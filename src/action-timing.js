// Shared contact/emission times keep animation, VFX and combat damage in agreement.
export const BEAM_TIMING = Object.freeze({ ready: 0.32, fire: 0.42, impact: 0.64, fade: 1.42, lightEnd: 1.62, end: 1.96 });
export const DISC_TIMING = Object.freeze({ ready: 0.45, release: 0.72, impact: 1.1, end: 1.55 });

export const DISC_THROW_TIMING = Object.freeze({ ready: 0, release: 0.2, impact: 0.58, end: 1 });
export const discTiming = (effect) => (effect?.prepared ? DISC_THROW_TIMING : DISC_TIMING);

/**
 * Tiga's Zepellion ray is the finisher, so it takes a slow three-beat wind-up
 * before the light: reach (both arms pushed forward), pull (forearms dragged
 * wide), cross (the L/photonic cross), then fire. The ready phase lasts more
 * than 1.5x the Mebium ray's and the contact lands later - that cost is what the
 * stronger hit buys.
 */
export const ZEPELLION_TIMING = Object.freeze({
  reach: 0.6,
  pull: 0.86,
  pullHold: 1.24,
  cross: 1.8,
  ready: 1.85,
  fire: 1.85,
  impact: 2.1,
  fade: 3.0,
  lightEnd: 3.2,
  end: 3.6,
});

export const ZEPELLION_PREPARED_TIMING=Object.freeze({reach:0,pull:0,pullHold:0,cross:0,ready:.12,fire:.12,impact:.37,fade:1.27,lightEnd:1.47,end:1.87});
export const beamTimingFor=(kind,prepared=false)=>kind==='zepellion'?(prepared?ZEPELLION_PREPARED_TIMING:ZEPELLION_TIMING):BEAM_TIMING;
