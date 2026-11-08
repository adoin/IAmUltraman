/**
 * Proves that every MMD kaiju moves to its own documented move.
 *
 * Headless, camera-free: for each monster and each attack slot it samples the
 * world-space bones at the middle of the wind-up and of the strike, compares the
 * signature against the monster's idle pose and against every other monster on
 * the same slot, checks the canon-specific shapes (Specium "＋", Storium T,
 * Seven's head blade, Zetton's mouth fireball, Gomora's horn wave, Gatanothor's
 * two-handed smash) and writes labelled screenshots plus a measurement table to
 * artifacts/poses/.
 */
import {chromium} from 'playwright';
import {mkdirSync, writeFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.GAME_URL || 'http://127.0.0.1:4173';
const out = 'artifacts/poses';
mkdirSync(out, {recursive: true});

// Signature = 7 bones × 3 axes, divided by the kaiju's height so the numbers are
// comparable across models. RMS differences below are in "model heights".
const IDLE_THRESHOLD = 0.1;
const PAIR_THRESHOLD = 0.07;
const MMD = ['baltan', 'mefilas', 'chaos-seven', 'chaos-taro', 'chaos-ultraman', 'zetton', 'gomora-mecha', 'galactron', 'gatanothor'];
const SHARED = ['bolt', 'sweep', 'slam', 'melee'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 720, height: 540 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('response', (response) => {
  if (response.status() >= 400 && !response.url().includes('favicon')) errors.push(response.status() + ' ' + response.url());
});

await page.goto(base, { waitUntil: 'domcontentloaded' });
const battle = `(await import(document.querySelector('script[type=module]').src)).battle`;
await page.waitForFunction(`(async()=>{const b=${battle};return b.assetReady===true})()`, { timeout: 180000 });
await page.locator('#start-keyboard').click();
await page.waitForFunction(() => document.body.classList.contains('in-battle'));

// Page-side helpers: one render animation loop-free scene, sampled on demand.
await page.evaluate(`(async()=>{
  const b=${battle};
  b.renderer.setAnimationLoop(null);
  await b.prefetch;
  const T=await import('three');
  window.__b=b;window.__T=T;
  const local=(bone,origin,scale)=>{if(!bone)return[0,0,0];const p=bone.getWorldPosition(new T.Vector3());return[(p.x-origin.x)/scale,(p.y-origin.y)/scale,(p.z-origin.z)/scale];};
  const dir=(from,to)=>{if(!from||!to)return[0,0,0];const a=from.getWorldPosition(new T.Vector3()),c=to.getWorldPosition(new T.Vector3()).sub(a);const l=c.length()||1;return[c.x/l,c.y/l,c.z/l];};
  window.__sample=()=>{
    const mm=b.monsterMotion,rig=mm.rig,root=mm.root;
    const origin=root.getWorldPosition(new T.Vector3());
    const scale=root.getWorldScale(new T.Vector3()).x*16;
    const points={elbowL:local(rig.fore.L,origin,scale),elbowR:local(rig.fore.R,origin,scale),
      handL:local(rig.hand.L,origin,scale),handR:local(rig.hand.R,origin,scale),
      head:local(rig.head,origin,scale),chest:local(rig.chest,origin,scale),hips:local(rig.hips,origin,scale),
      footL:local(rig.foot.L,origin,scale),footR:local(rig.foot.R,origin,scale)};
    // Bone directions are limb-length independent, so stubby pincers read as
    // clearly as long arms; positions keep the reach and the centre of mass.
    const sig=[dir(rig.arm.L,rig.fore.L),dir(rig.fore.L,rig.hand.L),dir(rig.arm.R,rig.fore.R),dir(rig.fore.R,rig.hand.R),
      dir(rig.chest,rig.head||rig.neck),dir(rig.hips,rig.chest),points.handL,points.handR,points.head].flat();
    let emit=null,emitError='';
    try{const q=mm.origin('R');emit=[(q.x-origin.x)/scale,(q.y-origin.y)/scale,(q.z-origin.z)/scale];}catch(error){emitError=String((error&&error.message)||error);}
    return {sig,points,emit,emitError,headNode:rig.head?rig.head.name:null,phase:b.attack?b.attack.phase:null,age:b.attack?+b.attack.age.toFixed(2):null};
  };
  window.__select=(wave)=>{
    b.start();b.wave=wave;b.monsterMax=b.waveInfo.hp;b.monsterHealth=b.monsterMax;b.nextAttack=1e9;
    b.enemyDistance=26;b.attack=null;b.selectMonster();
    b.monsterBaseZ=20-26;b.currentMonster.position.z=b.monsterBaseZ;
    for(let i=0;i<45;i++)b.advance(1/30);
    b.renderer.render(b.renderScene,b.camera);
    return {model:b.waveInfo.model,attacks:[...b.waveInfo.attacks]};
  };
  window.__begin=(kind)=>{b.attack=null;b.nextAttack=1e9;b.beginAttack(kind);return b.attack?b.attack.kind:null;};
  window.__toWindup=()=>{for(let i=0;i<240&&b.attack&&b.attack.phase==='windup'&&b.attack.age<b.attack.windup*0.8;i++)b.advance(1/30);b.renderer.render(b.renderScene,b.camera);return window.__sample();};
  window.__toFlight=()=>{for(let i=0;i<240&&b.attack&&b.attack.phase==='windup';i++)b.advance(1/30);for(let i=0;i<240&&b.attack&&b.attack.phase==='flight'&&b.attack.age<b.attack.flight*0.5;i++)b.advance(1/30);b.renderer.render(b.renderScene,b.camera);return window.__sample();};
  return true;
})()`);

async function label(text) {
  await page.evaluate((value) => {
    let node = document.getElementById('pose-label');
    if (!node) {
      node = document.createElement('div');
      node.id = 'pose-label';
      document.body.appendChild(node);
    }
    node.textContent = value;
    node.style.cssText =
      'position:fixed;left:10px;top:10px;z-index:9999;font:600 14px system-ui;color:#fff;background:rgba(8,16,28,.85);padding:5px 9px;border-radius:6px;border:1px solid #2a4a6a';
  }, text);
}
async function shot(name, text) {
  await label(text);
  const path = join(out, name + '.jpg');
  await page.screenshot({ path, type: 'jpeg', quality: 74 });
  return path;
}

const dist = (a, b) => Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) / a.length);
const table = [];
const idle = new Map();
const poses = new Map(); // `${model}/${kind}` → {windup, flight}
const names = new Map(); // model → {kind: name}

