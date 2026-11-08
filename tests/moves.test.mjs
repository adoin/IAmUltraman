import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_ATTACK_NAMES, WAVES} from '../src/combat.js';
import {MONSTER_MOVES} from '../src/monster-poses.js';

const DOC = readFileSync(new URL('../docs/monster-moves.md', import.meta.url), 'utf8');
const MODELS = [
  'baltan',
  'mefilas',
  'chaos-seven',
  'chaos-taro',
  'chaos-ultraman',
  'zetton',
  'gomora-mecha',
  'galactron',
  'gatanothor',
];

function documentedRows() {
  return DOC.split('\n')
    .filter((line) => line.startsWith('| ') && line.split('|').length >= 7)
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => MODELS.includes(cells[1]))
    .map((cells) => ({ model: cells[1], kind: cells[2], name: cells[3], source: cells[6] }));
}

test('docs/monster-moves.md documents every kaiju slot and matches combat.js', () => {
  const rows = documentedRows();
  assert.ok(rows.length >= 30, `expected a full table, got ${rows.length} rows`);
  for (const model of MODELS) {
    const slots = Object.keys(MONSTER_ATTACK_NAMES[model] || {});
    assert.ok(slots.length >= 3, `${model} needs at least three documented slots`);
    for (const kind of slots) {
      const row = rows.find((entry) => entry.model === model && entry.kind === kind);
      assert.ok(row, `docs/monster-moves.md is missing ${model}/${kind}`);
      assert.ok(row.source.startsWith('https://'), `${model}/${kind} needs a source link`);
      assert.equal(row.name, MONSTER_ATTACK_NAMES[model][kind], `${model}/${kind} must use the documented name`);
    }
  }
});

test('every documented move has a pose spec with a wind-up, a strike and an emission point', () => {
  const emitters = new Set(['hand', 'mouth', 'forehead', 'horn', 'chest']);
  for (const model of MODELS) {
    for (const kind of Object.keys(MONSTER_ATTACK_NAMES[model])) {
      const move = MONSTER_MOVES[model]?.[kind];
      assert.ok(move, `missing pose spec ${model}/${kind}`);
      assert.equal(move.name, MONSTER_ATTACK_NAMES[model][kind]);
      assert.ok(move.windup?.arms && move.flight?.arms, `${model}/${kind} needs arms in both phases`);
      assert.ok(emitters.has(move.emit || 'hand'), `${model}/${kind} has an unknown emit point`);
    }
  }
});

test('no two kaiju reuse the same attack pose', () => {
  const seen = new Map();
  for (const model of MODELS)
    for (const [kind, move] of Object.entries(MONSTER_MOVES[model])) {
      const signature = JSON.stringify([move.windup, move.flight]);
      const key = `${kind}:${signature}`;
      assert.equal(seen.get(key), undefined, `${model}/${kind} duplicates ${seen.get(key)}`);
      seen.set(key, `${model}/${kind}`);
    }
});

test('the advertised waves stay intact: 11 waves, Gatanothor last, one Baltan', () => {
  assert.equal(WAVES.length, 11);
  assert.equal(WAVES.at(-1).model, 'gatanothor');
  assert.equal(WAVES.filter((wave) => wave.model.startsWith('baltan')).length, 1);
  for (const wave of WAVES)
    for (const kind of wave.attacks)
      assert.ok(MONSTER_ATTACK_NAMES[wave.model]?.[kind] || wave.model === 'redking' || wave.model === 'ganq',
        `${wave.model} has no move name for ${kind}`);
});
