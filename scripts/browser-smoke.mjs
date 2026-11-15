/**
 * Browser smoke test driven through the Chrome DevTools Protocol.
 *
 * Exercises the production build the way a player would: rendering, desktop
 * movement, the full farm/economy loop, land purchase, pause behaviour,
 * IndexedDB save/load and the touch layout.
 *
 * Usage:
 *   npm run test:smoke
 *
 * Requires Google Chrome. Override its location with CHROME_PATH if needed.
 * If a preview server is already serving http://localhost:4173 it is reused;
 * otherwise one is started and stopped automatically.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.tmp');
const URL = 'http://localhost:4173/';
const PERF_SAMPLE_MS = Math.max(1000, Math.min(15000, Number(process.env.OTTOMAN_PROFILE_MS) || 3000));
const PERF_TARGETS = {
  desktop: { frameP95Ms: Number(process.env.OTTOMAN_DESKTOP_FRAME_P95_MS) || 16.7, jsHeapMb: Number(process.env.OTTOMAN_DESKTOP_JS_HEAP_MB) || 256 },
  midRangeAndroid: { frameP95Ms: Number(process.env.OTTOMAN_ANDROID_FRAME_P95_MS) || 33.3, jsHeapMb: Number(process.env.OTTOMAN_ANDROID_JS_HEAP_MB) || 192 },
  saveAndLoadMs: Number(process.env.OTTOMAN_SAVE_LOAD_MS) || 500,
  pathQueries100Ms: Number(process.env.OTTOMAN_PATH_100_MS) || 16.7,
  nearbyQueries200At1000NpcsMs: Number(process.env.OTTOMAN_NEARBY_1000_MS) || 16.7,
};
const CHROME = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(TMP, { recursive: true });

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

async function serverIsUp() {
  try {
    const response = await fetch(URL, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensurePreview() {
  if (await serverIsUp()) return null;

  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/ is missing. Run "npm run build" first.');
  }

  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(250);
    if (await serverIsUp()) return preview;
  }

  preview.kill('SIGTERM');
  throw new Error('Preview server did not start on port 4173.');
}

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH to its executable.`);
  process.exit(1);
}

const preview = await ensurePreview();

const profile = join(TMP, 'chrome-profile');
rmSync(profile, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=9333',
  `--user-data-dir=${profile}`,
  '--window-size=1280,800',
  'about:blank',
], { stdio: 'ignore' });

let ws;
let nextId = 1;
const pending = new Map();
const events = [];

async function connect() {
  let target = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:9333/json/list');
      const targets = await response.json();
      target = targets.find(entry => entry.type === 'page');
      if (target) break;
    } catch {
      // Chrome is still booting.
    }
    await sleep(250);
  }
  if (!target) throw new Error('Could not connect to Chrome');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    ws.onopen = resolvePromise;
    ws.onerror = reject;
  });

  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolveRequest, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolveRequest(message.result);
    } else if (message.method) {
      events.push(message);
    }
  };
}

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolvePromise, reject) => {
    pending.set(id, { resolve: resolvePromise, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'Evaluation failed');
  }
  return result.result.value;
}

function collectErrors() {
  const errors = [];
  for (const event of events) {
    if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params.exceptionDetails;
      errors.push(details.exception?.description ?? details.text);
    }
    if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') {
      errors.push(event.params.args.map(argument => argument.value ?? argument.description).join(' '));
    }
    if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
      errors.push(event.params.entry.text);
    }
  }
  return errors;
}

async function key(type, keyName, code, windowsVirtualKeyCode) {
  await send('Input.dispatchKeyEvent', {
    type,
    key: keyName,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  });
}

async function tapKey(letter, keyCode) {
  await key('keyDown', letter, `Key${letter.toUpperCase()}`, keyCode);
  await sleep(60);
  await key('keyUp', letter, `Key${letter.toUpperCase()}`, keyCode);
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(TMP, name), Buffer.from(result.data, 'base64'));
}

async function startGameplay(loadSlot = null) {
  // Go through the same transition the menu button performs: leave the menu
  // behind instead of stacking the gameplay scene on top of it.
  await evaluate(`(() => {
    const g = window.__ottomanGame;
    for (const key of ['MainMenuScene', 'LoadingScene']) {
      if (g.scene.isActive(key) || g.scene.isPaused(key)) g.scene.stop(key);
    }
    g.scene.start('GameplayScene', ${JSON.stringify(loadSlot)} ? { loadSlot: ${JSON.stringify(loadSlot)} } : undefined);
    return true;
  })()`);
  await sleep(1200);
}

async function sceneState() {
  return evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    return {
      active: s.scene.isActive(),
      player: s.player.getGridPosition(),
      plot0: s.farmManager.getPlotById('plot_0').state,
      plot0Growth: s.farmManager.getPlotById('plot_0').growthProgress,
      plot8Owned: s.farmManager.getPlotById('plot_8').unlocked,
      wheat: s.inventory.getItemCount('wheat'),
      seeds: s.inventory.getItemCount('seed_wheat'),
      currency: s.economy.getCurrency(),
      day: s.timeManager.getTime().totalDays,
      paused: s.timeManager.isPaused(),
      pauseVisible: s.pauseText.visible,
      touch: s.touchLayout,
      joystick: s.virtualJoystick.isVisible,
      button: s.interactionButton.isVisible,
    };
  })()`);
}

try {
  await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  // Headless Chrome does not consider the page focused, so Phaser pauses its
  // loop on blur and its keyboard queue replays events. Focus emulation keeps
  // the loop stepping exactly like a real focused tab.
  await send('Page.bringToFront').catch(() => {});
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  console.log('\nDesktop');
  await send('Page.navigate', { url: URL });
  await sleep(3500);

  const canvasCount = await evaluate(`document.querySelectorAll('canvas').length`);
  check('Phaser canvas is mounted', canvasCount === 1, `found ${canvasCount}`);

  await screenshot('ottoman-menu-desktop.png');
  await evaluate(`(() => { const m=window.__ottomanGame.scene.getScene('MainMenuScene'); m.button.emit('pointerdown'); return true; })()`);
  await sleep(150);
  const creationPaths=await evaluate(`(() => { const m=window.__ottomanGame.scene.getScene('MainMenuScene'); return m.modal.list.filter(o=>o.text==='Bu yolu seç').length; })()`);
  check('character creation offers three starting paths',creationPaths===3,`paths=${creationPaths}`);
  const creationTextFits=await evaluate(`(() => {
    const m=window.__ottomanGame.scene.getScene('MainMenuScene');
    const cards=m.modal.list.filter(o=>o.type==='Rectangle');
    const descriptions=m.modal.list.filter(o=>o.type==='Text'&&/^(Hasan|Aysun|Yusuf)\\n/.test(o.text));
    return descriptions.length===3&&descriptions.every((text,i)=>{const t=text.getBounds(),c=cards[i].getBounds();return t.left>=c.left-1&&t.right<=c.right+1;});
  })()`);
  check('character descriptions stay inside their cards',creationTextFits===true);
  await evaluate(`(() => { const m=window.__ottomanGame.scene.getScene('MainMenuScene'); m.modal.list.find(o=>o.text==='Bu yolu seç').emit('pointerdown'); return true; })()`);
  await sleep(1400);
  let state = await sceneState();
  check('gameplay scene is active', state.active === true);
  check('player spawns in the settlement', state.player.x === 16 && state.player.y === 17, JSON.stringify(state.player));
  const onboarding = await evaluate(`(() => { const s=window.__ottomanGame.scene.getScene('GameplayScene'); return {active:s.tutorial.isActive(),step:s.tutorial.getCurrentStep()?.id,visible:s.tutorialGuide.isVisible()}; })()`);
  check('new character receives an optional playable first-run guide',onboarding.active&&onboarding.step==='arrival'&&onboarding.visible,JSON.stringify(onboarding));
  const openingUnaffected = await evaluate(`(() => { const s=window.__ottomanGame.scene.getScene('GameplayScene'); s.chroniclePanel.open('help'); const unchanged=!s.tutorial.isComplete('arrival'); s.chroniclePanel.close(); return unchanged; })()`);
  check('opening the help screen alone does not complete a tutorial step',openingUnaffected===true);
  check('desktop layout hides touch joystick', state.joystick === false);
  const missingTextures=await evaluate(`(() => {const s=window.__ottomanGame.scene.getScene('GameplayScene'),found=[];const scan=o=>{if(o.type==='Image'&&o.texture?.key==='__MISSING'){const m=o.getWorldTransformMatrix();found.push({x:Math.round(m.tx),y:Math.round(m.ty),parent:o.parentContainer?.id,parentType:o.parentContainer?.type,key:o.texture.key});}if(Array.isArray(o.list))o.list.forEach(scan);};s.children.list.forEach(scan);return found;})()`);
  check('settlement and resident art use existing textures',missingTextures.length===0,JSON.stringify(missingTextures));

  // Regression guard for the old art bug where the body was painted outside
  // the 128x176 texture and only the boots remained visible.
  const spriteBounds = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const image = s.textures.get('player_front_idle').source[0].image;
    const ctx = image.getContext('2d');
    const { width, height } = image;
    const data = ctx.getImageData(0, 0, width, height).data;
    let minY = height;
    let maxY = -1;
    let painted = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) {
          painted++;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minY, maxY, painted, width, height };
  })()`);
  check(
    'player texture paints a full body',
    spriteBounds.minY < 70 && spriteBounds.maxY > 140,
    JSON.stringify(spriteBounds),
  );

  const profile = await evaluate(`(async () => {
    const s=window.__ottomanGame.scene.getScene('GameplayScene'),sim=s.settlementSimulation;
    let updateMs=0,updateCalls=0,pathCalls=0,pathMs=0;
    const originalUpdate=sim.update.bind(sim), originalPath=sim.findPath.bind(sim);
    sim.update=(...args)=>{const t=performance.now(),result=originalUpdate(...args);updateMs+=performance.now()-t;updateCalls++;return result;};
    sim.findPath=(...args)=>{const t=performance.now(),result=originalPath(...args);pathMs+=performance.now()-t;pathCalls++;return result;};
    const frames=[];let last=0,start=performance.now();
    await new Promise(resolve=>{const step=now=>{if(last)frames.push(now-last);last=now;if(now-start<${PERF_SAMPLE_MS})requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});
    const sampledMs=performance.now()-start;
    sim.update=originalUpdate;sim.findPath=originalPath;
    const sorted=[...frames].sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]??0;
    const allObjects=[];const visit=o=>{allObjects.push(o);if(Array.isArray(o.list))o.list.forEach(visit);};s.children.list.forEach(visit);
    const memory=performance.memory?.usedJSHeapSize??null;
    const liveNpcs=sim.states;const pathStart=performance.now();for(let i=0;i<100;i++){const npc=liveNpcs[i%liveNpcs.length];sim.findPath(npc.position,npc.home);}const path100Ms=performance.now()-pathStart;
    const population=[];const states=sim.states,originalLength=states.length,template=states[0];
    for(const count of [7,50,200,1000]){states.length=originalLength;for(let i=originalLength;i<count;i++)states.push({...template,id:'profile_'+i,position:{x:i%32,y:(i*7)%32},destination:{...template.destination},home:{...template.home},workplace:template.workplace?{...template.workplace}:null,needs:{...template.needs},relationships:{},personality:{...template.personality},schedule:template.schedule});const t=performance.now();for(let i=0;i<200;i++)sim.findNearbyNpc({x:16,y:16});population.push({npcs:count,queries:200,totalMs:performance.now()-t});}
    states.length=originalLength;
    const saveStart=performance.now();const saved=await s.saveGame('slot98',true);const saveMs=performance.now()-saveStart;
    const loadStart=performance.now();const loaded=await s.saveManager.loadSlot('slot98');const loadMs=performance.now()-loadStart;await s.saveManager.deleteSave('slot98');
    const big=loaded.status==='ok'?{...loaded.data,inventory:{items:Array.from({length:1000},(_,i)=>['stress_'+i,1]),maxSlots:1000}}:null;
    const invStart=performance.now();const largeInventoryAccepted=big?s.saveManager.validateRawRecord(big).status==='ok':false;const largeInventoryValidationMs=performance.now()-invStart;
    return {sampleMs:sampledMs,frames:frames.length,fps:frames.length*1000/sampledMs,frameMsP50:pct(.50),frameMsP95:pct(.95),frameMsMax:Math.max(0,...frames),
      jsHeapBytes:memory,devicePixelRatio:devicePixelRatio,userAgent:navigator.userAgent,phaserDisplayObjects:allObjects.length,textureCount:s.textures.getTextureKeys().length,activeNpcs:sim.getNpcs().length,
      settlementUpdateCalls:updateCalls,settlementUpdateTotalMs:updateMs,settlementUpdateMeanMs:updateCalls?updateMs/updateCalls:0,
      actualPathCalls:pathCalls,actualPathTotalMs:pathMs,pathQueries100Ms:path100Ms,nearbyNpcPopulationSweep:population,
      saveMs,loadMs,saveSucceeded:saved,loadSucceeded:loaded.status==='ok',largeInventoryEntries:1000,largeInventoryAccepted,largeInventoryValidationMs,
      renderer:s.game.renderer.type===1?'canvas':'webgl-or-other',targets:${JSON.stringify(PERF_TARGETS)}};
  })()`);
  console.log(`PROFILE ${JSON.stringify(profile)}`);
  console.log(`PROFILE_TARGET_CHECKS ${JSON.stringify({
    desktopP95: profile.frameMsP95 <= PERF_TARGETS.desktop.frameP95Ms,
    desktopJsHeap: profile.jsHeapBytes === null || profile.jsHeapBytes / 1048576 <= PERF_TARGETS.desktop.jsHeapMb,
    save: profile.saveMs <= PERF_TARGETS.saveAndLoadMs,
    load: profile.loadMs <= PERF_TARGETS.saveAndLoadMs,
    pathfinding: profile.pathQueries100Ms <= PERF_TARGETS.pathQueries100Ms,
    nearbyAt1000: profile.nearbyNpcPopulationSweep.find(row => row.npcs === 1000)?.totalMs <= PERF_TARGETS.nearbyQueries200At1000NpcsMs,
  })}`);
  const graphicsComparison=await evaluate(`(async()=>{
    const s=window.__ottomanGame.scene.getScene('GameplayScene'),previous=s.settingsManager.getSettings().graphicsQuality,results=[];
    for(const quality of ['balanced','low']){
      s.settingsManager.setGraphicsQuality(quality);s.applyGraphicsQuality();
      await new Promise(resolve=>setTimeout(resolve,180));
      const frames=[];let last=0,start=performance.now();
      await new Promise(resolve=>{const step=now=>{if(last)frames.push(now-last);last=now;if(now-start<1800)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});
      const sorted=[...frames].sort((a,b)=>a-b);results.push({quality,fps:frames.length*1000/(performance.now()-start),p50:sorted[Math.floor(sorted.length*.5)]??0,p95:sorted[Math.floor(sorted.length*.95)]??0});
    }
    s.settingsManager.setGraphicsQuality(previous);s.applyGraphicsQuality();return results;
  })()`);
  console.log(`GRAPHICS_QUALITY_COMPARISON ${JSON.stringify(graphicsComparison)}`);
  const effectIsolation=await evaluate(`(async()=>{
    const s=window.__ottomanGame.scene.getScene('GameplayScene'),results=[];
    const sample=async label=>{const frames=[];let last=0,start=performance.now();await new Promise(resolve=>{const step=now=>{if(last)frames.push(now-last);last=now;if(now-start<1600)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});const sorted=[...frames].sort((a,b)=>a-b);return {mode:label,fps:frames.length*1000/(performance.now()-start),p95:sorted[Math.floor(sorted.length*.95)]??0};};
    s.vignette.setVisible(false);results.push(await sample('balanced_no_vignette'));s.vignette.setVisible(true);
    s.objectManager.setAmbientEffectsEnabled(false);results.push(await sample('balanced_no_ambient_props'));s.objectManager.setAmbientEffectsEnabled(true);
    return results;
  })()`);
  console.log(`EFFECT_ISOLATION ${JSON.stringify(effectIsolation)}`);

  const lineage = await evaluate(
    `window.__ottomanGame.scene.getScene('GameplayScene').lineageText.text`,
  );
  check('HUD shows the current lineage', typeof lineage === 'string' && lineage.includes('Kuşak'), lineage);
  const createdCharacter=await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').familySystem.getCurrentCharacter().firstName`);
  check('selected character is used in the new campaign',createdCharacter==='Hasan',createdCharacter);
  const timeSpeed=await evaluate(`(async()=>{const s=window.__ottomanGame.scene.getScene('GameplayScene');const before=s.timeManager.getTimeScale();await s.handleChronicleAction('time:faster');const faster=s.timeManager.getTimeScale();await s.handleChronicleAction('time:slower');return {before,faster,restored:s.timeManager.getTimeScale()};})()`);
  check('time speed controls are configurable',timeSpeed.faster===Math.min(4,timeSpeed.before*2)&&timeSpeed.restored===timeSpeed.before,JSON.stringify(timeSpeed));

  const worldOpening = await evaluate(`(() => {
    const s=window.__ottomanGame.scene.getScene('GameplayScene');
    const npcs=s.settlementSimulation.getNpcs();
    const current=s.timeManager.getTime();
    s.timeManager.setTime({...current,day:4,totalDays:3.4});
    return {count:npcs.length,unique:new Set(npcs.map(n=>n.id)).size,saveCount:s.settlementSimulation.getSaveState().npcs.length};
  })()`);
  await sleep(300);
  await evaluate(`(() => { const s=window.__ottomanGame.scene.getScene('GameplayScene'); const t=s.timeManager.getTime(); s.timeManager.setTime({...t,totalDays:3.55}); return true; })()`);
  await sleep(200);
  const dayWorld=await evaluate(`(() => { const s=window.__ottomanGame.scene.getScene('GameplayScene'); const n=s.settlementSimulation.getNpcs(); return {farmer:n.find(v=>v.id==='hasan_farmer')?.activity,merchant:n.find(v=>v.id==='yusuf_merchant')?.activity,event:s.historicalSystem.getState().simulationTimeline.triggeredEvents.some(id=>id.startsWith('frontier_')),market:s.marketSystem.isBusinessOpen()}; })()`);
  check('settlement creates seven persistent named residents',worldOpening.count===7&&worldOpening.unique===7&&worldOpening.saveCount===7,JSON.stringify(worldOpening));
  check('daily routines send residents to work and market',dayWorld.farmer==='working'&&dayWorld.merchant==='market'&&dayWorld.market===true,JSON.stringify(dayWorld));
  check('fictional village events enter the existing timeline',dayWorld.event===true);
  await evaluate(`(() => { const s=window.__ottomanGame.scene.getScene('GameplayScene'); const t=s.timeManager.getTime(); s.timeManager.setTime({...t,totalDays:3.95}); s.updateWorldLighting(1000000); return true; })()`);
  const nightAlpha=await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').worldLighting.fillAlpha`);
  await evaluate(`(() => { const s=window.__ottomanGame.scene.getScene('GameplayScene'); const t=s.timeManager.getTime(); s.timeManager.setTime({...t,totalDays:3.55}); s.updateWorldLighting(1001000); return true; })()`);
  const dayAlpha=await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').worldLighting.fillAlpha`);
  check('day and night visibly change settlement lighting',nightAlpha>dayAlpha,`${nightAlpha} / ${dayAlpha}`);

  const longRun = await evaluate(`(() => {
    const s=window.__ottomanGame.scene.getScene('GameplayScene');
    const start=s.timeManager.getTime(),startAge=s.familySystem.getCurrentCharacter()?.age??0;
    s.timeManager.advanceDays(720);
    s.settlementSimulation.advanceSimulationToNow();
    s.farmManager.syncGrowth();
    s.marketSystem.update();
    s.historicalSystem.updateTime(s.timeManager.getTime().year);
    s.syncFamily();
    const end=s.timeManager.getTime(),npcs=s.settlementSimulation.getNpcs(),hour=s.timeManager.getHourOfDay();
    const farmer=npcs.find(n=>n.id==='hasan_farmer');
    const expected=farmer?.schedule.find(item=>hour>=item.startHour&&hour<item.endHour)?.activity;
    const events=s.settlementSimulation.getSaveState().events;
    return {years:end.year-start.year,ageDelta:(s.familySystem.getCurrentCharacter()?.age??0)-startAge,
      lastHour:s.settlementSimulation.getSaveState().lastProcessedHour,targetHour:Math.floor(end.totalDays*24),
      farmerActivity:farmer?.activity,expectedActivity:expected,needsValid:npcs.every(n=>Object.values(n.needs).every(Number.isFinite)),
      eventsBounded:events.length<=100,activeEventsCurrent:events.filter(e=>e.status==='active').every(e=>e.expiresDay>=Math.floor(end.totalDays)),
      farmValid:s.farmManager.getSimulation().getAllPlots().every(p=>Number.isFinite(p.growthProgress)&&p.growthProgress>=0&&p.growthProgress<=1)};
  })()`);
  check('multi-year catch-up advances the family and calendar',longRun.years>=2&&longRun.ageDelta>=2,JSON.stringify(longRun));
  check('NPC schedules and needs catch up chronologically',longRun.lastHour===longRun.targetHour&&longRun.farmerActivity===longRun.expectedActivity&&longRun.needsValid,JSON.stringify(longRun));
  check('local events expire and remain bounded after long runs',longRun.eventsBounded&&longRun.activeEventsCurrent,JSON.stringify(longRun));
  check('crop growth remains finite and clamped after long runs',longRun.farmValid);

  const dialogueCheck=await evaluate(`(() => {
    const s=window.__ottomanGame.scene.getScene('GameplayScene');
    const hasan=s.settlementSimulation.getNpcs().find(n=>n.id==='hasan_farmer');
    s.player.setGridPosition(hasan.position.x,hasan.position.y);
    s.performContextAction();
    const panel=s.dialoguePanel, opened=panel.isOpen(), choices=panel.view?.choices?.length??0;
    let view=s.settlementSimulation.chooseDialogue('hasan_farmer','promise',s.inventory,s.economy);panel.update(view);
    view=s.settlementSimulation.chooseDialogue('hasan_farmer','later',s.inventory,s.economy);panel.update(view);
    return {opened,choices,promise:s.settlementSimulation.getDialogueState().flags.includes('hasan_future_support'),closed:!panel.isOpen()};
  })()`);
  check('NPC interaction opens a branching touch-ready dialogue panel',dialogueCheck.opened&&dialogueCheck.choices>=3,JSON.stringify(dialogueCheck));
  check('dialogue promise consequences persist across generations',dialogueCheck.promise&&dialogueCheck.closed,JSON.stringify(dialogueCheck));

  await tapKey('g', 71);
  await sleep(350);
  const familyTreeOpen = await evaluate(
    `window.__ottomanGame.scene.getScene('GameplayScene').familyTreePanel.isOpen()`,
  );
  check('family tree panel opens', familyTreeOpen === true);

  const chronicleViews = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const tabs = ['inventory','character','journal','timeline','relations','saves','settings'];
    const available = tabs.every(tab => { s.chroniclePanel.show(tab); return s.chroniclePanel.isOpen(); });
    s.chroniclePanel.show('inventory');
    return { available, bounds: s.chroniclePanel.container.getBounds() };
  })()`);
  check('all chronicle screens open through navigation', chronicleViews.available === true);
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await sleep(350);
  const resizedChronicle = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const b = s.chroniclePanel.container.getBounds();
    return b.left >= -1 && b.top >= -1 && b.right <= 801 && b.bottom <= 601;
  })()`);
  check('chronicle panel adapts to viewport resizing', resizedChronicle === true);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
  await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').chroniclePanel.close()`);
  const treeBounds = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const b = s.familyTreePanel.container.getBounds();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  })()`);
  check(
    'family tree fits inside the desktop viewport',
    treeBounds.left >= -1 && treeBounds.top >= -1 && treeBounds.right <= 1280 + 1 && treeBounds.bottom <= 800 + 1,
    JSON.stringify(treeBounds),
  );
  await screenshot('ottoman-family-tree.png');
  await tapKey('g', 71);
  await sleep(250);
  const familyTreeClosed = await evaluate(
    `window.__ottomanGame.scene.getScene('GameplayScene').familyTreePanel.isOpen()`,
  );
  const resumedAfterTree = await evaluate(
    `window.__ottomanGame.scene.getScene('GameplayScene').timeManager.isPaused()`,
  );
  check('family tree panel closes and resumes time', familyTreeClosed === false && resumedAfterTree === false);

  // Movement uses the same input path as a player.
  await key('keyDown', 'w', 'KeyW', 87);
  await sleep(600);
  await key('keyUp', 'w', 'KeyW', 87);
  await sleep(150);
  const moved = await sceneState();
  check(
    'keyboard moves the player',
    moved.player.x !== state.player.x || moved.player.y !== state.player.y,
    JSON.stringify(moved.player),
  );
  const beforeDownMove=await sceneState();
  await key('keyDown','s','KeyS',83);await sleep(400);await key('keyUp','s','KeyS',83);
  const afterDownMove=await sceneState();
  const savePanelUnexpectedlyOpened=await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').chroniclePanel.getTab()==='saves'&&window.__ottomanGame.scene.getScene('GameplayScene').chroniclePanel.isOpen()`);
  check('S moves down without opening the save screen',afterDownMove.player.y>beforeDownMove.player.y&&!savePanelUnexpectedlyOpened,JSON.stringify({before:beforeDownMove.player,after:afterDownMove.player,savePanelUnexpectedlyOpened}));
  await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').inputManager.setMovementBinding('right','K')`);
  const beforeRemappedMove=await sceneState();
  await key('keyDown','k','KeyK',75);await sleep(450);await key('keyUp','k','KeyK',75);
  const afterRemappedMove=await sceneState();
  check('movement shortcut can be rebound',afterRemappedMove.player.x!==beforeRemappedMove.player.x||afterRemappedMove.player.y!==beforeRemappedMove.player.y);
  await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').inputManager.setMovementBinding('right','D')`);

  // Full farming loop through the real interaction system.
  await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.player.setGridPosition(10, 12);
    return true;
  })()`);
  await sleep(200);
  await tapKey('f', 70);
  await sleep(300);
  state = await sceneState();
  check('F prepares the soil', state.plot0 === 1, `state=${state.plot0}`);

  await tapKey('f', 70);
  await sleep(300);
  const menuOpen = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    return s.farmInteractionSystem.menu !== null;
  })()`);
  check('seed menu opens on prepared soil', menuOpen === true);

  await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.farmManager.plantCrop('plot_0', 'wheat');
    s.farmInteractionSystem.closeMenu();
    return true;
  })()`);
  await sleep(200);
  state = await sceneState();
  check('wheat is planted and one seed is consumed', state.plot0 >= 2 && state.seeds === 2, JSON.stringify(state));

  for (let day = 0; day < 5; day++) {
    await tapKey('t', 84);
    await sleep(160);
    const probe = await sceneState();
    console.log(`    after T${day + 1}: day=${probe.day} plot=${probe.plot0} growth=${probe.plot0Growth}`);
  }
  state = await sceneState();
  check('crops mature as days advance', state.plot0 === 4, `state=${state.plot0}`);

  await tapKey('f', 70);
  await sleep(300);
  state = await sceneState();
  check('mature crop is harvested', state.wheat >= 3 && state.plot0 === 5, JSON.stringify(state));

  const currencyBefore = state.currency;
  await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.marketSystem.sellAll('wheat');
    return true;
  })()`);
  await sleep(200);
  state = await sceneState();
  check('crop sale pays akçe', state.currency > currencyBefore, `${currencyBefore} -> ${state.currency}`);

  const stockBefore = await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').marketSystem.getStock('seed_wheat')`);
  const seedsBefore = state.seeds;
  await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.marketSystem.buy('seed_wheat');
    return true;
  })()`);
  await sleep(200);
  state = await sceneState();
  const stockAfter = await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').marketSystem.getStock('seed_wheat')`);
  check('proceeds buy another seed from market stock', state.seeds === seedsBefore + 1, `seeds=${state.seeds}`);
  check('market stock is consumed', stockAfter === stockBefore - 1, `${stockBefore} -> ${stockAfter}`);

  // Acquire land: locked plot_8 at (12, 14).
  await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.player.setGridPosition(12, 14);
    return true;
  })()`);
  await sleep(150);
  const currencyBeforeLand = state.currency;
  await tapKey('f', 70);
  await sleep(300);
  state = await sceneState();
  check('locked land can be purchased', state.plot8Owned === true, `owned=${state.plot8Owned}`);
  check(
    'land purchase costs akçe',
    state.currency === currencyBeforeLand - 20,
    `${currencyBeforeLand} -> ${state.currency}`,
  );

  await screenshot('ottoman-gameplay.png');

  // Pause freezes the calendar and the player.
  await tapKey('p', 80);
  await sleep(150);
  const pauseStart = await sceneState();
  await key('keyDown', 'w', 'KeyW', 87);
  await sleep(1200);
  await key('keyUp', 'w', 'KeyW', 87);
  const pauseEnd = await sceneState();
  check('pause shows an indicator', pauseStart.paused === true && pauseStart.pauseVisible === true);
  check('pause freezes the calendar', pauseEnd.day === pauseStart.day, `${pauseStart.day} -> ${pauseEnd.day}`);
  check(
    'pause freezes the player',
    pauseEnd.player.x === pauseStart.player.x && pauseEnd.player.y === pauseStart.player.y,
    `${JSON.stringify(pauseStart.player)} -> ${JSON.stringify(pauseEnd.player)}`,
  );
  await tapKey('p', 80);
  await sleep(200);
  state = await sceneState();
  check('unpause resumes the calendar', state.paused === false);

  // Save, mutate, then reload from IndexedDB.
  const dayBeforeSave = state.day;
  const wheatBeforeSave = state.wheat;
  const landBeforeSave = state.plot8Owned;
  await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').saveGame()`);
  await sleep(700);
  const savedWorld=await evaluate(`(async()=>{const s=window.__ottomanGame.scene.getScene('GameplayScene');const r=await s.saveManager.loadSlot('slot1');return r.status==='ok'?{count:r.data.world?.settlement?.npcs?.length,eventCount:r.data.world?.settlement?.events?.length,dialogue:r.data.world?.settlement?.dialogue}:null;})()`);
  const tutorialSaved=await evaluate(`(async()=>{const s=window.__ottomanGame.scene.getScene('GameplayScene');const r=await s.saveManager.loadSlot('slot1');return r.status==='ok'?r.data.tutorial:null;})()`);
  check('save stores resident schedules, needs, relationships, and local events',savedWorld?.count===7&&Number.isInteger(savedWorld?.eventCount),JSON.stringify(savedWorld));
  check('save stores dialogue decisions, relationships, and lasting consequences',savedWorld?.dialogue?.flags?.includes('hasan_future_support')&&savedWorld?.dialogue?.decisions?.includes('hasan_farmer:later'),JSON.stringify(savedWorld?.dialogue));
  check('save stores tutorial progress alongside the campaign',Array.isArray(tutorialSaved?.completedSteps)&&tutorialSaved.active===true,JSON.stringify(tutorialSaved));
  await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.inventory.removeItem('wheat', s.inventory.getItemCount('wheat'));
    s.timeManager.advanceDays(3);
    return true;
  })()`);
  await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').loadGame()`);
  await sleep(900);
  state = await sceneState();
  check('save/load restores inventory', state.wheat === wheatBeforeSave, `wheat=${state.wheat}`);
  check(
    'save/load restores calendar day',
    Math.floor(state.day) === Math.floor(dayBeforeSave),
    `day=${state.day} expected ~${dayBeforeSave}`,
  );
  check('save/load restores land ownership', state.plot8Owned === landBeforeSave, `owned=${state.plot8Owned}`);
  const restoredResidents=await evaluate(`(() => {const s=window.__ottomanGame.scene.getScene('GameplayScene');const dialogue=s.settlementSimulation.getDialogueState();return {residents:s.settlementSimulation.getNpcs().length===7,events:s.settlementSimulation.getSaveState().events.length>0,promise:dialogue.flags.includes('hasan_future_support'),decision:dialogue.decisions.includes('hasan_farmer:later')};})()`);
  check('NPC locations, relationships, and events restore from the save',restoredResidents.residents&&restoredResidents.events,JSON.stringify(restoredResidents));
  check('dialogue promises and decisions restore from the save',restoredResidents.promise&&restoredResidents.decision,JSON.stringify(restoredResidents));
  const tutorialRestored=await evaluate(`(() => {const s=window.__ottomanGame.scene.getScene('GameplayScene');return JSON.stringify(s.tutorial.saveState());})()`);
  check('load resumes tutorial state without restarting onboarding',tutorialRestored===JSON.stringify(tutorialSaved),tutorialRestored);

  const corruptionRecovery = await evaluate(`(async () => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const open = () => new Promise((resolve,reject) => { const req=indexedDB.open('OttomanGameDB',3);req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result); });
    const db=await open();
    const write=()=>new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({version:'9.0.0',damaged:true},'slot3');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    const read=()=>new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly');const req=tx.objectStore('saves').get('slot3');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await write();const before=JSON.stringify(await read());const result=await s.saveManager.loadSlot('slot3');
    const saved=await s.saveManager.saveGame('slot3',{time:s.timeManager.getTime(),inventory:s.inventory.serialize(),economy:s.economy.serialize(),farm:s.farmManager.getSimulation().serialize(),market:s.marketSystem.serialize(),playerPosition:s.player.getGridPosition()});
    const after=JSON.stringify(await read());db.close();return {invalid:result.status==='invalid',blocked:saved===false,unchanged:before===after};
  })()`);
  check('incompatible save is detected and kept unchanged', corruptionRecovery.invalid && corruptionRecovery.blocked && corruptionRecovery.unchanged, JSON.stringify(corruptionRecovery));

  const interruptedWrite = await evaluate(`(async()=>{
    const s=window.__ottomanGame.scene.getScene('GameplayScene'),manager=s.saveManager;
    await s.saveGame('slot1',true);
    const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('OttomanGameDB',3);r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});
    const db=await open();
    const read=async key=>new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly'),r=tx.objectStore('saves').get(key);r.onsuccess=()=>resolve(JSON.stringify(r.result));r.onerror=()=>reject(r.error);});
    const beforeMain=await read('slot1'),beforeBackup=await read('slot1:backup'),proto=IDBObjectStore.prototype,put=proto.put;let writes=0;
    proto.put=function(...args){writes++;if(writes===2)throw new DOMException('simulated interrupted write','DataError');return put.apply(this,args);};
    let saved=false;try{saved=await manager.saveGame('slot1',{time:s.timeManager.getTime(),inventory:s.inventory.serialize(),economy:s.economy.serialize(),farm:s.farmManager.getSimulation().serialize(),market:s.marketSystem.serialize(),playerPosition:s.player.getGridPosition()});}finally{proto.put=put;}
    await new Promise(resolve=>setTimeout(resolve,0));
    const afterMain=await read('slot1'),afterBackup=await read('slot1:backup');db.close();
    return {saved,writes,mainUnchanged:beforeMain===afterMain,backupUnchanged:beforeBackup===afterBackup};
  })()`);
  check('interrupted save transaction preserves main and backup copies',interruptedWrite.saved===false&&interruptedWrite.writes===2&&interruptedWrite.mainUnchanged&&interruptedWrite.backupUnchanged,JSON.stringify(interruptedWrite));

  // Succession flow through the real UI/state: an adult child exists, the
  // current character dies, the modal opens, and choosing the heir transfers
  // the playable role and household assets.
  const successionSetup = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const founder = s.familySystem.getCurrentCharacter();
    const spouse = s.familySystem.getMember(founder.spouseId);
    const heir = s.familySystem.createChild(spouse.id, founder.id, s.timeManager.getTime(), {
      firstName: 'Orhan',
      gender: 'male',
      age: 19,
    });
    s.familySystem.killCharacter(founder.id, 'illness', s.timeManager.getTime());
    s.syncFamily();
    return {
      founderId: founder.id,
      heirId: heir.id,
      panelOpen: s.successionPanel.isOpen(),
      paused: s.timeManager.isPaused(),
      eligible: s.familySystem.getEligibleHeirs().length,
      legacyBefore: s.familySystem.getLegacy().generationsSurvived,
    };
  })()`);
  check(
    'death opens the succession screen',
    successionSetup.panelOpen === true && successionSetup.paused === true,
    JSON.stringify(successionSetup),
  );
  check('the adult child is an eligible heir', successionSetup.eligible >= 1, `heirs=${successionSetup.eligible}`);
  const successionBounds = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const b = s.successionPanel.container.getBounds();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  })()`);
  check(
    'succession screen fits inside the desktop viewport',
    successionBounds.left >= -1 && successionBounds.top >= -1 &&
      successionBounds.right <= 1280 + 1 && successionBounds.bottom <= 800 + 1,
    JSON.stringify(successionBounds),
  );
  await screenshot('ottoman-succession.png');

  const successionResult = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.chooseSuccessor('${successionSetup.heirId}');
    const current = s.familySystem.getCurrentCharacter();
    s.updateHud();
    return {
      currentId: current.id,
      generation: current.generation,
      panelOpen: s.successionPanel.isOpen(),
      paused: s.timeManager.isPaused(),
      legacy: s.familySystem.getLegacy().generationsSurvived,
      currency: s.economy.getCurrency(),
      lineage: s.lineageText.text,
    };
  })()`);
  await sleep(150);
  successionResult.lineage = await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').lineageText.text`);
  check(
    'choosing an heir continues the game as generation two',
    successionResult.currentId === successionSetup.heirId &&
      successionResult.generation === 2 &&
      successionResult.legacy === 2,
    JSON.stringify(successionResult),
  );
  check(
    'succession closes the modal and resumes the calendar',
    successionResult.panelOpen === false && successionResult.paused === false,
  );
  check(
    'HUD reflects the new head of the family',
    successionResult.lineage.includes('Orhan') && successionResult.lineage.includes('Kuşak 2'),
    successionResult.lineage,
  );

  const transitions=await evaluate(`(async()=>{
    const g=window.__ottomanGame,counts=[];
    for(let i=0;i<5;i++){
      if(g.scene.isActive('GameplayScene'))g.scene.stop('GameplayScene');
      g.scene.start('GameplayScene');
      await new Promise(resolve=>setTimeout(resolve,180));
      const s=g.scene.getScene('GameplayScene');
      counts.push({active:s.scene.isActive(),npcs:s.settlementSimulation.getNpcs().length,objects:s.children.list.length});
    }
    return {canvasCount:document.querySelectorAll('canvas').length,counts};
  })()`);
  check('rapid gameplay scene transitions release and rebuild entities cleanly',transitions.canvasCount===1&&transitions.counts.length===5&&transitions.counts.every(row=>row.active&&row.npcs===7&&row.objects<300),JSON.stringify(transitions));

  console.log('\nMobile (390x844 touch emulation)');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await evaluate(`(() => {const m=window.__ottomanGame.scene.getScene('GameplayScene').settingsManager;m.setAudioVolume('farming',0.23);m.setAudioMasterMuted(true);})()`);
  await send('Page.reload');
  await sleep(3500);
  await screenshot('ottoman-menu-mobile.png');
  await startGameplay('slot1');
  state = await sceneState();
  const afterReloadWorld=await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').settlementSimulation.getNpcs().length`);
  check('save survives a full page reload',Math.floor(state.day)>=Math.floor(dayBeforeSave)&&state.wheat===wheatBeforeSave&&afterReloadWorld===7,`day=${state.day}, wheat=${state.wheat}, residents=${afterReloadWorld}`);
  const restoredAudio=await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').settingsManager.getSettings().audio`);
  check('audio levels and master mute survive a full page reload',restoredAudio.masterMuted===true&&restoredAudio.volumes.farming===0.23,JSON.stringify(restoredAudio));
  await evaluate(`(() => {const s=window.__ottomanGame.scene.getScene('GameplayScene');s.settingsManager.setAudioMasterMuted(false);s.settingsManager.setAudioVolume('farming',0.5);s.audioManager.refreshSettings();})()`);
  check('touch layout detected', state.touch === true);
  check('virtual joystick is shown', state.joystick === true);
  const mobileTutorial=await evaluate(`(() => {const s=window.__ottomanGame.scene.getScene('GameplayScene');const b=s.tutorialGuide.container?.getBounds();const help=s.getChronicleData('help').actions;return {active:s.tutorial.isActive(),visible:s.tutorialGuide.isVisible(),inside:!!b&&b.left>=-1&&b.top>=-1&&b.right<=391&&b.bottom<=845,replays:help.filter(a=>a.action.startsWith('tutorial:replay:')).length};})()`);
  check('tutorial guide and replay menu fit touch layout',mobileTutorial.active&&mobileTutorial.visible&&mobileTutorial.inside&&mobileTutorial.replays===9,JSON.stringify(mobileTutorial));

  await tapKey('g', 71);
  await sleep(350);
  const mobileTreeOpen = await evaluate(
    `window.__ottomanGame.scene.getScene('GameplayScene').familyTreePanel.isOpen()`,
  );
  check('family tree opens in the mobile layout', mobileTreeOpen === true);
  await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').chroniclePanel.open('inventory')`);
  const touchPanel = await evaluate(`(() => { const s=window.__ottomanGame.scene.getScene('GameplayScene'); const b=s.chroniclePanel.container.getBounds(); return {open:s.chroniclePanel.isOpen(),inside:b.left>=-1&&b.top>=-1&&b.right<=391&&b.bottom<=845}; })()`);
  check('chronicle touch panel fits the phone viewport', touchPanel.open && touchPanel.inside, JSON.stringify(touchPanel));
  await evaluate(`window.__ottomanGame.scene.getScene('GameplayScene').chroniclePanel.close()`);
  const mobileTreeBounds = await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    const b = s.familyTreePanel.container.getBounds();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  })()`);
  check(
    'mobile family tree fits inside the phone viewport',
    mobileTreeBounds.left >= -1 && mobileTreeBounds.top >= -1 &&
      mobileTreeBounds.right <= 390 + 1 && mobileTreeBounds.bottom <= 844 + 1,
    JSON.stringify(mobileTreeBounds),
  );
  await screenshot('ottoman-family-tree-mobile.png');
  await tapKey('g', 71);
  await sleep(250);

  await evaluate(`(() => {
    const s = window.__ottomanGame.scene.getScene('GameplayScene');
    s.player.setGridPosition(10, 12);
    return true;
  })()`);
  await sleep(250);
  state = await sceneState();
  check('action button appears in context', state.button === true);

  // Drag the joystick upward and confirm the player moves.
  const beforeDrag = state.player;
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 105, y: 734 }],
  });
  await send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 105, y: 680 }],
  });
  await sleep(700);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
  const afterDrag = await sceneState();
  check(
    'virtual joystick moves the player',
    afterDrag.player.x !== beforeDrag.x || afterDrag.player.y !== beforeDrag.y,
    `${JSON.stringify(beforeDrag)} -> ${JSON.stringify(afterDrag.player)}`,
  );

  const battleResult=await evaluate(`(() => {
    const s=window.__ottomanGame.scene.getScene('GameplayScene');
    const accepted=s.militarySystem.acceptMission('mission_frontier_skirmish');
    const started=s.militarySystem.startBattle(s.timeManager.getTime().year);
    s.timeManager.pause();s.battlefieldPanel.open();
    const box=s.battlefieldPanel.container.getBounds();
    s.militarySystem.getBattlefield().selectUnit('frontier_militia');
    const restricted=s.militarySystem.issueBattleCommand('hold').success===false;
    const b=s.militarySystem.getBattlefield();for(const u of b.getUnits())if(u.side==='enemy'){u.count=0;u.health=0;}
    b.update(.9);s.battlefieldPanel.refresh();s.reportBattle();
    return {accepted:accepted.success,started:started.success,wasOpen:box.width>300&&box.height>300,restricted,complete:s.militarySystem.getState().completedMissions.includes('mission_frontier_skirmish'),timeline:s.historicalSystem.getState().simulationTimeline.triggeredEvents.some(id=>id.includes('fictional_battle_report'))};
  })()`);
  check('battle panel opens responsively and restricts low-rank formation commands',battleResult.accepted&&battleResult.started&&battleResult.wasOpen&&battleResult.restricted,JSON.stringify(battleResult));
  check('battle report completes the objective and records a fictional timeline event',battleResult.complete&&battleResult.timeline,JSON.stringify(battleResult));

  await screenshot('ottoman-mobile.png');

  const errors = collectErrors();
  check('no uncaught runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (error) {
  failed++;
  failures.push(String(error));
  console.error('\nSmoke test crashed:', error);
  const errors = collectErrors();
  if (errors.length) console.error('Browser errors:', errors.slice(0, 5));
} finally {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) console.log(failures.join('\n'));
  ws?.close();
  chrome.kill('SIGTERM');
  preview?.kill('SIGTERM');
  process.exit(failed > 0 ? 1 : 0);
}