const waves = await page.evaluate(`(async()=>{const W=(await import(new URL('src/combat.js',document.baseURI).href)).WAVES;return W.map((w,i)=>({wave:i+1,model:w.model,attacks:[...w.attacks]}));})()`);
for (const wave of waves.filter((entry) => MMD.includes(entry.model))) {
  const info = await page.evaluate((index) => window.__select(index), wave.wave);
  const moveNames = await page.evaluate(
    `(async()=>{const{monsterMoves}=await import(new URL('src/combat.js',document.baseURI).href).catch(()=>({}));
      const N=(await import(new URL('src/combat.js',document.baseURI).href));
      return N.MONSTER_ATTACK_NAMES['${info.model}']||{};})()`,
  );
  names.set(info.model, moveNames);
  const idleSample = await page.evaluate(() => window.__sample());
  idle.set(info.model, idleSample.sig);
  await shot(`${info.model}-idle`, `${info.model} · 待机`);

  const kinds = [...new Set([...info.attacks, 'melee'])]; // every wave slot plus the close-range move
  for (const kind of kinds) {
    await page.evaluate((value) => window.__begin(value), kind);
    const windup = await page.evaluate(() => window.__toWindup());
    await shot(`${info.model}-${kind}-windup`, `${info.model} · ${moveNames[kind] || kind} · 蓄力`);
    const flight = await page.evaluate(() => window.__toFlight());
    await shot(`${info.model}-${kind}-flight`, `${info.model} · ${moveNames[kind] || kind} · 出手`);
    poses.set(`${info.model}/${kind}`, { windup, flight });
    table.push({
      model: info.model,
      kind,
      name: moveNames[kind] || kind,
      idleWindup: +dist(windup.sig, idleSample.sig).toFixed(3),
      idleFlight: +dist(flight.sig, idleSample.sig).toFixed(3),
    });
  }
}

