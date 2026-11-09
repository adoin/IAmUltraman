/**
 * Camera-free proof of the Zepellion pre-motion.
 *
 * 1. Samples the first-person hands at each of the three wind-up beats (reach,
 *    pull, cross) and compares them with the Mebium ray's ready pose.
 * 2. Saves reach / pull / cross / fire frames to artifacts/poses/.
 * 3. Drives the HUD stage and asserts the card text mentions the gather.
 */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {ZEPELLION_TIMING} from '../src/action-timing.js';

const base = process.env.GAME_URL || 'http://127.0.0.1:4173';
const out = process.env.BROWSER_ARTIFACT_DIR || 'D:/tmp/ultraman-zepellion-check';
mkdirSync(out, {recursive: true});
const DIFFERENCE = 0.12; // world units between the two hand rigs' poses
const {reach, pull, cross, fire, lightEnd, end} = ZEPELLION_TIMING;

// The wind-up is only a three-beat motion if the beats are ordered and spaced.
assert.ok(reach < pull && pull < cross && cross <= fire, 'reach -> pull -> cross -> fire must be ordered');
assert.ok(pull - reach >= 0.4 && cross - pull >= 0.4, 'each wind-up beat needs its own time');
assert.ok(lightEnd > fire && end > lightEnd, 'the light must outlast the shot');

const browser = await chromium.launch({...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}),headless:true});
const page = await browser.newPage({viewport: {width: 640, height: 420}});
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(base, {waitUntil: 'domcontentloaded'});
const battle = `(await import(document.querySelector('script[type=module]').src)).battle`;
await page.waitForFunction(`(async()=>{const b=${battle};return b.assetReady===true})()`, {timeout: 180000});
await page.locator('#start-keyboard').click();
await page.waitForFunction(() => document.body.classList.contains('in-battle'));
await page.evaluate(`(async()=>{
  const b=${battle};
  b.renderer.setAnimationLoop(null);
  await b.prefetch;
  const T=await import('three');
  window.__b=b;window.__T=T;
  // World-space hand positions of both first-person arms.
  window.__hands=()=>{
    const out=[];
    for(const rig of b.hero.rigs){
      const wrist=rig.hand.getWorldPosition(new T.Vector3());
      const elbow=rig.lower.getWorldPosition(new T.Vector3());
      out.push(wrist,elbow);
    }
    return out.map(v=>[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)]);
  };
  window.__castThenSample=(skill,ages)=>{
    b.start();b.attack=null;b.nextAttack=1e9;b.lastCast[skill]=-100;b.effects=[];
    b.cast(skill);
    const samples=[];let t=0;
    for(const age of ages){while(t<age-1e-6){b.advance(1/60);t+=1/60;}samples.push({age,t:+t.toFixed(2),hands:window.__hands()});b.renderer.render(b.renderScene,b.camera);}
    return samples;
  };
  window.__label=(text)=>{let el=document.getElementById('pose-label');if(!el){el=document.createElement('div');el.id='pose-label';document.body.appendChild(el);}el.textContent=text;el.style.cssText='position:fixed;left:10px;top:10px;z-index:9999;font:600 14px system-ui;color:#fff;background:rgba(8,16,28,.85);padding:5px 9px;border-radius:6px;border:1px solid #2a4a6a';};
  return true;
})()`);

const flat = (samples) => samples.map((sample) => sample.hands.flat());
const distance = (a, b) => Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) / a.length);

// Capture each actual phase before advancing to another sample.
const beam=[];
for(const age of [.2,.32,.6]){const [sample]=await page.evaluate(age=>window.__castThenSample('beam',[age]),age);beam.push(sample);if(age===.32){await page.evaluate(()=>window.__label('梅特里姆光线 · 起手'));await page.screenshot({path:join(out,'zepellion-beam-ready.jpg'),type:'jpeg',quality:74});}}
const zep=[],files=['reach','pull','cross','fire'],labels=['①伸臂','②横拉','③定姿','发射'];
for(const [i,age]of [reach,pull,cross,fire+.16].entries()){
 const [sample]=await page.evaluate(age=>window.__castThenSample('zepellion',[age]),age);zep.push(sample);
 await page.evaluate(label=>window.__label('哉佩利敖光线 '+label),labels[i]);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:join(out,'zepellion-'+files[i]+'.jpg'),type:'jpeg',quality:74});
}

const beamReady = flat([beam[1]])[0];
const zepReach = flat([zep[0]])[0];
const zepPull = flat([zep[1]])[0];
const zepCross = flat([zep[2]])[0];
const reachVsBeam = distance(zepReach, beamReady);
const reachVsPull = distance(zepReach, zepPull);
const pullVsCross = distance(zepPull, zepCross);
const crossVsBeam = distance(zepCross, beamReady);
assert.ok(reachVsBeam >= DIFFERENCE, `the reach beat must differ from the Mebium ready pose (${reachVsBeam.toFixed(3)})`);
assert.ok(reachVsPull >= DIFFERENCE * 0.6, `the wide pull must move the arms (${reachVsPull.toFixed(3)})`);
assert.ok(pullVsCross >= DIFFERENCE * 0.6, `the cross must snap out of the pull (${pullVsCross.toFixed(3)})`);
const settled=distance(zepCross,flat([zep[3]])[0]);
assert.ok(settled<.03,`the final firing pose must be complete before emission (${settled.toFixed(3)})`);

// The HUD has to show the pre-motion stages without a camera.
await page.evaluate(()=>{window.__b.effects=[];window.__b.lastCast.zepellion=-100;});
const hud = [];
for (const stage of [1, 2, 0]) {
  await page.evaluate((value) => {
    window.__b.setPoseStage(value);
    window.__b.renderer.render(window.__b.renderScene, window.__b.camera);
  }, stage);
  await page.waitForTimeout(120);
  hud.push({stage, text: (await page.locator('#zepellion-status').innerText()).trim()});
}
assert.match(hud[0].text, /聚气/, `stage 1 HUD text was "${hud[0].text}"`);
assert.match(hud[1].text, /L\s*形/, `stage 2 HUD text was "${hud[1].text}"`);
assert.match(hud[2].text, /就绪|冷却/, `stage 0 HUD text was "${hud[2].text}"`);
assert.deepEqual(errors, [], 'no page errors while casting');

console.log(JSON.stringify({
  timing: {reach, pull, cross, fire},
  reachVsBeam: +reachVsBeam.toFixed(3),
  reachVsPull: +reachVsPull.toFixed(3),
  pullVsCross: +pullVsCross.toFixed(3),
  crossVsBeam: +crossVsBeam.toFixed(3),
  hud,
}, null, 1));
await browser.close();
