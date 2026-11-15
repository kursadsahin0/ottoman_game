import { Scene } from 'phaser';
import { IsometricUtils } from '@utils/IsometricUtils';
import { InputManager } from '@systems/InputManager';
import { Player } from '@entities/Player';
import { GameSettingsManager, ISOMETRIC_CONFIG, type AudioBus } from '@core/GameConfig';
import { WorldGenerator } from '@data/WorldData';
import { TileMap } from '@systems/TileMap';
import { WorldObjectManager } from '@systems/WorldObjectManager';
import { InteractionSystem } from '@systems/InteractionSystem';
import { VirtualJoystick, InteractionButton } from '@systems/VirtualJoystick';
import { TimeManager, Season, DEFAULT_CALENDAR, type GameTime } from '@systems/TimeManager';
import { Inventory } from '@systems/Inventory';
import { Economy } from '@systems/Economy';
import { ProfessionSystem } from '@systems/ProfessionSystem';
import { PROFESSION_DEFINITIONS, type ProfessionId } from '@data/ProfessionData';
import { FarmManager } from '@systems/FarmManager';
import { FarmSimulation } from '@systems/FarmSimulation';
import { FarmInteractionSystem } from '@systems/FarmInteractionSystem';
import { MarketSystem } from '@systems/MarketSystem';
import { SaveManager } from '@systems/SaveManager';
import type { CharacterVisuals } from '@data/CharacterCustomization';
import { DEFAULT_CHARACTER_VISUALS, visualsForAge } from '@data/CharacterCustomization';
import { STARTING_PATHS, type StartingPath } from '@data/StartingPaths';
import { FamilySystem, type FamilyAssetBridge } from '@systems/FamilySystem';
import { FamilyTreePanel } from '@/ui/FamilyTreePanel';
import { SuccessionPanel } from '@/ui/SuccessionPanel';
import type { FamilyEvent } from '@data/FamilyData';
import { DEPTH } from '@utils/Depth';
import { createUiCamera, registerUi, registerWorld } from '@utils/CameraLayers';
import { HistoricalEventSystem } from '@systems/HistoricalEventSystem';
import { HISTORICAL_LOCATIONS, HISTORICAL_SOURCES } from '@data/HistoricalContent';
import type { EventConsequence } from '@data/HistoricalData';
import { PoliticalSystem, type PoliticalAction } from '@systems/PoliticalSystem';
import { PoliticalPanel } from '@/ui/PoliticalPanel';
import { ChroniclePanel, type ChronicleTab } from '@/ui/ChroniclePanel';
import { MilitarySystem } from '@systems/MilitarySystem';
import { WeaponType, ArmorType } from '@data/CombatData';
import { platformAdapter } from '@/platform/PlatformAdapter';
import { SettlementSimulation } from '@systems/SettlementSimulation';
import { DialoguePanel } from '@/ui/DialoguePanel';
import { BattlefieldPanel } from '@/ui/BattlefieldPanel';
import { RegionalWorldSystem } from '@systems/RegionalWorldSystem';
import { REGIONAL_LOCATIONS } from '@data/RegionalWorldData';
import { CropType, FarmPlotState, CROP_DEFINITIONS } from '@data/CropData';
import { QuestSystem, type QuestContext } from '@systems/QuestSystem';
import { AUTHORED_QUESTS } from '@data/QuestData';
import { HISTORICAL_EVENTS } from '@data/HistoricalData';
import { ITEM_DEFINITIONS } from '@data/EconomyData';
import { TutorialSystem, TUTORIAL_STEPS } from '@systems/TutorialSystem';
import { TutorialGuide } from '@/ui/TutorialGuide';
import { AudioManager } from '@systems/AudioManager';
import { ATMOSPHERE_PARTICLE_BUDGET, ATMOSPHERE_PRESETS } from '@data/AtmosphereData';

const SAVE_SLOT = 'slot1';

export class GameplayScene extends Scene {
  private inputManager!: InputManager;
  private player!: Player;
  private settingsManager!: GameSettingsManager;
  private fpsText!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private lineageText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private tileMap!: TileMap;
  private objectManager!: WorldObjectManager;
  private interactionSystem!: InteractionSystem;
  private virtualJoystick!: VirtualJoystick;
  private interactionButton!: InteractionButton;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private timeManager!: TimeManager;
  private inventory!: Inventory;
  private economy!: Economy;
  private farmManager!: FarmManager;
  private farmInteractionSystem!: FarmInteractionSystem;
  private marketSystem!: MarketSystem;
  private regionalWorld!: RegionalWorldSystem;
  private questSystem!: QuestSystem;
  private lastQuestDay=-1;
  private lastPoliticalDay=-1;
  private lastQuestGeneration=1;
  private regionalTradeItem='wheat';
  private regionalPage=0;
  private regionalPageCount=1;
  private regionalTravelMethod:'foot'|'pack_animal'='foot';
  private settlementSimulation!: SettlementSimulation;
  private saveManager!: SaveManager;
  private familySystem!: FamilySystem;
  private professionSystem!: ProfessionSystem;
  private politicalSystem!: PoliticalSystem;
  private historicalSystem!: HistoricalEventSystem;
  private politicalPanel!: PoliticalPanel;
  private chroniclePanel!: ChroniclePanel;
  private dialoguePanel!: DialoguePanel;
  private battlefieldPanel!: BattlefieldPanel;
  private lastBattlePanelTick = -1;
  private lastBattleSaveTick = 0;
  private nextHudRefreshAt = 0;
  private militarySystem!: MilitarySystem;
  private familyTreePanel!: FamilyTreePanel;
  private successionPanel!: SuccessionPanel;
  private saveButton!: Phaser.GameObjects.Text;
  private loadButton!: Phaser.GameObjects.Text;
  private dayButton!: Phaser.GameObjects.Text;
  private yearButton!: Phaser.GameObjects.Text;
  private familyButton!: Phaser.GameObjects.Text;
  private chronicleButton!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;
  private hudButtonBackgrounds = new Map<Phaser.GameObjects.Text, Phaser.GameObjects.Graphics>();
  private hudButtonWidth = 160;
  private hudButtonHeight = 32;
  private knownSaveSlots:string[]=['slot1','slot2','slot3'];
  private achievements:string[]=[];
  private visibilityHandler: (() => void) | null = null;
  private touchLayout = false;
  private manualPaused = false;
  private uiDepth = 400;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private sunbeam: Phaser.GameObjects.Image | null = null;
  private vignette: Phaser.GameObjects.Image | null = null;
  private hudPanel: Phaser.GameObjects.Image | null = null;
  private coinIcon: Phaser.GameObjects.Image | null = null;
  private characterAppearance: string | undefined;
  private worldLighting: Phaser.GameObjects.Rectangle | null = null;
  private worldLightingKey = '';
  private worldLightingLastUpdate = 0;
  private worldLightingColor = 0x182234;
  private worldLightingAlpha = 0;
  private worldLightingTargetColor = 0x182234;
  private worldLightingTargetAlpha = 0;
  private zoomTween: Phaser.Tweens.Tween | null = null;
  private weatherParticles: Phaser.GameObjects.Graphics | null = null;
  private weatherParticlesLastUpdate = 0;
  private tutorial!: TutorialSystem;
  private tutorialGuide!: TutorialGuide;
  private tutorialStartPosition: { x: number; y: number } | null = null;
  private familyTreeViewed = false;
  private tutorialGuideHiddenForFamily = false;
  private tutorialGrowthPlotId: string | null = null;
  private tutorialGrowthReplayBaselineDay: number | null = null;
  private audioManager!: AudioManager;
  private nextAudioRefreshAt = 0;

  constructor() {
    super({ key: 'GameplayScene' });
  }