// 1. Every combination has to leave the idle pose behind.
const violations = [];
for (const row of table) {
  if (row.idleWindup < IDLE_THRESHOLD) violations.push(`idle ${row.model}/${row.kind} windup ${row.idleWindup}`);
  if (row.idleFlight < IDLE_THRESHOLD) violations.push(`idle ${row.model}/${row.kind} flight ${row.idleFlight}`);
}

// 2. The same slot must not reuse one pose across monsters.
const pairRows = [];
for (const kind of SHARED) {
  const entries = MMD.map((model) => ({ model, pose: poses.get(`${model}/${kind}`) })).filter((entry) => entry.pose);
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i],
        b = entries[j];
      const windup = +dist(a.pose.windup.sig, b.pose.windup.sig).toFixed(3);
      const flight = +dist(a.pose.flight.sig, b.pose.flight.sig).toFixed(3);
      pairRows.push({ kind, a: a.model, b: b.model, windup, flight });
      if (windup < PAIR_THRESHOLD) violations.push(`pair ${kind} ${a.model}/${b.model} windup ${windup}`);
      if (flight < PAIR_THRESHOLD) violations.push(`pair ${kind} ${a.model}/${b.model} flight ${flight}`);
    }
}
if (violations.length) {
  console.error(JSON.stringify(violations, null, 1));
  throw new Error(`${violations.length} pose rule(s) failed`);
}

// 3. Canon-specific shapes.
const p = (model, kind, phase, key) => poses.get(`${model}/${kind}`)[phase].points[key];
const chaosUltra = poses.get('chaos-ultraman/bolt').flight.points;
const segDist = (a, b, c) => {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const len = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
};
const crossGap = Math.min(
  segDist(chaosUltra.elbowR, chaosUltra.handR, chaosUltra.handL),
  segDist(chaosUltra.elbowL, chaosUltra.handL, chaosUltra.handR),
);
const taro = poses.get('chaos-taro/bolt').flight.points;
const storiumSpan = Math.abs(taro.handL[0] - taro.handR[0]);
const storiumLevel = Math.abs(taro.handL[1] - taro.handR[1]);
const sevenWindup = poses.get('chaos-seven/bolt').windup.points,
  sevenFlight = poses.get('chaos-seven/bolt').flight.points;
const headGap = Math.hypot(
  sevenWindup.handR[0] - sevenWindup.head[0],
  sevenWindup.handR[1] - sevenWindup.head[1],
  sevenWindup.handR[2] - sevenWindup.head[2],
);
const sevenReach = sevenFlight.handR[2] - sevenFlight.head[2];
const zettonWindup = poses.get('zetton/bolt').windup.points;
const zettonRun = poses.get('zetton/bolt').flight;
const zettonIdle = idle.get('zetton');
const zettonIdleHands = (zettonIdle[6] + zettonIdle[12]) / 2; // handL y, handR y inside the signature
const zettonRaise = (zettonWindup.handL[1] + zettonWindup.handR[1]) / 2 - zettonIdleHands;
const zettonEmit = zettonRun.emit;
const zettonFace = zettonEmit ? Math.abs(zettonEmit[1] - zettonRun.points.head[1]) : -1;
const gomoraSweep = poses.get('gomora-mecha/sweep');
const hornLift = gomoraSweep.windup.points.head[1] - poses.get('gomora-mecha/bolt').windup.points.head[1];
const hornEmit = gomoraSweep.flight.emit ? gomoraSweep.flight.emit[1] - gomoraSweep.flight.points.head[1] : -1;
const gataSlam = poses.get('gatanothor/slam');
const slamGap = Math.abs(gataSlam.flight.points.handL[1] - gataSlam.flight.points.handR[1]);
const slamDrop = (gataSlam.windup.points.handL[1] + gataSlam.windup.points.handR[1]) / 2 - (gataSlam.flight.points.handL[1] + gataSlam.flight.points.handR[1]) / 2;

const zettonHead = zettonRun.headNode,
  zettonEmitError = zettonRun.emitError || '';
