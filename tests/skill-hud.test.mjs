import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BattleEngine,SHIELD} from '../src/combat.js';
import {skillHudStates} from '../src/skill-hud.js';
const get=(battle,skill,pose)=>skillHudStates(battle,pose).find(s=>s.skill===skill);
test('HUD cooldown follows accepted casts and the paused simulation clock',()=>{
  const b=new BattleEngine();b.start();b.nextAttack=100;
  assert.equal(get(b,'beam').state,'ready');assert.equal(b.cast('beam'),true);assert.equal(get(b,'beam').remaining,9.5);
  b.paused=true;b.update(2);assert.equal(get(b,'beam').remaining,9.5);
  b.paused=false;b.update(.5);assert.equal(get(b,'beam').remaining,9);
  b.effects=[];b.enemyDistance=16;const before=b.lastCast.disc;assert.equal(b.cast('disc'),false);assert.equal(b.lastCast.disc,before);assert.equal(get(b,'disc').state,'locked');assert.equal(get(b,'beam').state,'cooldown');
});
test('shield duration, recovery and energy are different HUD states',()=>{
  const b=new BattleEngine();b.start();b.nextAttack=100;assert.equal(b.raiseShield(),true);assert.equal(get(b,'guard').state,'guarding');assert.equal(get(b,'guard').progress,1);
  b.lowerShield();assert.equal(get(b,'guard').remaining,SHIELD.cooldown);assert.equal(get(b,'guard').state,'cooldown');b.time=b.guardReadyAt;b.guardEnergy=0;assert.equal(get(b,'guard').state,'empty');
});
test('only the matching recognized pose fills an available skill',()=>{
  const b=new BattleEngine();b.start();b.nextAttack=100;const pose={tracking:true,chargingSkill:'beam',charge:.7};assert.equal(get(b,'beam',pose).progress,.7);assert.equal(get(b,'beam',pose).state,'charging');assert.equal(get(b,'palm',pose).state,'ready');b.discGesture={progress:1,armed:true};assert.equal(get(b,'disc').state,'charging');assert.equal(get(b,'disc').progress,1);
});
