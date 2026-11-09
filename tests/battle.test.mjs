import{locomotionFor}from'../src/locomotion.js';
﻿import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BattleEngine,ATTACKS,SHIELD,CELEBRATION,WAVES,SKILLS} from '../src/combat.js';
function battle(){const events=[];const scene=new BattleEngine(e=>events.push(e));scene.start();return{scene,events};}
function advance(s,seconds){for(let t=0;t<seconds;t+=.05)s.update(.05);}
function impact(s,kind){s.beginAttack(kind);if(s.attack)advance(s,s.attack.windup+s.attack.flight+.1);}
test('every wave is defeated before the adventure ends and stars add up',()=>{const{scene:s,events}=battle();const waves=WAVES.length;for(let i=0;i<waves;i++){s.damage(1000);advance(s,3.1);}assert.equal(s.stars,waves*3+waves*(waves+1)/2);assert.equal(s.finished,true);assert.ok(events.some(e=>e.type==='victory'));});
test('the last victory plays a timed celebration before the results panel',()=>{
  const{scene:s,events}=battle();
  for(let i=0;i<WAVES.length;i++){s.damage(1000);advance(s,3.1);}
  assert.ok(s.celebrating>CELEBRATION.duration-.2);
  assert.equal(s.cast('beam'),false);assert.equal(s.punch(),false);
  advance(s,CELEBRATION.duration*.5);
  assert.equal(events.some(e=>e.type==='celebration-end'),false);
  s.paused=true;advance(s,10);assert.ok(s.celebrating>0);s.paused=false;
  advance(s,CELEBRATION.duration*.5+.1);
  assert.equal(s.celebrating,0);
  assert.ok(events.some(e=>e.type==='celebration-end'));
  const end=events.filter(e=>e.type==='celebration-end');
  assert.equal(end.length,1);assert.ok(end[0].stars>0);
  s.start();assert.equal(s.celebrating,0);
});
test('enemy windup warns without deducting energy; damage occurs on impact',()=>{const{scene:s,events}=battle();s.beginAttack('bolt');advance(s,ATTACKS.bolt.windup+.05);assert.equal(s.heroHealth,100);assert.ok(events.some(e=>e.type==='telegraph'));assert.ok(events.some(e=>e.type==='enemy-cast'));advance(s,ATTACKS.bolt.flight+.05);assert.equal(s.heroHealth,86);});
test('raising the shield on the incoming strike blocks each monster attack',()=>{for(const kind of Object.keys(ATTACKS)){const{scene:s}=battle();if(kind==='charge')s.wave=3;s.beginAttack(kind);const{windup,flight}=s.attack;advance(s,windup+.1);s.setDefense(true);advance(s,flight+.1);assert.equal(s.heroHealth,100,kind);assert.equal(s.stats.blocked,1,kind);assert.equal(s.stars,1);assert.ok(s.guardEnergy<100);}});
test('side step dodges aimed projectiles and charge; standing in place does not',()=>{for(const kind of ['bolt','charge']){const{scene:s}=battle();if(kind==='charge')s.wave=3;s.beginAttack(kind);s.setDefense(false,1);advance(s,s.attack.windup+s.attack.flight+.1);assert.equal(s.stats.dodged,1);assert.equal(s.heroHealth,100);}});
test('sweep requires advertised safe side, while shockwave requires shield',()=>{const{scene:s}=battle();s.beginAttack('sweep');s.setDefense(false,s.attack.safeSide);advance(s,ATTACKS.sweep.windup+ATTACKS.sweep.flight+.1);assert.equal(s.stats.dodged,1);s.setDefense(false,1);impact(s,'slam');assert.equal(s.heroHealth,80);});
test('depleted shield cannot grant free invulnerability',()=>{const{scene:s}=battle();s.guardEnergy=1;s.setDefense(true);impact(s,'slam');assert.equal(s.heroHealth,80);assert.equal(s.stats.blocked,0);});
test('powerful light beam interrupts windup and cancels incoming attack',()=>{const{scene:s,events}=battle();s.beginAttack('slam');s.cast('beam');advance(s,.7);assert.equal(s.attack,null);assert.ok(events.some(e=>e.type==='interrupt'));assert.equal(s.monsterHealth,64);assert.equal(s.heroHealth,100);});
test('practice preserves health; projectiles do not hurt their owner',()=>{const{scene:s}=battle();s.practice=true;for(const kind of Object.keys(ATTACKS))impact(s,kind);assert.equal(s.heroHealth,100);assert.equal(s.monsterHealth,110);});
test('cooldown, pause and defeated enemy prevent repeated casts',()=>{const{scene:s}=battle();s.nextAttack=100;assert.equal(s.cast('beam'),true);assert.equal(s.cast('beam'),false);advance(s,SKILLS.beam.cooldown+.1);assert.equal(s.cast('beam'),true);s.paused=true;assert.equal(s.cast('disc'),false);s.paused=false;s.damage(1000);assert.equal(s.cast('disc'),false);});
test('pause freezes incoming attacks and restarting clears transient state',()=>{const{scene:s}=battle();s.beginAttack('bolt');s.paused=true;advance(s,20);assert.equal(s.attack.age,0);assert.equal(s.heroHealth,100);s.start();assert.equal(s.attack,null);assert.equal(s.effects.length,0);assert.equal(s.guard,false);assert.equal(s.lean,0);});
test('energy depletion ends combat and restart restores energy',()=>{const{scene:s,events}=battle();for(let i=0;i<6;i++)impact(s,'slam');assert.equal(s.heroHealth,0);assert.equal(s.finished,true);assert.ok(events.some(e=>e.type==='over'));s.start();assert.equal(s.heroHealth,100);assert.equal(s.finished,false);});
test('ordinary punches cause real impact damage independently of skill cooldowns',()=>{const{scene:s}=battle();s.enemyDistance=13;s.lastCast.beam=s.time;s.lastCast.disc=s.time;assert.equal(s.punch('left'),true);assert.equal(s.punch('right'),false);s.update(.1);assert.equal(s.monsterHealth,110);s.update(.1);assert.equal(s.monsterHealth,98);s.update(.2);assert.equal(s.punch('right'),true);s.update(.2);assert.equal(s.monsterHealth,86);assert.equal(s.lastCast.beam,0);assert.equal(s.lastCast.disc,0);assert.equal(s.guardEnergy,100);});
test('punches respect pause, defeat and restart, and do not interrupt boss windup',()=>{const{scene:s}=battle();s.paused=true;assert.equal(s.punch(),false);s.paused=false;s.beginAttack('slam');s.punch();s.update(.2);assert.equal(s.attack.kind,'slam');s.damage(1000);assert.equal(s.punch(),false);s.start();assert.equal(s.punch(),true);});
test('casting puts the shield on cooldown and rejected attacks spend no cooldown',()=>{const{scene:s}=battle();s.nextAttack=100;s.setDefense(true);assert.equal(s.cast('beam'),true);assert.equal(s.guard,false);assert.equal(s.guardCooldown,SHIELD.cooldown);s.setDefense(true);assert.equal(s.guard,false);assert.equal(s.cast('disc'),false);assert.equal(s.punch(),false);assert.equal(s.lastCast.disc,-100);advance(s,SHIELD.cooldown+.1);s.setDefense(false);s.setDefense(true);assert.equal(s.guard,true);assert.equal(s.cast('disc'),true);assert.equal(s.guard,false);});
test('a held key or pose expires, stays spent through cooldown and requires a new press',()=>{
  const {scene:s}=battle();s.nextAttack=100;s.setDefense(true);
  s.update(SHIELD.duration-.1);assert.equal(s.guard,true);
  s.update(.2);assert.equal(s.guard,false);assert.ok(Math.abs(s.guardCooldown-(SHIELD.cooldown-.1))<1e-8);
  s.setDefense(false);s.setDefense(true);assert.equal(s.guard,false);
  s.update(SHIELD.cooldown);s.setDefense(true);assert.equal(s.guard,false);
  s.setDefense(false);s.setDefense(true);assert.equal(s.guard,true);
});
test('early release starts the full cooldown and simulation pause freezes it',()=>{
  const {scene:s}=battle();s.setDefense(true);s.update(.25);s.setDefense(false);
  assert.equal(s.guard,false);assert.equal(s.guardCooldown,SHIELD.cooldown);assert.equal(s.raiseShield(),false);
  s.paused=true;s.update(20);assert.equal(s.guardCooldown,SHIELD.cooldown);
  s.paused=false;s.update(SHIELD.cooldown);assert.equal(s.raiseShield(),true);
  s.start();assert.equal(s.guard,false);assert.equal(s.guardCooldown,0);
});
test('an attack landing after the guard window damages the player even while held',()=>{
  const {scene:s}=battle();s.setDefense(true);impact(s,'slam');assert.equal(s.heroHealth,80);assert.equal(s.stats.blocked,0);
});

