import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const artifacts=path.resolve(process.env.BROWSER_ARTIFACT_DIR||'D:/tmp/ultraman-animation-check');
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}),headless:true});
const report=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('favicon')&&e.text()!=='INFO: Created TensorFlow Lite XNNPACK delegate for CPU.')errors.push(e.text());});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.getElementById('load-status').textContent==='海湾准备就绪');
  await page.locator('#start-keyboard').click();
  const act=code=>page.evaluate(async code=>{const{battle:b}=await import(document.querySelector('script[type=module]').src);const T=await import('three');return new Function('b','T',code)(b,T);},code);
  await act('b.renderer.setAnimationLoop(null);');

  // Measure the deformed skeleton, not just preset names or assigned quaternions.
  const hands=await act(`
    b.start();const result=[];
    for(const r of b.hero.rigs){
      const suffix='_'+r.side,point=n=>r.nodes[n+suffix].getWorldPosition(new T.Vector3());
      const wrist=point('Hand'),long=point('Mid1').sub(wrist).normalize();
      const across=point('Index1').sub(point('Pinky1')).normalize().multiplyScalar(r.side==='L'?1:-1);
      const normal=across.clone().cross(long).normalize(),measure={side:r.side};
      for(const shape of ['blade','fist','shield']){
        r.applyShape({[shape]:1});r.root.updateWorldMatrix(true,true);
        const tip=f=>r.nodes[f+'3'+suffix].localToWorld(r.tipLocal[f].clone());
        const mcp=point('Mid1'),pip=point('Mid2'),dip=point('Mid3'),end=tip('Mid');
        measure[shape]={spread:tip('Index').distanceTo(tip('Pinky')),reach:end.clone().sub(mcp).dot(long),curl:pip.clone().sub(mcp).normalize().dot(end.clone().sub(dip).normalize()),thumbSide:tip('Thumb').sub(point('Index1')).dot(normal)};
      }result.push(measure);
    }return result;`);
  for(const hand of hands){
    assert.ok(hand.blade.spread<hand.shield.spread*.68,'blade fingers must close together');
    assert.ok(hand.blade.curl>.98,'blade fingers remain straight');
    assert.ok(hand.blade.reach>.18,'blade fingers extend beyond the knuckles');
    assert.ok(hand.fist.curl<-.5,'punch fingers must fold back into the palm');
    assert.ok(hand.fist.reach<.01,'fist must not retain the open hand silhouette');
    assert.ok(hand.blade.thumbSide<-.015&&hand.fist.thumbSide<-.045,'thumb must tuck on the palm side');
  }
  report.push({hands});console.log('PASS actual fingertip geometry: closed blade, curled fist, open shield and palm-side thumbs');

  for(const [label,viewport,low]of [['desktop',{width:1280,height:800},false],['portrait',{width:390,height:844},true],['tablet',{width:700,height:900},false]]){
    await page.setViewportSize(viewport);await page.waitForTimeout(100);await act(`b.setQuality('${low?'low':'high'}');b.reduced=${low};`);
    for(const action of ['beam','punch','disc','shield']){
      await act(`b.start();b.nextAttack=100;b.hero.reset();b.__motion={jump:0,stretch:0,caps:0,previous:b.hero.rigs.map(r=>r.metrics()),lengths:b.hero.diagnostics().map(r=>[r.forearmLength,r.upperLength])};b.__caps=[];b.hands.traverse(m=>{if(m.isSkinnedMesh&&m.material.name.includes('lining'))b.__caps.push(m);});${action==='shield'?'b.setDefense(true);':action==='punch'?'b.punch("right");':`b.cast('${action}');`}`);
      const times=action==='beam'?[.16,.34,.41,.55,.65,1.3,1.8,2.02]:action==='disc'?[.16,.31,.33,.55,.75,1.18]:action==='punch'?[.06,.18,.28,.40]:[.15,.5];
      let previous=0;
      for(const time of times){
        const m=await act(`
          for(let time=0;time<${time-previous}-.000001;time+=1/120){
            ${action==='shield'?'b.setDefense(true);':''}
            b.advance(Math.min(1/120,${time-previous}-time));
            b.hero.rigs.forEach((r,i)=>{const now=r.metrics(),before=b.__motion.previous[i];
              for(const joint of ['wrist','elbow','shoulder'])b.__motion.jump=Math.max(b.__motion.jump,now[joint].distanceTo(before[joint]));
              b.__motion.stretch=Math.max(b.__motion.stretch,Math.abs(now.wrist.distanceTo(now.elbow)-b.__motion.lengths[i][0]),Math.abs(now.elbow.distanceTo(now.shoulder)-b.__motion.lengths[i][1]));b.__motion.previous[i]=now;
            });
            // Attached skins need updateMatrixWorld (not just updateWorldMatrix)
            // before CPU skinning: it refreshes their inverse bind transforms.
            b.renderScene.updateMatrixWorld(true);
            for(const mesh of b.__caps){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
              const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).project(b.camera);
              if(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1)b.__motion.caps++;
            }}
          }
          const rigs=b.hero.rigs,points=rigs.map(r=>r.metrics()),dirs=points.map(r=>r.wrist.clone().sub(r.elbow).normalize());
          const project=p=>{p.project(b.camera);return[(p.x+1)/2,(1-p.y)/2];};
          const fingertips=rigs.map(r=>r.nodes['Mid3_'+r.side].localToWorld(r.tipLocal.Mid.clone()));
          const beam=b.visualEffects.find(e=>e.kind==='beam'),disc=b.visualEffects.find(e=>e.kind==='disc');
          const result={time:${time},health:b.monsterHealth,visible:b.hands.visible,jump:b.__motion.jump,stretch:b.__motion.stretch,visibleCaps:b.__motion.caps,perpendicular:dirs[0].dot(dirs[1]),upright:dirs[1].y,horizontal:dirs[0].x,
            supportGap:points[1].elbow.distanceTo(b.camera.worldToLocal(fingertips[0].clone())),tips:fingertips.map(p=>project(p.clone())),wrists:rigs.map(r=>project(r.hand.getWorldPosition(new T.Vector3()))),
            beam:beam?{visible:beam.volume.visible,sourceError:beam.start.distanceTo(b.hero.socketWorld('beam')),contact:beam.contact.material.opacity,rail:beam.volume.sourceBottom.distanceTo(beam.volume.sourceTop)}:null,
            disc:disc?{held:!disc.released,sourceError:disc.disc.position.distanceTo(b.hero.socketWorld('disc')),targetError:disc.disc.position.distanceTo(disc.end)}:null};
          b.renderer.render(b.renderScene,b.camera);return result;`);
        assert.ok(m.stretch<.0001,'action must preserve arm lengths');
        assert.equal(m.visibleCaps,0,'shoulder cuts must remain outside the viewport throughout the action');
        assert.ok(m.jump<(action==='punch'?.42:.24),'adjacent frames must not teleport joints');
        assert.equal((await page.locator('body').innerText()).trim(),'');
        if(action==='beam'){
          if(time>=.34&&time<=1.3){
            assert.ok(Math.abs(m.perpendicular)<.025&&m.upright>.99&&m.horizontal>.99,'hold must form a vertical blade and horizontal support');
            assert.ok(m.supportGap<.23,'supporting fingers must meet the vertical elbow');
            for(const [x,y]of [...m.tips,...m.wrists])assert.ok(x>.03&&x<.97&&y>.03&&y<.94,'hands must fit in the viewport');
          }
          if(time===.41){assert.equal(m.beam.visible,false);assert.equal(m.health,110);}
          if(time===.55){assert.equal(m.beam.visible,true);assert.equal(m.health,110);assert.equal(m.beam.contact,0);}
          if(time===.65){assert.equal(m.health,64);assert.ok(m.beam.contact>0);}
          if(m.beam){assert.ok(m.beam.sourceError<.0001);if(time>=.55)assert.ok(m.beam.rail>.9);}
          if(time===2.02){assert.equal(m.visible,false);assert.equal(m.beam,null);}
        }
        if(action==='punch'&&time===.18)assert.equal(m.health,98);
        if(action==='disc'){
          if(time===.31){assert.equal(m.disc.held,true);assert.ok(m.disc.sourceError<.0001);assert.equal(m.health,110);}
          if(time===.33)assert.equal(m.disc.held,false);
          if(time===.75){assert.equal(m.health,79);assert.ok(m.disc.targetError<.0001);}
        }
        report.push({viewport:label,action,...m});
        await page.screenshot({path:path.join(artifacts,`${label}-${action}-${time}.png`)});
        if(action==='beam'&&time===.34){await act('b.visualEffects.forEach(e=>e.group.visible=false);b.renderer.render(b.renderScene,b.camera);');await page.screenshot({path:path.join(artifacts,`${label}-beam-pose.png`)});await act('b.visualEffects.forEach(e=>e.group.visible=true);');}
        previous=time;
      }
      console.log(`PASS ${label} ${action}: continuous joints, fixed arm lengths, pose framing and contact timing`);
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(artifacts,'geometry-report.json'),JSON.stringify(report,null,2));
}finally{await browser.close();}
