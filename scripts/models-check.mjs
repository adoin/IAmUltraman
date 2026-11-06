import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const out=process.env.BROWSER_ARTIFACT_DIR||'D:/tmp/ultraman-city-melee/range';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))errors.push(r.status()+' '+r.url());});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});await page.locator('#start-keyboard').click();await page.waitForFunction(()=>document.body.classList.contains('in-battle'));
 const act=code=>page.evaluate(async code=>{const{battle:b}=await import(document.querySelector('script[type=module]').src);const T=await import('three');return new Function('b','T',code)(b,T);},code);
 const frame=dt=>act(`for(let t=0;t<${dt}-1e-8;t+=1/60)b.advance(Math.min(1/60,${dt}-t));b.renderer.render(b.renderScene,b.camera);`);
 await act('b.renderer.setAnimationLoop(null);b.start();b.nextAttack=100;');await frame(.2);await page.screenshot({path:out+'/city-redking.png'});
 const models=await act(`return ['redking','baltan','ganq'].map(name=>{const m=b.models.get(name),bounds=new T.Box3().setFromObject(m);let skins=0,mapped=0;m.traverse(o=>{if(o.isSkinnedMesh)skins++;if(o.isMesh&&o.material.map?.image)mapped++;});return{name,skins,mapped,size:bounds.getSize(new T.Vector3()).toArray(),clips:b.monsterAnimations.get(name).map(c=>c.name)};});`);
 for(const m of models){assert.ok(m.mapped>0&&(m.name==='ganq'||m.skins>0&&(m.name==='redking'||m.clips.length>=5))&&m.size.every(Number.isFinite),JSON.stringify(m));}
 await page.keyboard.press('f');await frame(.4);assert.equal(await act('return b.monsterHealth'),110);
 await act("b.beginAttack('charge')");await frame(4.3);assert.ok(await act('return b.inMelee&&b.currentMonster.position.z>0'));await page.screenshot({path:out+'/near.png'});
 assert.equal(await act("return b.cast('beam')"),false);assert.equal(await act('return b.lastCast.beam'),-100);
 await page.keyboard.down('l');await frame(.35);assert.equal(await act('return b.guard'),true);await page.screenshot({path:out+'/x-shield.png'});await page.keyboard.up('l');
 await act('b.attack=null;b.nextAttack=100;');for(let i=0;i<3;i++){await page.keyboard.press('f');await frame(.4);}await frame(.8);assert.ok(await act('return b.enemyDistance>=35&&b.knockdowns===1'));await page.screenshot({path:out+'/retreat.png'});
 await page.keyboard.press('o');await frame(.35);assert.equal(await act('return b.monsterHealth'),54);await page.screenshot({path:out+'/palm.png'});await frame(.6);
 await page.keyboard.press('j');await frame(.55);await act('b.visualEffects.forEach(e=>e.group.visible=false);b.renderer.render(b.renderScene,b.camera);');await page.screenshot({path:out+'/cross.png'});await act('b.enemyDistance=13;');await frame(.25);assert.equal(await act("return b.effects.some(e=>e.kind==='beam')||b.visualEffects.some(e=>e.kind==='beam')"),false);
 await act("b.start();b.wave=2;b.monsterHealth=145;b.monsterMax=145;b.selectMonster();b.nextAttack=100;");await frame(.5);await page.screenshot({path:out+'/baltan.png'});
 await act('b.wave=3;b.selectMonster();b.nextAttack=100;');await frame(.5);await page.screenshot({path:out+'/ganq.png'});
 assert.equal((await page.locator('body').innerText()).trim(),(await page.locator('.battle-hud').innerText()).trim());assert.deepEqual(errors,[]);console.log('PASS real models, city textures, misses at range, charge, X shield, third-hit retreat, palm, remote cancellation and clean battle',JSON.stringify(models));
}finally{await browser.close();}