  create(data?: { loadSlot?: string; tutorialStart?: boolean; newCharacter?: { firstName:string; gender:'male'|'female'; archetype:string; visuals?: CharacterVisuals } }): void {
    this.nextHudRefreshAt = 0;
    const startingPath = data?.newCharacter && data.newCharacter.archetype in STARTING_PATHS
      ? STARTING_PATHS[data.newCharacter.archetype as StartingPath]
      : undefined;
    this.characterAppearance = startingPath ? data?.newCharacter?.archetype : undefined;
    this.settingsManager = GameSettingsManager.getInstance();
    this.audioManager = AudioManager.getInstance();
    this.nextAudioRefreshAt = 0;
    this.inputManager = new InputManager(this);
    this.inputManager.initialize();
    this.timeManager = TimeManager.getInstance();
    this.inventory = new Inventory(startingPath?.items);
    this.economy = new Economy(this.inventory, startingPath?.currency);
    this.politicalSystem = new PoliticalSystem();
    this.historicalSystem = new HistoricalEventSystem();
    this.militarySystem = new MilitarySystem();
    this.saveManager = SaveManager.getInstance();
    this.tutorial = new TutorialSystem(undefined, data?.tutorialStart === true);
    this.regionalWorld = new RegionalWorldSystem();

    // The dynasty is simulation state, independent of rendering. The founder
    // starts with a spouse so the line can grow naturally through the years.
    this.familySystem = new FamilySystem({
      time: this.timeManager.getTime(),
      familyName: 'Kayı',
      bridge: this.createFamilyAssetBridge(),
    });
    const founder = data?.newCharacter
      ? this.familySystem.createFounder(this.timeManager.getTime(),{
          firstName:data.newCharacter.firstName,gender:data.newCharacter.gender,age:24,
          ...(data.newCharacter.visuals ? { visuals:data.newCharacter.visuals } : {}),
          ...(startingPath ? { appearance: data.newCharacter.archetype as 'Çiftçi' | 'Akıncı' | 'Kervancı' } : {}),
          ...(startingPath ? { stats: startingPath.stats } : {}),
        })
      : this.familySystem.getCurrentCharacter();
    this.militarySystem.setLeadershipScore(founder?.skills.leadership ?? 0);
    if (founder) {
      this.familySystem.createSpouse(founder.id, this.timeManager.getTime());
    }
    this.professionSystem = new ProfessionSystem(founder?.id ?? null, (profession, level) => {
      const current = this.familySystem.getCurrentCharacter();
      if (!current) return;
      const key = PROFESSION_DEFINITIONS[profession].skillKey;
      current.skills[key] = Math.min(100, Math.max(current.skills[key], level * 10));
      this.familySystem.recordImportantChoice(`${PROFESSION_DEFINITIONS[profession].label} becerisi ${level}. düzeye ulaştı.`, this.timeManager.getTime().year);
    });
    this.characterAppearance = founder?.appearance ?? this.characterAppearance;
    this.familyTreePanel = new FamilyTreePanel(this, this.familySystem, undefined, () => {
      this.familyTreePanel.close();
      const current = this.familySystem.getCurrentCharacter();
      if (!current) return;
      this.familySystem.retireCharacter(current.id, this.timeManager.getTime());
      const pending = this.familySystem.getPendingSuccession();
      if (pending) this.successionPanel.open(pending);
    });
    this.politicalPanel = new PoliticalPanel(this, this.politicalSystem, () => this.politicalContext(), (action) => this.takePoliticalAction(action));
    this.chroniclePanel = new ChroniclePanel(this,(tab)=>this.getChronicleData(tab),(action)=>{void this.handleChronicleAction(action);});
    this.dialoguePanel = new DialoguePanel(this, (choiceId) => {
      const npc = this.settlementSimulation.findNearbyNpc(this.player.getGridPosition());
      if(!npc)return null;
      const before=this.settlementSimulation.getDialogueState().decisions.length;
      const view=this.settlementSimulation.chooseDialogue(npc.id, choiceId, this.inventory, this.economy);
      if(this.settlementSimulation.getDialogueState().decisions.length>before){this.recordTutorialProgress('dialogue');if(npc.id==='fatma_villager'&&(choiceId==='listen'||choiceId==='promise'))this.recordQuestEvent('diplomacy.water_request_heard');if(npc.id==='ilyas_official'&&choiceId==='mediate')this.recordQuestEvent('dispute.heard_both');if(npc.id==='kara_guard'&&choiceId==='volunteer')this.recordQuestEvent('military.service');}
      return view;
    }, (npcId) => this.settlementSimulation.hasPendingInteraction(npcId), (npcId) => {
      const result = this.settlementSimulation.interact(npcId, this.inventory, this.economy, this.historicalSystem);
      this.showFeedback(result.message, result.success);
      if (result.success) this.recordTutorialProgress('meet');
      this.updateHud();
    }, () => {
      this.settlementSimulation.closeDialogue();
      if (!this.manualPaused) this.timeManager.resume(Date.now());
    });
    this.battlefieldPanel = new BattlefieldPanel(this,this.militarySystem.getBattlefield(),()=>this.militarySystem.getRank(),()=>{
      const mission=this.militarySystem.getState().currentMission;
      return mission?.commanderId==='commander_kara'&&this.militarySystem.getRelationship('commander_kara')>=0;
    },()=>{
      const result=this.militarySystem.getBattlefield().attackWithPlayer();
      const soldier=this.militarySystem.getBattlefield().getUnits().find(unit=>unit.id==='player_character');
      if(soldier)this.player.getCombatStats().stamina=Math.max(0,Math.min(this.player.getCombatStats().maxStamina,soldier.stamina));
      if(result.ammunitionUsed)this.inventory.removeItem('arrows',1);
      if(result.success)this.audioManager.playCombat('strike');
      this.showFeedback(result.message,result.success);
      this.battlefieldPanel.refresh();
      if(result.success)void this.saveGame(SAVE_SLOT,true);
    },()=>{void this.saveGame(SAVE_SLOT,true);},()=>this.reportBattle(),()=>{if(!this.manualPaused)this.timeManager.resume(Date.now());},order=>this.militarySystem.recordTacticalDecision(order),()=>this.settingsManager.getSettings().debugMode);
    void this.saveManager.getSaveSlots().then(slots=>{this.knownSaveSlots=slots;});
    this.successionPanel = new SuccessionPanel(this, this.familySystem, {
      onSelect: (heirId) => this.chooseSuccessor(heirId),
      onRestart: () => this.restartFamily(),
      onContest: (heirId) => {
        const accepted = this.familySystem.contestSuccession(heirId, this.timeManager.getTime().year, 'Aile reisliği seçimine itiraz etti.');
        if (accepted) {
          const pending = this.familySystem.getPendingSuccession();
          if (pending) this.successionPanel.open(pending);
          void this.saveGame(SAVE_SLOT, true);
        }
      },
    });

    this.touchLayout = this.detectTouchLayout();

    // The world camera zooms; the UI camera stays at 1:1 so HUD, prompts and
    // touch controls are never dragged around by the world transform.
    this.uiCamera = createUiCamera(this);
    this.applyViewportLayout();
    this.setupMouseWheelZoom();
    const worldMap = WorldGenerator.generateFrontierSettlement();

    this.createWorldBackdrop(worldMap.width, worldMap.height);

    this.tileMap = new TileMap(this, worldMap);
    this.tileMap.render();

    this.objectManager = new WorldObjectManager(this, worldMap);
    this.objectManager.createObjects();
    this.objectManager.setAmbientEffectsEnabled(this.settingsManager.getSettings().graphicsQuality!=='low');

    this.player = new Player(this, 16, 17, this.inputManager, startingPath, this.characterAppearance, this.familySystem.getCurrentCharacter()?.gender??'male', this.familySystem.getCurrentCharacter()?.visuals);
    this.player.setFootstepCallback(surface=>this.audioManager.playFootstep(surface));
    this.player.setMapBounds(worldMap.width, worldMap.height);
    this.player.setCollisionChecker((gridX, gridY) => {
      if (!this.tileMap.isTileWalkable(gridX, gridY)) return true;
      return this.objectManager.checkCollision(gridX, gridY);
    });
    this.player.showSelectionIndicator(true);

    this.setupCamera(worldMap.width, worldMap.height);

    const simulation = new FarmSimulation();
    this.farmManager = new FarmManager(this, simulation, this.inventory, this.economy, this.professionSystem);
    this.farmManager.createPlotSprites();
    this.farmInteractionSystem = new FarmInteractionSystem(
      this,
      this.player,
      this.farmManager,
      this.economy,
      this.inventory,
      this.touchLayout,
      event=>{if(event==='tutorial:plant')this.recordTutorialProgress('plant');else {this.recordQuestEvent(event);if(event==='farm.harvest')this.recordTutorialProgress('harvest');}},
    );
    this.marketSystem = new MarketSystem(this, this.economy, this.inventory, this.professionSystem);
    this.marketSystem.setPoliticalStanding(this.politicalSystem.getState().factionStanding.market_merchants ?? 0);
    this.settlementSimulation = new SettlementSimulation(
      this,
      worldMap,
      (x, y) => !this.tileMap.isTileWalkable(x, y) || this.objectManager.checkCollision(x, y),
    );
    this.questSystem=new QuestSystem(AUTHORED_QUESTS,{npcs:this.settlementSimulation.getNpcs().map(n=>n.id),items:Object.keys(ITEM_DEFINITIONS),locations:REGIONAL_LOCATIONS.map(l=>l.id),historicalEvents:HISTORICAL_EVENTS.map(e=>e.id)});
    this.lastQuestGeneration=this.familySystem.getCurrentCharacter()?.generation??1;
    this.events.on('settlement-timeline-event', this.recordSettlementTimelineEvent, this);

    this.interactionSystem = new InteractionSystem(this, this.player, this.objectManager, {
      openMarket: () => this.marketSystem.openMarket(),
    }, this.touchLayout);

    this.virtualJoystick = new VirtualJoystick(this);
    this.virtualJoystick.onMove = (forceX, forceY) => this.inputManager.setAnalogVector(forceX, forceY);
    this.virtualJoystick.onUp = () => this.inputManager.clearAnalogVector();

    this.interactionButton = new InteractionButton(this);
    this.interactionButton.setCallback(() => this.performContextAction());

    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(50);
    registerWorld(this, this.debugGraphics);

    this.setupHud();
    this.tutorialGuide = new TutorialGuide(this, this.tutorial, () => this.tutorialGuide.hide(), () => {
      this.tutorial.skip(); this.tutorialGuide.hide(); void this.saveGame(SAVE_SLOT, true);
    });
    this.tutorialStartPosition = this.player.getGridPosition();
    this.createWorldLighting();
    this.applyGraphicsQuality();
    this.setupKeyboard();
    this.setupPauseHandling();

    if (this.touchLayout) {
      this.virtualJoystick.show();
    } else {
      this.virtualJoystick.hide();
      this.interactionButton.hide();
    }

    this.timeManager.resume(Date.now());

    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.handleShutdown, this);
    if(data?.loadSlot) void this.loadGame(data.loadSlot);
    else if (this.tutorial.isActive()) this.tutorialGuide.show();
  }

  private detectTouchLayout(): boolean {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return hasTouch || coarsePointer;
  }

  /**
   * Connects the abstract family ledger to the live farming/economy state, so
   * the estate a character actually built is what their heirs inherit.
   */
  private createFamilyAssetBridge(): FamilyAssetBridge {
    return {
      read: (family, deceased) => {
        if (!deceased) {
          return { wealth: 0, debts: 0, equipment: [], landPlots: [], familyReputation: 0 };
        }
        const isCurrent = family.currentPlayableId === deceased.id;
        if (!isCurrent) {
          return {
            wealth: deceased.wealth,
            debts: deceased.debts,
            equipment: [...deceased.equipment],
            landPlots: [...deceased.landPlots],
            familyReputation: deceased.reputation,
          };
        }

        const landPlots = this.farmManager
          .getSimulation()
          .getAllPlots()
          .filter((plot) => plot.unlocked)
          .map((plot) => plot.id.startsWith('plot_') && /^plot_\d+$/.test(plot.id)
            ? Number(plot.id.replace('plot_', ''))
            : plot.id);
        const equipment = this.inventory.serialize().items.map(([itemId]) => itemId);
        return {
          wealth: this.economy.getCurrency(),
          debts: deceased.debts,
          equipment,
          landPlots,
          familyReputation: deceased.reputation,
        };
      },
      apply: (property, heir) => {
        // The successor's personal purse becomes the household purse.
        this.economy.deserialize({ currency: Math.max(0, Math.floor(heir.wealth)) });
        const simulation = this.farmManager.getSimulation();
        for (const index of property.landPlots) {
          const plot = simulation.getPlotById(typeof index === 'number' ? `plot_${index}` : index);
          if (plot) plot.unlocked = true;
        }
        this.farmManager.refreshAll();
      },
    };
  }

  private baseWorldZoom = 1;
  private zoomLevel = 1;
  private minZoom = 0.48;
  private maxZoom = 1.6;
  private zoomStep = 0.08;

  private applyViewportLayout(): void {
    const { width, height } = this.scale;
    // The world origin is fixed; only the camera zoom adapts to the viewport.
    // Keep the settlement large enough that the painted detail reads on both
    // desktop and portrait phones.
    this.baseWorldZoom = Phaser.Math.Clamp(Math.min(width / 1650, height / 950), 0.62, 1);
    this.zoomLevel = this.baseWorldZoom;
    this.zoomTween?.stop();
    this.cameras.main.setZoom(this.zoomLevel);

    this.uiCamera.setViewport(0, 0, width, height);
    if (this.sunbeam) {
      this.sunbeam.setDisplaySize(width * 1.15, height * 1.1);
      this.sunbeam.setPosition(width * 0.72, height * 0.28);
    }
    if (this.vignette) {
      this.vignette.setDisplaySize(width, height);
      this.vignette.setPosition(width / 2, height / 2);
    }
  }

  private setupMouseWheelZoom(): void {
    if (!this.input.mouse) {
      return;
    }

    this.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (deltaY < 0) {
        this.zoomLevel = Phaser.Math.Clamp(this.zoomLevel + this.zoomStep, this.minZoom, this.maxZoom);
      } else if (deltaY > 0) {
        this.zoomLevel = Phaser.Math.Clamp(this.zoomLevel - this.zoomStep, this.minZoom, this.maxZoom);
      }
      this.animateCameraZoom(this.zoomLevel);
    });
  }

  private animateCameraZoom(target:number):void {
    this.zoomTween?.stop();
    this.zoomTween=this.tweens.add({targets:this.cameras.main,zoom:target,duration:190,ease:'Sine.Out',onUpdate:()=>this.layoutWorldLighting()});
    this.scaleHudText(target);
  }

  private scaleHudText(zoom: number): void {
    const scaleFactor = Phaser.Math.Clamp(zoom / this.baseWorldZoom, 1, 1.4);
    if (this.timeText) {
      this.timeText.setFontSize(Math.round(13 * scaleFactor));
    }
    if (this.moneyText) {
      this.moneyText.setFontSize(Math.round(15 * scaleFactor));
    }
    if (this.inventoryText) {
      this.inventoryText.setFontSize(Math.round(12 * scaleFactor));
    }
    if (this.lineageText) {
      this.lineageText.setFontSize(Math.round(11 * scaleFactor));
    }
    if (this.fpsText) {
      this.fpsText.setFontSize(Math.round(12 * scaleFactor));
      if (this.fpsText.padding) {
        this.fpsText.setPadding(6 * scaleFactor, 3 * scaleFactor);
      }
    }
    if (this.coordsText) {
      this.coordsText.setFontSize(Math.round(12 * scaleFactor));
      if (this.coordsText.padding) {
        this.coordsText.setPadding(6 * scaleFactor, 3 * scaleFactor);
      }
    }
    if (this.pauseText) {
      this.pauseText.setFontSize(Math.round(16 * scaleFactor));
      if (this.pauseText.padding) {
        this.pauseText.setPadding(12 * scaleFactor, 6 * scaleFactor);
      }
    }
    if (this.helpText) {
      this.helpText.setFontSize(Math.round(11 * scaleFactor));
      if (this.helpText.padding) {
        this.helpText.setPadding(6 * scaleFactor, 3 * scaleFactor);
      }
    }
    if (this.saveButton) {
      this.saveButton.setFontSize(Math.round(12 * scaleFactor));
      if (this.saveButton.padding) {
        this.saveButton.setPadding(9 * scaleFactor, 5 * scaleFactor);
      }
    }
    if (this.loadButton) {
      this.loadButton.setFontSize(Math.round(12 * scaleFactor));
      if (this.loadButton.padding) {
        this.loadButton.setPadding(9 * scaleFactor, 5 * scaleFactor);
      }
    }
    if (this.dayButton) {
      this.dayButton.setFontSize(Math.round(12 * scaleFactor));
      if (this.dayButton.padding) {
        this.dayButton.setPadding(9 * scaleFactor, 5 * scaleFactor);
      }
    }
    if (this.yearButton) {
      this.yearButton.setFontSize(Math.round(12 * scaleFactor));
      if (this.yearButton.padding) {
        this.yearButton.setPadding(9 * scaleFactor, 5 * scaleFactor);
      }
    }
    if (this.familyButton) {
      this.familyButton.setFontSize(Math.round(12 * scaleFactor));
      if (this.familyButton.padding) {
        this.familyButton.setPadding(9 * scaleFactor, 5 * scaleFactor);
      }
    }
    this.layoutHudText();
  }

  /**
   * Painted expanse behind the baked ground. It lives in world space so the
   * zoomed camera reveals misty fields rather than a flat void when it catches
   * the edge of the settlement.
   */
  private createWorldBackdrop(mapWidth: number, mapHeight: number): void {
    const halfW = ISOMETRIC_CONFIG.tileWidth / 2;
    const halfH = ISOMETRIC_CONFIG.tileHeight / 2;
    const minX = -mapHeight * halfW;
    const maxX = mapWidth * halfW;
    const minY = 0;
    const maxY = (mapWidth + mapHeight) * halfH;

    const backdrop = this.add.image(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      'fx_backdrop',
    );
    backdrop.setDisplaySize((maxX - minX) * 1.55, (maxY - minY) * 1.45);
    backdrop.setDepth(DEPTH.ground - 10);
    registerWorld(this, backdrop);
  }

  private setupCamera(mapWidth: number, mapHeight: number): void {
    const halfW = ISOMETRIC_CONFIG.tileWidth / 2;
    const halfH = ISOMETRIC_CONFIG.tileHeight / 2;
    const origin = IsometricUtils.gridToScreen(0, 0);
    const minX = origin.x - mapHeight * halfW - 300;
    const maxX = origin.x + mapWidth * halfW + 300;
    const minY = origin.y - 300;
    const maxY = origin.y + (mapWidth + mapHeight) * halfH + 300;

    this.cameras.main.setBackgroundColor('#11170e');
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
  }

  private setupHud(): void {
    const { width, height } = this.scale;

    // A warm diagonal light suggests late-afternoon sun over the valley.
    this.sunbeam = this.add.image(width * 0.72, height * 0.28, 'fx_sunbeam');
    this.sunbeam.setDisplaySize(width * 1.15, height * 1.1);
    this.sunbeam.setScrollFactor(0);
    this.sunbeam.setDepth(DEPTH.vignette - 2);
    this.sunbeam.setAlpha(0.5);

    // Screen-space atmosphere: a soft vignette frames the settlement without
    // darkening the HUD or touch controls.
    this.vignette = this.add.image(width / 2, height / 2, 'fx_vignette');
    this.vignette.setDisplaySize(width, height);
    this.vignette.setScrollFactor(0);
    this.vignette.setDepth(DEPTH.vignette);
    this.vignette.setAlpha(0.92);

    this.hudPanel = this.add.image(10, 8, 'ui_panel');
    this.hudPanel.setOrigin(0, 0);
    this.hudPanel.setScrollFactor(0);
    this.hudPanel.setDepth(DEPTH.hud - 4);
    this.hudPanel.setAlpha(0.95);

    this.coinIcon = this.add.image(27, 51, 'icon_coin');
    this.coinIcon.setScrollFactor(0);
    this.coinIcon.setDepth(this.uiDepth + 1);

    this.timeText = this.add.text(22, 15, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#efe0bd',
    });
    this.timeText.setScrollFactor(0).setDepth(this.uiDepth);
    this.timeText.setShadow(0, 1, '#000000', 3);

    this.moneyText = this.add.text(43, 40, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: '#e8c766',
      fontStyle: 'bold',
    });
    this.moneyText.setScrollFactor(0).setDepth(this.uiDepth);
    this.moneyText.setShadow(0, 1, '#000000', 3);

    this.inventoryText = this.add.text(22, 66, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#c9bea0',
    });
    this.inventoryText.setScrollFactor(0).setDepth(this.uiDepth);
    this.inventoryText.setShadow(0, 1, '#000000', 3);

    this.lineageText = this.add.text(22, 86, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#d8c294',
    });
    this.lineageText.setScrollFactor(0).setDepth(this.uiDepth);
    this.lineageText.setShadow(0, 1, '#000000', 3);

    this.fpsText = this.add.text(12, 104, 'FPS: 0', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
    });
    this.fpsText.setScrollFactor(0).setDepth(this.uiDepth);

    this.coordsText = this.add.text(12, 128, 'Grid: (0, 0)', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
    });
    this.coordsText.setScrollFactor(0).setDepth(this.uiDepth);

    this.pauseText = this.add.text(0, 0, 'DURAKLATILDI (P)', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f3e3c0',
      backgroundColor: '#1a120bcc',
      padding: { x: 12, y: 6 },
    });
    this.pauseText.setOrigin(0.5, 0.5);
    this.pauseText.setScrollFactor(0).setDepth(DEPTH.hud + 50);
    this.pauseText.setVisible(false);

    this.helpText = this.add.text(12, this.scale.height - 24,
      'WASD/oklar: yürü · F: tarla · E: etkileşim · M: pazar · G: nesil · J: defter · N: NPC incele · V: NPC yolları · T/Y: zaman · P: duraklat · F3: hata ayıklama',
      {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#e8dcc0',
        backgroundColor: '#00000099',
        padding: { x: 6, y: 3 },
      });
    this.helpText.setScrollFactor(0).setDepth(this.uiDepth);
    this.helpText.setVisible(!this.touchLayout);

    this.saveButton = this.createHudButton('Kaydet', () => { void this.saveGame(); });
    this.loadButton = this.createHudButton('Yükle', () => { void this.loadGame(); });
    this.dayButton = this.createHudButton('Gün +1', () => this.advanceDay());
    this.yearButton = this.createHudButton('Yıl +1', () => this.advanceYear());
    this.familyButton = this.createHudButton('Nesil (G)', () => this.toggleFamilyTree());
    const politicsButton = this.createHudButton('Siyaset (B)', () => this.politicalPanel.toggle());
    (this as any).politicsButton = politicsButton;
    this.chronicleButton=this.createHudButton('Defter (J)',()=>this.chroniclePanel.toggle());
    this.pauseButton=this.createHudButton('Menü (P)',()=>this.openPauseMenu());

    registerUi(
      this,
      this.sunbeam,
      this.vignette,
      this.hudPanel,
      this.coinIcon,
      this.timeText,
      this.moneyText,
      this.inventoryText,
      this.lineageText,
      this.fpsText,
      this.coordsText,
      this.pauseText,
      this.helpText,
      this.saveButton,
      this.loadButton,
      this.dayButton,
      this.yearButton,
      this.familyButton,
      politicsButton,
      this.chronicleButton,
      this.pauseButton,
      ...this.hudButtonBackgrounds.values(),
    );

    this.updateDebugVisibility();
    this.layoutHudText();
  }

  private createWorldLighting(): void {
    const rect = this.add.rectangle(0, 0, 16, 16, 0x182234, 0);
    rect.setScrollFactor(0).setDepth(DEPTH.hud - 1);
    this.worldLighting = rect;
    registerWorld(this, rect);
    this.layoutWorldLighting();
    this.weatherParticles = this.add.graphics();
    this.weatherParticles.setScrollFactor(0).setDepth(DEPTH.vignette + 2);
    registerUi(this, this.weatherParticles);
  }

  private layoutWorldLighting(): void {
    if (!this.worldLighting) return;
    const { width, height } = this.scale;
    const zoom = Math.max(0.1, this.cameras.main.zoom);
    this.worldLighting.setPosition(width / (2 * zoom), height / (2 * zoom));
    this.worldLighting.setDisplaySize(width * 1.8 / zoom, height * 1.8 / zoom);
  }

  private updateWorldLighting(now: number): void {
    if (!this.worldLighting || !this.settlementSimulation) return;
    if (now - this.worldLightingLastUpdate < 100) return;
    this.worldLightingLastUpdate = now;
    const hour = this.timeManager.getHourOfDay();
    this.objectManager?.setLightingHour(hour);
    const place=this.audioManager?.getEnvironment().place??'village';
    const profile=ATMOSPHERE_PRESETS[place];
    let color: number = profile.nightTint, alpha = 0;
    if (hour < 5 || hour >= 21) alpha = hour < 5 ? profile.nightAlpha + 0.04 : profile.nightAlpha;
    else if (hour < 7) { color = profile.dawnTint; alpha = (7 - hour) * 0.07; }
    else if (hour >= 18) { color = profile.duskTint; alpha = (hour - 18) * 0.045; }
    const weather = this.settlementSimulation.getWeather();
    const intensity = this.settlementSimulation.getWeatherIntensity(weather);
    if (weather === 'rain') { color = 0x45566a; alpha = Math.max(alpha, 0.16 * intensity); }
    if (weather === 'snow') { color = 0xa8bac8; alpha = Math.max(alpha, 0.13 * intensity); }
    if (weather === 'cloudy') { color = 0x777b7b; alpha = Math.max(alpha, 0.055 * intensity); }
    if (weather === 'fog') { color = 0xb9c1b9; alpha = Math.max(alpha, 0.075 * intensity); }
    if (weather === 'wind') { color = 0x8e9c99; alpha = Math.max(alpha, 0.045 * intensity); }
    const season = this.timeManager.getTime().season;
    if (hour >= 7 && hour < 18 && weather === 'clear') {
      if (season === Season.WINTER) { color = 0x9baeb4; alpha = Math.max(alpha, 0.045); }
      if (season === Season.AUTUMN) { color = 0xb27448; alpha = Math.max(alpha, 0.025); }
      if (season === Season.SUMMER) { color = profile.daylightTint; alpha = Math.max(alpha, 0.018); }
      if (season === Season.SPRING) { color = place === 'village' || place === 'market' ? 0x89a567 : profile.daylightTint; alpha = Math.max(alpha, 0.016); }
    }
    alpha = Phaser.Math.Clamp(alpha, 0, 0.48);
    const key = `${Math.floor(hour * 4)}:${weather}:${Math.round(intensity * 100)}:${season}:${place}:${color}:${Math.round(alpha * 100)}`;
    if (key !== this.worldLightingKey) {
      this.worldLightingKey = key;
      this.worldLightingTargetColor=color;
      this.worldLightingTargetAlpha=alpha;
    }
    const from=Phaser.Display.Color.IntegerToColor(this.worldLightingColor);
    const to=Phaser.Display.Color.IntegerToColor(this.worldLightingTargetColor);
    const blend=0.18;
    this.worldLightingColor=Phaser.Display.Color.GetColor(
      Math.round(Phaser.Math.Linear(from.red,to.red,blend)),
      Math.round(Phaser.Math.Linear(from.green,to.green,blend)),
      Math.round(Phaser.Math.Linear(from.blue,to.blue,blend)),
    );
    this.worldLightingAlpha=Phaser.Math.Linear(this.worldLightingAlpha,this.worldLightingTargetAlpha,blend);
    this.worldLighting.setFillStyle(this.worldLightingColor,this.worldLightingAlpha);
  }

  /** Fixed small batch keeps weather readable without per-drop game objects. */
  private updateWeatherParticles(now: number): void {
    if (!this.weatherParticles || !this.settlementSimulation || now - this.weatherParticlesLastUpdate < 100) return;
    this.weatherParticlesLastUpdate = now;
    const graphics = this.weatherParticles;
    graphics.clear();
    const quality=this.settingsManager.getSettings().graphicsQuality;
    const budget=ATMOSPHERE_PARTICLE_BUDGET[quality];
    if(budget===0)return;
    const weather = this.settlementSimulation.getWeather();
    const { width, height } = this.scale;
    if(weather!=='rain'&&weather!=='snow'&&weather!=='wind'){
      const hour=this.timeManager.getHourOfDay();
      if(weather==='clear'&&hour>=7&&hour<19){graphics.fillStyle(0xf0d7a0,quality==='high'?0.075:0.045);const dust=quality==='high'?9:4;for(let i=0;i<dust;i++){const x=(i*131+Math.floor(now/35)*(i%2?1:-1)+width)%width,y=(i*97+Math.floor(now/80))%height;graphics.fillCircle(x,y,0.7+(i%2)*0.4);}}
      return;
    }
    const count = Math.min(budget,weather === 'rain' ? 30 : weather === 'snow' ? 22 : 14);
    const intensity = this.settlementSimulation.getWeatherIntensity(weather);
    graphics.lineStyle(weather === 'rain' ? 1 : 2, weather === 'snow' ? 0xe6edf0 : 0xc4d4df, (weather === 'wind' ? 0.14 : 0.24) * intensity);
    for (let i = 0; i < count; i++) {
      const x = (i * 83 + Math.floor(now / 13) * (weather === 'rain' ? 7 : 2)) % width;
      const y = (i * 137 + Math.floor(now / (weather === 'rain' ? 6 : 18)) * 11) % height;
      if (weather === 'rain') graphics.lineBetween(x, y, x - 5, y + 12);
      else if (weather === 'snow') graphics.fillCircle(x, y, 1.5 + (i % 3) * 0.35);
      else graphics.lineBetween(x, y, x + 10, y - 2);
    }
  }

  private createHudButton(label: string, onClick: () => void): Phaser.GameObjects.Text {
    const background = this.add.graphics();
    background.setScrollFactor(0).setDepth(this.uiDepth + 4);
    const button = this.add.text(0, 0, label, {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#f3e3c0',
      stroke: '#261a10',
      strokeThickness: 1,
      shadow: { offsetX: 0, offsetY: 1, color: '#100b07', blur: 2, fill: true },
    });
    button.setScrollFactor(0).setDepth(this.uiDepth + 5);
    button.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.hudButtonWidth, this.hudButtonHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    this.hudButtonBackgrounds.set(button, background);
    button.on('pointerover', () => this.paintHudButton(button, true));
    button.on('pointerout', () => this.paintHudButton(button, false));
    button.on('pointerdown', () => { this.audioManager?.playUi('tap'); onClick(); });
    return button;
  }

  private paintHudButton(button: Phaser.GameObjects.Text, highlighted = false): void {
    const background = this.hudButtonBackgrounds.get(button);
    if (!background) return;
    const x = button.x - 12;
    const y = button.y - 7;
    const width = this.hudButtonWidth;
    const height = this.hudButtonHeight;
    background.clear();
    background.fillStyle(0x130e09, highlighted ? 0.5 : 0.38);
    background.fillRoundedRect(x + 1, y + 3, width, height, 8);
    background.fillStyle(highlighted ? 0x59452d : 0x302315, highlighted ? 0.96 : 0.94);
    background.fillRoundedRect(x, y, width, height, 8);
    background.lineStyle(1, highlighted ? 0xe4c77f : 0x9b7844, highlighted ? 0.9 : 0.62);
    background.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 8);
    background.fillStyle(highlighted ? 0xf0d48e : 0xb8995d, 0.95);
    background.fillRoundedRect(x + 6, y + 7, 3, height - 14, 1.5);
  }

  private layoutHudText(): void {
    const { width, height } = this.scale;

    // The panel hugs its contents so it never becomes a dark slab on phones.
    const panelWidth = this.touchLayout ? Math.min(252, width - 104) : 324;
    if (this.hudPanel) this.hudPanel.setDisplaySize(panelWidth, 108);
    if (this.coinIcon) this.coinIcon.setPosition(27, 51);

    if (this.lineageText) this.lineageText.setPosition(22, 84);

    this.fpsText.setPosition(12, 112);
    this.coordsText.setPosition(12, 136);

    this.hudButtonWidth = Math.min(166, Math.max(140, width - 24));
    const buttonX = Math.max(12, width - 12 - this.hudButtonWidth) + 12;
    const buttonY = [14, 51, 88, 125, 162, 199, 236, 273];
    const hudButtons = [this.saveButton, this.loadButton, this.dayButton, this.yearButton, this.familyButton,
      (this as any).politicsButton as Phaser.GameObjects.Text | undefined, this.chronicleButton, this.pauseButton];
    hudButtons.forEach((button, index) => {
      if (!button) return;
      button.setPosition(buttonX, buttonY[index] ?? 14);
      this.paintHudButton(button);
    });
    this.pauseText.setPosition(width / 2, Math.max(122, height * 0.16));
    this.helpText.setPosition(12, height - 24);

    this.helpText.setVisible(!this.touchLayout);
  }

  private setupKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    const whenRunning = (action: () => void): void => {
      if (!this.timeManager.isPaused()) action();
    };

    keyboard.on('keydown-E', () => whenRunning(() => this.performContextAction()));
    keyboard.on('keydown-F', () => whenRunning(() => this.farmInteractionSystem.interact()));
    keyboard.on('keydown-M', () => whenRunning(() => {
      if (this.nearMarket()) {
        this.marketSystem.openMarket();
      } else {
        this.showFeedback('Pazara yaklaşın (Move closer to the market)', false);
      }
    }));
    keyboard.on('keydown-T', () => whenRunning(() => this.advanceDay()));
    keyboard.on('keydown-Y', () => whenRunning(() => this.advanceYear()));
    keyboard.on('keydown-G', () => this.toggleFamilyTree());
    keyboard.on('keydown-B', () => this.politicalPanel.toggle());
    keyboard.on('keydown-J', () => this.chroniclePanel.toggle());
    keyboard.on('keydown-H', () => this.chroniclePanel.toggle('help'));
    keyboard.on('keydown-N', (event: KeyboardEvent) => {
      this.settlementSimulation.cycleVillageDebug(event.shiftKey ? -1 : 1);
    });
    keyboard.on('keydown-V', () => {
      const enabled = this.settlementSimulation.toggleVillageOverlay();
      this.showFeedback(enabled ? 'Köy hata ayıklama katmanı açık' : 'Köy hata ayıklama katmanı kapalı', true);
    });
    keyboard.on('keydown-P', () => this.togglePause());
    keyboard.on('keydown-F3', () => {
      const settings = this.settingsManager.getSettings();
      this.settingsManager.setDebugMode(!settings.debugMode);
      this.updateDebugVisibility();
    });
    keyboard.on('keydown-ESC', () => {
      if(this.battlefieldPanel?.isOpen()&&this.militarySystem.getBattlefield().isActive()){this.battlefieldPanel.togglePaused();return;}
      if (this.familyTreePanel?.isOpen()) {
        this.familyTreePanel.close();
        return;
      }
      if (this.successionPanel?.isOpen()) {
        // The dynasty cannot continue until an heir is chosen.
        return;
      }
      if (this.marketSystem.isOpen()) {
        this.marketSystem.closeMarket();
        return;
      }
      if(this.chroniclePanel.isOpen()){
        if(this.chroniclePanel.getTab()==='pause')void this.handleChronicleAction('resume');
        else if(this.timeManager.isPaused())this.chroniclePanel.show('pause');
        else this.chroniclePanel.close();
        return;
      }
      this.openPauseMenu();
    });
  }

  private setupPauseHandling(): void {
    this.events.on(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.timeManager.pause();
      } else if (!this.manualPaused) {
        this.timeManager.resume(Date.now());
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private onScenePause(): void {
    this.timeManager.pause();
  }

  private onSceneResume(): void {
    this.timeManager.resume(Date.now());
  }

  private advanceDay(): void {
    if (this.timeManager.isPaused()) return;
    this.timeManager.advanceDay();
    this.settlementSimulation.advanceSimulationToNow();
    this.farmManager.syncGrowth();
    this.marketSystem.update();
    this.syncFamily();
    this.updateQuestLifecycle();
    this.updateHud();
    this.showFeedback('1 gün ilerledi (Day advanced)', true);
    void this.saveGame('slot1',true);
  }

  private advanceYear(): void {
    if (this.timeManager.isPaused()) return;
    const calendar=this.timeManager.getCalendarConfig();
    this.timeManager.advanceDays(calendar.daysPerMonth*calendar.monthsPerYear);
    this.settlementSimulation.advanceSimulationToNow();
    this.farmManager.syncGrowth();
    this.marketSystem.update();
    this.syncFamily();
    this.updateQuestLifecycle();
    this.updateHud();
    this.showFeedback('1 yıl ilerledi (Year advanced)', true);
    void this.saveGame('slot1',true);
  }

  /**
   * Runs the dynasty simulation up to the current calendar date. A death of
   * the playable character opens the succession screen; no heir is ever
   * generated silently.
   */
  private syncFamily(): void {
    if (!this.familySystem) return;
    const playable=this.familySystem.getCurrentCharacter();
    if(playable)this.player?.setVisuals(visualsForAge(playable.visuals??DEFAULT_CHARACTER_VISUALS,playable.age));
    const events = this.familySystem.advanceTime(this.timeManager.getTime());
    const generation=this.familySystem.getCurrentCharacter()?.generation??this.lastQuestGeneration;
    if(generation>this.lastQuestGeneration){this.recordQuestEvent('family.generation_advanced',generation-this.lastQuestGeneration);this.lastQuestGeneration=generation;}
    for(const event of events)if(event.type==='alliance'||event.type==='marriage'||event.type==='birth')this.recordQuestEvent('family.bond');
    const notable = events.filter(
      (event: FamilyEvent) =>
        event.type === 'death' || event.type === 'birth' || event.type === 'coming_of_age',
    );
    const latest = notable[notable.length - 1];
    if (latest) {
      this.showFeedback(latest.message, latest.type !== 'death');
    }

    const pending = this.familySystem.getPendingSuccession();
    if (pending && !this.successionPanel.isOpen()) {
      if (this.marketSystem?.isOpen()) this.marketSystem.closeMarket();
      if (this.familyTreePanel?.isOpen()) this.familyTreePanel.close();
      this.successionPanel.open(pending);
    }
    this.updateLineageHud();
  }

  private updateLineageHud(): void {
    if (!this.lineageText) return;
    const current = this.familySystem?.getCurrentCharacter();
    if (!current) {
      if (this.lineageText.text !== 'Aile sona erdi') this.lineageText.setText('Aile sona erdi');
      return;
    }
    const family = this.familySystem.getFamily();
    const living = this.familySystem.getLivingMembers().length;
    const heirs = this.familySystem.getAliveHeirCount();
    const label = `${family.name} · Kuşak ${current.generation} · ${current.firstName} (${current.age}) · ${living} üye · ${heirs} varis`;
    if (this.lineageText.text !== label) this.lineageText.setText(label);
    this.familySystem.setPoliticalLegacy(this.politicalSystem?.getState().politicalLegacy ?? 0);
  }

  private politicalContext() {
    const pos=this.player.getGridPosition(); const year=this.timeManager.getTime().year;
    this.historicalSystem.updateTime(year, year<1326?'osman_gazi':year<1362?'orhan_gazi':'murad_i');
    const ruler=year<1326?'osman_gazi':year<1362?'orhan_gazi':'murad_i';
    this.politicalSystem.updateEra(year,ruler,this.historicalSystem);
    return {year,ruler,location:pos.x<24?'Frontier Settlement':'Border Zone',rank:'recruit',currency:this.economy.getCurrency(),militaryStrength:this.politicalSystem.getState().militaryStrength,familyGeneration:this.familySystem.getCurrentCharacter()?.generation??1,totalDays:this.timeManager.getTime().totalDays,items:Object.fromEntries(this.inventory.getAllItems().map(item=>[item.itemId,item.quantity]))};
  }

  private takePoliticalAction(action: PoliticalAction): void {
    const result=this.politicalSystem.act(action,this.politicalContext(),this.historicalSystem,(amount)=>this.economy.removeCurrency(amount),(itemId,amount)=>this.inventory.removeItem(itemId,amount));
    if(result.currencyReward)this.economy.addCurrency(result.currencyReward);
    for(const [politicalId,amount] of Object.entries(result.relationshipChanges??{})){
      const npcId=politicalId==='commander_kara'?'kara_guard':politicalId==='local_cadi'?'ilyas_official':politicalId;
      this.settlementSimulation.adjustQuestRelationship(npcId,amount);
      if(result.memoryKind&&result.memorySummary)this.settlementSimulation.rememberNpcInteraction(npcId,result.memoryKind==='promise'?'help':result.memoryKind==='betrayal'?'conflict':result.memoryKind==='conflict'?'conflict':'help',result.memorySummary,Math.abs(amount));
    }
    if(result.success&&(action==='accept_levy'||action==='refuse_levy'))this.recordQuestEvent('politics.levy_considered');
    if(result.success&&action==='negotiate_land')this.recordQuestEvent('politics.land_negotiated');
    if(result.success&&action==='mediate_dispute')this.recordQuestEvent('politics.dispute_mediated');
    if(result.success&&action==='form_alliance')this.recordQuestEvent('politics.alliance_formed');
    if(result.success&&action==='fulfill_trade_contract')this.recordQuestEvent('politics.trade_contract_fulfilled');
    if(result.success&&action==='support_leader')this.recordQuestEvent('politics.local_support');
    if(result.success&&action==='rebel')this.recordQuestEvent('politics.rebellion_resolved');
    if(result.success){
      this.recordTutorialProgress('politics');
      const state=this.politicalSystem.getState();
      this.marketSystem.setPoliticalStanding(state.factionStanding.market_merchants ?? 0);
      if(result.outcome==='defeat'||result.outcome==='exile'){const lostPlots=this.farmManager.getSimulation().getAllPlots().filter(plot=>plot.unlocked).length;this.economy.deserialize({currency:Math.max(0,this.economy.getCurrency()-Math.min(100,this.economy.getCurrency()))});this.farmManager.getSimulation().getAllPlots().forEach(plot=>{if(plot.unlocked)plot.unlocked=false;});if(lostPlots)this.familySystem.recordLandChange(-lostPlots,'Siyasi yenilgi ve sürgün sonrası mülkler müsadere edildi.',this.timeManager.getTime().year);this.farmManager.refreshAll();}
      if(result.outcome==='victory')this.economy.addCurrency(60);
      this.familySystem.setPoliticalLegacy(state.politicalLegacy);
      const standingChange=action==='join_faction'?8:action==='rebel'?-12:action==='negotiate_land'?5:action==='resist_order'?-5:0;
      this.familySystem.recordPoliticalCommitment(`${action}: ${result.message}`,this.timeManager.getTime().year,state.authorityId,standingChange);
      this.familySystem.recordImportantChoice(`Siyasi karar: ${result.message}`,this.timeManager.getTime().year);
      this.politicalPanel.refresh();this.updateHud();
    }
    this.showFeedback(result.message,result.success);
  }

  private updateAudioState(now: number): void {
    this.audioManager.setPaused(this.timeManager.isPaused());
    this.audioManager.setCombatActive(this.militarySystem.getBattlefield().isActive()&&this.battlefieldPanel?.isOpen()===true&&this.battlefieldPanel.isPaused()===false);
    if (now < this.nextAudioRefreshAt) return;
    this.nextAudioRefreshAt = now + 650;
    const current = this.regionalWorld.getCurrent();
    const battle = this.militarySystem.getBattlefield().isActive() || this.battlefieldPanel?.isOpen() === true;
    const place: 'village'|'forest'|'market'|'travel'|'battlefield' = battle ? 'battlefield' : this.marketSystem.isOpen() ? 'market' : current.id === 'kizilca_village' ? 'village' : /forest|wood/i.test(`${current.terrain} ${current.kind}`) ? 'forest' : 'travel';
    const mood = battle ? 'battlefield' : this.politicalPanel.isOpen() ? 'political' : place === 'travel' || place === 'forest' ? 'travel' : 'calm';
    const weather = this.settlementSimulation.getWeather();
    this.audioManager.setEnvironment({place,weather,hour:this.timeManager.getHourOfDay(),mood,weatherIntensity:this.settlementSimulation.getWeatherIntensity(weather)});
  }

  private toggleFamilyTree(): void {
    if (!this.familyTreePanel) return;
    if (this.familyTreePanel.isOpen()) {
      this.familyTreePanel.close();
      if (this.tutorialGuideHiddenForFamily) { this.tutorialGuideHiddenForFamily = false; this.tutorialGuide?.show(); }
      return;
    }
    if (this.successionPanel?.isOpen()) return;
    if (this.marketSystem?.isOpen()) this.marketSystem.closeMarket();
    this.familyTreePanel.open();
    this.familyTreeViewed = true;
    if (this.tutorial.getCurrentStep()?.id === 'legacy' && this.tutorial.isActive()) {
      this.tutorialGuideHiddenForFamily = true;
      this.tutorialGuide?.hide();
    }
  }

  private chooseSuccessor(heirId: string): void {
    const priorId = this.professionSystem.serialize().characterId;
    const outcome = this.familySystem.selectSuccessor(heirId, this.timeManager.getTime());
    if (!outcome.success) {
      this.showFeedback(outcome.message, false);
      return;
    }
    this.successionPanel.close();
    if (priorId && priorId !== heirId) this.professionSystem.inheritKnowledge(priorId, heirId);
    this.player.setGender(this.familySystem.getCurrentCharacter()?.gender??'male');
    this.characterAppearance = this.familySystem.getCurrentCharacter()?.appearance;
    this.player.setAppearance(this.characterAppearance);
    this.player.setVisuals(this.familySystem.getCurrentCharacter()?.visuals);
    this.militarySystem.setLeadershipScore(this.familySystem.getCurrentCharacter()?.skills.leadership ?? 0);
    this.farmManager.refreshAll();
    this.updateHud();
    this.showFeedback(outcome.message, true);
  }

  /** Explicit restart: a new dynasty, calendar and estate. Never automatic. */
  private restartFamily(): void {
    const startTime: GameTime = {
      day: 1,
      month: 3,
      year: 1299,
      season: Season.SPRING,
      totalDays: 0,
    };
    this.timeManager.pause();
    this.timeManager.setCalendarConfig(DEFAULT_CALENDAR);
    this.timeManager.setTime(startTime);
    this.settlementSimulation.syncClock();
    this.inventory.deserialize(new Inventory().serialize());
    this.economy.deserialize(new Economy(this.inventory).serialize());
    this.farmManager.getSimulation().deserialize(new FarmSimulation().serialize());
    this.politicalSystem.reset();
    this.questSystem.reset();this.lastQuestGeneration=1;this.lastQuestDay=0;this.lastPoliticalDay=0;
    this.historicalSystem = new HistoricalEventSystem();
    this.politicalPanel.refresh();
    this.farmManager.refreshAll();
    this.player.setGridPosition(16, 17);
    const founder = this.familySystem.startNewFamily(startTime, 'Kayı');
    this.familySystem.createSpouse(founder.id, startTime);
    this.professionSystem.resetForCharacter(founder.id);
    this.characterAppearance = founder.appearance;
    this.player.setAppearance(founder.appearance);
    this.player.setGender(founder.gender);
    this.player.setVisuals(founder.visuals);
    this.successionPanel.close();
    void this.saveManager.deleteSave(SAVE_SLOT);
    this.syncFamily();
    this.updateHud();
    this.showFeedback('Yeni aile kuruldu (New family started)', true);
  }

  private togglePause(): void {
    if(this.battlefieldPanel?.isOpen()&&this.militarySystem.getBattlefield().isActive()){this.battlefieldPanel.togglePaused();return;}
    if (this.timeManager.isPaused()) {
      this.manualPaused = false;
      this.chroniclePanel?.close();
      this.timeManager.resume(Date.now());
      this.pauseText.setVisible(false);
    } else {
      this.manualPaused = true;
      this.timeManager.pause();
      this.pauseText.setVisible(true);
      this.chroniclePanel?.open('pause');
    }
  }

  private nearMarket(): boolean {
    const pos = this.player.getGridPosition();
    this.player.setWeatherMovement(this.settlementSimulation.getWeather());
    const near =
      (Math.abs(pos.x - 20) <= 2.5 && Math.abs(pos.y - 18) <= 2.5) ||
      (Math.abs(pos.x - 22) <= 2.5 && Math.abs(pos.y - 18) <= 2.5);
    return near;
  }

  private performContextAction(): void {
    if (this.timeManager.isPaused()) return;
    if(this.regionalWorld.getCurrent().id!=='kizilca_village'){this.showFeedback('Bu konumun pazar, tarla ve seyahat işlemleri Bölge haritasından yönetiliyor.',false);return;}
    const pos = this.player.getGridPosition();
    const nearbyNpc = this.settlementSimulation.findNearbyNpc(pos);
    if (nearbyNpc) {
      this.settlementSimulation.setDialogueReputation(this.politicalSystem.getState().reputation);
      const dialogue = this.settlementSimulation.openDialogue(nearbyNpc.id, this.inventory, this.economy);
      if (dialogue) {
        this.recordTutorialProgress('meet');
        this.timeManager.pause();
        this.dialoguePanel.open(dialogue);
      } else {
        const result = this.settlementSimulation.interact(nearbyNpc.id, this.inventory, this.economy, this.historicalSystem);
        if(result.success&&result.message.includes('Anlaşmazlık yatıştı'))this.recordQuestEvent('dispute.heard_both');
        this.showFeedback(result.message, result.success);
      }
      this.updateHud();
      return;
    }
    if (this.farmManager.getPlotAt(pos.x, pos.y)) {
      this.farmInteractionSystem.interact();
      return;
    }
    if (this.interactionSystem.tryInteract()) return;
    if (this.nearMarket()) {
      this.marketSystem.openMarket();
    }
  }

  private updateDebugVisibility(): void {
    const settings = this.settingsManager.getSettings();
    this.fpsText.setVisible(settings.debugMode && settings.showFPS);
    this.coordsText.setVisible(settings.debugMode && settings.showCoordinates);
    this.debugGraphics.setVisible(settings.debugMode && settings.showGrid);
    if (!settings.debugMode) {
      this.debugGraphics.clear();
    }
  }

  private applyGraphicsQuality():void{
    const quality=this.settingsManager.getSettings().graphicsQuality;
    this.sunbeam?.setVisible(quality==='high');this.vignette?.setVisible(quality!=='low');
    this.objectManager?.setAmbientEffectsEnabled(quality!=='low');
  }

  private updateHud(): void {
    const now = this.time.now;
    if (now < this.nextHudRefreshAt) return;
    this.nextHudRefreshAt = now + 100;
    const settings = this.settingsManager.getSettings();
    const timeLabel = `${this.regionalWorld?.getCurrent().name??'Kızılca Köyü'} · ${this.settlementSimulation?.getClockLabel(this.timeManager.getTime()) ?? this.timeManager.getDateString()}`;
    if (this.timeText.text !== timeLabel) this.timeText.setText(timeLabel);
    const moneyLabel = `${this.economy.getCurrency()} akçe`;
    if (this.moneyText.text !== moneyLabel) this.moneyText.setText(moneyLabel);
    const inventoryLabel = `Buğday ${this.inventory.getItemCount('wheat')} · Arpa ${this.inventory.getItemCount('barley')} · Yulaf ${this.inventory.getItemCount('oats')} · Tohum ${this.inventory.getItemCount('seed_wheat')}`;
    if (this.inventoryText.text !== inventoryLabel) this.inventoryText.setText(inventoryLabel);
    this.updateLineageHud();

    if (settings.debugMode) {
      if (settings.showFPS) {
        this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)} · ${this.player.getState()}`);
      }
      if (settings.showCoordinates) {
        const pos = this.player.getGridPosition();
        this.coordsText.setText(`Grid: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
      }
    }
  }

  private drawDebugGrid(): void {
    const settings = this.settingsManager.getSettings();
    if (!settings.debugMode || !settings.showGrid) return;

    this.debugGraphics.clear();
    this.debugGraphics.lineStyle(1, 0xf0cf8a, 0.16);

    const size = 32;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pos = IsometricUtils.gridToScreen(x, y);
        this.debugGraphics.beginPath();
        this.debugGraphics.moveTo(pos.x, pos.y);
        this.debugGraphics.lineTo(pos.x + ISOMETRIC_CONFIG.tileWidth / 2, pos.y + ISOMETRIC_CONFIG.tileHeight / 2);
        this.debugGraphics.lineTo(pos.x, pos.y + ISOMETRIC_CONFIG.tileHeight);
        this.debugGraphics.lineTo(pos.x - ISOMETRIC_CONFIG.tileWidth / 2, pos.y + ISOMETRIC_CONFIG.tileHeight / 2);
        this.debugGraphics.closePath();
        this.debugGraphics.strokePath();
      }
    }
  }

  private showFeedback(message: string, success: boolean): void {
    const feedback = this.add.text(this.scale.width / 2, this.scale.height / 2 - 120, message, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: success ? '#b7e4a0' : '#ff9b8d',
      backgroundColor: '#1a120bdd',
      padding: { x: 12, y: 8 },
    });
    feedback.setOrigin(0.5, 0.5);
    feedback.setScrollFactor(0).setDepth(600);
    registerUi(this, feedback);

    this.tweens.add({
      targets: feedback,
      alpha: 0,
      y: feedback.y - 30,
      delay: 900,
      duration: 600,
      onComplete: () => feedback.destroy(),
    });
  }

  private async saveGame(slot = SAVE_SLOT, silent = false): Promise<void> {
    this.historicalSystem.updateTime(this.timeManager.getTime().year);
    const military=this.militarySystem.serialize();
    this.updateAchievements();
    const saved = await this.saveManager.saveGame(slot, {
      time: this.timeManager.getTime(), calendar: this.timeManager.getCalendarConfig(), inventory: this.inventory.serialize(), economy: this.economy.serialize(),
      professions: this.professionSystem.serialize(),
      farm: this.farmManager.getSimulation().serialize(), market: this.marketSystem.serialize(),
      playerPosition: this.player.getGridPosition(), playerCondition:{health:this.player.getCombatStats().health,stamina:this.player.getCombatStats().stamina}, family: this.familySystem.serialize(), political: this.politicalSystem.serialize(),
      timeline: this.historicalSystem.serialize(), military, equipment:this.player.getEquipmentSystem().serialize(),
      tutorial: this.tutorial.saveState(),
      world:{mapSeed:1337,npcStates:{},settlement:this.settlementSimulation.getSaveState(),regional:this.regionalWorld.serialize(),...(this.characterAppearance ? { characterAppearance:this.characterAppearance } : {})}, quests:{active:[...this.questSystem.getActive().map(q=>q.id),...(military.currentMission?[military.currentMission.id]:[]),...this.settlementSimulation.getDialogueState().quests],completed:[...military.completedMissions,...this.questSystem.getByStatus('completed').map(q=>q.id)],achievements:[...this.achievements],system:this.questSystem.serialize()},
    });
    if(!silent){this.knownSaveSlots=await this.saveManager.getSaveSlots();this.showFeedback(saved ? `${slot} kaydedildi` : `Kayıt başarısız: ${this.saveManager.getLastError()??'mevcut kayıt korunuyor.'}`,saved);this.chroniclePanel?.show('saves');}
    if (saved && !silent && this.familyTreeViewed) this.recordTutorialProgress('legacy');
  }

  private async loadGame(slot = SAVE_SLOT): Promise<void> {
    const result=await this.saveManager.loadSlot(slot);
    if(result.status==='empty'){this.showFeedback('Bu yuvada kayıt bulunamadı.',false);return;}
    if(result.status==='invalid'){this.showFeedback(result.message,false);return;}
    const save=result.data;
    this.tutorial.restore(save.tutorial);
    this.tutorialGuide?.hide();
    this.characterAppearance=save.world?.characterAppearance;
    this.regionalWorld.deserialize(save.world?.regional);
    this.questSystem.deserialize(save.quests?.system);
    this.player.setAppearance(this.characterAppearance);
    this.settlementSimulation.loadSaveState(save.world?.settlement);
    if(save.calendar)this.timeManager.setCalendarConfig(save.calendar);this.timeManager.setTime(save.time);this.inventory.deserialize(save.inventory);this.economy.deserialize(save.economy);
    this.settlementSimulation.syncClock();
    this.farmManager.getSimulation().deserialize(save.farm);this.marketSystem.deserialize(save.market);
    this.tutorialGrowthPlotId=this.farmManager.getSimulation().getAllPlots().filter(plot=>plot.plantedDay!==undefined).sort((a,b)=>(b.plantedDay??-1)-(a.plantedDay??-1))[0]?.id??null;
    if(save.family){if(this.familyTreePanel.isOpen())this.familyTreePanel.close();if(this.successionPanel.isOpen())this.successionPanel.close();this.familySystem.deserialize(save.family);this.player.setGender(this.familySystem.getCurrentCharacter()?.gender??'male');this.characterAppearance=this.familySystem.getCurrentCharacter()?.appearance;this.player.setAppearance(this.characterAppearance);this.player.setVisuals(this.familySystem.getCurrentCharacter()?.visuals);}
    if(save.playerCondition)this.player.restoreCondition(save.playerCondition.health,save.playerCondition.stamina);
    this.professionSystem.deserialize(save.professions, this.familySystem.getCurrentCharacter()?.id ?? null);
    this.politicalSystem.deserialize(save.political);this.marketSystem.setPoliticalStanding(this.politicalSystem.getState().factionStanding.market_merchants??0);this.familySystem.setPoliticalLegacy(this.politicalSystem.getState().politicalLegacy);
    this.historicalSystem.deserialize(save.timeline);this.militarySystem.deserialize(save.military);this.player.getEquipmentSystem().deserialize(save.equipment);this.player.refreshAppearanceArt();
    this.achievements=[...(save.quests?.achievements??[])];
    this.lastQuestDay=Math.floor(this.timeManager.getTime().totalDays);this.lastPoliticalDay=this.lastQuestDay;this.lastQuestGeneration=this.familySystem.getCurrentCharacter()?.generation??1;
    if(save.playerPosition)this.player.setGridPosition(save.playerPosition.x,save.playerPosition.y);
    const offlineDays=this.timeManager.calculateOfflineDays(save.timestamp);
    if(offlineDays>0){this.timeManager.advanceDays(offlineDays);this.showFeedback(`Yokluğunuzda ${offlineDays} gün geçti`,true);}
    else this.showFeedback(result.recoveredFromBackup?'Yedek kayıt kurtarıldı; hasarlı asıl kayıt korundu.':result.migrated?'Eski kayıt güncellendi ve yüklendi.':'Oyun yüklendi.',true);
    this.farmManager.syncGrowth();this.farmManager.refreshAll();this.marketSystem.update();this.syncFamily();this.updateHud();this.chroniclePanel?.show('saves');
    if (this.tutorial.isActive()) this.tutorialGuide?.show();
  }

  private getChronicleData(tab:ChronicleTab):{title:string;lines:string[];slots?:string[];settings?:Record<string,boolean>;audio?:{masterMuted:boolean;volumes:Record<AudioBus,number>};actions?:Array<{label:string;action:string}>;choices?:Record<string,string>;map?:Array<{id:string;name:string;x:number;y:number;current:boolean;visited:boolean;action:string}>;routes?:Array<[string,string]>} {
    const p=this.politicalSystem.getState(),f=this.familySystem.getFamily(),c=this.familySystem.getCurrentCharacter(),m=this.militarySystem.getState();
    if(tab==='inventory')return {title:'Eşya ve teçhizat',lines:[...this.inventory.getAllItems().map(i=>`${i.itemId} · ${i.quantity}`),`Silah: ${this.player.getEquipmentSystem().getEquipment().weapon}`,`Zırh: ${this.player.getEquipmentSystem().getEquipment().armor}`,`Akçe ${this.economy.getCurrency()} · Çanta ${this.inventory.getUsedSlots()}/${this.inventory.getMaxSlots()}`],actions:[{label:'Hançer',action:`equip:${WeaponType.MELEE_DAGGER}`},{label:'Kılıç',action:`equip:${WeaponType.MELEE_SWORD}`},{label:'Mızrak',action:`equip:${WeaponType.MELEE_SPEAR}`},{label:'Balta',action:`equip:${WeaponType.MELEE_AXE}`},{label:'Yay',action:`equip:${WeaponType.BOW}`},{label:'Deri zırh',action:`armor:${ArmorType.LEATHER}`},{label:'Zincir zırh',action:`armor:${ArmorType.CHAINMAIL}`}]};
    if(tab==='character'){
      const progression=this.professionSystem.serialize();
      const knownProfessions=this.professionSystem.getKnownProfessions();
      const professionLines=Object.entries(PROFESSION_DEFINITIONS).map(([id,def])=>{const profession=id as ProfessionId;if(!knownProfessions.includes(profession))return `${def.label} · Henüz öğrenilmedi`;const skill=this.professionSystem.getSkill(profession);const next=skill.level<10?Math.max(0,80+45*skill.level**1.35-skill.experience):0;const ability=def.abilities.filter(a=>a.level<=skill.level).at(-1)?.label;return `${def.label} · Düzey ${skill.level} · ${skill.experience}/${next} deneyim${ability?` · ${ability}`:''}`;});
      const nearby=this.settlementSimulation.findNearbyNpc(this.player.getGridPosition());
      const actions:Array<{label:string;action:string}>=[];
      if(nearby){
        for(const [id,def] of Object.entries(PROFESSION_DEFINITIONS) as Array<[ProfessionId,(typeof PROFESSION_DEFINITIONS)[ProfessionId]]>){
          const score=def.skillKey==='trade'?nearby.attributes.wit:def.skillKey==='farming'?nearby.attributes.endurance:def.skillKey==='combat'?nearby.attributes.strength:nearby.attributes.craft;
          if(def.occupationIds.includes(nearby.occupation)&&score>=65&&this.professionSystem.getSkill(id).level<3)actions.push({label:`${nearby.name} ustasından ${def.label} öğren · 12 akçe`,action:`profession:mentor:${nearby.id}:${id}`});
        }
        if(nearby.occupation==='blacksmith'&&this.professionSystem.getHoeCondition()<100)actions.push({label:'Çapayı demircide onar · 8 akçe',action:'profession:repair_hoe'});
      }
      const learnedLines=knownProfessions.map(id=>{const skill=this.professionSystem.getSkill(id);return `${PROFESSION_DEFINITIONS[id].label} itibarı ${skill.reputation} · İş ${skill.activities}`;});
      const unlockedAbilities=this.professionSystem.getKnownProfessions().flatMap(id=>PROFESSION_DEFINITIONS[id].abilities.filter(ability=>ability.level<=this.professionSystem.getSkill(id).level).map(ability=>`${PROFESSION_DEFINITIONS[id].label}: ${ability.label}`));
      const notYet=Object.values(PROFESSION_DEFINITIONS).filter(def=>!knownProfessions.includes(def.id)).map(def=>def.label);
      return {title:'Karakter, bağlar ve meslekler',lines:[`${c?.firstName??'—'} ${c?.familyName??''} · ${c?.age??0} yaş · Kuşak ${c?.generation??1}`,`Aile ${f.name} · Rütbe ${m.rank}`,`Can ${Math.round(this.player.getHealthPercent()*100)}% · Dayanıklılık ${Math.round(this.player.getStaminaPercent()*100)}%`,`Yorgunluk ${progression.fatigue}% · Çapa dayanıklılığı ${progression.hoeCondition}%`,`İtibar ${p.reputation} · Ün ${c?.reputation??0}`,`Bağlar: ${c?.relationships.map(r=>`${r.type} (${r.strength})`).join(', ')||'Henüz kayıt yok'}`,'MESLEKLER · Başarılı iş, satış ve hizmet ilerleme kazandırır.',...professionLines.filter((_,index)=>knownProfessions.includes(Object.keys(PROFESSION_DEFINITIONS)[index] as ProfessionId)),...learnedLines,...unlockedAbilities,notYet.length?`Öğrenilebilir meslekler: ${notYet.join(', ')}`:'Usta NPC yanındayken uygun dersler ve onarım açılır.'],actions};
    }
    if(tab==='journal'){
      const battle=this.militarySystem.getBattlefield().getState(),context=this.questContext(),available=this.questSystem.getAvailable(context),active=this.questSystem.getActive(),completed=this.questSystem.getByStatus('completed'),failed=this.questSystem.getByStatus('failed');
      const questLines=[...active.flatMap(record=>{const def=AUTHORED_QUESTS.find(q=>q.id===record.id)!;return [`${def.title} · etkin · ${def.issuer.name} · ${def.classification==='fictional'?'Kurgusal':'Tarihsel'}`,...record.objectives.map(o=>`${o.completed?'✓':'○'} ${o.text} (${o.current}/${o.target})`),...record.optionalObjectives.map(o=>`${o.completed?'✓':'◇'} İsteğe bağlı: ${o.text} (${o.current}/${o.target})`),`Ödül: ${def.rewards.currency} akçe · ${def.rewards.reputation} itibar. ${def.historicalContext}`,...(def.navigationLocationId?[`Konum: ${def.navigationLocationId}`]:[])];}),...completed.map(r=>`Tamamlandı: ${AUTHORED_QUESTS.find(q=>q.id===r.id)?.title??r.id} · ${r.branchId??''}`),...failed.map(r=>`Başarısız: ${AUTHORED_QUESTS.find(q=>q.id===r.id)?.title??r.id}`),...(available.length?[`Alınabilir: ${available.slice(0,4).map(q=>q.title).join(' · ')}`]:['Şu konum ve tarihte yeni görev yok.'])];
      const militaryLines=[`Askerlik: ${m.isEnlisted?'hizmette':'sivil yaşam'} · Rütbe ${this.militarySystem.getRank()} · Ün ${this.militarySystem.getReputation()}`,`Liderlik ${m.leadership}/100 · Taktik karar ${m.tacticalDecisions} · Erzak itibarı ${m.supplyScore}`];
      const combatStats=this.player.getCombatStats();
      const militaryActions=[...(m.isEnlisted?(!m.currentMission?[{label:'Askerlikten ayrıl',action:'military:leave'}]:[]):[{label:'Hudut birliğine yazıl',action:'military:enlist'}]),...(combatStats.health<combatStats.maxHealth&&!this.militarySystem.getBattlefield().isActive()?[{label:'Yaraları sar · 3 gün dinlen',action:'military:rest_recover'}]:[])];
      const questActions:Array<{label:string;action:string}>=[...available.slice(0,3).map(q=>({label:`Görevi al · ${q.title}`,action:`quest:accept:${q.id}`}))];
      for(const record of active){const def=AUTHORED_QUESTS.find(q=>q.id===record.id)!;if(def.navigationLocationId)questActions.push({label:`Haritada göster · ${def.navigationLocationId}`,action:`quest:navigate:${def.navigationLocationId}`});for(const branch of def.branches){const objectivesDone=record.objectives.every(o=>o.completed);if((branch.requiresObjectives&&objectivesDone)||(!branch.requiresObjectives&&branch.allowBeforeObjectives))questActions.push({label:`${def.title}: ${branch.label}`,action:`quest:resolve:${def.id}:${branch.id}`});}}
      if(active.some(r=>r.id==='heir_education')&&(c?.generation??1)>=2)questActions.push({label:'Varise aile bilgisi aktar',action:'quest:event:family.heir_skill_taught'});
      const legacy=this.questSystem.getState().familyLegacy;
      return {title:'Görev günlüğü',lines:[`Etkin ${active.length} · Tamamlanan ${completed.length} · Başarısız ${failed.length}`,`Aile mirası: itibar +${legacy.familyReputation} · sonraki kuşak desteği ${legacy.descendantSupport}`,...militaryLines,m.currentMission?`Askerî görev: ${m.currentMission.title}`:'Etkin askerî görev yok',...(battle.status!=='inactive'?[`Çatışma: ${battle.status} · Dost kaybı ${this.militarySystem.getBattlefield().getCasualties('friendly')}`]:[]),...questLines,...this.settlementSimulation.getDialogueState().quests.map(id=>`Yerleşim görevi: ${id}`),...m.currentMission?.objectives.map(o=>`${o.completed?'✓':'○'} ${o.description}`)??[],...m.completedMissions.map(id=>`Askerî görev tamamlandı: ${id}`),...this.questSystem.getConsequences().slice(-3)],actions:[...militaryActions,...questActions.slice(0,7),...(m.currentMission?.id==='mission_frontier_skirmish'&&battle.status==='inactive'&&m.isEnlisted?[{label:'Sınır çatışmasına katıl',action:'battle:start'}]:[]),...(battle.status==='active'?[{label:'Savaş alanına dön',action:'battle:resume'}]:[]),...(battle.status==='victory'||battle.status==='defeat'||battle.status==='retreated'?[{label:battle.reported?'Rapor verildi':'Savaş raporunu aç',action:battle.reported?'':'battle:resume'}].filter(a=>a.action):[]),...(m.currentMission?.objectives.filter(o=>!o.completed&&o.type==='survive'&&battle.status==='victory').map(o=>({label:'İlerle',action:`objective:${o.id}`}))??[]),...(m.currentMission&&m.currentMission.objectives.every(o=>o.completed)?[{label:'Görevi tamamla',action:'completeMission'}]:[]),...(!m.currentMission?this.militarySystem.getAvailableMissions().slice(0,3).map(mission=>({label:`Askerî görev: ${mission.title}`,action:`mission:${mission.id}`})):[])]};
    }
    if(tab==='timeline'){
      const year=this.timeManager.getTime().year,ruler=year<1326?'osman_gazi':year<1362?'orhan_gazi':'murad_i';
      this.historicalSystem.updateTime(year,ruler);this.historicalSystem.setContext(this.createHistoricalEventContext());
      const baseline=this.historicalSystem.getBaselineEvents().sort((a,b)=>a.startYear-b.startYear);
      const mobile=this.scale.width<650,past=baseline.filter(e=>e.startYear<=year).slice(-(mobile?1:2)),future=baseline.filter(e=>e.startYear>year).slice(0,mobile?1:2);
      const historyLine=(e:typeof baseline[number])=>{const status=e.classification==='documented_fact'?'kaynaklı':e.classification==='disputed_interpretation'?'tartışmalı':e.classification==='alternate_history'?'alternatif tarih':e.classification==='fictional'?'kurgu':'belirsiz';const place=e.locations.map(id=>HISTORICAL_LOCATIONS.find(l=>l.id===id)?.name??id).join(', ')||'bölge belirtilmemiş';const sources=e.sources.map(citation=>HISTORICAL_SOURCES.find(source=>source.id===citation.sourceId)?.author??citation.sourceId).join(', ');return `${e.dateLabel} · ${e.name} · ${status}/${e.confidence} · ${place}${sources?` · ${sources}`:''}`;};
      const outcomes=this.historicalSystem.getEventHistory().slice(-(mobile?2:3)).map(outcome=>{const event=HISTORICAL_EVENTS.find(candidate=>candidate.id===outcome.eventId),recorded=this.historicalSystem.getState().simulationTimeline.flags[outcome.eventId] as {title?:string}|undefined;return `${outcome.gameYear} · ${event?.title??recorded?.title??outcome.eventId} · ${outcome.classification??(outcome.isDivergent?'alternatif tarih':'kurgu')} · ${event?.choices.find(choice=>choice.id===outcome.chosenChoiceId)?.text??outcome.chosenChoiceId}`;});
      const pending=this.historicalSystem.getPendingChoiceEvents()[0],available=this.historicalSystem.getAvailableEvents().sort((a,b)=>a.earliestYear-b.earliestYear)[0];
      const rulerName=this.historicalSystem.getRulers().find(entry=>entry.id===ruler)?.name??ruler;
      const lines=[...past.map(historyLine),...future.map(e=>`Sonraki temel · ${historyLine(e)}`),`Simülasyon · ${year} · ${rulerName}`,...(outcomes.length?outcomes:['Kişisel bir zaman çizgisi kararı henüz alınmadı.']),...this.historicalSystem.getDivergences().slice(-(mobile?1:2)).map(d=>`BÜYÜK AYRIŞMA · ${d.simulatedOutcome}${d.explanation?` Neden: ${d.explanation}`:''}`),`Gecikmeli sonuçlar: ${this.historicalSystem.getState().simulationTimeline.pendingConsequences?.length??0}`,...(pending?[`Karar · ${pending.title}${pending.baselineEventId?` · bağ ${pending.baselineEventId}`:' · kurmaca'}`,pending.description]:available?[`Olası gelişme · ${available.title}${available.baselineEventId?` · bağ ${available.baselineEventId}`:' · kurmaca'}`]:['Bu yıl için yeni bir olay yok.']),...this.historicalSystem.getUnverifiedHistoricalClaims().slice(0,mobile?0:1).map(claim=>`Belirsiz tarih · ${claim}`)];
      const actions=pending?this.historicalSystem.getAvailableChoices(pending.id).map(choice=>({label:choice.text,action:`timeline:choose:${pending.id}:${choice.id}`})):available?[{label:`Olayı aç · ${available.title}`,action:`timeline:trigger:${available.id}`}]:[];
      return {title:`Tarih çizgisi · ${year}`,lines,actions};
    }
    if(tab==='relations'){const social=this.settlementSimulation.getDialogueState().relationships;return {title:'Siyasi ve kişisel ilişkiler',lines:[`Otorite ${p.authorityId} · Sadakat ${p.loyalty}`,`Nüfuz ${p.localInfluence} · Halk desteği ${p.popularSupport} · Meşruiyet ${p.legitimacy}`,`Komutan Kara ${p.commanderTrust.commander_kara??0} · Kadı ${p.officialTrust.local_cadi??0}`,...Object.entries(p.factionStanding).map(([id,v])=>`${id}: ${v}`),`Arazi hakkı ${p.landRights} · Korku ${p.fear}`,...Object.entries(social).flatMap(([npcId,domains])=>Object.entries(domains).map(([domain,value])=>`${npcId} · ${domain}: ${value}`))]};}
    if(tab==='region'){
      const current=this.regionalWorld.getCurrent(),state=this.regionalWorld.getState(),year=this.timeManager.getTime().year;
      const map=REGIONAL_LOCATIONS.map((loc,i)=>({id:loc.id,name:loc.name,x:[.18,.53,.78,.48][i]??.5,y:[.36,.22,.68,.78][i]??.5,current:loc.id===current.id,visited:state.visited.includes(loc.id),action:`region:travel:${loc.id}`}));
      const routes=REGIONAL_LOCATIONS.flatMap(loc=>loc.neighbors.filter(n=>loc.id<n.id).map(n=>[loc.id,n.id] as [string,string]));
      const actions:Array<{label:string;action:string}>=[];
      for(const neighbor of current.neighbors){const dest=REGIONAL_LOCATIONS.find(l=>l.id===neighbor.id);if(dest&&year>=dest.availableFrom&&(dest.availableUntil===undefined||year<=dest.availableUntil))actions.push({label:`Yola çık · ${dest.name}`,action:`region:travel:${dest.id}`});}
      if(current.services.includes('pazar')){
        const items=['wheat','barley','oats','seed_wheat','seed_barley','seed_oats','hoe'];
        for(const itemId of items)actions.push({label:`Ürün: ${itemId}${this.regionalTradeItem===itemId?' ✓':''}`,action:`region:item:${itemId}`});
        actions.push({label:`Al · ${this.regionalTradeItem} (${this.regionalWorld.getPrice(current.id,this.regionalTradeItem)} akçe)`,action:`region:buy:${this.regionalTradeItem}`},{label:`Sat · ${this.regionalTradeItem}`,action:`region:sell:${this.regionalTradeItem}`});
      }
      if(current.tenure)actions.push({label:`Arazi kullanım hakkı · ${current.tenure.cost} akçe`,action:'region:property'});
      const remotePlots=this.farmManager.getSimulation().getAllPlots().filter(plot=>plot.locationId===current.id&&plot.unlocked);
      for(const plot of remotePlots.slice(0,2)){
        if(plot.state===FarmPlotState.READY_TO_HARVEST)actions.push({label:`Hasat · ${plot.id}`,action:`region:harvest:${plot.id}`});
        else if(plot.state===FarmPlotState.UNTROUCHED||plot.state===FarmPlotState.HARVESTED)actions.push({label:`Toprağı hazırla · ${plot.id}`,action:`region:prepare:${plot.id}`});
        else if(plot.state===FarmPlotState.PREPARED)for(const crop of Object.values(CropType))actions.push({label:`${CROP_DEFINITIONS[crop].name} ek · ${plot.id}`,action:`region:plant:${plot.id}:${crop}`});
      }
      actions.unshift({label:`Yol yöntemi: ${this.regionalTravelMethod==='foot'?'Yaya':'Binekli'}`,action:'region:method'});
      const pageSize=this.scale.width<650?3:6,pages=Math.max(1,Math.ceil(actions.length/pageSize));this.regionalPageCount=pages;this.regionalPage=Math.min(this.regionalPage,pages-1);
      const visible=actions.slice(this.regionalPage*pageSize,this.regionalPage*pageSize+pageSize);
      if(pages>1)visible.push({label:`İşlemler · ${this.regionalPage+1}/${pages}`,action:'region:page'});
      const lines=this.scale.width<650?[`${current.kind} · ${current.terrain} · ${current.climate}`,`Nüfus ${current.population} · Yetki: ${current.authority}`,`Hizmet: ${current.services.join(', ')} · Mülk: ${state.properties.length} · Ziyaret: ${state.visited.length}/${REGIONAL_LOCATIONS.length}`]:[`${current.kind} · ${current.terrain} · ${current.climate}`,`Nüfus ${current.population} · Yetki: ${current.authority}`,`Hizmetler: ${current.services.join(', ')}`,`Mülk: ${state.properties.length} · Ziyaret: ${state.visited.length}/${REGIONAL_LOCATIONS.length}`,`Konumlar kurgusaldır; kira, bu oyunun yerel kullanım hakkı modelidir.`,...state.travelLog.slice(-1)];
      return {title:`Bölgesel yol ağı · ${current.name}`,lines,actions:visible,map,routes};
    }
    if(tab==='saves')return {title:'Kayıt yönetimi',lines:['Gün ve yıl ilerletme sonunda otomatik kayıt alınır. Yükleme hatası özgün kaydı değiştirmez.','Yuva başına kaydet/yükle. Dışa aktarılan JSON başka platformda boş bir yuvaya alınabilir.'],slots:this.knownSaveSlots,actions:[{label:'Dışa aktar · 1',action:'export:slot1'},{label:'İçe aktar · 3',action:'import:slot3'}]};
    if(tab==='audio'){const audio=this.settingsManager.getSettings().audio;return {title:'Ses ayarları',lines:['Tamamen özgün, sentezlenmiş sesler kullanılır. NPC seslendirmesi içerik olarak henüz mevcut değildir.','Kaydırıcıları fare veya dokunmayla ayarlayın; seçili ses düzeyini ok tuşlarıyla da değiştirebilirsiniz.'],audio};}
    if(tab==='help')return {title:'Yardım ve oynanabilir eğitim',lines:[`Eğitim ${this.tutorial.completedCount()}/${this.tutorial.totalSteps()} adım tamamlandı${this.tutorial.isSkipped()?' · atlandı':''}. H tuşu veya bu Defter sekmesiyle yardım açılır. Her adım gerçek bir oyun hareketiyle tamamlanır.`, 'Dersleri tek tek yeniden oynatabilirsiniz. Tarihsel temel ile kurmaca sefer olayları ayrı gösterilir.'],actions:[...(this.tutorial.isReplaying()?[{label:'Sefer eğitimine dön',action:'tutorial:cancel-replay'}]:this.tutorial.isActive()?[{label:'Eğitime dön',action:'tutorial:continue'}]:[]),...TUTORIAL_STEPS.map(step=>({label:`Yeniden öğren · ${step.title}`,action:`tutorial:replay:${step.id}`}))]};
    if(tab==='settings'){const s=this.settingsManager.getSettings();return {title:'Oyun ayarları',lines:['Grafik düzeyini cihazınıza göre seçin. Düşük ayar atmosfer örtülerini ve duman canlandırmalarını azaltır.','Hareket tuşunu değiştirmek için yön düğmesine dokunup yeni bir tuşa basın. Ok tuşları her zaman çalışır.',`Yerleşim saati: ${this.timeManager.getTimeScale().toFixed(1)}×`],settings:{FPS:s.showFPS,Izgara:s.showGrid,Koordinat:s.showCoordinates},choices:{Grafik:s.graphicsQuality},actions:[{label:'Zamanı yavaşlat',action:'time:slower'},{label:'Zamanı hızlandır',action:'time:faster'},{label:`Yukarı · ${s.keyBindings.up}`,action:'rebind:up'},{label:`Aşağı · ${s.keyBindings.down}`,action:'rebind:down'},{label:`Sol · ${s.keyBindings.left}`,action:'rebind:left'},{label:`Sağ · ${s.keyBindings.right}`,action:'rebind:right'}]};}
    return {title:'Oyun duraklatıldı',lines:['Dünya saati durdu. Seferi kaydedin veya ana menüye dönün.'],actions:[{label:'Devam et',action:'resume'},{label:'Ayarlar',action:'settings'},{label:'Kaydet',action:'save:slot1'},{label:'Ana menü',action:'menu'}]};
  }

  private updateAchievements():void {
    const add=(id:string)=>{if(!this.achievements.includes(id))this.achievements.push(id);};
    if(this.familySystem.getCurrentCharacter()?.generation&&this.familySystem.getCurrentCharacter()!.generation>1)add('dynasty_survived');
    if(this.farmManager.getSimulation().getAllPlots().some(plot=>plot.state===5))add('first_harvest');
    if(this.politicalSystem.getState().choices.length>0)add('political_voice');
    if(this.militarySystem.getState().completedMissions.length>0)add('frontier_service');
  }

  private recordTutorialProgress(stepId: string): void {
    if (stepId === 'plant') {
      const planted = this.farmManager.getSimulation().getAllPlots().filter(plot => plot.plantedDay !== undefined).sort((a,b) => (b.plantedDay ?? -1) - (a.plantedDay ?? -1));
      this.tutorialGrowthPlotId = planted[0]?.id ?? null;
    }
    if (!this.tutorial?.completeStep(stepId)) return;
    if (stepId === 'growth') this.tutorialGrowthReplayBaselineDay = null;
    if (this.tutorial.isActive()) this.tutorialGuide?.show();
    else this.tutorialGuide?.hide();
    // Persist the newly completed lesson immediately in the ordinary save slot.
    void this.saveGame(SAVE_SLOT, true);
  }

  private async handleChronicleAction(action:string):Promise<void>{
    if(action.startsWith('timeline:trigger:')){
      const eventId=action.slice('timeline:trigger:'.length),result=this.historicalSystem.triggerEvent(eventId);
      this.showFeedback(result.success?`${result.event?.title} · kurmaca karar olayı açıldı.`:'Bu olay şu anda açılamıyor.',result.success);
      this.chroniclePanel.show('timeline');if(result.success)await this.saveGame(SAVE_SLOT,true);return;
    }
    if(action.startsWith('timeline:choose:')){
      const [, ,eventId,choiceId]=action.split(':');
      const context=this.createHistoricalEventContext();this.historicalSystem.setContext(context);
      const result=this.historicalSystem.makeChoice(eventId??'',choiceId??'',this.timeManager.getTime().totalDays);
      if(result.success){for(const consequence of result.consequences)this.applyHistoricalConsequence(consequence);const event=HISTORICAL_EVENTS.find(e=>e.id===eventId);this.familySystem.recordImportantChoice(`Zaman çizgisi · ${event?.title??eventId}: ${result.message}`,this.timeManager.getTime().year);this.recordQuestEvent('timeline.event_recorded');if(result.isDivergent)this.recordQuestEvent('timeline.alternate_history');}
      this.showFeedback(result.message,result.success);this.updateHud();this.chroniclePanel.show('timeline');if(result.success)await this.saveGame(SAVE_SLOT,true);return;
    }
    if(action.startsWith('profession:mentor:')){
      const [, , , npcId, professionId] = action.split(':');
      const npc=this.settlementSimulation.findNearbyNpc(this.player.getGridPosition());
      const profession=professionId as ProfessionId;
      const accepted=!!npc&&npc.id===npcId&&this.professionSystem.learnFromMentor(profession,npc.id,npc.occupation,Math.floor(this.timeManager.getTime().totalDays),fee=>this.economy.removeCurrency(fee));
      if(accepted){this.familySystem.recordImportantChoice(`${npc!.name} ustadan ${PROFESSION_DEFINITIONS[profession].label} öğrenildi.`,this.timeManager.getTime().year);await this.saveGame(SAVE_SLOT,true);}
      this.showFeedback(accepted?`${npc!.name} ustadan ilk ders alındı.`:'Usta artık yanınızda değil, ders ücreti yetmiyor ya da bu ders daha önce alındı.',accepted);
      this.chroniclePanel.show('character');return;
    }
    if(action==='profession:repair_hoe'){
      const npc=this.settlementSimulation.findNearbyNpc(this.player.getGridPosition());
      const repaired=npc?.occupation==='blacksmith'&&this.professionSystem.repairHoe(Math.floor(this.timeManager.getTime().totalDays),fee=>this.economy.removeCurrency(fee));
      this.showFeedback(repaired?'Demirci çapanın ağzını yeniledi.':'Yakında demirci yok, çapa sağlam ya da paranız yetmiyor.',!!repaired);
      if(repaired)await this.saveGame(SAVE_SLOT,true);
      this.chroniclePanel.show('character');return;
    }
    if(action==='audio:mute'){const audio=this.settingsManager.getSettings().audio;this.settingsManager.setAudioMasterMuted(!audio.masterMuted);this.audioManager.refreshSettings();this.chroniclePanel.show('audio');return;}
    if(action.startsWith('audio:volume:')||action.startsWith('audio:step:')){const [,kind,busText,valueText]=action.split(':');const buses:AudioBus[]=['music','ambience','ui','farming','combat','voice'];if(buses.includes(busText as AudioBus)){const bus=busText as AudioBus;const current=this.settingsManager.getSettings().audio.volumes[bus];const value=kind==='volume'?Number(valueText):current+Number(valueText);if(Number.isFinite(value)){this.settingsManager.setAudioVolume(bus,value);this.audioManager.refreshSettings();}this.chroniclePanel.show('audio');}return;}
    if(action==='tutorial:continue'){this.tutorial.continue();this.chroniclePanel.close();this.tutorialGuide.show();return;}
    if(action==='tutorial:cancel-replay'){this.tutorial.cancelReplay();this.chroniclePanel.close();this.tutorialGuide.show();return;}
    if(action==='tutorial:skip'){this.tutorial.skip();this.tutorialGuide.hide();this.chroniclePanel.close();await this.saveGame(SAVE_SLOT,true);return;}
    if(action.startsWith('tutorial:replay:')){const stepId=action.slice('tutorial:replay:'.length);this.tutorial.replay(stepId);if(stepId==='arrival')this.tutorialStartPosition=this.player.getGridPosition();if(stepId==='growth')this.tutorialGrowthReplayBaselineDay=this.timeManager.getTime().totalDays;if(stepId==='legacy')this.familyTreeViewed=false;this.chroniclePanel.close();this.tutorialGuide.show();return;}
    if(action.startsWith('quest:accept:')){const result=this.questSystem.activate(action.slice('quest:accept:'.length),this.questContext());this.showFeedback(result.message,result.success);this.chroniclePanel.show('journal');if(result.success)await this.saveGame(SAVE_SLOT,true);return;}
    if(action.startsWith('quest:navigate:')){this.chroniclePanel.show('region');this.showFeedback(`Bölge haritasında ${action.slice('quest:navigate:'.length)} konumunu bulun.`,true);return;}
    if(action.startsWith('quest:resolve:')){const [, ,questId,branchId]=action.split(':'),result=this.questSystem.resolve(questId??'',branchId??'',this.questContext(),cost=>{if(this.economy.getCurrency()<(cost.currency??0)||Object.entries(cost.items??{}).some(([id,n])=>!this.inventory.hasItem(id,n)))return false;if(!this.economy.removeCurrency(cost.currency??0))return false;for(const [id,n] of Object.entries(cost.items??{}))if(!this.inventory.removeItem(id,n))return false;return true;});if(result.success){this.cameras.main.flash(140,233,214,156);this.economy.addCurrency(result.rewards?.currency??0);this.politicalSystem.adjustReputation(result.rewards?.reputation??0);for(const [npcId,amount] of Object.entries(result.relationshipChanges??{}))this.settlementSimulation.adjustQuestRelationship(npcId,amount);for(const [factionId,amount] of Object.entries(result.factionChanges??{}))this.politicalSystem.adjustFactionStanding(factionId,amount);if(result.landRightsChange){this.politicalSystem.grantLandRights(result.landRightsChange);this.familySystem.recordLandChange(result.landRightsChange,`Görev uzlaşmasıyla arazi hakkı +${result.landRightsChange}`,this.timeManager.getTime().year);}if(result.legacy)this.familySystem.recordImportantChoice(`Görev mirası: ${result.legacy.familyReputation??0} aile itibarı ve ${result.legacy.descendantSupport??0} kuşak desteği.`,this.timeManager.getTime().year);for(const consequence of result.consequences??[])this.familySystem.recordImportantChoice(consequence,this.timeManager.getTime().year);}this.showFeedback(result.message,result.success);this.updateHud();this.chroniclePanel.show('journal');if(result.success)await this.saveGame(SAVE_SLOT,true);return;}
    if(action.startsWith('quest:event:')){const event=action.slice('quest:event:'.length),changed=this.questSystem.recordEvent(event);this.showFeedback(changed?'Aile bilgisi varise aktarıldı.':'Bu hedef şu anda ilerlemedi.',changed>0);this.chroniclePanel.show('journal');if(changed)await this.saveGame(SAVE_SLOT,true);return;}
    if(action==='region:page'){this.regionalPage=(this.regionalPage+1)%this.regionalPageCount;this.chroniclePanel.show('region');return;}
    if(action==='region:method'){this.regionalTravelMethod=this.regionalTravelMethod==='foot'?'pack_animal':'foot';this.chroniclePanel.show('region');return;}
    if(action.startsWith('region:item:')){this.regionalTradeItem=action.slice('region:item:'.length);this.chroniclePanel.show('region');return;}
    if(action.startsWith('region:travel:')){
      const destination=action.slice('region:travel:'.length),startYear=this.timeManager.getTime().year;
      const route=this.regionalWorld.getCurrent().neighbors.find(n=>n.id===destination);const hireCost=this.regionalTravelMethod==='pack_animal'?Math.ceil((route?.distance??0)*0.6):0;
      if(hireCost&&!this.economy.removeCurrency(hireCost)){this.showFeedback(`Binek kiralığı için ${hireCost} akçe gerekli.`,false);return;}
      let provisionsShort=false;
      const weather=this.settlementSimulation.getWeather();
      const result=this.regionalWorld.travel(destination,startYear,this.timeManager.getTime(),()=>{this.timeManager.advanceDay();if(this.inventory.hasItem('barley'))this.inventory.removeItem('barley',1);else if(this.inventory.hasItem('wheat'))this.inventory.removeItem('wheat',1);else provisionsShort=true;this.settlementSimulation.advanceSimulationToNow();this.farmManager.syncGrowth();this.marketSystem.update();this.historicalSystem.updateTime(this.timeManager.getTime().year);this.updateQuestLifecycle();},weather,this.regionalTravelMethod,()=>this.historicalSystem.checkForTriggeredEvents().some(e=>e.triggered&&e.event&&!e.event.isFictional));
      this.showFeedback(`${result.message}${provisionsShort?' Erzak azlığı yüzünden yol uzadı ve erzak gereksinimi karşılanamadı.':''}${hireCost?` Binek gideri: ${hireCost} akçe.`:''}`,result.success);if(result.success){this.recordQuestEvent(`region.visit.${destination}`);this.historicalSystem.recordSimulationEvent({id:`regional_travel_${destination}_${this.timeManager.getTime().year}_${this.timeManager.getTime().totalDays}`,title:'Bölgesel Yolculuk (Kurgusal)',description:`Oyuncu ${this.regionalWorld.getCurrent().name} konumuna seyahat etti.`,year:this.timeManager.getTime().year,choice:'Bölgesel güzergâhta yolculuk',consequences:[`${result.days??0} gün takvim ilerledi`,...(result.interrupted?['Tarihsel olay yaklaşınca yolculuk durdu']:[])],isFictional:true});this.recordQuestEvent('timeline.event_recorded');this.timeManager.pause();this.updateHud();this.chroniclePanel.show('region');await this.saveGame(SAVE_SLOT,true);}return;
    }
    if(action.startsWith('region:buy:')||action.startsWith('region:sell:')){
      const buy=action.startsWith('region:buy:'),itemId=action.slice(action.lastIndexOf(':')+1),current=this.regionalWorld.getCurrent();
      const result=this.regionalWorld.trade(current.id,itemId,1,buy?'buy':'sell',this.inventory,this.economy);this.showFeedback(result.message,result.success);this.chroniclePanel.show('region');if(result.success){this.professionSystem.recordTrade(buy?'buy':'sell',itemId,1,Math.floor(this.timeManager.getTime().totalDays));this.recordQuestEvent('market.regional_trade');await this.saveGame(SAVE_SLOT,true);}return;
    }
    if(action==='region:property'){
      const political=this.politicalSystem.getState(),time=this.timeManager.getTime(),result=this.regionalWorld.acquireProperty(this.regionalWorld.getCurrent().id,time.totalDays,political.landRights,political.localInfluence,this.economy);
      if(result.success&&result.property){this.farmManager.getSimulation().addRegionalProperty(result.property.id,result.property.locationId,result.property.plots);this.familySystem.recordLandChange(result.property.plots,`${result.property.locationId} konumunda ${result.property.plots} parsel kullanım hakkı edinildi.`,time.year);this.familySystem.updateFamilyRelationship('settlement',result.property.locationId,5);}
      this.showFeedback(result.message,result.success);this.chroniclePanel.show('region');if(result.success)await this.saveGame(SAVE_SLOT,true);return;
    }
    if(action.startsWith('region:prepare:')||action.startsWith('region:harvest:')){
      const marker=action.startsWith('region:prepare:')?'region:prepare:':'region:harvest:',plotId=action.slice(marker.length),sim=this.farmManager.getSimulation(),crop=sim.getPlotById(plotId)?.cropType;
      const isPrepare=action.startsWith('region:prepare:'),result=isPrepare?sim.preparePlot(plotId,this.inventory):sim.harvestCrop(plotId,this.inventory);this.farmManager.syncGrowth();this.showFeedback(result.message,result.success);this.chroniclePanel.show('region');if(result.success){this.audioManager.playFarming(isPrepare?'prepare':'harvest');if(!isPrepare){this.recordQuestEvent('farm.harvest');this.recordTutorialProgress('harvest');if(crop===CropType.BARLEY)this.recordQuestEvent('farm.harvest.barley');if(crop===CropType.WHEAT)this.recordQuestEvent('farm.harvest.wheat');if(crop===CropType.OATS)this.recordQuestEvent('farm.harvest.oats');}await this.saveGame(SAVE_SLOT,true);}return;
    }
    if(action.startsWith('region:plant:')){
      const [, ,plotId,crop]=action.split(':'),cropType=Object.values(CropType).find(type=>type===crop)??CropType.WHEAT,result=this.farmManager.getSimulation().plantCrop(plotId??'',cropType,this.timeManager.getTime(),this.inventory);this.farmManager.syncGrowth();this.showFeedback(result.message,result.success);this.chroniclePanel.show('region');if(result.success){this.audioManager.playFarming('plant');await this.saveGame(SAVE_SLOT,true);}return;
    }
    if(action.startsWith('save:')){await this.saveGame(action.slice(5));return;}
    if(action.startsWith('load:')){await this.loadGame(action.slice(5));return;}
    if(action==='menu'){await this.saveGame('slot1',true);this.chroniclePanel.close();this.timeManager.pause();this.scene.start('MainMenuScene');return;}
    if(action==='settings'){this.chroniclePanel.show('settings');return;}
    if(action.startsWith('setting:')){const key=action.slice(8),s=this.settingsManager.getSettings();if(key==='FPS')this.settingsManager.setShowFPS(!s.showFPS);if(key==='Izgara')this.settingsManager.setShowGrid(!s.showGrid);if(key==='Koordinat')this.settingsManager.setShowCoordinates(!s.showCoordinates);this.updateDebugVisibility();this.chroniclePanel.show('settings');}
    if(action.startsWith('choice:')){const quality=this.settingsManager.getSettings().graphicsQuality;this.settingsManager.setGraphicsQuality(quality==='high'?'low':quality==='low'?'balanced':'high');this.applyGraphicsQuality();this.chroniclePanel.show('settings');return;}
    if(action==='time:slower'||action==='time:faster'){
      const current=this.timeManager.getTimeScale();
      const next=action==='time:slower'?Math.max(0.5,current/2):Math.min(4,current*2);
      this.timeManager.setTimeScale(next);
      this.showFeedback(`Yerleşim saati ${next.toFixed(1)}× hızında.`,true);
      this.chroniclePanel.show('settings');return;
    }
    if(action.startsWith('rebind:')){const direction=action.slice(7) as 'up'|'down'|'left'|'right';this.showFeedback('Yeni tuşa basın (vazgeçmek için Esc)',true);this.input.keyboard?.once('keydown',(event:KeyboardEvent)=>{if(event.key==='Escape'){this.chroniclePanel.show('settings');return;}const reserved=['E','F','M','T','Y','G','B','H','J','P',' ','ARROWUP','ARROWDOWN','ARROWLEFT','ARROWRIGHT'];if(/^[a-z0-9]$/i.test(event.key)&&!reserved.includes(event.key.toUpperCase())){this.inputManager.setMovementBinding(direction,event.key);this.showFeedback(`${direction} hareket tuşu ${event.key.toUpperCase()} oldu.`,true);}else this.showFeedback('Bu tuş başka bir komut için ayrılmış.',false);this.chroniclePanel.show('settings');});return;}
    if(action.startsWith('export:')){const slot=action.slice(7),contents=await this.saveManager.exportGame(slot);const ok=contents?await platformAdapter.exportText(`ottoman-${slot}.json`,contents):false;this.showFeedback(ok?'Kayıt dosyası dışa aktarıldı.':'Bu yuva dışa aktarılamadı veya işlem iptal edildi.',ok);return;}
    if(action.startsWith('import:')){const slot=action.slice(7),contents=await platformAdapter.importText();if(contents===null){this.showFeedback('Dosya seçimi iptal edildi.',false);return;}const ok=await this.saveManager.importGame(slot,contents);this.knownSaveSlots=await this.saveManager.getSaveSlots();this.showFeedback(ok?`${slot} yuvasına kayıt alındı.`:'Dosya geçersiz veya hedef yuva dolu; mevcut kayıt korunuyor.',ok);this.chroniclePanel.show('saves');return;}
    if(action.startsWith('equip:')){const result=this.player.getEquipmentSystem().equipWeapon(action.slice(6) as WeaponType,this.timeManager.getTime().year);if(result.success)this.player.refreshAppearanceArt();this.showFeedback(result.message,result.success);this.chroniclePanel.show('inventory');}
    if(action.startsWith('armor:')){const result=this.player.getEquipmentSystem().equipArmor(action.slice(6) as ArmorType);if(result.success)this.player.refreshAppearanceArt();this.showFeedback(result.message,result.success);this.chroniclePanel.show('inventory');}
    if(action.startsWith('mission:')){const result=this.militarySystem.acceptMission(action.slice(8));this.showFeedback(result.message,result.success);if(result.success)this.recordTutorialProgress('military');this.chroniclePanel.show('journal');}
    if(action==='military:leave'||action==='military:enlist'){
      const result=action==='military:leave'?this.militarySystem.leaveService():this.militarySystem.enlist(this.familySystem.getCurrentCharacter()?.skills.leadership??0);
      this.showFeedback(result.message,result.success);this.chroniclePanel.show('journal');await this.saveGame(SAVE_SLOT,true);return;
    }
    if(action==='military:rest_recover'){
      if(this.militarySystem.getBattlefield().isActive()){this.showFeedback('Çatışma sürerken dinlenemezsiniz.',false);return;}
      this.timeManager.advanceDays(3);
      this.settlementSimulation.advanceSimulationToNow();this.farmManager.syncGrowth();this.marketSystem.update();this.historicalSystem.updateTime(this.timeManager.getTime().year);this.updateQuestLifecycle();
      const healed=this.player.getCombatStats().maxHealth-this.player.getCombatStats().health;
      this.player.recoverFromInjury(Math.min(healed,30));
      this.player.getCombatStats().stamina=this.player.getCombatStats().maxStamina;
      this.showFeedback('Üç gün dinlenip yaralarınızı sardınız.',true);this.updateHud();this.chroniclePanel.show('journal');await this.saveGame(SAVE_SLOT,true);return;
    }
    if(action==='battle:start'||action==='battle:resume'){
      if(action==='battle:start'){
        const weapon=this.player.getEquipmentSystem().getWeaponStats(),armor=this.player.getEquipmentSystem().getArmorStats(),playerStats=this.player.getCombatStats();
        const ration=this.inventory.hasItem('wheat')?'wheat':this.inventory.hasItem('barley')?'barley':null;
        const supplied=!!ration,weather=this.settlementSimulation.getWeather();
        const battleWeather=weather==='fog'||weather==='wind'?'cloudy':weather;
        const result=this.militarySystem.startBattle(this.timeManager.getTime().year,{weather:battleWeather,supplied,ammunition:weapon.range>1.7?this.inventory.getItemCount('arrows'):0,fatigue:(1-playerStats.stamina/playerStats.maxStamina)*100,weaponRange:weapon.range,weaponDamage:weapon.damage,armorDefense:armor.defense,stamina:playerStats.stamina,maxStamina:playerStats.maxStamina,health:playerStats.health,maxHealth:playerStats.maxHealth});
        this.showFeedback(result.message,result.success);if(!result.success){this.chroniclePanel.show('journal');return;}
        if(ration)this.inventory.removeItem(ration,1);this.militarySystem.recordSupplyUse(supplied);
        this.historicalSystem.recordSimulationEvent({id:`fictional_battle_started_${this.timeManager.getTime().year}_${Math.floor(this.timeManager.getTime().totalDays)}`,title:'Sınır Çatışması Başladı (Kurgusal)',description:'Bir kurmaca sınır çatışması başladı; bu karşılaşma belgelenmiş bir tarihsel savaşı temsil etmez.',year:this.timeManager.getTime().year,choice:'Sınır görevine katılındı',consequences:[`Hava: ${weather}`,`Erzak: ${supplied?'mevcut':'yok'}`,`Ön yorgunluk: ${Math.round((1-playerStats.stamina/playerStats.maxStamina)*100)}%`,`Silah: ${weapon.name}`],isFictional:true});
      }
      this.chroniclePanel.close();this.timeManager.pause();this.battlefieldPanel.open();void this.saveGame(SAVE_SLOT,true);return;
    }
    if(action.startsWith('objective:')){this.militarySystem.updateMissionObjective(action.slice(10));this.chroniclePanel.show('journal');return;}
    if(action==='completeMission'){const missionId=this.militarySystem.getState().currentMission?.id??'mission';const result=this.militarySystem.completeMission('diplomatic');if(result.success)this.cameras.main.flash(140,233,214,156);if(result.success&&result.rewards){this.economy.addCurrency(result.rewards.currency);this.politicalSystem.adjustReputation(result.rewards.reputation);this.professionSystem.recordActivity('military','military_service',missionId,Math.floor(this.timeManager.getTime().totalDays));}this.showFeedback(result.message,result.success);this.chroniclePanel.show('journal');return;}
    if(action==='resume'){this.manualPaused=false;this.pauseText.setVisible(false);this.chroniclePanel.close();this.timeManager.resume(Date.now());return;}
  }

  private createHistoricalEventContext(){
    const politics=this.politicalSystem.getState(),military=this.militarySystem.getState(),dialogue=this.settlementSimulation.getDialogueState();
    const relationships=Object.fromEntries(Object.entries(dialogue.relationships).map(([id,domains])=>[id,Object.values(domains).reduce((sum,value)=>sum+value,0)/Math.max(1,Object.values(domains).length)]));
    return {reputation:politics.reputation,rank:military.rank,relationships,completedEvents:Object.keys(this.historicalSystem.getState().simulationTimeline.eventOutcomes),completedMissions:military.completedMissions,currency:this.economy.getCurrency(),militaryStrength:politics.militaryStrength,factionStanding:politics.factionStanding,familyGeneration:this.familySystem.getCurrentCharacter()?.generation??1,totalDays:this.timeManager.getTime().totalDays};
  }

  private applyHistoricalConsequence(consequence:EventConsequence):void{
    const value=typeof consequence.value==='number'?consequence.value:Number(consequence.value??0);
    switch(consequence.type){
      case 'reputation':this.politicalSystem.adjustReputation(value);break;
      case 'currency':if(value>=0)this.economy.addCurrency(value);else this.economy.removeCurrency(-value);break;
      case 'relationship':if(consequence.target)this.settlementSimulation.adjustQuestRelationship(consequence.target,value);break;
      case 'add_item':if(consequence.target)this.inventory.addItem(consequence.target,Math.max(1,Math.floor(value||1)));break;
      case 'set_flag':if(consequence.target)this.historicalSystem.setFlag(consequence.target,consequence.value);break;
      case 'modify_military':if(consequence.target==='leadership')this.militarySystem.setLeadershipScore(this.militarySystem.getState().leadership+value);break;
      case 'rank_progress':this.politicalSystem.adjustReputation(value);break;
      case 'trigger_event':if(typeof consequence.value==='string')this.historicalSystem.triggerEvent(consequence.value);break;
    }
  }
  private openPauseMenu():void{this.timeManager.pause();this.pauseText.setVisible(true);this.chroniclePanel.open('pause');}

  private handleResize(): void {
    this.applyViewportLayout();
    this.zoomLevel = Phaser.Math.Clamp(this.baseWorldZoom, this.minZoom, this.maxZoom);
    this.cameras.main.setZoom(this.zoomLevel);
    this.layoutWorldLighting();
    this.scaleHudText(this.zoomLevel);
    this.layoutHudText();
    this.virtualJoystick.layout();
    this.interactionButton.layout();
    this.farmInteractionSystem.handleResize();
    this.interactionSystem.handleResize();
  }

  private handleShutdown(): void {
    this.chroniclePanel?.close();
    this.battlefieldPanel?.destroy();
    this.dialoguePanel?.destroy();
    this.familyTreePanel?.close();
    this.successionPanel?.close();
    this.settlementSimulation?.destroy();
    this.events.off('settlement-timeline-event', this.recordSettlementTimelineEvent, this);
    this.timeManager.pause();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.scale.off('resize', this.handleResize, this);
    this.events.off(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);
  }

  private recordSettlementTimelineEvent(event: { id: string; title: string; description: string; year: number; choice: string; consequences: string[] }): void {
    this.historicalSystem.recordSimulationEvent({ ...event, isFictional: true });
    this.recordQuestEvent('timeline.event_recorded');
  }

  private questContext():QuestContext {
    const time=this.timeManager.getTime(),state=this.questSystem.getState(),current=this.regionalWorld.getCurrent();
    const dialogue=this.settlementSimulation.getDialogueState(),politics=this.politicalSystem.getState();
    return {year:time.year,day:Math.floor(time.totalDays),generation:this.familySystem.getCurrentCharacter()?.generation??1,descendantSupport:state.familyLegacy.descendantSupport,currency:this.economy.getCurrency(),inventory:Object.fromEntries(this.inventory.getAllItems().map(i=>[i.itemId,i.quantity])),relationships:dialogue.relationships,factionStanding:politics.factionStanding,locationId:current.id,knownLocations:REGIONAL_LOCATIONS.map(l=>l.id),knownNpcs:this.settlementSimulation.getNpcs().map(n=>n.id),knownItems:Object.keys(ITEM_DEFINITIONS),knownHistoricalEvents:HISTORICAL_EVENTS.map(e=>e.id),completedQuestIds:this.questSystem.getByStatus('completed').map(q=>q.id),worldFlags:[...state.flags,...dialogue.flags,...politics.choices,...current.services.map(s=>`service:${s}`)]};
  }

  private recordQuestEvent(event:string,amount=1):void { this.questSystem?.recordEvent(event,amount); }
  private updateQuestLifecycle():void {
    const day=Math.floor(this.timeManager.getTime().totalDays);
    const year=this.timeManager.getTime().year;
    this.historicalSystem.updateTime(year,year<1326?'osman_gazi':year<1362?'orhan_gazi':'murad_i');
    this.historicalSystem.setContext(this.createHistoricalEventContext());
    for(const due of this.historicalSystem.advanceConsequencesToDay(day)){
      this.applyHistoricalConsequence(due.consequence);
      this.familySystem.recordImportantChoice(`Gecikmeli zaman çizgisi sonucu: ${due.consequence.description}`,year);
    }
    const weather=this.settlementSimulation?.getWeather();this.marketSystem?.setTradeRouteDisruption(weather==='rain'?0.12:weather==='snow'?0.2:weather==='fog'?0.08:weather==='wind'?0.05:0);
    if(day!==this.lastPoliticalDay){this.politicalSystem?.updateEra(year,year<1326?'osman_gazi':year<1362?'orhan_gazi':'murad_i',this.historicalSystem);const changed=this.politicalSystem?.advanceToDay(day,this.historicalSystem,year);if(changed){this.politicalPanel?.refresh();this.marketSystem?.setPoliticalStanding(this.politicalSystem.getState().factionStanding.market_merchants??0);this.showFeedback('Pazar sözleşmesinin süresi geçti; Yusuf’un güveni azaldı.',false);}this.lastPoliticalDay=day;}
    if(!this.questSystem||day===this.lastQuestDay)return;this.lastQuestDay=day;
    const failed=this.questSystem.updateDay(this.questContext());if(failed.length)this.showFeedback(`Süresi dolan görev: ${failed.map(id=>this.questSystem.getDefinitions().find(q=>q.id===id)?.title??id).join(', ')}`,false);
  }

  private reportBattle(): void {
    const battle=this.militarySystem.getBattlefield().getState();
    const result=this.militarySystem.resolveBattleReport();
    if(result.success)this.historicalSystem.setFlag('last_battle_outcome',battle.status);
    if(result.success)this.audioManager.playCombat(battle.status==='victory'?'command':'impact');
    this.showFeedback(result.message,result.success);
    if(result.success){
      const victory=battle.status==='victory';
      this.settlementSimulation.recordMilitaryOutcome(victory,result.casualties);
      this.recordQuestEvent('military.report');
      this.recordQuestEvent('military.service');
      if(victory){
        const completed=this.militarySystem.completeMission('cautious');
        if(completed.success&&completed.rewards){
          this.professionSystem.recordActivity('military','military_service',this.militarySystem.getState().completedMissions.at(-1)??`battle_${battle.tick}`,Math.floor(this.timeManager.getTime().totalDays));
          this.economy.addCurrency(completed.rewards.currency);
          this.politicalSystem.adjustReputation(completed.rewards.reputation);
          for(const item of completed.rewards.items??[])this.inventory.addItem(item.itemId,item.quantity);
        }
        this.familySystem.recordMilitaryAchievement(`Kurgusal sınır çatışmasında görev tamamlandı; ${result.casualties} dost kaybı.`,this.timeManager.getTime().year);
      }else{
        this.militarySystem.failMission();
        const outcome=battle.status==='retreated'?'güvenli geri çekilme':'yenilgi';
        this.familySystem.recordImportantChoice(`Kurgusal hudut çatışmasında ${outcome} yaşandı; ${result.casualties} dost kaybı ve ${result.enemyCasualties} düşman kaybı kayda geçti.`,this.timeManager.getTime().year);
      }
      this.historicalSystem.recordSimulationEvent({id:`fictional_battle_report_${this.timeManager.getTime().year}_${battle.tick}`,title:`Sınır Çatışması Raporu · ${victory?'Zafer':battle.status==='retreated'?'Geri çekilme':'Yenilgi'} (Kurgusal)`,description:'Oyuncu komutasındaki küçük sınır çatışması ve kayıpları oyun simülasyonunda kaydedildi.',year:this.timeManager.getTime().year,choice:victory?'Dost birlikler alanı tuttu':'Dost birlikler geri çekildi veya yenildi',consequences:[`Dost kaybı: ${result.casualties}`,`Düşman kaybı: ${result.enemyCasualties}`,'Komutan ilişkisi ve askerî itibar güncellendi'],isFictional:true});
    }
    this.battlefieldPanel.close();
    this.chroniclePanel?.show('journal');
    this.updateHud();
    void this.saveGame(SAVE_SLOT,true);
  }

  update(time: number, delta: number): void {
    if(typeof document!=='undefined'&&document.hidden)return;
    this.updateHud();
    this.updateAudioState(time);
    if (this.tutorialGuideHiddenForFamily && !this.familyTreePanel.isOpen()) {
      this.tutorialGuideHiddenForFamily = false;
      this.tutorialGuide?.show();
    }

    if(this.battlefieldPanel?.isOpen()&&this.militarySystem.getBattlefield().isActive()&&!this.battlefieldPanel.isPaused()){
      const playerUnitBefore=this.militarySystem.getBattlefield().getUnits().find(unit=>unit.id==='player_character');
      const healthBefore=playerUnitBefore?.health??0;
      this.militarySystem.getBattlefield().update(delta/1000);
      const battleState=this.militarySystem.getBattlefield().getState();
      const playerUnitAfter=battleState.units.find(unit=>unit.id==='player_character');
      if(playerUnitAfter){const injury=Math.max(0,healthBefore-playerUnitAfter.health);if(injury>0)this.player.takeDamage(injury);this.player.getCombatStats().stamina=Math.max(0,Math.min(this.player.getCombatStats().maxStamina,playerUnitAfter.stamina));}
      const status=battleState.status;
      const tick=battleState.tick;
      if(status!=='active'&&tick!==this.lastBattlePanelTick){this.lastBattlePanelTick=tick;this.lastBattleSaveTick=tick;this.battlefieldPanel.refresh();void this.saveGame(SAVE_SLOT,true);}
      else if(status==='active'&&tick!==this.lastBattlePanelTick&&tick%3===0){this.lastBattlePanelTick=tick;this.battlefieldPanel.refresh();}
      if(status==='active'&&tick>=this.lastBattleSaveTick+10){this.lastBattleSaveTick=tick;void this.saveGame(SAVE_SLOT,true);}
    }

    // A paused world freezes movement, prompts and all simulation.
    if (this.timeManager.isPaused()) {
      this.interactionButton.hide();
      return;
    }

    this.inputManager.update();
    this.player.update(time, delta);
    this.interactionSystem.update();
    this.farmInteractionSystem.update();
    this.farmManager.update();
    this.marketSystem.update();
    this.syncFamily();
    this.updateQuestLifecycle();

    const pos = this.player.getGridPosition();
    if (this.tutorialStartPosition && Math.hypot(pos.x - this.tutorialStartPosition.x, pos.y - this.tutorialStartPosition.y) >= 2) this.recordTutorialProgress('arrival');
    const growthPlot=this.tutorialGrowthPlotId?this.farmManager.getSimulation().getPlotById(this.tutorialGrowthPlotId):undefined;
    const currentDay=this.timeManager.getTime().totalDays;
    if(growthPlot?.state===FarmPlotState.READY_TO_HARVEST&&growthPlot.plantedDay!==undefined&&currentDay>growthPlot.plantedDay&&(this.tutorialGrowthReplayBaselineDay===null||currentDay>this.tutorialGrowthReplayBaselineDay))this.recordTutorialProgress('growth');
    const newSettlementDay = this.settlementSimulation.update(time, pos);
    if (this.farmManager.simulateNpcFarmWork(this.settlementSimulation.getNpcs(), this.timeManager.getTime())) void this.saveGame(SAVE_SLOT,true);
    this.marketSystem.setBusinessOpen(this.settlementSimulation.isMarketOpen());
    this.updateWorldLighting(time);
    this.updateWeatherParticles(time);
    if (newSettlementDay) void this.saveGame(SAVE_SLOT, true);
    const hasFarmContext = this.farmManager.getPlotAt(pos.x, pos.y) !== null;
    const hasObjectContext = this.interactionSystem.hasTarget();
    const hasNpcContext = this.settlementSimulation.findNearbyNpc(pos) !== null;
    if (this.touchLayout) {
      if (hasFarmContext || hasObjectContext || this.nearMarket() || hasNpcContext) {
        this.interactionButton.show();
      } else {
        this.interactionButton.hide();
      }
    }

    if (this.settingsManager.getSettings().debugMode) {
      this.drawDebugGrid();
    }
  }
}