test('far punches miss, charging enters melee and rejects remote casts',()=>{const{scene:s}=battle();s.punch();advance(s,.4);assert.equal(s.monsterHealth,110);s.beginAttack('charge');advance(s,4);assert.ok(s.inMelee);assert.equal(s.cast('beam'),false);assert.equal(s.lastCast.beam,-100);});
test('three close punches push the enemy away and restore remote casting',()=>{const{scene:s}=battle();s.enemyDistance=13;s.nextAttack=100;for(let i=0;i<3;i++){assert.equal(s.punch(),true);advance(s,.4);}assert.equal(s.monsterHealth,74);advance(s,1);assert.ok(s.enemyDistance>=35);assert.equal(s.cast('beam'),true);});
test('crossing into melee cancels an unlanded remote attack',()=>{const{scene:s,events}=battle();s.cast('beam');s.enemyDistance=13;advance(s,.7);assert.equal(s.monsterHealth,110);assert.equal(s.effects.length,0);assert.ok(events.some(e=>e.type==='remote-interrupted'));});

test('a charge moves over its complete flight and reaches melee at impact',()=>{const{scene:s}=battle();s.nextAttack=100;s.beginAttack('charge');while(s.attack.phase==='windup')s.update(.01);const flight=s.attack.flight;s.update(flight/2);assert.ok(s.enemyDistance>18);assert.equal(s.heroHealth,100);s.update(flight/2);assert.ok(Math.abs(s.enemyDistance-16.5)<.001);assert.equal(s.heroHealth,100);});

