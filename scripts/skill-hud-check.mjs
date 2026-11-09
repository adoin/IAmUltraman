import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const out=process.env.BROWSER_ARTIFACT_DIR||'D:/tmp/ultraman-skill-hud-check';await mkdir(out,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}),headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
 await page.goto('http://127.0.0.1:4173/?preview=skills',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.classList.contains('in-battle'));
 const act=code=>page.evaluate(async code=>{const {battle:b}=await import('/src/main.js');return new Function('b',code)(b);},code);
 await act('b.renderer.setAnimationLoop(null);b.start();b.practice=true;b.nextAttack=100000;b.animateMonster(0);b.renderer.render(b.renderScene,b.camera);');
 await page.waitForTimeout(130);assert.equal(await page.locator('.combat-skill').count(),5);assert.equal(await page.locator('[data-skill=beam]').getAttribute('data-state'),'ready');
 await page.screenshot({path:out+'/desktop-ready.png'});
 await page.keyboard.press('j');await page.waitForTimeout(130);assert.equal(await page.locator('[data-skill=beam]').getAttribute('data-state'),'cooldown');const cooldown=await page.locator('[data-skill=beam] .combat-skill-time').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('[data-skill=beam] .combat-skill-time').textContent(),cooldown);
 await act('b.effects=[];b.lastCast.zepellion=b.time-6.6;b.guardEnergy=100;b.raiseShield();b.renderer.render(b.renderScene,b.camera);');await page.waitForTimeout(130);assert.equal(await page.locator('[data-skill=guard]').getAttribute('data-state'),'guarding');await page.screenshot({path:out+'/desktop-mixed.png'});
 await act('b.lowerShield();b.enemyDistance=16;b.effects=[];');await page.waitForTimeout(130);assert.equal(await page.locator('[data-skill=disc]').getAttribute('data-state'),'locked');assert.equal(await page.locator('[data-skill=guard]').getAttribute('data-state'),'cooldown');await page.screenshot({path:out+'/desktop-near.png'});
 for(const [name,width,height]of [['mobile-landscape',844,390],['mobile-portrait',390,844]]){await page.setViewportSize({width,height});await act('b.resize();b.renderer.render(b.renderScene,b.camera);');await page.waitForTimeout(130);const box=await page.locator('.combat-skills').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=height,name+' clipped');await page.screenshot({path:out+'/'+name+'.png'});}
 await act('b.start();b.nextAttack=100;b.beginAttack("sweep");b.attack.age=.6;');await page.waitForTimeout(130);assert.equal(await page.locator('[data-skill=guard] .combat-skill-label').textContent(),'举盾');assert.equal(await page.locator('[data-skill=guard]').getAttribute('data-state'),'ready');
 assert.deepEqual(errors,[]);console.log('PASS five real skill states, keyboard cooldown, clock freeze, shield duration/cooldown, melee lock, guard cue and three viewport layouts');
}finally{await browser.close();}
