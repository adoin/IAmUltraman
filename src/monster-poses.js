/**
 * Per-kaiju attack poses.
 *
 * Each entry describes the bone targets for one attack slot so every monster
 * moves like its source material instead of sharing one generic pose. All
 * vectors are directions in the kaiju's own frame: +x points to its left,
 * +y up, +z toward the player (the direction it faces).
 *
 *   windup / flight  the two phases of an attack
 *     arms    {L,R} whole-limb directions (shoulder → hand)
 *     lower   {L,R} optional forearm directions, for bent arms
 *     legs    {L,R} optional thigh → shin directions (kicks, stamps)
 *     chest   [pitch, yaw] radians, + = lean forward / turn left
 *     head    [pitch, yaw]
 *     hips    [pitch]
 *   emit     where the projectile leaves the body: hand | mouth | forehead | horn | chest
 *
 * Names match docs/monster-moves.md and combat.js MONSTER_ATTACK_NAMES.
 */

const DOWN = [0.3, -1, 0.06];

export const MONSTER_MOVES = {
  baltan: {
    bolt: {
      name: '白色破坏光弹',
      emit: 'hand',
      windup: { arms: { L: [0.72, 0.5, 0.2], R: [-0.72, 0.5, 0.2] }, chest: [-0.06, 0] },
      flight: { arms: { L: [0.34, 0.14, 1], R: [-0.34, 0.14, 1] }, chest: [-0.12, 0] },
    },
    sweep: {
      name: '冷冻光线',
      emit: 'hand',
      windup: { arms: { L: [0.28, 0.9, -0.05], R: [-0.28, 0.9, -0.05] }, chest: [0.08, 0] },
      flight: { arms: { L: [-0.5, 0.15, 0.8], R: [-0.85, 0.08, 0.45] }, chest: [0, 0.32] },
    },
    melee: {
      name: '巴尔坦钳爪突刺',
      emit: 'hand',
      windup: { arms: { L: [0.3, 0.35, 0.1], R: [-0.25, -0.7, -0.55] }, chest: [0.1, 0.15] },
      flight: { arms: { L: [0.5, -0.6, -0.2], R: [-0.15, 0.05, 1] }, chest: [-0.05, -0.15] },
    },
    charge: {
      name: '分身突进',
      emit: 'hand',
      windup: { arms: { L: [0.55, -0.5, -0.55], R: [-0.55, -0.5, -0.55] }, chest: [0.3, 0] },
      flight: { arms: { L: [0.5, -0.6, -0.6], R: [-0.5, -0.6, -0.6] }, chest: [0.36, 0] },
    },
  },

  mefilas: {
    bolt: {
      name: '美菲拉斯光弹',
      emit: 'hand',
      windup: { arms: { L: [0.35, 0.28, 0.4], R: [-0.35, 0.28, 0.4] }, chest: [-0.12, 0] },
      flight: { arms: { L: [0.3, 0.15, 1], R: [-0.3, 0.15, 1] }, chest: [-0.02, 0] },
    },
    sweep: {
      name: '念力波动',
      emit: 'hand',
      windup: { arms: { L: [0.95, 0.22, 0], R: [-0.95, 0.22, 0] }, chest: [0.05, 0] },
      flight: { arms: { L: [0.8, 0.2, 0.6], R: [-0.8, 0.2, 0.6] }, chest: [0.1, 0.18] },
    },
    melee: {
      name: '怪力直拳',
      emit: 'hand',
      windup: { arms: { L: [0.55, -0.5, -0.3], R: [-0.45, -0.35, -0.5] }, chest: [0.1, 0.25] },
      flight: { arms: { L: [0.6, -0.55, -0.15], R: [-0.2, 0.15, 1] }, chest: [0, -0.2] },
    },
    charge: {
      name: '瞬间移动',
      emit: 'hand',
      windup: { arms: { L: [0.25, -0.85, -0.2], R: [-0.25, -0.85, -0.2] }, chest: [0.35, 0] },
      flight: { arms: { L: [0.2, -0.9, -0.3], R: [-0.2, -0.9, -0.3] }, chest: [0.4, 0] },
    },
  },

  'chaos-seven': {
    bolt: {
      name: '艾梅利姆光线',
      emit: 'forehead',
      windup: { arms: { L: [0.45, -0.9, 0.05], R: [0.06, 0.86, 0.18] }, chest: [-0.1, 0.12], head: [0.15, 0.1] },
      flight: { arms: { L: [0.5, -0.85, -0.1], R: [0.08, -0.05, 1] }, lower: { R: [0.05, -0.35, 0.95] }, chest: [0, -0.12], head: [0.05, 0] },
    },
    sweep: {
      name: '头镖飞旋',
      emit: 'hand',
      windup: { arms: { L: [0.55, 0.55, 0.25], R: [-0.1, 0.9, 0.1] }, chest: [0, 0.18], head: [0.12, 0.12] },
      flight: { arms: { L: [0.75, 0.35, -0.35], R: [-0.75, -0.3, 0.6] }, chest: [0, 0.45], head: [0.05, 0.1] },
    },
    melee: {
      name: '赛文式连击',
      emit: 'hand',
      windup: { arms: { L: [0.3, 0.6, 0.3], R: [-0.3, -0.5, -0.55] }, chest: [0.05, 0.15] },
      flight: { arms: { L: [0.35, 0.55, 0.35], R: [-0.15, 0.15, 0.95] }, chest: [-0.05, -0.15] },
    },
    charge: {
      name: '暗影突进',
      emit: 'hand',
      windup: { arms: { L: [0.5, -0.45, -0.6], R: [-0.5, -0.45, -0.6] }, chest: [0.28, 0] },
      flight: { arms: { L: [0.45, -0.5, -0.65], R: [-0.45, -0.5, -0.65] }, chest: [0.34, 0] },
    },
  },

  'chaos-taro': {
    bolt: {
      name: '斯特利姆光线',
      emit: 'hand',
      windup: { arms: { L: [-0.35, 0.12, 0.35], R: [0.35, 0.12, 0.35] }, chest: [0.04, 0] },
      flight: { arms: { L: [1, 0.06, 0.2], R: [-1, 0.06, 0.2] }, lower: { L: [1, 0.02, 0.15], R: [-1, 0.02, 0.15] }, chest: [-0.05, 0] },
    },
    sweep: {
      name: '新斯特利姆光线',
      emit: 'hand',
      windup: { arms: { L: [0.55, -0.35, 0.5], R: [0.3, 0.9, 0.2] }, chest: [0.1, -0.15] },
      flight: { arms: { L: [0.5, -0.8, -0.25], R: [-0.9, 0.12, 0.5] }, chest: [0, 0.34] },
    },
    melee: {
      name: '燕式踢',
      emit: 'hand',
      windup: { arms: { L: [0.6, 0.3, -0.2], R: [-0.6, 0.3, -0.2] }, legs: { R: [0, -0.65, 0.75] }, chest: [-0.18, 0] },
      flight: { arms: { L: [0.75, 0.2, -0.3], R: [-0.75, 0.2, -0.3] }, legs: { R: [0, 0.55, 0.9] }, chest: [-0.25, 0] },
    },
    charge: {
      name: '王者冲锋',
      emit: 'hand',
      windup: { arms: { L: [0.4, -0.75, -0.4], R: [-0.4, -0.75, -0.4] }, chest: [0.3, 0] },
      flight: { arms: { L: [0.35, -0.8, -0.45], R: [-0.35, -0.8, -0.45] }, chest: [0.36, 0] },
    },
  },

  'chaos-ultraman': {
    bolt: {
      name: '卡欧斯斯派修姆光线',
      emit: 'hand',
      windup: { arms: { L: [0.8, 0.3, -0.4], R: [-0.8, 0.3, -0.4] }, chest: [-0.08, 0] },
      // Both forearms cross in front of the chest: the "＋" of the Specium ray.
      flight: { arms: { L: [-0.95, 0.15, 0.55], R: [0.95, 0.15, 0.55] }, chest: [-0.02, 0] },
    },
    sweep: {
      name: '卡欧斯光轮',
      emit: 'hand',
      windup: { arms: { L: [0.35, -0.55, 0.15], R: [0.1, 0.98, 0.05] }, chest: [-0.05, 0.1] },
      flight: { arms: { L: [0.5, -0.2, 0.15], R: [-0.35, -0.55, 0.75] }, chest: [0.12, 0.22] },
    },
    melee: {
      name: '奥特拳',
      emit: 'hand',
      windup: { arms: { L: [0.4, -0.6, -0.3], R: [-0.35, -0.4, -0.6] }, chest: [0.08, 0.2] },
      flight: { arms: { L: [0.45, -0.7, -0.2], R: [-0.2, 0.1, 1] }, chest: [0, -0.2] },
    },
    charge: {
      name: '高速突进',
      emit: 'hand',
      windup: { arms: { L: [0.3, -0.85, -0.15], R: [-0.3, -0.85, -0.15] }, chest: [0.3, 0] },
      flight: { arms: { L: [0.25, -0.9, -0.25], R: [-0.25, -0.9, -0.25] }, chest: [0.35, 0] },
    },
  },

  zetton: {
    bolt: {
      name: '一兆度火球',
      emit: 'mouth',
      // Both hands gather heat at the face; the fireball leaves the mouth.
      windup: { arms: { L: [0.22, 0.62, 0.35], R: [-0.22, 0.62, 0.35] }, head: [0.12, 0], chest: [0.06, 0] },
      flight: { arms: { L: [0.62, -0.35, 0.45], R: [-0.32, -0.92, -0.15] }, head: [-0.08, 0.05], chest: [-0.2, 0.12] },
    },
    sweep: {
      name: '杰顿光线',
      emit: 'hand',
      windup: { arms: { L: [0.3, 0.75, 0.2], R: [-0.3, 0.75, 0.2] }, chest: [0.05, 0] },
      flight: { arms: { L: [0.16, 0.1, 1], R: [-0.16, 0.1, 1] }, lower: { L: [0.05, 0.05, 1], R: [-0.05, 0.05, 1] }, chest: [0, 0] },
    },
    melee: {
      name: '能量拳',
      emit: 'hand',
      windup: { arms: { L: [0.55, -0.6, -0.2], R: [-0.2, -0.75, -0.4] }, chest: [0.15, 0.12] },
      flight: { arms: { L: [0.6, -0.65, -0.1], R: [-0.1, 0.5, 0.9] }, chest: [-0.1, -0.1] },
    },
    charge: {
      name: '瞬间移动',
      emit: 'hand',
      windup: { arms: { L: [0.3, -0.7, -0.3], R: [-0.3, -0.7, -0.3] }, chest: [0.35, 0] },
      flight: { arms: { L: [0.25, -0.75, -0.4], R: [-0.25, -0.75, -0.4] }, chest: [0.4, 0] },
    },
  },

  'gomora-mecha': {
    bolt: {
      name: '机械光弹',
      emit: 'hand',
      windup: { arms: { L: [0.45, -0.7, -0.2], R: [-0.2, 0.5, 0.7] }, chest: [0.05, 0.1], head: [0.1, 0] },
      flight: { arms: { L: [0.5, -0.75, -0.1], R: [-0.1, 0.15, 1] }, chest: [0, -0.1] },
    },
    sweep: {
      name: '超振动波',
      emit: 'horn',
      // The horn has to aim up: lean back so the head bone rises.
      windup: { arms: { L: [0.5, -0.5, -0.4], R: [-0.5, -0.5, -0.4] }, chest: [-0.22, 0], head: [-0.45, 0], hips: [-0.12] },
      flight: { arms: { L: [0.7, 0.2, 0.3], R: [-0.7, 0.2, 0.3] }, chest: [0.16, 0], head: [0.12, 0], hips: [0.05] },
    },
    slam: {
      name: '大地踏击',
      emit: 'hand',
      windup: { arms: { L: [0.25, 0.95, 0.15], R: [-0.25, 0.95, 0.15] }, hips: [-0.15], chest: [-0.2, 0], head: [-0.2, 0] },
      flight: { arms: { L: [0.35, -0.9, 0.35], R: [-0.35, -0.9, 0.35] }, hips: [0.28], chest: [0.25, 0], head: [0.3, 0] },
    },
    melee: {
      name: '机械重拳',
      emit: 'hand',
      windup: { arms: { L: [0.5, -0.6, -0.2], R: [0.1, 0.8, -0.3] }, chest: [0.12, 0.15] },
      flight: { arms: { L: [0.55, -0.65, -0.15], R: [-0.05, -0.35, 0.95] }, chest: [0.08, -0.18] },
    },
    charge: {
      name: '蛮力突进',
      emit: 'hand',
      windup: { arms: { L: [0.45, -0.6, -0.55], R: [-0.45, -0.6, -0.55] }, chest: [0.3, 0], head: [0.2, 0] },
      flight: { arms: { L: [0.4, -0.65, -0.6], R: [-0.4, -0.65, -0.6] }, chest: [0.38, 0], head: [0.3, 0] },
    },
  },

  galactron: {
    bolt: {
      name: '迦拉克隆光线',
      emit: 'chest',
      windup: { arms: { L: [0.85, 0.25, -0.35], R: [-0.85, 0.25, -0.35] }, chest: [-0.2, 0], head: [-0.1, 0] },
      flight: { arms: { L: [0.9, 0.1, 0.35], R: [-0.9, 0.1, 0.35] }, chest: [0.12, 0], head: [0.05, 0] },
    },
    sweep: {
      name: '重力冲击波',
      emit: 'hand',
      windup: { arms: { L: [0.45, -0.85, -0.2], R: [-0.45, -0.85, -0.2] }, chest: [-0.1, 0] },
      flight: { arms: { L: [0.8, -0.55, 0.3], R: [-0.8, -0.55, 0.3] }, chest: [0.22, 0], hips: [0.3] },
    },
    slam: {
      name: '巨体重压',
      emit: 'hand',
      windup: { arms: { L: [0.7, 0.75, 0.1], R: [-0.7, 0.75, 0.1] }, chest: [-0.15, 0] },
      flight: { arms: { L: [0.6, -0.85, 0.3], R: [-0.6, -0.85, 0.3] }, chest: [0.3, 0], hips: [0.2] },
    },
    melee: {
      name: '腕刃斩击',
      emit: 'hand',
      windup: { arms: { L: [0.4, -0.7, -0.2], R: [0.9, 0.2, -0.2] }, chest: [0.05, 0.25] },
      flight: { arms: { L: [0.45, -0.75, -0.1], R: [-0.6, 0.15, 0.8] }, chest: [0, -0.3] },
    },
    charge: {
      name: '暴走冲锋',
      emit: 'hand',
      windup: { arms: { L: [0.7, 0.1, -0.5], R: [-0.7, 0.1, -0.5] }, chest: [0.25, 0] },
      flight: { arms: { L: [0.75, 0.05, -0.6], R: [-0.75, 0.05, -0.6] }, chest: [0.33, 0] },
    },
  },

  gatanothor: {
    bolt: {
      name: '怪光线',
      emit: 'mouth',
      windup: { arms: { L: [0.8, 0.55, 0.2], R: [-0.8, 0.55, 0.2] }, chest: [-0.15, 0], head: [-0.1, 0] },
      flight: { arms: { L: [0.85, 0.2, 0.35], R: [-0.85, 0.2, 0.35] }, chest: [0.12, 0], head: [0.08, 0] },
    },
    sweep: {
      name: '触手横扫',
      emit: 'hand',
      windup: { arms: { L: [0.5, 0.75, 0.1], R: [-0.75, -0.4, 0.2] }, chest: [0, -0.2] },
      flight: { arms: { L: [-0.7, 0.15, 0.7], R: [-0.95, 0.05, 0.35] }, chest: [0, 0.38] },
    },
    slam: {
      name: '触手砸击',
      emit: 'hand',
      windup: { arms: { L: [0.15, 0.95, 0.15], R: [-0.15, 0.95, 0.15] }, chest: [-0.12, 0] },
      flight: { arms: { L: [0.1, -1, 0.15], R: [-0.1, -1, 0.15] }, chest: [0.2, 0] },
    },
    melee: {
      name: '大镰重击',
      emit: 'hand',
      windup: { arms: { L: [0.55, -0.6, -0.2], R: [-0.85, 0.3, -0.1] }, chest: [0.08, 0.2] },
      flight: { arms: { L: [0.6, -0.65, -0.1], R: [-0.5, 0.2, 0.85] }, chest: [0, -0.28] },
    },
    charge: {
      name: '黑暗突进',
      emit: 'hand',
      windup: { arms: { L: [0.35, -0.8, -0.35], R: [-0.35, -0.8, -0.35] }, chest: [0.28, 0] },
      flight: { arms: { L: [0.3, -0.85, -0.45], R: [-0.3, -0.85, -0.45] }, chest: [0.36, 0] },
    },
  },
};

/** Idle arm direction, shared with the resting pose in monster-motion.js. */
export const REST_ARM = { L: [0.3, -1, 0.06], R: [-0.3, -1, 0.06] };

/** Offset of an emission point from the kaiju's head, in its own frame. */
export const EMIT_OFFSETS = {
  mouth: [0, 0.12, 1.25],
  forehead: [0, 0.55, 1.05],
  horn: [0, 1.15, 0.45],
  chest: [0, 0.1, 1.15],
};

export const moveFor = (model, kind) => MONSTER_MOVES[model]?.[kind] || null;
export const emitFor = (model, kind) => (MONSTER_MOVES[model]?.[kind]?.emit || 'hand');
export { DOWN as REST_ARM_FALLBACK };