test('the first wave visibly commits to approaching before the player can chain remote skills',()=>{const{scene:s}=battle();s.update(s.entranceDelay()+.05);assert.equal(s.attack.kind,'charge');assert.equal(s.attack.name,'重步逼近');assert.equal(s.inMelee,false);});

test('a prepared left disc uses the short throw timeline, stores hand and cancels preview',()=>{const b=new BattleEngine();b.start();b.setDiscPreparation({side:'left',progress:1,armed:true});assert.equal(b.cast('disc','left'),true);const e=b.effects[0];assert.equal(e.prepared,true);assert.equal(e.side,'left');assert.equal(b.discGesture,null);b.update(.57);assert.equal(b.monsterHealth,110);b.update(.02);assert.equal(b.monsterHealth,79);});

test('disc preparation is cleared by punching, pause input and melee entry',()=>{const b=new BattleEngine();b.start();const prep={side:'right',progress:1,armed:true};b.setDiscPreparation(prep);b.punch('left');assert.equal(b.discGesture,null);b.setDiscPreparation(prep);b.enemyDistance=16;b.update(.01);assert.equal(b.discGesture,null);b.enemyDistance=35;b.paused=true;b.setDiscPreparation(prep);assert.equal(b.discGesture,null);});
test('zepellion is the strongest ray, with the longest cooldown beside the rebalanced disc',()=>{
  const{scene:s}=battle();s.nextAttack=100;
  assert.ok(SKILLS.zepellion.damage>SKILLS.beam.damage,'zepellion must out-damage the Mebium ray');
  assert.ok(SKILLS.zepellion.cooldown>SKILLS.beam.cooldown);
  assert.equal(SKILLS.beam.cooldown,6.5);assert.equal(SKILLS.zepellion.cooldown,9);assert.equal(SKILLS.disc.cooldown,2);
  assert.equal(SKILLS.palm.damage,14);
  const before=s.monsterHealth;
  assert.equal(s.cast('zepellion'),true);
  advance(s,SKILLS.zepellion.impact+.05);
  assert.equal(s.monsterHealth,before-SKILLS.zepellion.damage);
  assert.equal(s.cast('zepellion'),false,'cooldown must reject an immediate recast');
});
test('the final wave is Gatanothor, then Galactron and Zetton, then the Baltan family',()=>{
  const last=WAVES[WAVES.length-1];
  assert.equal(last.model,'gatanothor','the new boss must close the adventure');
  const runnerUp=Math.max(...WAVES.slice(0,-1).map(w=>w.hp));
  assert.ok(last.hp>=runnerUp*1.15,`Gatanothor ${last.hp} must clearly lead ${runnerUp}`);
  for(const model of ['zetton','galactron']) {
    const wave=WAVES.find(w=>w.model===model);
    assert.ok(wave,'missing '+model);
    for(const other of WAVES) {
      if(other===wave||other.model==='gatanothor') continue;
      if(model==='zetton'&&other.model==='galactron') continue;
      assert.ok(wave.hp>other.hp,`${model} ${wave.hp} must out-scale ${other.model} ${other.hp}`);
    }
  }
  const baltans=['baltan'];
  for(const model of baltans) {
    const index=WAVES.findIndex(w=>w.model===model);
    assert.ok(index>=0,'missing '+model);
    if(index===0) continue;
    assert.ok(WAVES[index].hp>WAVES[index-1].hp,`${model} must lift its wave above the previous one`);
  }
});

