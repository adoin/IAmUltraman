import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {messages} from '../src/i18n-catalog.js';
import {translate,normalizeLocale} from '../src/i18n.js';
import {WAVES,ATTACKS,MONSTER_ATTACK_NAMES} from '../src/combat.js';
import {LOCOMOTION} from '../src/locomotion.js';

test('every static UI text and accessible label has English and Japanese copy',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
  const sources=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim())
    .concat([...html.matchAll(/(?:aria-label|title|alt|content)="([^"]+)"/g)].map(m=>m[1]));
  for(const source of new Set(sources)){
    if(!/[\u3400-\u9fff]/u.test(source)||['中文','日本語'].includes(source))continue;
    for(const language of ['en','ja']){
      assert.ok(messages[source]||translate(source,language)!==source,source+' / '+language);
      assert.equal(translate(source,'zh'),source);
    }
  }
});

test('every monster, warning and approach can be localized without changing combat data',()=>{
  const values=[...WAVES.flatMap(w=>[w.name,w.title]),...Object.values(ATTACKS).flatMap(a=>[a.name,a.hint]),
    ...Object.values(MONSTER_ATTACK_NAMES).flatMap(Object.values),...Object.values(LOCOMOTION).map(p=>p.label)];
  for(const source of values)for(const language of ['en','ja'])assert.equal(typeof messages[source]?.[language],'string',source);
});

test('live cooldown, guard, wave, results and composed skill labels preserve values',()=>{
  assert.equal(translate('冷却 9.5 秒 · 按 J','en'),'Cooldown 9.5 s · J');
  assert.equal(translate('冷却 2.2 秒 · 伤害 14 · 按 O','ja'),'クールダウン2.2秒 · ダメージ14 · O');
  assert.equal(translate('梅特里姆光线，冷却 3.7 秒','en'),'Metallium Ray, Cooldown 3.7 s');
  assert.equal(translate('防御中，剩余 1.2 秒','ja'),'防御中 · 残り1.2秒');
  assert.equal(translate('岩石投掷 · 正在蓄力','en'),'Rock Throw · Charging');
  assert.equal(translate('守护星星 12','ja'),'守護の星 12');
  assert.equal(translate('第 11 波 · 新的挑战','en'),'Wave 11 · A new challenge');
  assert.equal(translate('收集了 35 颗守护星星。日落海湾为你欢呼！','en'),'Collected 35 guardian stars. Sunset Bay cheers for you!');
  assert.equal(translate('  光之护盾  ','en'),'  Light Shield  ');
  assert.equal(translate('波','en'),'');
  assert.equal(translate('local-music.mp3','ja'),'local-music.mp3');
  assert.equal(normalizeLocale('invalid'),'zh');
});
