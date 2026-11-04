import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BattleScene} from '../src/scene.js';
globalThis.matchMedia=()=>({matches:true});
globalThis.ResizeObserver=class{observe(){}};
globalThis.devicePixelRatio=1;
globalThis.requestAnimationFrame=()=>0;
function battle(){const events=[];const canvas={getContext:()=>({}),getBoundingClientRect:()=>({width:1000,height:550})};const scene=new BattleScene(canvas,e=>events.push(e));scene.start();return {scene,events};}
test('five defeated monsters complete the adventure and award 30 stars',()=>{const{scene:s,events}=battle();for(let i=0;i<5;i++){s.damage(1000);s.update(3);}assert.equal(s.stars,30);assert.equal(s.finished,true);assert.ok(events.some(e=>e.type==='victory'));});
test('enemy projectiles never damage the monster',()=>{const{scene:s}=battle();s.practice=true;const original=s.monsterHealth;for(let i=0;i<12;i++){s.nextAttack=0;s.update(.1);}assert.equal(s.monsterHealth,original);assert.equal(s.heroHealth,100);});
test('energy depletion ends combat; restarting restores it',()=>{const{scene:s,events}=battle();for(let i=0;i<9;i++){s.nextAttack=0;s.update(.1);}assert.equal(s.heroHealth,0);assert.equal(s.finished,true);assert.ok(events.some(e=>e.type==='over'));s.start();assert.equal(s.heroHealth,100);assert.equal(s.finished,false);});
test('cooldown, pause and defeated enemy prevent repeated casts',()=>{const{scene:s}=battle();assert.equal(s.cast('beam'),true);assert.equal(s.cast('beam'),false);s.update(3.3);assert.equal(s.cast('beam'),true);s.paused=true;assert.equal(s.cast('disc'),false);s.paused=false;s.damage(1000);assert.equal(s.cast('disc'),false);});