test('later waves attack sooner: the monster stops standing around',()=>{
  const {scene: s} = battle();
  const delays = WAVES.map((_, index) => { s.wave = index + 1; return s.attackDelay(); });
  for (let i = 1; i < delays.length; i++) {
    assert.ok(delays[i] <= delays[i - 1], `wave ${i + 1} must not wait longer than wave ${i}`);
  }
  assert.ok(delays[0]>=1.5&&delays[0]<=2, `wave 1 should give the player room to learn (${delays[0]})`);
  assert.ok(delays.at(-1)>=.85&&delays.at(-1)<=1, `the last wave must press the attack (${delays.at(-1)})`);
  assert.ok(delays[0]-delays.at(-1)>=.8, 'the ramp has to be felt, not just measurable');
  s.difficulty = 'normal';
  const normal = WAVES.map((_, index) => { s.wave = index + 1; return s.attackDelay(); });
  assert.ok(normal.every((value, index) => value <= delays[index]), 'normal never waits longer than easy');
  s.wave = WAVES.length;
  assert.ok(normal.at(-1) <= 1.3, `normal must stay brisk at the end (${normal.at(-1)})`);
});

test('streaming a monster freezes combat and rejects input without spending cooldowns',()=>{const b=new BattleEngine();b.start();b.loading=true;const before={time:b.time,hp:b.heroHealth,cd:{...b.lastCast}};assert.equal(b.cast('beam'),false);assert.equal(b.punch('left'),false);assert.equal(b.raiseShield(),false);b.setDiscPreparation({side:'right',armed:true,progress:1});b.update(10);assert.equal(b.time,before.time);assert.equal(b.heroHealth,before.hp);assert.deepEqual(b.lastCast,before.cd);assert.equal(b.discGesture,null);b.loading=false;assert.equal(b.cast('beam'),true);});

test('the opening charge reaches and cancels a held finisher before a second remote cast',()=>{const {scene:s,events}=battle();s.cast('zepellion');advance(s,2.6);assert.ok(s.inMelee);assert.equal(s.monsterHealth,28);assert.equal(s.cast('disc'),false);assert.ok(events.some(e=>e.type==='remote-interrupted'));assert.equal(s.stats.damageTaken,0,'walking into range is not a collision attack');});

test('the faster opener still leaves time to dodge or raise a shield after launch',()=>{for(const outcome of ['block','dodge']){const {scene:s}=battle();s.wave=3;s.enemyDistance=locomotionFor(s.waveInfo.model).spawnDistance;s.nextAttack=s.entranceDelay();advance(s,1.2);assert.equal(s.attack.phase,'flight');s.setDefense(outcome==='block',outcome==='dodge'?1:0);advance(s,.8);assert.equal(s.heroHealth,100);assert.equal(s.stats[outcome==='block'?'blocked':'dodged'],1);}});

test('a staggered monster resumes pressure after a short recovery, not a full rest',()=>{const {scene:s}=battle();s.beginAttack('slam');s.cast('beam');advance(s,.7);assert.equal(s.attack,null);assert.ok(s.nextAttack>0&&s.nextAttack<=.85);advance(s,1);assert.ok(s.attack);});

