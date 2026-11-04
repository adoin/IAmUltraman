import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const artifacts=path.resolve(process.env.BROWSER_ARTIFACT_DIR||'D:/tmp/ultraman-models-check');await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}),headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('load-status').textContent==='海湾准备就绪');await page.locator('#start-keyboard').click();
 for(const [wave,kind,color]of [[1,'basalt','29353b'],[2,'leviathan','193b52'],[5,'nova','30252c']]){
  const result=await page.evaluate(async wave=>{
   const{battle:b}=await import(document.querySelector('script[type=module]').src);b.renderer.setAnimationLoop(null);b.wave=wave;b.monsterHealth=b.waveInfo.hp;b.monsterMax=b.waveInfo.hp;b.attack=null;b.effects=[];b.selectMonster();b.animateMonster(.01);b.animateHands(0);b.renderer.render(b.renderScene,b.camera);
   const skin=[],nodes=[],materials=[];let waist=0,chest=0;
   b.currentMonster.traverse(o=>{nodes.push(o.name);if(o.isMesh){materials.push(o.material);if(o.material.name==='Skin')skin.push(o.material.color.getHexString());if(o.name==='Tapered_torso'){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),x=Math.abs(p.getX(i));if(Math.abs(y+.35)<.05)waist=Math.max(waist,x);if(y>1.5&&y<2.8)chest=Math.max(chest,x);}}}});
   return{skin:[...new Set(skin)],nodes,waist,chest,triangles:b.renderer.info.render.triangles,drawCalls:b.renderer.info.render.calls,opaque:materials.every(m=>!m.transparent),huds:document.body.innerText.trim()};
  },wave);
  assert.deepEqual(result.skin,[color]);assert.ok(result.waist/result.chest<.65,JSON.stringify(result));assert.ok(result.triangles<20000);assert.equal(result.opaque,true);assert.equal(result.huds,'');for(const name of ['Body','Head','Jaw','ArmL','ArmR','ForearmL','ForearmR','Tail'])assert.ok(result.nodes.includes(name),name);if(kind==='nova')for(const name of ['WingL','WingR'])assert.ok(result.nodes.includes(name));
  await page.screenshot({path:path.join(artifacts,kind+'.png')});console.log('PASS',kind,'sRGB',color,'waist/chest',(result.waist/result.chest).toFixed(2),'scene triangles',result.triangles,'draw calls',result.drawCalls);
  await page.evaluate(async()=>{const{battle:b}=await import(document.querySelector('script[type=module]').src);b.currentMonster.rotation.y=.62;b.renderer.render(b.renderScene,b.camera);});await page.screenshot({path:path.join(artifacts,kind+'-three-quarter.png')});
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.evaluate(async()=>{const{battle:b}=await import(document.querySelector('script[type=module]').src);b.currentMonster.rotation.y=0;b.renderer.render(b.renderScene,b.camera);});await page.screenshot({path:path.join(artifacts,'mobile-boss.png')});assert.deepEqual(errors,[]);console.log('PASS all model palettes, tapered proportions, animation pivots and portrait rendering');
}finally{await browser.close();}
