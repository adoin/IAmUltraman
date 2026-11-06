import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BattleEngine,ATTACKS,SHIELD} from '../src/combat.js';
function battle(){const events=[];const scene=new BattleEngine(e=>events.push(e));scene.start();return{scene,events};}
function advance(s,seconds){for(let t=0;t<seconds;t+=.05)s.update(.05);}
function impact(s,kind){s.beginAttack(kind);advance(s,ATTACKS[kind].windup+ATTACKS[kind].flight+.1);}
test('five defeated monsters complete adventure and award 30 base stars',()=>{const{scene:s,events}=battle();for(let i=0;i<5;i++){s.damage(1000);advance(s,3.1);}assert.equal(s.stars,30);assert.equal(s.finished,true);assert.ok(events.some(e=>e.type==='victory'));});
test('enemy windup warns without deducting energy; damage occurs on impact',()=>{const{scene:s,events}=battle();s.beginAttack('bolt');advance(s,2.3);assert.equal(s.heroHealth,100);assert.ok(events.some(e=>e.type==='telegraph'));assert.ok(events.some(e=>e.type==='enemy-cast'));advance(s,1.2);assert.equal(s.heroHealth,86);});
test('raising the shield on the incoming strike blocks each monster attack',()=>{for(const kind of Object.keys(ATTACKS)){const{scene:s}=battle();s.beginAttack(kind);advance(s,ATTACKS[kind].windup+.1);s.setDefense(true);advance(s,ATTACKS[kind].flight+.1);assert.equal(s.heroHealth,100,kind);assert.equal(s.stats.blocked,1,kind);assert.equal(s.stars,1);assert.ok(s.guardEnergy<100);}});
test('side step dodges aimed projectiles and charge; standing in place does not',()=>{for(const kind of ['bolt','charge']){const{scene:s}=battle();s.beginAttack(kind);s.setDefense(false,1);advance(s,4);assert.equal(s.stats.dodged,1);assert.equal(s.heroHealth,100);}});
test('sweep requires advertised safe side, while shockwave requires shield',()=>{const{scene:s}=battle();s.beginAttack('sweep');s.setDefense(false,s.attack.safeSide);advance(s,4);assert.equal(s.stats.dodged,1);s.setDefense(false,1);impact(s,'slam');assert.equal(s.heroHealth,80);});
test('depleted shield cannot grant free invulnerability',()=>{const{scene:s}=battle();s.guardEnergy=1;s.setDefense(true);impact(s,'slam');assert.equal(s.heroHealth,80);assert.equal(s.stats.blocked,0);});
test('powerful light beam interrupts windup and cancels incoming attack',()=>{const{scene:s,events}=battle();s.beginAttack('slam');s.cast('beam');advance(s,.7);assert.equal(s.attack,null);assert.ok(events.some(e=>e.type==='interrupt'));assert.equal(s.monsterHealth,64);assert.equal(s.heroHealth,100);});
test('practice preserves health; projectiles do not hurt their owner',()=>{const{scene:s}=battle();s.practice=true;for(const kind of Object.keys(ATTACKS))impact(s,kind);assert.equal(s.heroHealth,100);assert.equal(s.monsterHealth,110);});
test('cooldown, pause and defeated enemy prevent repeated casts',()=>{const{scene:s}=battle();assert.equal(s.cast('beam'),true);assert.equal(s.cast('beam'),false);advance(s,3.3);assert.equal(s.cast('beam'),true);s.paused=true;assert.equal(s.cast('disc'),false);s.paused=false;s.damage(1000);assert.equal(s.cast('disc'),false);});
test('pause freezes incoming attacks and restarting clears transient state',()=>{const{scene:s}=battle();s.beginAttack('bolt');s.paused=true;advance(s,20);assert.equal(s.attack.age,0);assert.equal(s.heroHealth,100);s.start();assert.equal(s.attack,null);assert.equal(s.effects.length,0);assert.equal(s.guard,false);assert.equal(s.lean,0);});
test('energy depletion ends combat and restart restores energy',()=>{const{scene:s,events}=battle();for(let i=0;i<6;i++)impact(s,'slam');assert.equal(s.heroHealth,0);assert.equal(s.finished,true);assert.ok(events.some(e=>e.type==='over'));s.start();assert.equal(s.heroHealth,100);assert.equal(s.finished,false);});
test('ordinary punches cause real impact damage independently of skill cooldowns',()=>{const{scene:s}=battle();s.enemyDistance=13;s.lastCast.beam=s.time;s.lastCast.disc=s.time;assert.equal(s.punch('left'),true);assert.equal(s.punch('right'),false);s.update(.1);assert.equal(s.monsterHealth,110);s.update(.1);assert.equal(s.monsterHealth,98);s.update(.2);assert.equal(s.punch('right'),true);s.update(.2);assert.equal(s.monsterHealth,86);assert.equal(s.lastCast.beam,0);assert.equal(s.lastCast.disc,0);assert.equal(s.guardEnergy,100);});
test('punches respect pause, defeat and restart, and do not interrupt boss windup',()=>{const{scene:s}=battle();s.paused=true;assert.equal(s.punch(),false);s.paused=false;s.beginAttack('slam');s.punch();s.update(.2);assert.equal(s.attack.kind,'slam');s.damage(1000);assert.equal(s.punch(),false);s.start();assert.equal(s.punch(),true);});
test('casting puts the shield on cooldown and rejected attacks spend no cooldown',()=>{const{scene:s}=battle();s.setDefense(true);assert.equal(s.cast('beam'),true);assert.equal(s.guard,false);assert.equal(s.guardCooldown,SHIELD.cooldown);s.setDefense(true);assert.equal(s.guard,false);assert.equal(s.cast('disc'),false);assert.equal(s.punch(),false);assert.equal(s.lastCast.disc,-100);advance(s,SHIELD.cooldown+.1);s.setDefense(false);s.setDefense(true);assert.equal(s.guard,true);assert.equal(s.cast('disc'),true);assert.equal(s.guard,false);});
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

test('a charge moves over its complete flight and reaches melee at impact',()=>{const{scene:s}=battle();s.nextAttack=100;s.beginAttack('charge');while(s.attack.phase==='windup')s.update(.01);const flight=s.attack.flight;s.update(flight/2);assert.ok(s.enemyDistance>24);assert.equal(s.heroHealth,100);s.update(flight/2);assert.ok(Math.abs(s.enemyDistance-16.5)<.001);assert.equal(s.heroHealth,78);});

test('the first wave opens with a visible ranged attack before charging',()=>{const{scene:s}=battle();s.update(3.6);assert.equal(s.attack.kind,'bolt');assert.equal(s.attack.name,'岩石投掷');assert.equal(s.inMelee,false);});