test('every monster reaches melee alive against continuous ideal ranged input',()=>{for(let wave=1;wave<=WAVES.length;wave++){const b=new BattleEngine();b.start();b.practice=true;b.wave=wave;b.monsterMax=b.monsterHealth=b.waveInfo.hp;b.nextAttack=b.entranceDelay();for(let t=0;t<4&&!b.inMelee&&!b.defeated;t+=1/120){for(const skill of ['zepellion','beam','disc','palm'])if(b.cast(skill))break;b.update(1/120);}assert.equal(b.inMelee,true,b.waveInfo.name);assert.equal(b.defeated,false,b.waveInfo.name);assert.ok(b.time<locomotionFor(b.waveInfo.model).startDelay+locomotionFor(b.waveInfo.model).prepare+locomotionFor(b.waveInfo.model).duration+.1,b.waveInfo.name);}});
test('a heavy beam hurts an advancing monster without deleting its approach',()=>{const{scene:b}=battle();b.nextAttack=100;b.beginAttack('charge');b.cast('beam');advance(b,.7);assert.equal(b.monsterHealth,64);assert.equal(b.attack.kind,'charge');advance(b,2.1);assert.ok(b.inMelee);});
test('three melee punches earn a clear ranged window before the next charge',()=>{const{scene:b}=battle();b.practice=true;b.monsterMax=b.monsterHealth=1000;b.enemyDistance=16.5;b.nextAttack=100;for(let i=0;i<3;i++){b.punch(i%2?'right':'left');advance(b,.35);}const window=b.rangedWindowUntil;advance(b,1);assert.ok(!b.inMelee);assert.ok(window>b.time);assert.equal(b.cast('beam'),true);while(b.time<window-.1){assert.equal(b.inMelee,false);b.update(.01);}for(let t=0;t<5&&!b.inMelee;t+=.01)b.update(.01);assert.ok(b.inMelee);});
test('a camera-prepared ray fires from its completed pose without replaying the wind-up',()=>{const {scene:b,events}=battle();b.nextAttack=100;b.setPoseStage(3);assert.equal(b.cast('zepellion'),true);assert.equal(b.effects[0].prepared,true);assert.equal(b.zepellionStage,0);assert.ok(b.effects[0].impact<.5);advance(b,.3);assert.equal(b.monsterHealth,110);advance(b,.1);assert.equal(b.monsterHealth,28);const cast=events.find(e=>e.type==='cast');assert.equal(cast.timing.fire,.12);});
test('range and unavailable skills never keep a camera preparation armed',()=>{const {scene:b}=battle();b.enemyDistance=16;b.setPoseStage(3);assert.equal(b.zepellionStage,0);b.enemyDistance=35;b.cast('disc');b.setPoseStage(3);assert.equal(b.zepellionStage,0);});
test('punching or defending cancels a staged finisher without spending its cooldown',()=>{const {scene:b}=battle();b.nextAttack=100;b.setPoseStage(3);b.raiseShield();assert.equal(b.zepellionStage,0);b.lowerShield();b.setPoseStage(3);b.punch();assert.equal(b.zepellionStage,0);assert.equal(b.lastCast.zepellion,-100);});

test('even a perfectly precharged follow-up cannot kill the first monster before contact',()=>{for(const step of [1/60,1/120]){const{scene:b}=battle();b.practice=true;let casts=0;while(b.time<4&&!b.inMelee&&!b.defeated){if(casts===0){if(b.cast('beam'))casts++;}else{b.setPoseStage(3);if(b.cast('zepellion'))casts++;}b.update(step);}assert.equal(b.inMelee,true);assert.equal(b.defeated,false);}});

test('a shield requested during a ray can catch the charge when the ray is interrupted',()=>{const{scene:b}=battle();b.nextAttack=100;b.cast('zepellion');b.setDefense(true);assert.equal(b.guard,false);assert.equal(b.guardQueued,true);b.wave=3;b.beginAttack('charge');advance(b,1.8);assert.equal(b.stats.blocked,1);assert.equal(b.heroHealth,100);assert.equal(b.guardQueued,false);});
test('releasing a queued shield cancels it and cooldowns never queue automatic repeats',()=>{const{scene:b}=battle();b.nextAttack=100;b.cast('zepellion');b.setDefense(true);b.setDefense(false);b.enemyDistance=16;b.update(.01);assert.equal(b.guard,false);assert.equal(b.guardQueued,false);b.start();b.nextAttack=100;b.raiseShield();b.lowerShield();b.cast('zepellion');b.setDefense(true);assert.equal(b.guardQueued,false);advance(b,4.2);assert.equal(b.guard,false);});
