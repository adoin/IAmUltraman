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
  b.start();b.wave=2;b.monsterMax=b.waveInfo.hp;b.monsterHealth=b.monsterMax;b.nextAttack=1e9;b.attack=null;b.selectMonster();
  for(let i=0;i<40;i++)b.advance(1/30);
  const mm=b.monsterMotion;
  const P=()=>{const p=mm.rig.hand.L.getWorldPosition(new T.Vector3());const o=mm.root.getWorldPosition(new T.Vector3());const s=mm.root.getWorldScale(new T.Vector3()).x*16;return [ (p.x-o.x)/s,(p.y-o.y)/s,(p.z-o.z)/s ];};
  const idle=P();
  b.beginAttack("bolt");
  let spec=null;
  try{const poses=await import(new URL("src/monster-poses.js",document.baseURI).href);spec=poses.MONSTER_MOVES[b.waveInfo.model]?.[b.attack?.kind]?.name||null;}catch(e){spec="ERR "+e.message;}
  for(let i=0;i<40&&b.attack&&b.attack.phase==="windup";i++)b.advance(1/30);
  const windup=P();
  return {type:mm.type,attackKind:b.attack?.kind,phase:b.attack?.phase,age:+b.attack.age.toFixed(2),windup:+b.attack.windup.toFixed(2),
    spec,moveFor:!!spec,idle,windup,limbs:mm.limbs.L.length,mmd:!!mm.mmd,rigHead:mm.rig.head?.name};
})()`);
console.log(JSON.stringify(info,null,1));
await browser.close();
