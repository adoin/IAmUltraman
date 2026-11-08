import * as THREE from 'three';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const clamp = THREE.MathUtils.clamp;
const ease = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const key = (name) => name.replace(/[ ._]/g, '').toLowerCase();

export class MonsterMotion {
  constructor(root, type, clips) {
    this.root = root;
    this.type = type;
    this.clips = clips.map((clip) => clip.clone());
    this.nodes = new Map();
    this.rest = new Map();
    root.traverse((node) => {
      this.nodes.set(key(node.name), node);
      if (node.isBone) this.rest.set(node, node.quaternion.clone());
    });
    // Converted MMD kaiju keep their skeleton. Two naming styles exist:
    // romanised (L_ZYOUWAN / L_UDE / L_TE / MUNE / KOSHI) and Japanese
    // (腕.L / ひじ.L / 手首.L / 上半身 / センター / 足.L / ひざ.L / 足首.L).
    const pick = (...candidates) => {
      for (const candidate of candidates) {
        const node = this.node(candidate);
        if (node) return node;
      }
      return null;
    };
    const pair = (english, japanese) => ({
      L: pick('L_' + english, japanese + '.L', japanese + 'L'),
      R: pick('R_' + english, japanese + '.R', japanese + 'R'),
    });
    this.rig = {
      hips: pick('KOSHI', 'センター', '下半身'),
      chest: pick('MUNE', '上半身2', '上半身'),
      neck: pick('KUBI', '首'),
      arm: pair('ZYOUWAN', '腕'),
      fore: pair('UDE', 'ひじ'),
      hand: pair('TE', '手首'),
      thigh: pair('MOMO', '足'),
      shin: pair('SUNE', 'ひざ'),
      foot: pair('ASHI', '足首'),
    };
    this.mmd = !!(this.rig.arm.L && this.rig.arm.R && this.rig.hand.L && this.rig.hand.R && this.rig.chest);
    // Rigs without a ひじ/UDE bone still split the arm: 腕2.L is the next joint
    // down, which is enough for the aim() reach.
    if (!this.rig.fore.L) this.rig.fore.L = pick('L_WAN2', '腕3.L', '腕2.L');
    if (!this.rig.fore.R) this.rig.fore.R = pick('R_WAN2', '腕3.R', '腕2.R');
    this.limbs = {L: this.limbChain('L'), R: this.limbChain('R')};
    // A tail baked behind the feet (art/mmd_tail.py) still needs life: sway the
    // chain in world space so the appendage flexes instead of swinging rigidly.
    const tail = [];
    root.traverse((node) => {
      if (node.isBone && /^(hair|尻尾|しっぽ|tail)\d*$/i.test(node.name)) tail.push(node);
    });
    this.tail = [];
    if (tail.length >= 4) {
      const depth = (bone) => {
        let levels = 0;
        for (let node = bone; node; node = node.parent) levels++;
        return levels;
      };
      tail.sort((a, b) => depth(a) - depth(b));
      root.updateWorldMatrix(true, true);
      const tipY = tail[tail.length - 1].getWorldPosition(V()).y;
      const restY = (this.rig.hips || root).getWorldPosition(V()).y;
      // Head hair ends above the hips; only a real hanging tail passes this.
      if (tipY < restY) this.tail = tail;
    }
    this.legRest = new Map();
    if (this.mmd)
      for (const limb of ['L', 'R']) {
        const thigh = this.rig.thigh[limb];
        const shin = this.rig.shin[limb];
        if (thigh && shin)
          this.legRest.set(limb, shin.getWorldPosition(V()).sub(thigh.getWorldPosition(V())).normalize());
      }
    this.curlSigns = new Map();
    if (type === 'redking')
      for (const suffix of ['L', 'R']) {
        const across = this.node('index1.' + suffix)
          .getWorldPosition(V())
          .sub(this.node('little1.' + suffix).getWorldPosition(V()));
        const long = this.node('middle2.' + suffix)
          .getWorldPosition(V())
          .sub(this.node('middle1.' + suffix).getWorldPosition(V()));
        this.curlSigns.set(suffix, across.cross(long).y > 0 ? -1 : 1);
      }
    this.floorHeight =
      type === 'redking'
        ? Math.min(
            ...['foot.L', 'foot.R', 'toe.L', 'toe.R'].map((name) => this.node(name).getWorldPosition(V()).y),
          )
        : 0;
    this.legDirections = new Map();
    root.updateWorldMatrix(true, true);
    if (type === 'redking')
      for (const suffix of ['L', 'R'])
        for (const [a, b] of [
          ['leg.', 'knee.'],
          ['knee.', 'foot.'],
        ]) {
          const direction = this.node(b + suffix)
            .getWorldPosition(V())
            .sub(this.node(a + suffix).getWorldPosition(V()))
            .normalize()
            .applyQuaternion(root.getWorldQuaternion(Q()).invert());
          this.legDirections.set(a + suffix, direction);
        }
    this.mixer = new THREE.AnimationMixer(root);
    this.action = null;
    this.mode = '';
    this.attack = null;
    this.recovery = 1;
    this.contact = new Map();
    this.castSides = new Map();
    const pelvis = this.node('Bip001_04');
    if (type === 'baltan' && pelvis)
      for (const clip of this.clips)
        for (const track of clip.tracks)
          if (track.name === pelvis.name + '.position') {
            for (let i = 0; i < track.values.length; i += 3) {
              track.values[i] = pelvis.position.x;
              track.values[i + 1] = Math.min(track.values[i + 1], pelvis.position.y + 0.06);
              track.values[i + 2] = pelvis.position.z;
            }
          }
    if (type === 'baltan')
      for (const name of ['Attack_1', 'Attack_2', 'ExtraSkill_1']) {
        const clip = this.clips.find((c) => c.name === name);
        if (!clip) continue;
        const action = this.mixer.clipAction(clip).play();
        action.paused = true;
        let best = -Infinity,
          phase = 0.65;
        for (let i = 5; i <= 27; i++) {
          action.time = (clip.duration * i) / 30;
          this.mixer.update(0);
          root.updateWorldMatrix(true, true);
          for (const side of ['L', 'R']) {
            const score = this.origin(side).applyMatrix4(root.matrixWorld.clone().invert()).z;
            if (score > best) {
              best = score;
              phase = i / 30;
              this.castSides.set(name, side);
            }
          }
        }
        this.contact.set(name, Math.max(0.6, phase));
        this.mixer.stopAllAction();
        for (const state of root.userData.restPose || []) {
          state.node.position.copy(state.position);
          state.node.quaternion.copy(state.quaternion);
          state.node.scale.copy(state.scale);
        }
      }
  }
  node(name) {
    return this.nodes.get(key(name));
  }
  /** MMD hand bone position, so a projectile leaves the actual claw. */
  mmdHand(side) {
    const hand = this.rig?.hand?.[side] || this.node(side + '_TE');
    if (!hand) return null;
    const forearm = this.rig?.fore?.[side] || this.node(side + '_UDE');
    const point = hand.getWorldPosition(V());
    return forearm
      ? point.clone().addScaledVector(point.clone().sub(forearm.getWorldPosition(V())).normalize(), 0.6)
      : point;
  }
  origin(side = 'R') {
    if (this.type === 'ganq') return this.root.localToWorld(V(0, 10.8, 3.5));
    if (this.mmd) {
      const point = this.mmdHand(side);
      if (point) return point;
    }
    const hand =
      this.type === 'redking'
        ? this.node('hand.' + side)
        : this.node('Bip001 ' + side + ' Hand_' + (side === 'L' ? '020' : '028'));
    if (!hand) return this.root.localToWorld(V(0, 10, 3));
    const forearm =
      this.type === 'redking'
        ? this.node('forearm.' + side)
        : this.node('Bip001 ' + side + ' Forearm_' + (side === 'L' ? '00' : '027'));
    const point = hand.getWorldPosition(V());
    return forearm
      ? point.clone().addScaledVector(point.clone().sub(forearm.getWorldPosition(V())).normalize(), 0.8)
      : point;
  }
  castSide(attack) {
    if (this.type !== 'baltan') return attack?.safeSide > 0 ? 'L' : 'R';
    return (
      this.castSides.get(
        attack?.kind === 'sweep' ? 'ExtraSkill_1' : attack?.kind === 'bolt' ? 'Attack_2' : 'Attack_1',
      ) || 'R'
    );
  }
  aim(name, child, direction) {
    const bone = this.node(name),
      tip = this.node(child);
    if (!bone || !tip) return;
    const current = tip.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize();
    const target = direction.clone().normalize().applyQuaternion(this.root.getWorldQuaternion(Q()));
    const world = Q().setFromUnitVectors(current, target).multiply(bone.getWorldQuaternion(Q()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(world));
    bone.updateWorldMatrix(false, true);
  }

  /** Bone path from a shoulder down to that side's hand, e.g. 腕 / 腕2…腕7 / 手首. */
  limbChain(side) {
    const start = this.rig?.arm?.[side],
      end = this.rig?.hand?.[side];
    if (!start || !end) return [];
    const walk = (bone, trail) => {
      const next = trail.concat(bone);
      if (bone === end) return next;
      for (const child of bone.children) {
        if (!child.isBone) continue;
        const found = walk(child, next);
        if (found) return found;
      }
      return null;
    };
    return walk(start, []) || [];
  }

  /**
   * Aim a whole limb, not just the first joint. Long MMD arms (機械哥莫拉 has
   * 腕…腕7 before 手首) leave the claws in front of the chest when only the
   * shoulder is turned; every segment follows the direction instead. Three-bone
   * rigs (shoulder / elbow / hand) behave exactly as before.
   */
  aimLimb(side, first, second = first, split = 0.5) {
    const chain = this.limbs?.[side] || [];
    if (chain.length < 2) return;
    const cut = Math.max(1, Math.round((chain.length - 1) * split));
    for (let i = 0; i < chain.length - 1; i++)
      this.aim(chain[i].name, chain[i + 1].name, i < cut ? first : second);
  }

  turn(name, axis, angle) {
    const bone = this.node(name);
    if (!bone) return;
    const world = Q()
      .setFromAxisAngle(axis.clone().applyQuaternion(this.root.getWorldQuaternion(Q())), angle)
      .multiply(bone.getWorldQuaternion(Q()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(world));
    bone.updateWorldMatrix(false, true);
  }
  update(attack, dt, {dead = false, hurt = false, time = 0} = {}) {
    if (this.attack !== attack) {
      if (!attack && this.attack) this.recovery = 0;
      this.previous = this.attack;
      this.attack = attack;
    }
    this.recovery = Math.min(1, this.recovery + dt / 0.35);
    const active = attack || (this.recovery < 1 ? this.previous : null),
      fade = attack ? 1 : 1 - ease(this.recovery);
    const closing =
      active?.kind === 'melee' && active.phase === 'flight' ? ease(active.age / active.flight) : 0;
    this.lunge = closing * fade * (this.type === 'redking' ? 5 : this.type === 'baltan' ? 0 : 4);
    this.aimX =
      active?.kind === 'melee'
        ? (active.originLean || 0) *
          4.5 *
          ease(active.phase === 'windup' ? active.age / active.windup : 1) *
          fade
        : 0;
    if (this.mmd) {
      // Skeletal drive for the converted MMD kaiju: reset, then aim the real
      // limb bones for the pose the current attack needs. Node names differ
      // between the romanised and Japanese MMD rigs, so this.rig resolves them.
      const rig = this.rig;
      const aim = (from, to, direction) => {
        if (from && to) this.aim(from.name, to.name, direction);
      };
      for (const [bone, rotation] of this.rest) bone.quaternion.copy(rotation);
      this.root.updateWorldMatrix(true, true);
      const gather = active ? ease(active.phase === 'windup' ? active.age / active.windup : 1) : 0;
      const strike = active?.phase === 'flight' ? ease(active.age / active.flight) : 0;
      const castSide = active?.safeSide > 0 ? 'L' : 'R';
      const sign = castSide === 'L' ? 1 : -1;
      for (const limb of ['L', 'R']) {
        const out = limb === 'L' ? 1 : -1;
        this.aimLimb(limb, V(out * 0.3, -1, 0.06), V(out * 0.14, -1, 0.12), 0.45);
      }
      if (rig.neck)
        this.turn(rig.neck.name, V(1, 0, 0), active?.kind === 'charge' ? 0.12 * gather : 0.05 * Math.sin(time * 1.7));
      if (rig.chest) {
        this.turn(rig.chest.name, V(1, 0, 0), 0.02 * Math.sin(time * 1.3));
        this.turn(rig.chest.name, V(0, 1, 0), 0.03 * Math.sin(time * 0.9));
      }
      if (active) {
        if (active.kind === 'bolt' || active.kind === 'sweep') {
          // Y is up and +Z is toward the player, so a wind-up has to lift the arm
          // forward-up; pointing it at -Z raised it behind the shoulder instead.
          const raise = V(sign * 0.25, 0.38, 0.55).lerp(V(sign * 0.1, 0.08, 1), strike);
          this.aimLimb(castSide, raise.clone().lerp(V(sign * 0.3, -1, 0.06), Math.max(0, 1 - gather * 2)), raise, 0.4);
          if (rig.chest) this.turn(rig.chest.name, V(0, 1, 0), -sign * 0.25 * gather);
        }
        if (active.kind === 'melee') {
          const punch = strike > 0 ? V(sign * 0.16, 0.12, 1) : V(sign * 0.4, 0.2, -0.7);
          this.aimLimb(castSide, punch);
          if (rig.chest) this.turn(rig.chest.name, V(0, 1, 0), -sign * 0.3 * strike * fade);
        }
        if (active.kind === 'charge') {
          const lean = (active.phase === 'windup' ? gather : 1) * fade;
          if (rig.hips) this.turn(rig.hips.name, V(1, 0, 0), 0.22 * lean);
          if (rig.chest) this.turn(rig.chest.name, V(1, 0, 0), 0.18 * lean);
          if (active.phase === 'flight')
            for (const limb of ['L', 'R']) {
              const direction = this.legRest.get(limb);
              if (!direction) continue;
              const stride = Math.sin(active.age * 14) * (limb === 'L' ? 0.4 : -0.4);
              aim(
                rig.thigh[limb],
                rig.shin[limb],
                direction.clone().applyAxisAngle(V(1, 0, 0), -stride),
              );
            }
        }
      }
      if (this.tail.length) {
        const life = dead ? 0 : 1;
        this.tail.forEach((bone, index) => {
          const ramp = (index + 1) / this.tail.length;
          const phase = time * 1.6 - index * 0.7;
          this.turn(bone.name, V(0, 1, 0), 0.017 * ramp * life * Math.sin(phase));
          this.turn(bone.name, V(1, 0, 0), 0.01 * ramp * life * Math.cos(phase * 0.8));
        });
      }
      if (hurt && rig.chest) this.turn(rig.chest.name, V(1, 0, 0), -0.16);
      if (dead) {
        if (rig.chest) this.turn(rig.chest.name, V(1, 0, 0), -0.5);
        if (rig.hips) this.turn(rig.hips.name, V(1, 0, 0), -0.35);
      }
      return;
    }
    if (this.type === 'redking') {
      for (const [bone, rotation] of this.rest) bone.quaternion.copy(rotation);
      this.root.updateWorldMatrix(true, true);
      const gather = active ? ease(active.phase === 'windup' ? active.age / active.windup : 1) : 0;
      const strike = active?.phase === 'flight' ? ease(active.age / active.flight) : 0;
      const side = active?.safeSide > 0 ? 'L' : 'R';
      const thrust =
        active?.phase === 'flight'
          ? ease(
              clamp(
                active.age /
                  active.flight /
                  (active.kind === 'bolt' ? 0.15 : active.kind === 'slam' ? 0.28 : 1),
                0,
                1,
              ),
            )
          : 0;
      this.turn(
        'upperbody1',
        V(0, 1, 0),
        active?.kind === 'melee' ? (side === 'L' ? 1 : -1) * (0.28 * gather - 0.45 * strike) * fade : 0,
      );
      if(active?.kind==='charge'){const lean=(active.phase==='windup'?ease(active.age/active.windup):1)*fade;this.turn('upperbody1',V(1,0,0),.3*lean);this.turn('neck',V(1,0,0),-.1*lean);}
      if (hurt) this.turn('upperbody1', V(1, 0, 0), -0.13);
      if (dead) this.turn('upperbody1', V(1, 0, 0), -0.55);
      for (const suffix of ['L', 'R']) {
        const sign = suffix === 'L' ? 1 : -1;
        let upper = V(sign * 0.45, -0.75, 0.45),
          lower = V(-sign * 0.1, 0.35, 1);
        if (active) {
          let targetUpper = upper.clone(),
            targetLower = lower.clone();
          if (active.kind === 'melee' && suffix === side) {
            targetUpper = V(sign * 0.55, -0.2, -0.8).lerp(V(-sign * 0.35, 0.05, 1), strike);
            targetLower = V(-sign * 0.25, 0.8, 0.25).lerp(V(-sign * 0.25, 0.05, 1), strike);
          }
          if (active.kind === 'bolt' && suffix === side) {
            targetUpper = V(sign * 0.35, 0.9, -0.35).lerp(V(sign * 0.08, 0.05, 1), thrust);
            targetLower = V(0, 1, -0.5).lerp(V(0, -0.1, 1), thrust);
          }
          if (active.kind === 'slam') {
            targetUpper = V(sign * 0.45, 0.85, 0.1).lerp(V(sign * 0.2, -0.8, 0.7), thrust);
            targetLower = V(-sign * 0.15, 1, 0.1).lerp(V(-sign * 0.08, -0.55, 1), thrust);
          }
          if (active.kind === 'charge') {
            targetUpper = V(sign * 0.3, -0.3, 0.9);
            targetLower = V(-sign * 0.1, 0.2, 1);
          }
          upper.lerp(targetUpper, gather * fade);
          lower.lerp(targetLower, gather * fade);
        }
        this.aim('upperarm.' + suffix, 'forearm.' + suffix, upper);
        this.aim('forearm.' + suffix, 'hand.' + suffix, lower);
        if (active?.kind === 'melee') {
          const axis = this.node('index1.' + suffix)
            .getWorldPosition(V())
            .sub(this.node('little1.' + suffix).getWorldPosition(V()))
            .normalize()
            .applyQuaternion(this.root.getWorldQuaternion(Q()).invert());
          for (const finger of ['index', 'middle', 'ring', 'little'])
            for (const [joint, curl] of [
              [1, 1.05],
              [2, 1.45],
              [3, 0.8],
            ])
              this.turn(
                finger + joint + '.' + suffix,
                axis,
                curl * this.curlSigns.get(suffix) * gather * fade,
              );
        }
      }
      if (active?.kind === 'charge' && active.phase === 'flight') {
        for (const suffix of ['L', 'R']) {
          const stride = Math.sin(active.age * 16) * (suffix === 'L' ? 1 : -1) * 0.32 * fade;
          this.aim(
            'leg.' + suffix,
            'knee.' + suffix,
            this.legDirections
              .get('leg.' + suffix)
              .clone()
              .applyAxisAngle(V(1, 0, 0), -stride),
          );
          this.aim(
            'knee.' + suffix,
            'foot.' + suffix,
            this.legDirections
              .get('knee.' + suffix)
              .clone()
              .applyAxisAngle(V(1, 0, 0), stride * 0.7),
          );
        }
      }
      if (active?.kind === 'melee' && active.phase === 'flight') {
        for (const suffix of ['L', 'R']) {
          const lead = suffix === side ? 1 : -0.5,
            step = strike * lead * fade;
          this.aim(
            'leg.' + suffix,
            'knee.' + suffix,
            this.legDirections
              .get('leg.' + suffix)
              .clone()
              .applyAxisAngle(V(1, 0, 0), -0.3 * step),
          );
          this.aim(
            'knee.' + suffix,
            'foot.' + suffix,
            this.legDirections
              .get('knee.' + suffix)
              .clone()
              .applyAxisAngle(V(1, 0, 0), 0.35 * step),
          );
        }
      }
      if (active?.kind === 'slam') {
        const lift = gather * (1 - thrust) * fade;
        this.aim(
          'leg.R',
          'knee.R',
          this.legDirections
            .get('leg.R')
            .clone()
            .applyAxisAngle(V(1, 0, 0), -0.7 * lift),
        );
        this.aim(
          'knee.R',
          'foot.R',
          this.legDirections
            .get('knee.R')
            .clone()
            .applyAxisAngle(V(1, 0, 0), 0.9 * lift),
        );
      }
      if (
        (active?.kind === 'charge' || active?.kind === 'melee') &&
        active.phase === 'flight' &&
        !dead &&
        !hurt
      ) {
        const floor = Math.min(
          ...['foot.L', 'foot.R', 'toe.L', 'toe.R'].map((name) => this.node(name).getWorldPosition(V()).y),
        );
        this.root.position.y += this.floorHeight - floor;
        this.root.updateWorldMatrix(true, true);
      }
      this.turn('upperbody2', V(1, 0, 0), 0.012 * Math.sin(time * 2));
      this.turn('jaw', V(1, 0, 0), active?.kind === 'charge' ? 0.2 : 0.04 * Math.sin(time * 2));
      return;
    }
    if (this.type !== 'baltan') return;
    const mode = dead
      ? 'Death_1'
      : hurt
        ? 'Hurt_1'
        : active
          ? active.kind === 'charge'
            ? active.phase === 'windup'
              ? 'Attack_2'
              : 'Run_1'
            : active.kind === 'bolt'
              ? 'Attack_2'
              : active.kind === 'sweep'
                ? 'ExtraSkill_1'
                : 'Attack_1'
          : 'Idle_1';
    const clip = this.clips.find((c) => c.name === mode);
    if (!clip) return;
    if (mode !== this.mode) {
      this.action?.fadeOut(0.1);
      this.action = this.mixer.clipAction(clip).reset().fadeIn(0.1).play();
      this.action.setLoop(dead ? THREE.LoopOnce : THREE.LoopRepeat, dead ? 1 : Infinity);
      this.action.clampWhenFinished = dead;
      this.mode = mode;
    }
    this.action.paused = !!active && mode !== 'Run_1' && !dead && !hurt;
    if (this.action.paused) {
      const contact = this.contact.get(mode) || 0.65;
      const phase = attack
        ? attack.phase === 'windup'
          ? contact * 0.45 * ease(attack.age / attack.windup)
          : contact *
            (0.45 +
              0.55 * ease(clamp(attack.age / attack.flight / (attack.kind === 'melee' ? 1 : 0.2), 0, 1)))
        : THREE.MathUtils.lerp(contact, 1, ease(this.recovery));
      this.action.time = phase * clip.duration;
    }
    this.mixer.update(dt);
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
