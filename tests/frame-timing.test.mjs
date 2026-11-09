import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BattleScene} from '../src/scene.js';
test('slow render frames integrate combat in small steps and render poses only once',()=>{const calls=[],poses=[];const scene={loading:false,update:dt=>calls.push(dt),animateMonster:dt=>poses.push(dt),animateHands:()=>{},animateEffects:()=>{},celebration:null};BattleScene.prototype.advance.call(scene,.2);assert.ok(calls.length>=12);assert.ok(calls.every(dt=>dt<=1/60));assert.ok(Math.abs(calls.reduce((a,b)=>a+b,0)-.2)<1e-8);assert.deepEqual(poses,[.2]);scene.loading=true;BattleScene.prototype.advance.call(scene,.2);assert.equal(poses.length,1);});
