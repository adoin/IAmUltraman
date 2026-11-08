import {chromium} from "playwright";
const browser=await chromium.launch({channel:"chrome",headless:true});
const page=await browser.newPage({viewport:{width:480,height:360}});
page.on("pageerror",e=>console.log("PAGEERROR",String(e)));
await page.goto("http://127.0.0.1:4173",{waitUntil:"domcontentloaded"});
const battle=`(await import(document.querySelector('script[type=module]').src)).battle`;
await page.waitForFunction(`(async()=>{const b=${battle};return b.assetReady===true})()`,{timeout:180000});
await page.locator("#start-keyboard").click();
await page.waitForFunction(()=>document.body.classList.contains("in-battle"));
const info=await page.evaluate(`(async()=>{
  const b=${battle};b.renderer.setAnimationLoop(null);await b.prefetch;
  const T=await import("three");
  b.start();b.wave=8;b.monsterMax=b.waveInfo.hp;b.monsterHealth=b.monsterMax;b.nextAttack=1e9;b.attack=null;b.selectMonster();
  for(let i=0;i<40;i++)b.advance(1/30);
  const mm=b.monsterMotion;
  b.beginAttack("bolt");
  for(let i=0;i<240&&b.attack&&b.attack.phase==="windup";i++)b.advance(1/30);
  for(let i=0;i<240&&b.attack&&b.attack.phase==="flight"&&b.attack.age<b.attack.flight*0.5;i++)b.advance(1/30);
  const p=mm.origin("R");
  return {kind:b.attack?.kind,phase:b.attack?.phase,headName:mm.rig.head?mm.rig.head.name:null,
    originIsVec:!!(p&&p.isVector3),origin:[p.x,p.y,p.z],rootScale:mm.root.getWorldScale(new T.Vector3()).x,
    emitPoint:(()=>{try{const q=mm.emitPoint("mouth");return q?[q.x,q.y,q.z]:"null";}catch(e){return "ERR "+e.message;}})()};
})()`);
console.log(JSON.stringify(info,null,1));
await browser.close();
