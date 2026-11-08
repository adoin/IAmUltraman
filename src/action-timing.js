// Shared contact/emission times keep animation, VFX and combat damage in agreement.
export const BEAM_TIMING = Object.freeze({ ready: 0.32, fire: 0.42, impact: 0.64, fade: 1.42, lightEnd: 1.62, end: 1.96 });
export const DISC_TIMING = Object.freeze({ ready: 0.45, release: 0.72, impact: 1.1, end: 1.55 });

export const DISC_THROW_TIMING = Object.freeze({ ready: 0, release: 0.2, impact: 0.58, end: 1 });
export const discTiming = (effect) => (effect?.prepared ? DISC_THROW_TIMING : DISC_TIMING);

/**
 * Tiga's Zepellion ray is the finisher, so it reads as three beats instead of a
 * single pose: gather (arms drawn together in front of the chest), form (the L
 * cross), fire. The ready phase lasts at least 1.5x the Mebium beam's and the
 * contact lands later, which is what the stronger hit costs the player.
 */
export const ZEPELLION_TIMING = Object.freeze({
  gather: 0.55,
  ready: 1.0,
  form: 1.0,
  fire: 1.05,
  impact: 1.28,
  fade: 2.1,
  lightEnd: 2.35,
  end: 2.7,
});

export const beamTimingFor = (kind) => (kind === 'zepellion' ? ZEPELLION_TIMING : BEAM_TIMING);
