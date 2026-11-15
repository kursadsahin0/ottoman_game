import { ATMOSPHERE_PARTICLE_BUDGET, ATMOSPHERE_PRESETS, localLightIntensity } from '@data/AtmosphereData';

const places=Object.keys(ATMOSPHERE_PRESETS);
if(places.length!==5)throw new Error('Every game location needs an atmosphere profile.');
for(const [place,preset] of Object.entries(ATMOSPHERE_PRESETS)){
  if(preset.nightAlpha<0||preset.nightAlpha>0.48||preset.ambienceGain<=0||preset.ambienceGain>1.2)throw new Error(`Invalid atmosphere values for ${place}.`);
}
if(ATMOSPHERE_PARTICLE_BUDGET.low!==0||ATMOSPHERE_PARTICLE_BUDGET.balanced>ATMOSPHERE_PARTICLE_BUDGET.high)throw new Error('Reduced effects must disable and cap atmospheric particles.');
if(localLightIntensity(2)!==0.2||localLightIntensity(12)!==0||localLightIntensity(19)<=0)throw new Error('Local lamp light should fade through night, day and dusk.');
console.log('Atmosphere location profiles, night tint limits and reduced effect budgets verified.');
