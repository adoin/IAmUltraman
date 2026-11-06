// Shared contact/emission times keep animation, VFX and combat damage in agreement.
export const BEAM_TIMING=Object.freeze({ready:.32,fire:.42,impact:.64,fade:1.42,lightEnd:1.62,end:1.96});
export const DISC_TIMING=Object.freeze({ready:.45,release:.72,impact:1.1,end:1.55});

export const DISC_THROW_TIMING=Object.freeze({ready:0,release:.2,impact:.58,end:1});
export const discTiming=effect=>effect?.prepared?DISC_THROW_TIMING:DISC_TIMING;
