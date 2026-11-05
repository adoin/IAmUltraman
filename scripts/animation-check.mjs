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
  await act(`
    b.__crossing=segments=>{
      const [[a,c],[d,f]]=segments,sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
      const r=sub(c,a),s=sub(f,d),offset=sub(d,a),den=cross(r,s);
      if(Math.abs(den)<.000001)return null;
      const left=cross(offset,s)/den,right=cross(offset,r)/den;
      return{left,right,point:[a[0]+left*r[0],a[1]+left*r[1]],angle:Math.acos(Math.max(-1,Math.min(1,(r[0]*s[0]+r[1]*s[1])/Math.hypot(...r)/Math.hypot(...s))))*180/Math.PI};
    };
    b.__inspectCross=(allSamples=true)=>{
      b.renderScene.updateMatrixWorld(true);
      const lens=b.hero.lens.camera;
      const project=p=>{p.project(lens);return[p.x*innerWidth/2,p.y*innerHeight/2];};
      const arms=b.hero.rigs,segments=arms.map(r=>[project(r.lower.getWorldPosition(new T.Vector3())),project(r.hand.getWorldPosition(new T.Vector3()))]);
      const cross=b.__crossing(segments),[left,right]=arms;
      const point=name=>left.nodes[name+'_L'].getWorldPosition(new T.Vector3());
      const long=point('Mid1').sub(point('Hand')).normalize(),normal=point('Index1').sub(point('Pinky1')).normalize().cross(long).normalize();
      const forearm=point('Hand').sub(point('LowerArm')).normalize();
      const upright=right.hand.getWorldPosition(new T.Vector3()).sub(right.lower.getWorldPosition(new T.Vector3())).normalize();
      const finger=right.nodes.Mid3_R.localToWorld(right.tipLocal.Mid.clone()).sub(right.nodes.Mid1_R.getWorldPosition(new T.Vector3())).normalize();
      const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(lens.projectionMatrix,lens.matrixWorldInverse));
      const entries=arms.map(arm=>{
        const shoulder=arm.upper.getWorldPosition(new T.Vector3()),elbow=arm.lower.getWorldPosition(new T.Vector3());
        let first=0,last=1;
        for(const plane of frustum.planes){const a=plane.distanceToPoint(shoulder),b=plane.distanceToPoint(elbow);if(a<0&&b<0)return null;if(a<0)first=Math.max(first,a/(a-b));else if(b<0)last=Math.min(last,a/(a-b));}
        if(first>last)return null;
        const point=shoulder.lerp(elbow,first).project(lens);return[(1+point.x)/2,(1-point.y)/2];
      });
      const result={...cross,entries,leftPalm:normal.negate().toArray(),rightForearm:upright.toArray(),rightFingersUp:finger.y,rightElbowX:right.metrics().elbow.x,straightWrist:long.dot(forearm),gaps:[]};
      if(!cross||cross.left<=0||cross.left>=1||cross.right<=0||cross.right>=1)return result;
      const sides=new Map();b.hands.traverse(m=>{if(m.isSkinnedMesh){if(!sides.has(m.material))sides.set(m.material,m.material.side);m.material.side=T.DoubleSide;m.skeleton.update();m.computeBoundingSphere();if(m.boundingBox)m.computeBoundingBox();}});
      const ray=new T.Raycaster();
      for(const [dx,dy]of (allSamples?[[0,0],[-.006,0],[.006,0],[0,-.006],[0,.006]]:[[0,0]])){
        ray.setFromCamera(new T.Vector2(cross.point[0]*2/innerWidth+dx,cross.point[1]*2/innerHeight+dy),lens);
        const hits=arms.map(r=>ray.intersectObject(r.root,true).map(h=>h.distance));
        if(hits.every(h=>h.length>=2))result.gaps.push(Math.min(...hits[0])-Math.max(...hits[1]));
      }
      for(const [material,side]of sides)material.side=side;
      return result;
    };
  `);
  // The previously shipped tray pose was perpendicular but did not intersect.
  const rejected=await act('return b.__crossing([[[-1.063,-.867],[-.282,-.867]],[[.16,-.731],[.16,.05]]]);');
  assert.ok(!(rejected.left>.2&&rejected.left<.8&&rejected.right>.2&&rejected.right<.8),'old elbow-support pose must fail the cross criterion');

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
      await act(`b.start();b.nextAttack=100;b.hero.reset();b.__motion={jump:0,stretch:0,drift:0,caps:0,gap:1,gapTime:0,ticks:0,previous:b.hero.rigs.map(r=>r.metrics()),mounts:b.hero.rigs.map(r=>r.metrics().shoulder),lengths:b.hero.diagnostics().map(r=>[r.forearmLength,r.upperLength])};b.__caps=[];b.hands.traverse(m=>{if(m.isSkinnedMesh&&m.material.name.includes('lining'))b.__caps.push(m);});${action==='shield'?'':action==='punch'?'b.punch("right");':`b.cast('${action}');`}`);
      if(action==='shield')await page.keyboard.down('l');
      const times=action==='beam'?[.16,.24,.28,.34,.41,.55,.65,1.3,1.72,1.8,2.02]:action==='disc'?[.16,.31,.33,.55,.75,1.18]:action==='punch'?[.06,.18,.28,.40]:[.15,.5,1.95,2.6];
      let previous=0;
      for(const time of times){
        const m=await act(`
          for(let time=0;time<${time-previous}-.000001;time+=1/120){
            b.advance(Math.min(1/120,${time-previous}-time));
            b.hero.rigs.forEach((r,i)=>{const now=r.metrics(),before=b.__motion.previous[i];
              b.__motion.drift=Math.max(b.__motion.drift,now.shoulder.distanceTo(b.__motion.mounts[i]));
              for(const joint of ['wrist','elbow','shoulder'])b.__motion.jump=Math.max(b.__motion.jump,now[joint].distanceTo(before[joint]));
              b.__motion.stretch=Math.max(b.__motion.stretch,Math.abs(now.wrist.distanceTo(now.elbow)-b.__motion.lengths[i][0]),Math.abs(now.elbow.distanceTo(now.shoulder)-b.__motion.lengths[i][1]));b.__motion.previous[i]=now;
            });
            // Attached skins need updateMatrixWorld (not just updateWorldMatrix)
            // before CPU skinning: it refreshes their inverse bind transforms.
            b.renderScene.updateMatrixWorld(true);
            for(const mesh of b.__caps){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
              const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).project(b.hero.lens.camera);
              if(b.hands.visible&&Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1)b.__motion.caps++;
            }}
            if('${action}'==='beam'&&++b.__motion.ticks%2===0){const age=b.effects.find(e=>e.kind==='beam')?.age;if(age!==undefined&&(age<.32||age>1.62)){
              const cross=b.__inspectCross(false);if(cross.gaps.length){const gap=Math.min(...cross.gaps);if(gap<b.__motion.gap){b.__motion.gap=gap;b.__motion.gapTime=age;}}
            }}
          }
          const rigs=b.hero.rigs,points=rigs.map(r=>r.metrics()),dirs=points.map(r=>r.wrist.clone().sub(r.elbow).normalize());
          const project=p=>{p.project(b.hero.lens.camera);return[(p.x+1)/2,(1-p.y)/2];};
          const screenLength=(a,c,camera)=>{const delta=c.clone().project(camera).sub(a.clone().project(camera));return Math.hypot(delta.x*innerWidth,delta.y*innerHeight);};
          const fingertips=rigs.map(r=>r.nodes['Mid3_'+r.side].localToWorld(r.tipLocal.Mid.clone()));
          const beam=b.visualEffects.find(e=>e.kind==='beam'),disc=b.visualEffects.find(e=>e.kind==='disc');
          const result={time:${time},health:b.monsterHealth,visible:b.hands.visible,jump:b.__motion.jump,stretch:b.__motion.stretch,drift:b.__motion.drift,shoulderSpan:points[0].shoulder.distanceTo(points[1].shoulder),visibleCaps:b.__motion.caps,minMovingGap:b.__motion.gap,minMovingGapTime:b.__motion.gapTime,perpendicular:dirs[0].dot(dirs[1]),upright:dirs[1].y,horizontal:dirs[0].x,
            cross:${action==='beam'?'b.__inspectCross()':'null'},tips:fingertips.map(p=>project(p.clone())),wrists:rigs.map(r=>project(r.hand.getWorldPosition(new T.Vector3()))),
            beam:beam?{visible:beam.volume.visible,sourceError:beam.start.distanceTo(b.hero.socketWorld('beam')),screenError:b.camera.localToWorld(points[1].elbow.clone().lerp(points[1].wrist,.73).add(new T.Vector3(0,0,-.18))).project(b.hero.lens.camera).distanceTo(beam.start.clone().project(b.camera)),contact:beam.contact.material.opacity,railCoverage:screenLength(beam.volume.sourceBottom,beam.volume.sourceTop,b.camera)/screenLength(rigs[1].lower.getWorldPosition(new T.Vector3()),rigs[1].hand.getWorldPosition(new T.Vector3()),b.hero.lens.camera)}:null,
            disc:disc?{held:!disc.released,sourceError:disc.disc.position.distanceTo(b.hero.socketWorld('disc')),targetError:disc.disc.position.distanceTo(disc.end)}:null};
          b.renderer.render(b.renderScene,b.camera);return result;`);
        assert.ok(m.stretch<.0001,'action must preserve arm lengths');
        assert.ok(m.drift<.0001&&Math.abs(m.shoulderSpan-1.6193)<.001,'shoulders stay fixed at the measured Tiga shoulder span');
        assert.equal(m.visibleCaps,0,`${label} ${action} ${time}: shoulder cuts must remain outside the viewport throughout the action`);
        assert.ok(m.jump<(action==='punch'?.42:.24),'adjacent frames must not teleport joints');
        assert.equal((await page.locator('body').innerText()).trim(),'');
        if(action==='beam'){
          assert.ok(m.minMovingGap>=0,'forearms must not pass through each other during entry/recovery: '+JSON.stringify({viewport:label,gap:m.minMovingGap,time:m.minMovingGapTime}));
          if(time>=.34&&time<=1.3){
            assert.ok(m.cross.left>.2&&m.cross.left<.8&&m.cross.right>.2&&m.cross.right<.8,'crossing must lie inside BOTH forearms, not on a supporting palm');
            assert.ok(Math.abs(m.cross.angle-90)<2,'projected forearms must form a cross');
            assert.ok(m.cross.leftPalm[1]<-.999,'left palm must face the ground, measured from the wrist and three knuckles in world coordinates');
            assert.ok(m.cross.rightForearm[1]>.9999&&m.cross.rightFingersUp>.98,'right wrist and blade must rise vertically above the elbow, including in side view');
            assert.ok(m.cross.rightElbowX>(label==='desktop'?.45:.23),'right elbow must open to the player’s right');
            assert.ok(m.cross.straightWrist>.97,'left wrist must stay straight');
            assert.ok(m.cross.gaps.length>=3&&m.cross.gaps.every(g=>g>0&&g<.20),'right forearm must cover the left at the cross without penetration: '+JSON.stringify(m.cross.gaps));
            assert.ok(m.cross.entries[0]?.[0]<.28&&m.cross.entries[1]?.[0]>.70,'upper arms should enter from opposite outer portions of the frame: '+JSON.stringify(m.cross.entries));
            for(const [x,y]of [...m.tips,...m.wrists])assert.ok(x>.03&&x<.97&&y>.03&&y<.94,'hands must fit in the viewport');
          }
          if(time===.41){assert.equal(m.beam.visible,false);assert.equal(m.health,110);}
          if(time===.55){assert.equal(m.beam.visible,true);assert.equal(m.health,110);assert.equal(m.beam.contact,0);}
          if(time===.65){assert.equal(m.health,64);assert.ok(m.beam.contact>0);}
          if(m.beam){assert.ok(m.beam.sourceError<.0001&&m.beam.screenError<.0001);if(time>=.55)assert.ok(m.beam.railCoverage>1&&m.beam.railCoverage<1.5,'the visible emitter must span the upright forearm: '+m.beam.railCoverage);}
          if(time===2.02){assert.equal(m.visible,false);assert.equal(m.beam,null);}
        }
        if(action==='punch'&&time===.18)assert.equal(m.health,98);
        if(action==='shield'){
          const shield=await act('return {active:b.guard,energy:b.shield.material.uniforms.energy.value};');
          if(time<2){assert.ok(shield.active&&m.visible&&shield.energy>.2,'held shield must remain visible during its active window');}
          else{assert.ok(!shield.active&&!m.visible&&shield.energy<.01,'shield and hands must retract on expiry while L is still held');}
        }
        if(action==='disc'){
          if(time===.31){assert.equal(m.disc.held,true);assert.ok(m.disc.sourceError<.0001);assert.equal(m.health,110);}
          if(time===.33)assert.equal(m.disc.held,false);
          if(time===.75){assert.equal(m.health,79);assert.ok(m.disc.targetError<.0001);}
        }
        report.push({viewport:label,action,...m});
        await page.screenshot({path:path.join(artifacts,`${label}-${action}-${time}.png`)});
        if(action==='beam'&&time===.34){
          await act('b.visualEffects.forEach(e=>e.group.visible=false);b.renderer.render(b.renderScene,b.camera);');await page.screenshot({path:path.join(artifacts,`${label}-beam-pose.png`)});
          if(label==='desktop'){
            await act('b.__review={background:b.renderScene.background,fog:b.renderScene.fog,objects:b.renderScene.children.map(o=>[o,o.visible])};b.renderScene.children.forEach(o=>{if(o!==b.camera&&!o.isLight)o.visible=false;});b.renderScene.background=new T.Color(0x242b35);b.renderScene.fog=null;');
            for(const [view,direction]of [['front',[0,0,-1]],['side',[1,0,0]]]){
              await act(`const bounds=new T.Box3().setFromObject(b.hands,true),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
                const halfHeight=.58*Math.max(size.y,${view==='front'?'size.x':'size.z'}/b.camera.aspect),halfWidth=halfHeight*b.camera.aspect;
                const camera=new T.OrthographicCamera(-halfWidth,halfWidth,halfHeight,-halfHeight,.01,30),orientation=b.camera.getWorldQuaternion(new T.Quaternion());
                const horizontal=new T.Vector3(...${JSON.stringify(direction)}).applyQuaternion(orientation).setY(0).normalize();
                camera.position.copy(center).addScaledVector(horizontal,6);camera.up.set(0,1,0);camera.lookAt(center);b.renderer.render(b.renderScene,camera);`);
              await page.screenshot({path:path.join(artifacts,`beam-${view}.png`)});
            }
            await act('b.renderScene.background=b.__review.background;b.renderScene.fog=b.__review.fog;for(const[o,visible]of b.__review.objects)o.visible=visible;delete b.__review;');
          }
          await act('b.visualEffects.forEach(e=>e.group.visible=true);');
        }
        previous=time;
      }
      if(action==='shield')await page.keyboard.up('l');
      console.log(`PASS ${label} ${action}: continuous joints, fixed arm lengths, pose framing and contact timing`);
    }
    // A camera player can cast while guarding or immediately after a punch hits.
    // Exercise those real combat entry points and sample the skinned crossing.
    for(const previous of ['shield','left','right']){
      const transition=await act(`
        b.start();b.nextAttack=100;
        if('${previous}'==='shield')b.setDefense(true);else b.punch('${previous}');
        for(let i=0;i<26;i++)b.advance(1/120);
        const accepted=b.cast('beam');let gap=1,age=0;
        for(let i=0;i<48;i++){
          b.advance(1/120);
          if(i%2===0){const cross=b.__inspectCross(false);if(cross.gaps.length&&Math.min(...cross.gaps)<gap){gap=Math.min(...cross.gaps);age=(i+1)/120;}}
        }
        return{accepted,gap,age,held:b.__inspectCross()};`);
      assert.equal(transition.accepted,true);
      assert.ok(transition.gap>=0,`${label} ${previous} to beam: ${JSON.stringify(transition)}`);
      assert.ok(transition.held.left>.2&&transition.held.left<.8&&transition.held.gaps.every(g=>g>0));
    }
    for(const lean of [-1,1]){
      const pose=await act(`b.start();b.nextAttack=100;b.setDefense(false,${lean});b.cast('beam');
        for(let i=0;i<70;i++)b.advance(1/120);return b.__inspectCross();`);
      assert.ok(pose.rightForearm[1]>.9999&&pose.leftPalm[1]<-.999,'world vertical and palm-down must survive a tilted player camera');
      assert.ok(Math.abs(pose.angle-90)<2&&pose.left>.2&&pose.left<.8&&pose.gaps.length>=3&&pose.gaps.every(g=>g>0),'leaning must preserve the cross and the depth order: '+JSON.stringify(pose));
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(artifacts,'geometry-report.json'),JSON.stringify(report,null,2));
}finally{await browser.close();}
