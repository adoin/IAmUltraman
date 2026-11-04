import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BattleEngine, SKILLS} from './combat.js';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const glow=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});

export class BattleScene extends BattleEngine {
  constructor(canvas,onEvent){
    super(onEvent);this.canvas=canvas;this.clientEvent=onEvent;this.onEvent=e=>{this.visualEvent(e);this.clientEvent(e);};
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderScene=new THREE.Scene();this.renderScene.background=new THREE.Color(0x345572);this.renderScene.fog=new THREE.FogExp2(0x526b80,.008);
    this.camera=new THREE.PerspectiveCamera(57,1,.08,700);this.camera.position.set(0,9,20);this.camera.lookAt(0,6,-25);this.renderScene.add(this.camera);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.models=new Map();this.currentMonster=null;this.visualEffects=[];this.hitFlash=0;this.hurt=0;this.defenseFlash=0;this.renderLean=0;this.guardAmount=0;this.modelError=null;this.assetReady=false;this.lastNow=performance.now();this.frameCount=0;
    this.makeWorld();this.makeForeground();this.ready=this.loadAssets().catch(error=>{this.modelError=String(error);this.clientEvent({type:'load-error',error:this.modelError});throw error;});this.ready.catch(()=>{});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.paused=true;this.clientEvent({type:'graphics-lost'});});
    this.renderer.setAnimationLoop(now=>this.frame(now));
  }
  mesh(geometry,material,position,parent=this.renderScene){const o=new THREE.Mesh(geometry,material);if(position)o.position.copy(position);parent.add(o);return o;}
  makeWorld(){
    const world=this.renderScene;world.add(new THREE.HemisphereLight(0xd5e2ee,0x40363b,1.5));
    const sun=new THREE.DirectionalLight(0xffe0bd,2.0);sun.position.set(-35,55,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:160});sun.shadow.bias=-.0006;world.add(sun);world.add(sun.target);
    const rim=new THREE.DirectionalLight(0xb0cddd,1.0);rim.position.set(30,25,-40);world.add(rim);
    const concrete=new THREE.MeshStandardMaterial({color:0x3b4a58,roughness:.95});
    const ground=this.mesh(new THREE.PlaneGeometry(700,700),concrete,V(0,-.15,-70));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
    const plaza=this.mesh(new THREE.PlaneGeometry(24,160),new THREE.MeshStandardMaterial({color:0x293849,roughness:.9}),V(0,-.1,-32));plaza.rotation.x=-Math.PI/2;plaza.receiveShadow=true;
    const laneMat=new THREE.MeshBasicMaterial({color:0xebcda0,transparent:true,opacity:.4});for(let z=20;z>-135;z-=10)for(const x of [-8,8]){const m=this.mesh(new THREE.PlaneGeometry(.15,4),laneMat,V(x,-.07,z));m.rotation.x=-Math.PI/2;}
    const buildings=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x617385,roughness:.82,metalness:.1}),156);buildings.castShadow=true;buildings.receiveShadow=true;const matrix=new THREE.Matrix4();let index=0;const windows=[];let seed=192;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let side of [-1,1])for(let col=0;col<6;col++)for(let row=0;row<13;row++){
      const h=2+rand()*7+(col>3?rand()*6:0),x=side*(16+col*11+rand()*3),z=27-row*13+rand()*3,sx=5+rand()*4,sz=5+rand()*4;
      matrix.compose(V(x,h/2,z),new THREE.Quaternion(),V(sx,h,sz));buildings.setMatrixAt(index,matrix);buildings.setColorAt(index,new THREE.Color().setHSL(.56+rand()*.04,.12,.24+rand()*.18));index++;
      if(row<9)for(let floor=1;floor<h;floor+=1.3)for(let wx=-sx/2+.7;wx<sx/2;wx+=1.25)windows.push([x+wx,floor,z+sz/2+.015,rand()]);
    }buildings.instanceMatrix.needsUpdate=true;world.add(buildings);
    const windowMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(.35,.5),new THREE.MeshBasicMaterial({color:0xffd8a2}),windows.length);windows.forEach(([x,y,z,r],i)=>{matrix.makeTranslation(x,y,z);windowMesh.setMatrixAt(i,matrix);windowMesh.setColorAt(i,new THREE.Color(r>.3?0xffcb8b:0x617c92));});world.add(windowMesh);
    const water=this.mesh(new THREE.PlaneGeometry(700,160),new THREE.MeshStandardMaterial({color:0x346a84,metalness:.45,roughness:.36}),V(0,-.02,-190));water.rotation.x=-Math.PI/2;
    for(let i=0;i<16;i++){const rock=this.mesh(new THREE.ConeGeometry(22+rand()*22,25+rand()*38,5),new THREE.MeshStandardMaterial({color:i%2?0x56687f:0x65758c,roughness:1}),V(-280+i*40,10,-275-rand()*30));rock.rotation.y=rand()*6;}
    this.mesh(new THREE.SphereGeometry(12,32,16),new THREE.MeshBasicMaterial({color:0xffd6a0,fog:false,toneMapped:false}),V(-80,52,-240));
    this.mesh(new THREE.SphereGeometry(450,32,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x183d63)},bottom:{value:new THREE.Color(0xe1ab99)}},vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 p; void main(){float h=clamp(normalize(p).y*.95+.12,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.55)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));
    const beaconMat=new THREE.MeshBasicMaterial({color:0x7fffe5});for(let z=5;z>-100;z-=14)for(let side of [-1,1])this.mesh(new THREE.BoxGeometry(.12,.45,.12),beaconMat,V(side*11,.23,z));
    this.targetRing=this.mesh(new THREE.RingGeometry(6.9,7.05,72),glow(0x77d3ed,.45),V(0,.05,-15));this.targetRing.rotation.x=-Math.PI/2;this.targetRing.visible=false;
    this.warningRing=this.mesh(new THREE.RingGeometry(7.3,7.65,72),glow(0xffa266,.5),V(0,.07,-15));this.warningRing.rotation.x=-Math.PI/2;this.warningRing.visible=false;
    this.safeZone=this.mesh(new THREE.PlaneGeometry(7,20),glow(0x58edc7,.12),V(5,.1,2));this.safeZone.rotation.x=-Math.PI/2;this.safeZone.visible=false;
    const creatureFill=new THREE.PointLight(0xfff2e6,180,24,2);creatureFill.position.set(0,13,-7);world.add(creatureFill);
    this.monsterLight=new THREE.PointLight(0x4fffd9,0,20,1.7);this.monsterLight.position.set(0,9,-12);world.add(this.monsterLight);
  }
  makeForeground(){
    this.hands=new THREE.Group();this.camera.add(this.hands);this.handMeshes=[];
    this.shield=this.mesh(new THREE.SphereGeometry(3,24,16),new THREE.MeshBasicMaterial({color:0x6cffe5,transparent:true,opacity:0,wireframe:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),V(0,-.45,-3.1),this.camera);this.shield.scale.set(1,.8,.23);
    this.shieldGlow=this.mesh(new THREE.RingGeometry(1.4,1.47,64),glow(0x88ffe9,0),V(0,-.23,-2.5),this.camera);
    const reticle=new THREE.Group();this.camera.add(reticle);reticle.visible=false;const m=glow(0x9ef9ef,.65);for(const axis of [0,1])this.mesh(new THREE.PlaneGeometry(axis?.003:.03,axis?.03:.003),m,V(0,0,-2),reticle);reticle.position.y=-.06;
    this.impactVeil=this.mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({color:0xff785b,transparent:true,opacity:0,depthTest:false,depthWrite:false}),V(0,0,-.2),this.camera);this.impactVeil.renderOrder=100;
  }
  async loadAssets(){const loader=new GLTFLoader();const revision=new URL(import.meta.url).searchParams.get('v')||'local';await Promise.all(['basalt','leviathan','nova','hero-hands'].map(async name=>{const gltf=await loader.loadAsync(new URL(`../public/models/kaiju/${name}.glb?v=${revision}`,import.meta.url).href);const model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=name!=='hero-hands';o.receiveShadow=true;if(o.material)o.material.side=THREE.DoubleSide;}});this.models.set(name,model);}));
    const handRoot=this.models.get('hero-hands');this.hands.add(handRoot);for(const tag of ['L','R']){const arm=handRoot.getObjectByName('HeroArm'+tag);this.handMeshes.push(arm);}this.assetReady=true;this.selectMonster();this.clientEvent({type:'assets-ready'});
  }
  selectMonster(){if(!this.assetReady)return;if(this.currentMonster)this.renderScene.remove(this.currentMonster);this.currentMonster=this.models.get(this.waveInfo.model);this.currentMonster.position.set(0,0,-15);this.currentMonster.scale.setScalar(this.wave===5?1.8:1.5);this.renderScene.add(this.currentMonster);this.currentMonster.visible=true;this.pivots={};for(const name of ['Body','Head','Jaw','ArmL','ArmR','ForearmL','ForearmR','Tail','WingL','WingR']){const pivot=this.currentMonster.getObjectByName(name);if(pivot){pivot.rotation.set(0,0,0);this.pivots[name]=pivot;}}
    this.monsterLight.color.setHex(this.waveInfo.color);this.targetRing.material.color.setHex(this.waveInfo.color);this.clearTransient();
  }
  clearTransient(){for(const e of this.visualEffects)this.disposeObject(e.group);this.visualEffects=[];}
  disposeObject(o){this.renderScene.remove(o);o.traverse(n=>{if(n.isMesh||n.isPoints||n.isSprite){if(!n.isSprite)n.geometry?.dispose();if(Array.isArray(n.material))n.material.forEach(m=>m.dispose());else n.material?.dispose();}});}
  visualEvent(e){if(!this.renderScene)return;if(e.type==='wave')this.selectMonster();if(e.type==='cast')this.playerEffect(e.skill);if(e.type==='hit'){this.hitFlash=.3;this.impactEffect(e.source);this.sparkBurst(V(0,8.7,-12),this.waveInfo.color,34);}if(e.type==='defeat'){this.sparkBurst(V(0,9,-15),0xffd99c,100);this.hurt=0;}if(e.type==='defense'){if(e.outcome==='hit')this.hurt=.5;else if(e.outcome==='block'){this.defenseFlash=.8;this.sparkBurst(V(this.camera.position.x,8,14),0x89ffe6,45);}else if(e.outcome==='dodge')this.sparkBurst(V(this.camera.position.x+5,8,12),0xc1f9ff,20);}if(e.type==='enemy-cast')this.enemyEffect(e.attack);if(e.type==='interrupt')this.sparkBurst(V(0,10,-12),0xc4fffc,30);}
  flare(position,color,size,parent,opacity=1){
    if(!this.flareTexture){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const context=canvas.getContext('2d'),gradient=context.createRadialGradient(64,64,0,64,64,64);
      gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(255,255,255,.95)');gradient.addColorStop(.35,'rgba(255,255,255,.45)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);
      this.flareTexture=new THREE.CanvasTexture(canvas);
    }
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flareTexture,color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false}));
    sprite.position.copy(position);sprite.scale.set(size,size,1);parent.add(sprite);return sprite;
  }
  playerEffect(kind){
    const group=new THREE.Group();this.renderScene.add(group);this.camera.updateMatrixWorld(true);
    const start=this.camera.localToWorld(V((kind==='beam'?.28:.85)*(this.camera.aspect<1?.45:1),kind==='beam'?-.5:-.68,kind==='beam'?-2.05:-2.2)),end=V(0,8.7,-11.6);
    const entry={kind,group,age:0,duration:kind==='beam'?1.45:SKILLS.disc.duration,start,end};
    if(kind==='beam'){
      entry.length=start.distanceTo(end);entry.direction=end.clone().sub(start).normalize();
      const tube=new THREE.Group();group.add(tube);entry.tube=tube;tube.quaternion.setFromUnitVectors(V(0,1,0),entry.direction);
      for(const [radius,color,alpha]of [[.12,0xffffff,1],[.28,0x8dffff,.7],[.55,0x28bbff,.2],[.9,0x258cff,.055]])this.mesh(new THREE.CylinderGeometry(radius,radius,entry.length,20,1,true),glow(color,alpha),null,tube);
      for(let i=0;i<9;i++){const ring=this.mesh(new THREE.TorusGeometry(.38,.025,6,48),glow(0x9cffff,.7),V(0,-entry.length/2+i*entry.length/9,0),tube);ring.rotation.x=Math.PI/2;}
      entry.launch=this.flare(start,0x60e8ff,1.7,group,.6);this.flare(start,0xffffff,.5,group,.9);
      entry.contact=this.flare(end,0x55d5ff,6,group,0);
      const light=new THREE.PointLight(0x6aeaff,90,18,1.5);light.position.copy(start);group.add(light);entry.light=light;
    }else{
      const disc=new THREE.Group();group.add(disc);entry.disc=disc;
      const gold=glow(0xffbf45);gold.blending=THREE.NormalBlending;gold.opacity=.96;this.mesh(new THREE.TorusGeometry(1.25,.14,10,64),gold,null,disc);
      this.mesh(new THREE.TorusGeometry(.98,.065,8,64),glow(0xfffce6),null,disc);
      this.mesh(new THREE.RingGeometry(.36,1.12,64),glow(0xffb743,.19),null,disc);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;const tooth=this.mesh(new THREE.ConeGeometry(.19,.56,3),glow(0xffe4a3),V(Math.cos(a)*1.3,Math.sin(a)*1.3,0),disc);tooth.rotation.z=a-Math.PI/2;}
      entry.halo=this.flare(V(),0xffb746,5.8,disc,.32);
      entry.trail=[];for(let i=0;i<6;i++)entry.trail.push(this.flare(start,0xffca69,2.2-i*.22,group,.3-i*.035));
      const light=new THREE.PointLight(0xffcc70,55,14,1.5);disc.add(light);
    }
    this.visualEffects.push(entry);
  }
  impactEffect(source){
    const special=source==='beam'||source==='disc',color=source==='disc'?0xffcb6a:source==='beam'?0x75eaff:0xffe8b1;
    const group=new THREE.Group();group.position.set(0,8.7,-10.7);this.renderScene.add(group);
    const size=special?7:2.6;this.flare(V(),color,size,group,.9);this.flare(V(),0xffffff,size*.36,group,1);
    const rings=[];for(let i=0;i<(special?3:1);i++)rings.push(this.mesh(new THREE.TorusGeometry(1+i*.3,.06,6,64),glow(color,.9-i*.15),V(),group));
    const light=new THREE.PointLight(color,special?170:45,25,1.4);group.add(light);
    this.visualEffects.push({kind:'impact',group,rings,light,age:0,duration:special?.75:.32});
  }
  enemyEffect(attack){const group=new THREE.Group();this.renderScene.add(group);const kind=attack.kind;const entry={kind:'enemy-'+kind,group,age:0,duration:attack.flight,start:V(0,10,-12),end:V(attack.originLean*4.5,8,20),safeSide:attack.safeSide};
    if(kind==='bolt')for(let i=0;i<3;i++)this.mesh(new THREE.IcosahedronGeometry(.7-i*.15,2),glow(i?0xffda91:0xff885a,.7),V(),group);
    if(kind==='slam'){const m=this.mesh(new THREE.TorusGeometry(1,.12,8,96),glow(this.waveInfo.color),null,group);m.rotation.x=Math.PI/2;group.position.set(0,.2,-15);}
    if(kind==='sweep'){const mesh=this.mesh(new THREE.CylinderGeometry(.22,.22,38,16),glow(0xff9b76),V(0,0,0),group);mesh.rotation.x=Math.PI/2;group.position.set(-attack.safeSide*6,7,1);}
    if(kind==='charge'){this.mesh(new THREE.TorusGeometry(3,.16,8,64),glow(0xffb780),null,group);group.position.set(0,5,-15);}this.visualEffects.push(entry);
  }
  sparkBurst(position,color,count){const points=new Float32Array(count*3),velocity=[];for(let i=0;i<count;i++){points.set([position.x,position.y,position.z],i*3);velocity.push(V((Math.random()-.5)*13,(Math.random()-.2)*12,(Math.random()-.5)*13));}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(points,3));const material=new THREE.PointsMaterial({color,size:.14,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});const group=new THREE.Group();group.add(new THREE.Points(geo,material));this.renderScene.add(group);this.visualEffects.push({kind:'sparks',group,age:0,duration:1.2,velocity});}
  resize(){const {width,height}=this.canvas.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.fov=width<600?66:57;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);}
  setQuality(quality){this.renderer.setPixelRatio(quality==='low'?1:Math.min(devicePixelRatio||1,1.65));this.renderer.shadowMap.enabled=quality!=='low';this.resize();}
  animateMonster(dt){const m=this.currentMonster;if(!m)return;const t=this.time,p=this.pivots,a=this.attack,idle=this.reduced?0:Math.sin(t*1.6)*.08,winding=a?.phase==='windup'?clamp(a.age/a.windup,0,1):0,attack=a?.phase==='flight';
    m.rotation.y=this.defeated?.18*Math.sin(t):Math.sin(t*.5)*.04;m.position.y=this.defeated?-Math.pow(1-clamp(this.respawn/3,0,1),2)*21:0;m.position.z=mix(m.position.z,-15+(attack&&a.kind==='charge'?Math.sin(a.age/a.flight*Math.PI/2)*24:0),1-Math.exp(-dt*8));m.position.x=attack&&a.kind==='sweep'?Math.sin(a.age/a.flight*Math.PI)*-a.safeSide*3:0;
    if(p.Body){p.Body.rotation.x=(this.waveInfo.model==='leviathan'?.14:.06)+idle+(a?.kind==='slam'?winding*.22:0);p.Body.position.y=4.9+(this.reduced?0:Math.sin(t*1.6)*.07);}if(p.Head){p.Head.rotation.x=-winding*.22;p.Head.rotation.y=Math.sin(t*.7)*.07;}if(p.Jaw)p.Jaw.rotation.x=winding*.45+(attack?.25:0);
    if(p.ArmL){p.ArmL.rotation.x=a?.kind==='slam'?-winding*2.3:idle-.1-winding*.6;p.ArmL.rotation.z=-.12-(a?.kind==='sweep'&&a.safeSide>0?winding*.8:0);}if(p.ArmR){p.ArmR.rotation.x=a?.kind==='slam'?-winding*2.3:-idle-.1-winding*.6;p.ArmR.rotation.z=.12+(a?.kind==='sweep'?winding*.8:0);}if(p.ForearmL)p.ForearmL.rotation.x=-.32+idle+winding*.12;if(p.ForearmR)p.ForearmR.rotation.x=-.42-idle+winding*.12;if(p.Tail)p.Tail.rotation.y=Math.sin(t*1.3)*.16;if(p.WingL)p.WingL.rotation.y=Math.sin(t*1.4)*.16;if(p.WingR)p.WingR.rotation.y=-Math.sin(t*1.4)*.16;
    this.warningRing.visible=false;this.warningRing.material.opacity=.35+Math.sin(t*10)*.2;this.warningRing.scale.setScalar(1+winding*.15);this.safeZone.visible=false;if(a)this.safeZone.position.x=a.safeSide*6;this.monsterLight.intensity=winding*12+this.hitFlash*20;
  }
  animateHands(dt){const factor=1-Math.exp(-dt*10);this.renderLean=mix(this.renderLean,this.lean,factor);const guard=this.guard&&this.guardEnergy>0?1:0;if(guard&&!this.guardWasActive)this.shieldIgnition=.55;this.guardWasActive=guard;this.shieldIgnition=Math.max(0,(this.shieldIgnition||0)-dt);this.guardAmount=mix(this.guardAmount,guard,factor);const latest=this.effects.find(e=>e.kind==='beam'),disc=this.effects.find(e=>e.kind==='disc'),punch=this.effects.find(e=>e.kind==='punch');this.hands.visible=!!(latest||disc||punch||this.guardAmount>.02);
    this.camera.position.x=this.renderLean*4.5;this.camera.position.y=9+(this.reduced?0:Math.sin(this.time*1.4)*.025);this.camera.rotation.z=this.reduced?0:-this.renderLean*.035;this.camera.rotation.y=-this.renderLean*.025;
    this.handMeshes.forEach((arm,i)=>{const side=i===0?-1:1,g=this.guardAmount;let x=side*.79,y=-1.05,z=-1.65,rx=-.48,rz=-side*.24;if(latest){const strength=Math.sin(Math.min(1,latest.age/.18)*Math.PI/2);x=mix(x,i===0?-.28:.16,strength);y=mix(y,i===0?-.96:-.75,strength);z=mix(z,-1.9,strength);rz=mix(rz,i===0?-1.42:.06,strength);rx=0;}if(punch&&((punch.side==='left'&&i===0)||(punch.side==='right'&&i===1))){const thrust=Math.sin(punch.age/punch.duration*Math.PI);x=mix(x,side*.13,thrust);y=mix(y,-.05,thrust);z=mix(z,-3.1,thrust);rx=mix(rx,-1.15,thrust);rz=mix(rz,0,thrust);}for(let finger=0;finger<4;finger++){const node=arm.getObjectByName('Finger'+(i===0?'L':'R')+finger);if(node)node.rotation.x=punch?2.6:0;}if(disc&&i===1){const p=disc.age/disc.duration;x+=Math.sin(p*Math.PI)*.65;y+=Math.sin(p*Math.PI)*.45;rx-=Math.sin(p*Math.PI)*1.1;}arm.position.set(mix(x,side*.54,g),mix(y,-.24,g)+(this.reduced?0:Math.sin(this.time*1.6+i)*.014),mix(z,-1.4,g));arm.rotation.set(mix(rx,0,g),0,mix(rz,-side*.18,g));arm.scale.setScalar(latest?.46:.6);});
    this.shield.material.opacity=this.guardAmount*.07+this.defenseFlash*.09+this.shieldIgnition*.09;this.shieldGlow.material.opacity=this.guardAmount*.28+this.defenseFlash*.35+this.shieldIgnition*.65;this.shieldGlow.rotation.z=this.time*.1;this.hurt=Math.max(0,this.hurt-dt);this.defenseFlash=Math.max(0,this.defenseFlash-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);this.impactVeil.material.opacity=this.hurt*.13;
  }
  animateEffects(dt){for(const e of this.visualEffects){e.age+=dt;const t=clamp(e.age/e.duration,0,1);if(e.kind==='disc'){
        const flight=clamp(e.age/SKILLS.disc.impact,0,1);e.disc.position.lerpVectors(e.start,e.end,flight);e.disc.position.y+=Math.sin(flight*Math.PI)*1.2;e.disc.rotation.z=e.age*16;e.disc.rotation.x=.18;
        const fade=e.age<SKILLS.disc.impact?1:clamp(1-(e.age-SKILLS.disc.impact)/.35,0,1);e.disc.scale.setScalar(.95+flight*.35);e.disc.visible=fade>0;
        for(const [i,trail]of e.trail.entries()){const progress=clamp((e.age-i*.035)/SKILLS.disc.impact,0,1);trail.position.lerpVectors(e.start,e.end,progress);trail.position.y+=Math.sin(progress*Math.PI)*1.2;trail.material.opacity=(.26-i*.03)*fade;}
      }
      if(e.kind==='beam'){
        const reveal=clamp(e.age/.25,0,1),fade=clamp((e.duration-e.age)/.32,0,1),width=(.92+(this.reduced?0:Math.sin(e.age*22)*.055))*fade;
        e.tube.scale.set(width,Math.max(.001,reveal),width);e.tube.position.copy(e.start).addScaledVector(e.direction,e.length*reveal/2);
        e.launch.material.opacity=.6*fade;e.launch.scale.setScalar(1.7*(.9+Math.sin(e.age*12)*.05));e.contact.material.opacity=e.age>.25?.65*fade:0;e.light.intensity=90*fade;
      }
      if(e.kind==='impact'){for(const [i,ring]of e.rings.entries()){ring.scale.setScalar(1+t*(3+i));ring.material.opacity=(1-t)*.85;}e.group.children.filter(o=>o.isSprite).forEach(o=>{o.material.opacity=1-t;});e.light.intensity*=Math.max(0,1-dt*8);}if(e.kind==='enemy-bolt'){e.group.position.lerpVectors(e.start,e.end,t);e.group.rotation.z=e.age*5;e.group.scale.setScalar(1+t*1.2);}if(e.kind==='enemy-slam'){e.group.scale.setScalar(1+t*35);e.group.children[0].material.opacity=1-t*.7;}if(e.kind==='enemy-sweep')e.group.rotation.z=Math.sin(t*Math.PI)*.25;if(e.kind==='enemy-charge'){e.group.position.z=mix(-15,20,t);e.group.scale.setScalar(1+t*.5);}if(e.kind==='sparks'){const points=e.group.children[0],array=points.geometry.attributes.position.array;e.velocity.forEach((v,i)=>{array[i*3]+=v.x*dt;array[i*3+1]+=v.y*dt;array[i*3+2]+=v.z*dt;v.y-=5*dt;});points.geometry.attributes.position.needsUpdate=true;points.material.opacity=1-t;}}
    this.visualEffects=this.visualEffects.filter(e=>{if(e.age<e.duration)return true;this.disposeObject(e.group);return false;});
  }
  frame(now){const dt=Math.min((now-this.lastNow)/1000,.05);this.lastNow=now;if(!this.paused&&!this.finished){this.update(dt);this.animateEffects(dt);this.animateMonster(dt);this.animateHands(dt);}this.renderer.render(this.renderScene,this.camera);this.frameCount++;}
  dispose(){this.renderer.setAnimationLoop(null);this.observer.disconnect();this.clearTransient();this.flareTexture?.dispose();this.renderer.dispose();}
}
