/**
 * Camera-free proof of the Zepellion pre-motion.
 *
 * 1. Samples the first-person hands during the gather beat and during the same
 *    moment of the Mebium ray, and asserts the two poses are different.
 * 2. Saves gather / form / fire frames to artifacts/poses/.
 * 3. Drives the HUD stage and asserts the card text mentions the gather.
 */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.GAME_URL || 'http://127.0.0.1:4173';
const out = 'artifacts/poses';
mkdirSync(out, {recursive: true});
const DIFFERENCE = 0.12; // world units between the two hand rigs' poses

const browser = await chromium.launch({channel: 'chrome', headless: true});
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
    b.attack=null;b.nextAttack=1e9;b.lastCast[skill]=-100;b.effects=[];
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

// Mebium ray reference at its ready/impact beats.
const beam = await page.evaluate(() => window.__castThenSample('beam', [0.2, 0.32, 0.6]));
await page.evaluate(() => window.__label('梅特里姆光线 · 起手'));
await page.screenshot({path: join(out, 'zepellion-beam-ready.jpg'), type: 'jpeg', quality: 74});

// Zepellion: gather beat, the L form, then the shot.
const zep = await page.evaluate(() => window.__castThenSample('zepellion', [0.3, 0.5, 0.64, 0.95, 1.2]));
await page.evaluate(() => window.__label('哉佩利敖光线 · 聚气（双手在胸前合拢）'));
await page.screenshot({path: join(out, 'zepellion-gather.jpg'), type: 'jpeg', quality: 74});
await page.evaluate(() => window.__label('哉佩利敖光线 · L 形成形'));
await page.screenshot({path: join(out, 'zepellion-form.jpg'), type: 'jpeg', quality: 74});
await page.evaluate(() => window.__label('哉佩利敖光线 · 发射'));
await page.screenshot({path: join(out, 'zepellion-fire.jpg'), type: 'jpeg', quality: 74});

const beamReady = flat([beam[1]])[0];
const zepGather = flat([zep[1]])[0];
const zepForm = flat([zep[2]])[0];
const gatherVsBeam = distance(zepGather, beamReady);
const formVsBeam = distance(zepForm, beamReady);
assert.ok(gatherVsBeam >= DIFFERENCE, `the gather pose must differ from the Mebium ready pose (${gatherVsBeam.toFixed(3)})`);
assert.ok(formVsBeam >= DIFFERENCE / 2, `the L form must differ from the Mebium pose (${formVsBeam.toFixed(3)})`);

// The HUD has to show the pre-motion stages without a camera.
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

console.log(JSON.stringify({ gatherVsBeam: +gatherVsBeam.toFixed(3), formVsBeam: +formVsBeam.toFixed(3), hud }, null, 1));
await browser.close();
