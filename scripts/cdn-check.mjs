// Exercise a separate HTTPS resource origin without needing CDN credentials.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const metadata=JSON.parse(await readFile('dist/deployment.json','utf8'));
assert.ok(metadata.cdnBase,'Build with ASSET_BASE_URL=https://assets.example.test first');
const base=new URL(metadata.cdnBase),prefix=base.pathname.replace(/\/$/,'')+'/assets/'+metadata.assetVersion+'/public/';
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}),headless:true,args:['--mute-audio']});
try {
  const context=await browser.newContext(),requested=[],errors=[];
  await context.route(base.origin+'/**',async route=>{
    const url=new URL(route.request().url());assert.ok(url.pathname.startsWith(prefix));
    const relative=decodeURIComponent(url.pathname.slice(prefix.length)),root=path.resolve('dist/public'),file=path.resolve(root,relative);
    assert.ok(file.startsWith(root+path.sep));requested.push(relative);
    const mime={'.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.glb':'model/gltf-binary'}[path.extname(file)]||'application/octet-stream';
    await route.fulfill({status:200,body:await readFile(file),contentType:mime,headers:{'Access-Control-Allow-Origin':'*'}});
  });
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#pose-status').dataset.state==='ready'&&document.querySelector('#load-status').textContent==='海湾准备就绪');
  await page.locator('#start-keyboard').click();await page.waitForFunction(()=>document.body.classList.contains('in-battle'));
  await page.evaluate(async()=>{const {battle}=await import(document.querySelector('script[type=module]').src);await battle.prefetch;});
  assert.ok(requested.some(p=>p.endsWith('.wasm')));assert.ok(requested.includes('models/pose_landmarker_lite.task'));assert.ok(requested.includes('models/kaiju/redking.glb'));assert.ok(requested.includes('models/kaiju/gatanothor.glb'));assert.deepEqual(errors,[]);
  console.log('PASS cross-origin models, city, classic Worker dependencies, WASM and pose warmup;',new Set(requested).size,'resources');
}finally{await browser.close();}
