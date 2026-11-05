import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const artifacts=path.resolve(process.env.BROWSER_ARTIFACT_DIR||'D:/tmp/ultraman-browser-check');
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}),headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('favicon')&&e.text()!=='INFO: Created TensorFlow Lite XNNPACK delegate for CPU.')errors.push(e.text());});
  await page.addInitScript(()=>{
    window.__pipShortcut={events:0,requests:0,errors:[]};
    document.addEventListener('keydown',event=>{
      if(event.key.toLowerCase()!=='w'||event.ctrlKey||event.metaKey||event.altKey)return;
      window.__pipShortcut.events++;
      const video=document.querySelector('video');
      if(video){window.__pipShortcut.requests++;video.requestPictureInPicture().catch(e=>window.__pipShortcut.errors.push(e.name));}
    },true);
  });
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.getElementById('load-status').textContent==='海湾准备就绪');
  const act=fn=>page.evaluate(async text=>{const{battle}=await import(document.querySelector('script[type=module]').src);return new Function('b',text)(battle);},fn);
  const clean=async()=>{assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('in-battle')),true);assert.equal((await page.locator('body').innerText()).trim(),'');for(const selector of ['.battle-hud','#threat','#callout','#tracking-tip','.control-deck','#preview','.arena-touch','.topbar'])assert.equal(await page.locator(selector).isVisible(),false,selector);const size=await page.locator('#game').boundingBox();const viewport=page.viewportSize();assert.equal(Math.round(size.width),viewport.width);assert.equal(Math.round(size.height),viewport.height);};
  assert.equal(await act('return b.models.size'),4);
  assert.equal(await page.locator('.skill-card').count(),3);
  await page.locator('#show-moves').click();assert.equal(await page.locator('.punch-guide').isVisible(),true);await page.keyboard.press('Escape');
  await page.screenshot({path:path.join(artifacts,'preparation.png'),fullPage:true});
  await page.locator('#start-keyboard').click();await page.waitForTimeout(500);await act('b.nextAttack=100');await clean();assert.equal(await act('return b.hands.visible'),false);assert.equal(await act('return b.targetRing.visible||b.warningRing.visible||b.safeZone.visible'),false);
  assert.equal(await page.locator('video').count(),0);
  await page.keyboard.down('w');await page.keyboard.press('w');await page.keyboard.up('w');
  assert.deepEqual(await page.evaluate(()=>window.__pipShortcut),{events:0,requests:0,errors:[]});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'game');
  assert.equal(await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true,cancelable:true}))),true);
  await clean();console.log('PASS keyboard play owns W, has no video target and leaves modified shortcuts alone');
  await page.screenshot({path:path.join(artifacts,'clean-battle.png')});console.log('PASS preparation separated from viewport-sized battle: no text, HUD, controls, reticle or idle hands');
  await page.keyboard.press('f');await page.waitForTimeout(110);await page.screenshot({path:path.join(artifacts,'punch.png')});await page.waitForTimeout(260);assert.equal(await act('return b.monsterHealth'),98);assert.equal(await act('return b.lastCast.beam'),-100);await page.locator('#game').click({position:{x:900,y:650}});await page.waitForTimeout(440);assert.equal(await act('return b.monsterHealth'),86);assert.equal(await act('return b.stats.punches'),2);await clean();console.log('PASS F and canvas-click ordinary punches deal damage without spending skill cooldowns');
  await page.keyboard.press('j');await page.waitForTimeout(850);assert.equal(await act('return b.monsterHealth'),40);await clean();console.log('PASS skills and their visual feedback work in clean battle');
  await act("b.effects=[];b.attack=null;b.beginAttack('slam');while(b.attack.phase==='windup')b.update(.05)");await page.keyboard.down('l');await page.waitForTimeout(150);await act('for(let i=0;i<80;i++)b.update(.05)');assert.equal(await act('return b.guard'),false);assert.ok(await act('return b.guardCooldown')>0);await act('b.nextAttack=100;for(let i=0;i<90;i++){b.update(.05);b.setDefense(true,0);}');assert.equal(await act('return b.guard'),false);await page.keyboard.up('l');await page.keyboard.down('l');assert.equal(await act('return b.guard'),true);await page.keyboard.up('l');assert.equal(await act('return b.stats.blocked'),1);assert.equal(await act('return b.heroHealth'),100);await clean();console.log('PASS natural monster attacks and player shielding without text overlays');
  await page.keyboard.press('Escape');assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('in-battle')),false);assert.equal(await page.locator('.control-deck').isVisible(),true);assert.equal(await page.locator('#pause-panel').isVisible(),true);await page.locator('#settings').click();await page.locator('#quality').selectOption('low');await page.keyboard.press('Escape');await page.locator('#resume').click();await clean();console.log('PASS Escape returns to preparation; settings and resume restore clean battle');
  await act("b.start();for(let i=0;i<5;i++){b.damage(1000);b.update(3.2);}");assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('in-battle')),false);assert.equal(await page.locator('#pause-panel h2').textContent(),'守护成功！');await page.locator('#restart').click();await clean();console.log('PASS victory result appears outside battle; restart enters clean view');
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>document.getElementById('load-status').textContent==='海湾准备就绪');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#start-keyboard').click();await page.waitForTimeout(250);await clean();await page.screenshot({path:path.join(artifacts,'mobile-battle.png')});
  await page.locator('#game').dispatchEvent('touchstart',{touches:[{identifier:1},{identifier:2}]});assert.equal(await page.locator('.control-deck').isVisible(),true);await page.locator('#resume').click();await clean();console.log('PASS mobile clean viewport and two-finger return gesture');
  assert.deepEqual(errors,[]);console.log('PASS no JavaScript, shader or GLTF errors');
}finally{await browser.close();}