const canon = { crossGap, storiumSpan, storiumLevel, headGap, sevenReach, zettonFace, zettonRaise, hornLift, hornEmit, slamGap, slamDrop, zettonHead, zettonEmitError };
const check = (ok, message) => { if (!ok) violations.push('canon ' + message); };
check(Math.abs(chaosUltra.handL[0]) <= 0.6 && Math.abs(chaosUltra.handR[0]) <= 0.6, 'Specium hands must straddle the centre line');
check(chaosUltra.handL[0] * chaosUltra.handR[0] < 0, 'the Specium pose has to cross the arms (＋)');
check(crossGap <= 0.12, `Specium hands must meet the opposite forearm (gap ${crossGap.toFixed(3)})`);
check(storiumLevel <= 0.12, `Storium T needs level hands (${storiumLevel.toFixed(3)})`);
check(storiumSpan >= 0.5, `Storium T needs a wide horizontal span (${storiumSpan.toFixed(2)})`);
check(headGap <= 1.05, `Seven's hand must reach the head blade (gap ${headGap.toFixed(2)})`);
check(sevenReach >= 0.15, `Seven must fire with the arm out in front (${sevenReach.toFixed(2)})`);
check(zettonFace >= 0 && zettonFace <= 0.3, `Zetton's fireball must leave at face height (${zettonFace.toFixed(2)})`);
check(zettonRaise >= 0.1, `Zetton must gather the fireball with both hands raised (${zettonRaise.toFixed(2)})`);
check(hornLift > 0.04, `the head must participate in the oscillatory wave (${hornLift.toFixed(3)})`);
check(hornEmit > 0, `the oscillatory wave must leave above the head (${hornEmit.toFixed(3)})`);
check(slamGap <= 0.12, `both tentacles must smash together (gap ${slamGap.toFixed(3)})`);
check(slamDrop >= 0.15, `the smash has to travel down (drop ${slamDrop.toFixed(2)})`);

if (violations.length) {
  console.error(JSON.stringify({ canon, violations }, null, 1));
  throw new Error(`${violations.length} pose rule(s) failed`);
}

if (violations.length) {
  console.error(JSON.stringify(violations, null, 1));
  assert.fail(` pose rules failed`);
}
assert.deepEqual(errors, [], 'no page errors or missing assets while sampling');

// Evidence: table, gallery.
const gallery = [];
for (const file of readdirSync(out).filter((name) => name.endsWith('.jpg')).sort()) {
  const [model, kind, phase] = file.replace('.jpg', '').split('-');
  gallery.push({ file, model, kind: kind || 'idle', phase: phase || '' });
}
const rows = gallery
  .map(
    (entry) =>
      `<figure><img src="${entry.file}" loading="lazy"><figcaption>${entry.model} · ${entry.kind}${entry.phase ? ' · ' + entry.phase : ''}</figcaption></figure>`,
  )
  .join('');
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Kaiju move gallery</title>
<style>body{margin:0;background:#0b1622;color:#dbe8f5;font:13px system-ui;padding:12px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
figure{margin:0}img{width:100%;display:block;border:1px solid #25384d}figcaption{padding:3px 0;color:#9fb6cc}</style>
<h1>招式姿势截图（${gallery.length} 张）</h1><div class="g">${rows}</div>`,
);
writeFileSync(join(out, 'measurements.json'), JSON.stringify({ threshold: { idle: IDLE_THRESHOLD, pair: PAIR_THRESHOLD }, rows: table, pairs: pairRows }, null, 1));

const worstPair = pairRows.reduce((worst, row) => (row.flight < worst.flight ? row : worst), pairRows[0]);
const worstIdle = table.reduce((worst, row) => (row.idleFlight < worst.idleFlight ? row : worst), table[0]);
console.log(
  JSON.stringify(
    {
      combos: table.length,
      models: [...idle.keys()],
      kinds: [...new Set(table.map((row) => row.kind))],
      screenshots: gallery.length,
      closestPair: worstPair,
      closestToIdle: worstIdle,
      canon: {
        speciumHands: chaosUltra.handL.map((v) => +v.toFixed(2)),
        storiumSpan: +(Math.abs(taro.handL[0] - taro.handR[0])).toFixed(2),
        sevenHeadGap: +headGap.toFixed(2),
        zettonFaceDelta: +(zettonFace).toFixed(2),
        gomoraHornAbove: +(hornEmit).toFixed(2),
        gatanothorSlamGap: +slamGap.toFixed(2),
        gatanothorSlamDrop: +slamDrop.toFixed(2),
      },
    },
    null,
    1,
  ),
);
await browser.close();
