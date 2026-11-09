import {footGround,liftGroundTail} from './model-grounding.js';
import {locomotionFor,approachOpacity} from './locomotion.js';
﻿import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BattleEngine, SKILLS, CELEBRATION, WAVES} from './combat.js';
import {MonsterMotion} from './monster-motion.js';
import {HeroAnimation} from './hero-animation.js';
import {BEAM_TIMING,DISC_TIMING,ZEPELLION_TIMING,discTiming,beamTimingFor} from './action-timing.js';
import {BeamVolume} from './beam-effect.js';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const hitColor=new THREE.Color(0xffe3c8);
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const FLOATERS=new Set(['ganq']);
const glow=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});

export class BattleScene extends BattleEngine {
  constructor(canvas,onEvent){
    super(onEvent);this.canvas=canvas;this.clientEvent=onEvent;this.onEvent=e=>{this.visualEvent(e);this.clientEvent(e);};
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderScene=new THREE.Scene();this.renderScene.background=new THREE.Color(0x345572);this.renderScene.fog=new THREE.FogExp2(0x526b80,.008);
    this.camera=new THREE.PerspectiveCamera(57,1,.08,700);this.camera.position.set(0,9,20);this.camera.lookAt(0,6,-25);this.renderScene.add(this.camera);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.models=new Map();this.monsterAnimations=new Map();this.currentMonster=null;this.visualEffects=[];this.hitFlash=0;this.hurt=0;this.defenseFlash=0;this.renderLean=0;this.guardAmount=0;this.modelError=null;this.assetReady=false;this.zepellionStage=0;this.lastNow=performance.now();this.frameCount=0;this.victoryActor=null;this.victoryMixer=null;this.victoryClip=null;this.celebration=null;this.celebrationAge=0;
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
    let seed=192;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const water=this.mesh(new THREE.PlaneGeometry(700,160),new THREE.MeshStandardMaterial({color:0x346a84,metalness:.45,roughness:.36}),V(0,-.02,-190));water.rotation.x=-Math.PI/2;
    for(let i=0;i<16;i++){const rock=this.mesh(new THREE.ConeGeometry(22+rand()*22,25+rand()*38,5),new THREE.MeshStandardMaterial({color:i%2?0x56687f:0x65758c,roughness:1}),V(-280+i*40,10,-275-rand()*30));rock.rotation.y=rand()*6;}
    this.mesh(new THREE.SphereGeometry(12,32,16),new THREE.MeshBasicMaterial({color:0xffd6a0,fog:false,toneMapped:false}),V(-80,52,-240));
    this.skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x183d63)},bottom:{value:new THREE.Color(0xe1ab99)}},vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 p; void main(){float h=clamp(normalize(p).y*.95+.12,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.55)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    this.mesh(new THREE.SphereGeometry(450,32,24),this.skyMat);
    // Space fades in only for the victory take-off; the city keeps its sunset.
    this.starfield=(()=>{const count=900,positions=new Float32Array(count*3);
      for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,declination=Math.acos(1-Math.random()*.96),radius=380;positions[i*3]=Math.sin(declination)*Math.cos(angle)*radius;positions[i*3+1]=Math.cos(declination)*radius+30;positions[i*3+2]=Math.sin(declination)*Math.sin(angle)*radius;}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const material=new THREE.PointsMaterial({color:0xf4f9ff,size:2.6,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false});
      const points=new THREE.Points(geometry,material);points.visible=false;points.frustumCulled=false;this.renderScene.add(points);return points;})();
    const beaconMat=new THREE.MeshBasicMaterial({color:0x7fffe5});for(let z=5;z>-100;z-=14)for(let side of [-1,1])this.mesh(new THREE.BoxGeometry(.12,.45,.12),beaconMat,V(side*11,.23,z));
    this.targetRing=this.mesh(new THREE.RingGeometry(6.9,7.05,72),glow(0x77d3ed,.45),V(0,.05,-15));this.targetRing.rotation.x=-Math.PI/2;this.targetRing.visible=false;
    this.warningRing=this.mesh(new THREE.RingGeometry(7.3,7.65,72),glow(0xffa266,.5),V(0,.07,-15));this.warningRing.rotation.x=-Math.PI/2;this.warningRing.visible=false;
    this.safeZone=this.mesh(new THREE.PlaneGeometry(7,20),glow(0x58edc7,.12),V(5,.1,2));this.safeZone.rotation.x=-Math.PI/2;this.safeZone.visible=false;
    const creatureFill=new THREE.PointLight(0xfff2e6,300,26,2);creatureFill.position.set(0,13,-7);world.add(creatureFill);
    // Kaiju textures are dark; a soft kicker from the player's side keeps the
    // shaded panels from reading as flat black patches.
    const kaijuKicker=new THREE.PointLight(0xe6f0ff,150,34,2);kaijuKicker.position.set(-6,15,4);world.add(kaijuKicker);
    this.monsterLight=new THREE.PointLight(0x4fffd9,0,20,1.7);this.monsterLight.position.set(0,9,-12);world.add(this.monsterLight);
  }
  async loadCity(loader){
    const names=['building-skyscraper-a','building-skyscraper-b','building-skyscraper-c','building-skyscraper-d','building-skyscraper-e','building-g','building-j','building-m'];
    const models=await Promise.all(names.map(async name=>(await loader.loadAsync(new URL('../public/models/city/'+name+'.glb',import.meta.url).href)).scene));
    const bounds=models.map(model=>new THREE.Box3().setFromObject(model));
    const placements=models.map(()=>[]);
    let index=0;
    for(const side of [-1,1])for(let col=0;col<3;col++)for(let row=0;row<9;row++){
      const type=(index++*5+row)%models.length,size=bounds[type].getSize(V());
      const scale=(col===0?9:12)/Math.max(size.x,size.z);
      placements[type].push(new THREE.Matrix4().compose(V(side*(22+col*20),-bounds[type].min.y*scale,28-row*23),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),side<0?Math.PI:0),V(scale,scale,scale)));
    }
    models.forEach((model,type)=>model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const copies=placements[type],batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,copies.length);
      copies.forEach((matrix,i)=>batch.setMatrixAt(i,matrix.clone().multiply(mesh.matrixWorld)));
      batch.castShadow=true;batch.receiveShadow=true;this.renderScene.add(batch);
    }));
  }
  makeForeground(){
    this.hands=new THREE.Group();this.camera.add(this.hands);this.handMeshes=[];
    this.shield=this.mesh(new THREE.PlaneGeometry(4.4,3.7),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
      uniforms:{energy:{value:0},time:{value:0}},
      vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec2 coord;uniform float energy;uniform float time;
        void main(){
          vec2 p=(coord-.5)*2.0;float radius=length(p);
          vec2 grid=p*9.0,size=vec2(1.7320508,1.0);
          vec2 a=mod(grid,size)-size*.5,b=mod(grid-size*.5,size)-size*.5;
          vec2 cell=abs(dot(a,a)<dot(b,b)?a:b);
          float edge=max(dot(cell,vec2(.8660254,.5)),cell.y);
          float hex=smoothstep(.455,.482,edge);
          float rim=exp(-pow((radius-.94)*60.0,2.0));
          float ripple=exp(-pow((radius-fract(time*.45))*20.0,2.0))*.04;
          float mask=1.0-smoothstep(.93,1.0,radius);
          gl_FragColor=vec4(.32,1.0,.82,(hex*.14*mask+rim*.55+ripple*mask)*energy);
          #include <colorspace_fragment>
        }`,
    }),V(0,-.23,-2.8),this.camera);
    this.shieldGlow=this.mesh(new THREE.RingGeometry(1.4,1.47,64),glow(0x88ffe9,0),V(0,-.23,-2.5),this.camera);
    const reticle=new THREE.Group();this.camera.add(reticle);reticle.visible=false;const m=glow(0x9ef9ef,.65);for(const axis of [0,1])this.mesh(new THREE.PlaneGeometry(axis?.003:.03,axis?.03:.003),m,V(0,0,-2),reticle);reticle.position.y=-.06;
    this.discPreview=new THREE.Group();this.renderScene.add(this.discPreview);this.discPreview.visible=false;
    this.mesh(new THREE.TorusGeometry(.38,.026,8,48),glow(0xffd169),null,this.discPreview);
    this.mesh(new THREE.RingGeometry(.08,.34,48),glow(0xffcc66,.25),null,this.discPreview);
    this.impactVeil=this.mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({color:0xff785b,transparent:true,opacity:0,depthTest:false,depthWrite:false}),V(0,0,-.2),this.camera);this.impactVeil.renderOrder=100;
  }
  async loadAssets(){
    const loader=new GLTFLoader();
    const revision=new URL(import.meta.url).searchParams.get('v')||'local';
    this.loader=loader;this.revision=revision;
    await this.loadCity(loader);
    // Only the opening monster and the hero's arms are needed to enter the arena.
    await Promise.all([this.loadMonster(loader,revision,WAVES[0].model),this.loadMonster(loader,revision,'hero-hands')]);
    const handRoot=this.models.get('hero-hands');
    this.hands.add(handRoot);
    for(const tag of ['L','R']){const arm=handRoot.getObjectByName('HeroArm'+tag);this.handMeshes.push(arm);}
    this.hero=new HeroAnimation(this.handMeshes,this.camera);
    this.warmViewmodel();
    this.victoryReady=this.loadVictoryModel(loader,revision).catch(()=>{});
    this.assetReady=true;
    this.selectMonster();
    // Every later wave streams in while the child is still fighting wave one.
    this.prefetch=this.primeMonsters(loader,revision);
    this.clientEvent({type:'assets-ready'});
  }
  primeMonsters(loader,revision){
    const queue=[...new Set(WAVES.map(wave=>wave.model))].filter(name=>!this.models.has(name));
    return queue.reduce((chain,name)=>chain.then(()=>this.loadMonster(loader,revision,name)).catch(()=>{}),Promise.resolve())
      .then(()=>this.clientEvent({type:'monsters-ready'}));
  }
  /** Loads one kaiju on first use, sharing the request when two waves ask for it. */
  loadMonster(loader,revision,name){
    if(this.models.has(name))return Promise.resolve(this.models.get(name));
    this.monsterLoads??=new Map();
    if(this.monsterLoads.has(name))return this.monsterLoads.get(name);
    const task=(async()=>{
      const gltf=await loader.loadAsync(new URL(`../public/models/kaiju/${name}.glb?v=${revision}`,import.meta.url).href);
      const model=gltf.scene;
      model.traverse(o=>{if(o.isMesh){o.castShadow=name!=='hero-hands';o.receiveShadow=name!=='hero-hands';if(name==='hero-hands')o.frustumCulled=false;if(o.material)o.material.side=name==='hero-hands'?THREE.FrontSide:THREE.DoubleSide;}});
      if(name!=='hero-hands'){
        model.traverse(o=>{if(o.isMesh&&o.material.emissive&&!o.material.userData.hitBase){o.material.userData.hitBase=o.material.emissive.clone();}});
        this.monsterAnimations.set(name,gltf.animations);
        const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(V());
        const torso=model.getObjectByName('upperbody1')||model.getObjectByName('Bip001_Pelvis_05')||model.getObjectByName('KOSHI')||model.getObjectByName('下半身')||model.getObjectByName('センター');
        const anchor=torso?torso.getWorldPosition(V()):bounds.getCenter(V());
        const floor=footGround(model)??bounds.min.y;const factor=16/Math.max(.001,bounds.max.y-floor),wrapper=new THREE.Group();wrapper.add(model);model.scale.multiplyScalar(factor);model.position.add(V(-anchor.x,-floor,-anchor.z).multiplyScalar(factor));
        wrapper.updateMatrixWorld(true);wrapper.userData.grounding={floor,tailLift:liftGroundTail(wrapper)};
      wrapper.userData.restPose=[];
        model.traverse(node=>wrapper.userData.restPose.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}));
        this.models.set(name,wrapper);
      }else this.models.set(name,model);
      return this.models.get(name);
    })();
    this.monsterLoads.set(name,task);
    task.catch(()=>this.monsterLoads.delete(name));
    return task;
  }
  warmViewmodel(){
    const target=new THREE.WebGLRenderTarget(64,64),previous=this.renderer.getRenderTarget();
    this.hero.update({guard:1,dt:1});
    this.hands.visible=true;
    try{this.renderer.setRenderTarget(target);this.renderer.render(this.renderScene,this.camera);this.viewmodelReady=true;}
    finally{this.renderer.setRenderTarget(previous);this.hands.visible=false;this.hero.reset();target.dispose();}
  }
  async loadVictoryModel(loader,revision){
    // The downloaded community model keeps its baked take-off pose; it has no
    // armature, so the celebration only moves the whole figure.
    const gltf=await loader.loadAsync(new URL(`../public/motion-preview/tiga-flight.glb?v=${revision}`,import.meta.url).href);
    const root=gltf.scene;
    root.traverse(node=>{if(node.isMesh){node.frustumCulled=false;node.castShadow=true;node.receiveShadow=true;}});
    const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(V()),center=bounds.getCenter(V());
    const scale=15/Math.max(.001,size.y);
    root.scale.multiplyScalar(scale);
    root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    const holder=new THREE.Group();holder.add(root);holder.visible=false;this.renderScene.add(holder);
    this.victoryActor=holder;this.victoryRoot=root;
    this.victoryClip=gltf.animations.find(clip=>clip.name==='Idle_Torch_Loop')||gltf.animations[0]||null;
  }
  /**
   * Tiga holds one arm out, gathers light, then climbs out of the atmosphere
   * the way Ultraman leaves Earth. Stars and a dark sky arrive with the climb,
   * so the celebration reads as leaving the city behind rather than dancing.
   */
  startCelebration(){
    this.celebrationAge=0;
    this.celebration={
      from:this.camera.position.clone(),sparks:0,
      skyTop:this.skyMat?this.skyMat.uniforms.top.value.clone():null,
      skyBottom:this.skyMat?this.skyMat.uniforms.bottom.value.clone():null,
    };
    this.clearEnemyEffects();this.sparkBurst(V(0,10,-4),0xffd99c,110);
    if(this.victoryActor){
      this.victoryActor.visible=true;this.victoryActor.position.set(0,0,10);this.victoryActor.rotation.set(0,0,0);
      if(this.victoryClip){
        this.victoryMixer?.stopAllAction();
        this.victoryMixer=new THREE.AnimationMixer(this.victoryActor);
        this.victoryMixer.clipAction(this.victoryClip).setLoop(THREE.LoopRepeat,Infinity).play();
      }
    }
    if(!this.celebrationLight){this.celebrationLight=new THREE.PointLight(0xfff0c8,90,70,1.6);this.renderScene.add(this.celebrationLight);}
    this.celebrationLight.position.set(0,7,10);
    if(this.starfield){this.starfield.visible=true;this.starfield.material.opacity=0;}
  }
  animateCelebration(dt){
    if(!this.celebration)return;
    const age=this.celebrationAge+=dt;
    const ease=p=>{p=clamp(p,0,1);return p*p*(3-2*p);};
    const gather=ease(age/1.4);
    const lift=Math.max(0,age-1.4);
    const climb=lift*lift*3.2;
    const recline=ease(lift/2.2)*.45;
    this.camera.position.set(
      Math.sin(age*.4)*1.4,
      mix(this.celebration.from.y,10.6,gather)+Math.min(climb*.14,8),
      mix(this.celebration.from.z,33,gather)+Math.min(climb*.05,5)
    );
    this.camera.lookAt(0,10+Math.min(climb*.35,30),10);
    this.victoryMixer?.update(dt);
    if(this.victoryActor){
      this.victoryActor.position.y=climb;
      this.victoryActor.rotation.x=-recline;
      this.victoryActor.rotation.y=ease((lift-1)/2.6)*Math.PI*.6;
    }
    if(this.celebrationLight){
      this.celebrationLight.intensity=(60+Math.sin(age*4)*18)*(1-clamp(climb/80,0,1));
      this.celebrationLight.position.set(0,7+climb,10);
    }
    // Space arrives as he clears the rooftops.
    const space=ease((climb-3)/28);
    if(this.skyMat&&this.celebration.skyTop){
      this.skyMat.uniforms.top.value.copy(this.celebration.skyTop).lerp(new THREE.Color(0x040a18),space);
      this.skyMat.uniforms.bottom.value.copy(this.celebration.skyBottom).lerp(new THREE.Color(0x0a1a33),space);
    }
    if(this.starfield)this.starfield.material.opacity=space;
    this.celebration.sparks+=dt;
    if(this.celebration.sparks>.16){
      this.celebration.sparks=0;
      const colors=[0xffd070,0x8ff0ff,0xfff4d0,0x9dffd8];
      this.sparkBurst(V((Math.random()-.5)*3,climb+Math.random()*3,10+(Math.random()-.5)*3),colors[Math.floor(Math.random()*colors.length)],14);
    }
    if(age>=CELEBRATION.duration)this.stopCelebration();
  }
  stopCelebration(){
    this.celebrationAge=0;
    if(this.victoryMixer)this.victoryMixer.stopAllAction();
    if(this.victoryActor){this.victoryActor.visible=false;this.victoryActor.position.set(0,0,10);this.victoryActor.rotation.set(0,0,0);}
    if(this.celebrationLight){this.renderScene.remove(this.celebrationLight);this.celebrationLight=null;}
    if(this.celebration&&this.skyMat&&this.celebration.skyTop){
      this.skyMat.uniforms.top.value.copy(this.celebration.skyTop);
      this.skyMat.uniforms.bottom.value.copy(this.celebration.skyBottom);
    }
    if(this.starfield){this.starfield.visible=false;this.starfield.material.opacity=0;}
    this.celebration=null;
    this.camera.position.set(0,9,20);this.camera.rotation.set(0,0,0);this.camera.lookAt(0,6,-25);
  }
  /** Pose-recognition stage for the Zepellion pre-motion (0 none, 1 gathered, 2 L formed). */
  setPoseStage(stage){super.setPoseStage(stage);}
  selectMonster(){
    if(!this.assetReady)return;
    const requested=this.waveInfo.model;
    const selection=this.selection=(this.selection||0)+1;
    if(!this.models.has(requested)){
      this.loading=true;this.waveLoadError=null;
      if(this.currentMonster)this.currentMonster.visible=false;
      this.hands.visible=false;this.clearTransient();
      this.clientEvent({type:'wave-loading',info:this.waveInfo});
      this.loadMonster(this.loader,this.revision,requested).then(()=>{
        if(!this.disposed&&selection===this.selection&&this.waveInfo.model===requested)this.selectMonster();
      }).catch(error=>{
        if(this.disposed||selection!==this.selection)return;
        this.waveLoadError=error;
        this.clientEvent({type:'wave-load-error',info:this.waveInfo});
      });
      return;
    }
    const wasLoading=this.loading;this.waveLoadError=null;
    this.monsterMotion?.dispose();if(this.currentMonster)this.renderScene.remove(this.currentMonster);this.currentMonster=this.models.get(this.waveInfo.model);this.monsterBaseZ=20-this.enemyDistance;this.currentMonster.position.set(0,0,this.monsterBaseZ);this.currentMonster.scale.setScalar(this.wave===WAVES.length?1.12:1);this.currentMonster.rotation.set(0,0,0);this.knockbackAt=-Infinity;this.monsterHitAt=-Infinity;this.airborne=false;this.renderScene.add(this.currentMonster);this.currentMonster.visible=true;for(const rest of this.currentMonster.userData.restPose||[]){rest.node.position.copy(rest.position);rest.node.quaternion.copy(rest.quaternion);rest.node.scale.copy(rest.scale);}this.currentMonster.updateMatrixWorld(true);
    this.setMonsterOpacity(this.currentMonster,1);this.stepAttack=null;this.stepIndex=-1;
    this.monsterMotion=new MonsterMotion(this.currentMonster,this.waveInfo.model,this.monsterAnimations.get(this.waveInfo.model)||[]);
    this.monsterMotion.update(null,0,{time:this.time});
    this.currentMonster.updateWorldMatrix(true,true);
    this.currentMonster.traverse(mesh=>{if(mesh.isSkinnedMesh){mesh.skeleton.update();mesh.computeBoundingSphere();}});
    if(!this.chargeFlare){this.chargeGroup=new THREE.Group();this.chargeGroup.visible=false;this.renderScene.add(this.chargeGroup);this.chargeFlare=this.flare(V(),0xffab64,1.5,this.chargeGroup,0);this.heldRock=this.rock(this.chargeGroup);this.chargeGroup.visible=true;try{this.renderer.compile(this.renderScene,this.camera);}finally{this.chargeGroup.visible=false;}}
    this.chargeGroup.visible=false;this.monsterLight.intensity=0;this.monsterLight.color.setHex(this.waveInfo.color);this.targetRing.material.color.setHex(this.waveInfo.color);this.clearTransient();
    this.loading=false;
    if(wasLoading)this.clientEvent({type:'wave-ready',info:this.waveInfo});
  }
  clearTransient(){for(const e of this.visualEffects)this.disposeObject(e.group);this.visualEffects=[];}
  disposeObject(o){this.renderScene.remove(o);o.traverse(n=>{if(n.isMesh||n.isPoints||n.isSprite){if(!n.isSprite)n.geometry?.dispose();if(Array.isArray(n.material))n.material.forEach(m=>m.dispose());else n.material?.dispose();}});}
  visualEvent(e){if(!this.renderScene)return;if(e.type==='wave')this.selectMonster();if(e.type==='victory')this.startCelebration();if(e.type==='celebration-end')this.stopCelebration();if(e.type==='remote-interrupted'){for(const fx of this.visualEffects.filter(f=>SKILLS[f.kind]))this.disposeObject(fx.group);this.visualEffects=this.visualEffects.filter(f=>!SKILLS[f.kind]);}if(e.type==='knockback'){this.monsterMotion?.cancelLocomotion();this.clearEnemyEffects();this.knockbackAt=this.time;this.airborne=e.airborne;}if(e.type==='cast')this.playerEffect(e.skill,e);if(e.type==='hit'){this.monsterHitAt=this.time;this.hitSide=e.side==='left'?-1:1;this.hitFlash=.3;const point=e.source==='punch'?this.punchHitPoint(e.side):this.getHitPoint();this.impactEffect(e.source,e.side,point);this.sparkBurst(point,this.waveInfo.color,e.source==='punch'?18:34);}if(e.type==='defeat'){this.clearEnemyEffects();this.sparkBurst(V(0,9,-15),0xffd99c,100);this.hurt=0;}if(e.type==='defense'){if(e.outcome==='hit')this.hurt=.5;else if(e.outcome==='block'){this.defenseFlash=.8;this.sparkBurst(V(this.camera.position.x,8,14),0x89ffe6,45);}else if(e.outcome==='dodge')this.sparkBurst(V(this.camera.position.x+5,8,12),0xc1f9ff,20);}if(e.type==='enemy-cast')this.enemyEffect(e.attack);if(e.type==='interrupt'){this.clearEnemyEffects();this.sparkBurst(V(0,10,-12),0xc4fffc,30);}}
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
  playerEffect(kind,data={}){
    if(kind==='palm'){this.hero.palmSide=data.side||'right';this.hero.updateSockets();}
    if(kind==='disc'){this.hero.discSide=data.side||'right';this.hero.updateSockets();}
    const group=new THREE.Group();this.renderScene.add(group);this.camera.updateMatrixWorld(true);
    const start=this.hero.socketWorld(kind),end=this.getHitPoint();
    const beamFamily=kind==='beam'||kind==='zepellion',ultra=kind==='zepellion';
    const timing=data.timing||(kind==='disc'?discTiming(data):beamFamily?beamTimingFor(kind,data.prepared):null);
    const entry={kind,group,side:data.side,prepared:data.prepared,timing,age:0,duration:beamFamily?timing.lightEnd:timing?.end??SKILLS[kind].duration,start,end};
    if(kind==='palm'){
      entry.orb=this.flare(start,0x89eaff,1.8,group,1);entry.core=this.flare(start,0xffffff,.55,group,1);
    }else if(beamFamily){
      entry.volume=new BeamVolume(ultra?{core:[.42,.3,1],edge:[.86,.74,1],filaments:[0xc6b2ff,0xf4efff],gain:1.4,radius:1.3}:undefined);entry.volume.visible=false;group.add(entry.volume);
      entry.launch=this.flare(start,ultra?0xa98dff:0x60e8ff,ultra?2.2:1.7,group,.6);entry.sourceCore=this.flare(start,0xffffff,.36,group,0);entry.launch.material.opacity=0;
      entry.contact=this.flare(end,ultra?0xb49dff:0x55d5ff,ultra?4.6:3.5,group,0);
      const light=new THREE.PointLight(ultra?0xa78fff:0x6aeaff,ultra?105:90,ultra?20:18,1.5);light.position.copy(start);group.add(light);entry.light=light;
    }else{
      const disc=new THREE.Group();group.add(disc);entry.disc=disc;
      const gold=glow(0xffbf45);gold.blending=THREE.NormalBlending;gold.opacity=.96;this.mesh(new THREE.TorusGeometry(.38,.026,10,64),gold,null,disc);
      this.mesh(new THREE.TorusGeometry(.30,.012,8,64),glow(0xfffce6),null,disc);
      this.mesh(new THREE.RingGeometry(.11,.34,64),glow(0xffb743,.15),null,disc);
      for(let i=0;i<16;i++){const a=i*Math.PI/8;const tooth=this.mesh(new THREE.ConeGeometry(.045,.11,3),glow(0xffe4a3),V(Math.cos(a)*.395,Math.sin(a)*.395,0),disc);tooth.rotation.z=a-Math.PI/2;}
      entry.halo=this.flare(V(),0xffb746,1.35,disc,.25);
      entry.trail=[];for(let i=0;i<6;i++)entry.trail.push(this.flare(start,0xffca69,.75-i*.07,group,.22-i*.025));
      const light=new THREE.PointLight(0xffcc70,16,10,1.5);disc.add(light);entry.discSize=(this.camera.aspect<1?.8:1)*this.hero.lens.scale;
    }
    this.visualEffects.push(entry);
  }
  impactEffect(source,side,point=this.getHitPoint()){
    const special=source==='beam'||source==='zepellion'||source==='disc',color=source==='disc'?0xffcb6a:source==='zepellion'?0xc3aaff:source==='beam'?0x75eaff:0xffe8b1;
    const size=special?(source==='zepellion'?9:7):1.5;
    const group=new THREE.Group();group.position.copy(point).add(V(0,0,.2));this.renderScene.add(group);
    this.flare(V(),color,size,group,special?.9:.55);this.flare(V(),0xffffff,size*.36,group,special?1:.65);
    const rings=[];for(let i=0;i<(special?3:1);i++)rings.push(this.mesh(new THREE.TorusGeometry(1+i*.3,.06,6,64),glow(color,.9-i*.15),V(),group));
    const light=new THREE.PointLight(color,special?170:14,25,1.4);group.add(light);
    this.visualEffects.push({kind:'impact',group,rings,light,age:0,duration:special?.75:.32});
  }
  rock(parent){
    const geometry=new THREE.IcosahedronGeometry(1.1,1),positions=geometry.attributes.position,colors=[];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),grain=Math.sin(x*7+y*11+z*5),size=1+grain*.13+Math.cos(x*13-z*9)*.07;
      positions.setXYZ(i,x*size,y*size,z*size);const shade=.48+grain*.07;colors.push(shade*1.03,shade,shade*.94);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const mesh=this.mesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,flatShading:true}),V(),parent);mesh.castShadow=true;return mesh;
  }
  clearEnemyEffects(){
    for(const effect of this.visualEffects.filter(e=>e.kind.startsWith('enemy-')))this.disposeObject(effect.group);
    this.visualEffects=this.visualEffects.filter(e=>!e.kind.startsWith('enemy-'));
    if(this.chargeGroup)this.chargeGroup.visible=false;
  }
  enemyEffect(attack){
    if(attack.kind==='melee')return;
    const group=new THREE.Group();this.renderScene.add(group);const kind=attack.kind;
    const entry={kind:'enemy-'+kind,group,age:0,duration:attack.flight,start:this.monsterMotion.origin(this.monsterMotion.castSide(attack)),end:V(attack.originLean*4.5,8,20),safeSide:attack.safeSide,side:this.monsterMotion.castSide(attack)};
    if(kind==='bolt'){
      if(this.waveInfo.model==='redking'){this.rock(group);entry.rock=true;}
      else{this.flare(V(),this.waveInfo.color,1.6,group,1);this.flare(V(),0xffffff,.45,group,1);}
      group.position.copy(entry.start);
    }
    if(kind==='slam'){const ring=this.mesh(new THREE.TorusGeometry(1,.12,8,96),glow(this.waveInfo.color),null,group);ring.rotation.x=Math.PI/2;group.position.set(this.currentMonster.position.x,.2,this.currentMonster.position.z);group.visible=false;}
    if(kind==='sweep'){entry.beam=this.mesh(new THREE.CylinderGeometry(.2,.2,1,12),glow(this.waveInfo.color),V(),group);const sheet=new THREE.BufferGeometry();sheet.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));sheet.setIndex([0,1,2,2,1,3]);entry.sheet=this.mesh(sheet,glow(this.waveInfo.color,.14),V(),group);entry.sheet.frustumCulled=false;entry.source=this.flare(V(),this.waveInfo.color,2,group,.9);}
    if(kind==='charge'){
      const profile=attack.approach||locomotionFor(this.waveInfo.model);
      if(profile.mode==='blink'){
        entry.blink=true;entry.portals=[];
        for(const z of [this.currentMonster.position.z,20-16.5]){
          const portal=new THREE.Group();portal.position.set(0,8,z);group.add(portal);
          if(profile.portal==='pillar'){
            const cage=this.mesh(new THREE.CylinderGeometry(3.5,3.5,17,12,8,true),glow(0xffd36b,.25),V(),portal);cage.material.wireframe=true;
            for(let i=0;i<4;i++)this.mesh(new THREE.TorusGeometry(3.8,.04,6,40),glow(0xffe69a,.6),V(0,-6+i*4,0),portal).rotation.x=Math.PI/2;
          }else{
            this.mesh(new THREE.TorusGeometry(5,.07,8,64),glow(0x7cecff,.7),V(),portal);
            this.mesh(new THREE.TorusGeometry(4.5,.035,6,48),glow(0xd6ffff,.6),V(),portal).rotation.z=.25;
          }
          entry.portals.push(portal);
        }
      }else if(profile.mode==='ram'){this.flare(V(),this.waveInfo.color,2.5,group,.35);group.position.copy(this.currentMonster.position).add(V(0,10,0));entry.ram=true;}
      else{this.disposeObject(group);return;}
    }
    this.visualEffects.push(entry);
  }
  setMonsterOpacity(root,alpha){
    const allowFade=locomotionFor(this.waveInfo.model).mode==='blink';
    root.userData.approachAlpha=alpha;
    root.traverse(mesh=>{if(!mesh.isMesh)return;
      mesh.userData.approachVisible??=mesh.visible;mesh.userData.approachShadow??=mesh.castShadow;
      mesh.visible=mesh.userData.approachVisible&&alpha>.015;mesh.castShadow=mesh.userData.approachShadow&&alpha>.9;
      for(const material of [].concat(mesh.material)){
        material.userData.approachOpacity??=material.opacity;material.userData.approachDepth??=material.depthWrite;
        if((alpha<1||allowFade)&&!material.transparent){material.transparent=true;material.forceSinglePass=true;material.needsUpdate=true;}
        material.opacity=material.userData.approachOpacity*alpha;material.depthWrite=material.userData.approachDepth&&alpha>.98;
      }
    });
  }
  footDust(step){if(step.weight<.8)return;const group=new THREE.Group();group.position.copy(step.point);group.position.y=.08;this.flare(V(),step.metal?0xe1b994:0xb9a58a,.8+step.weight*.3,group,.13);this.renderScene.add(group);this.visualEffects.push({kind:'enemy-step',group,age:0,duration:.3});}
  sparkBurst(position,color,count){const points=new Float32Array(count*3),velocity=[];for(let i=0;i<count;i++){points.set([position.x,position.y,position.z],i*3);velocity.push(V((Math.random()-.5)*13,(Math.random()-.2)*12,(Math.random()-.5)*13));}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(points,3));const material=new THREE.PointsMaterial({color,size:.14,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});const group=new THREE.Group();group.add(new THREE.Points(geo,material));this.renderScene.add(group);this.visualEffects.push({kind:'sparks',group,age:0,duration:1.2,velocity});}
  resize(){const {width,height}=this.canvas.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.fov=width<600?66:57;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);}
  setQuality(quality){this.renderer.setPixelRatio(quality==='low'?1:Math.min(devicePixelRatio||1,1.65));this.renderer.shadowMap.enabled=quality!=='low';this.resize();}
  animateMonster(dt){
    const m=this.currentMonster;if(!m)return;const t=this.time,a=this.attack,winding=a?.phase==='windup'?clamp(a.age/a.windup,0,1):0,attack=a?.phase==='flight';
    m.rotation.y=this.defeated?.18*Math.sin(t):Math.sin(t*.5)*.04;m.position.y=this.defeated?-Math.pow(1-clamp(this.respawn/3,0,1),2)*21:0;this.monsterBaseZ=a?.kind==='charge'&&a.phase==='flight'?20-this.enemyDistance:mix(this.monsterBaseZ,20-this.enemyDistance,1-Math.exp(-dt*8));m.position.z=this.monsterBaseZ;m.position.x=0;if(a?.kind==='sweep'){const scan=a.phase==='flight'?clamp(a.age/a.flight,0,1):0,ready=a.phase==='windup'?clamp(a.age/a.windup,0,1):1;m.rotation.y+=Math.atan2(-a.safeSide*11*(1-2*scan),this.enemyDistance)*ready;}
    if(this.time-this.knockbackAt<1){const t=this.time-this.knockbackAt;m.position.y=this.airborne?Math.sin(t*Math.PI)*4:0;m.rotation.x=-Math.sin(t*Math.PI)*.24;}else m.rotation.x=0;
    const approach=a?.kind==='charge'?(a.approach||locomotionFor(this.waveInfo.model)):null;
    if(approach&&approach.mode!=='ram'){m.rotation.y=0;m.rotation.x=0;}
    if(approach?.mode==='ram'&&!this.defeated&&this.time-this.knockbackAt>=1){const dip=a.phase==='windup'?clamp(a.age/a.windup,0,1):1;m.rotation.x=.13*dip;}
    if(FLOATERS.has(this.waveInfo.model)&&!this.defeated){m.position.y+=Math.sin(t*1.8)*.06;if(a?.kind==='melee')m.position.z+=Math.sin(clamp(a.age/(a.phase==='windup'?a.windup:a.flight),0,1)*Math.PI)*.8;}
    this.monsterMotion?.update(a,dt,{dead:this.defeated,hurt:this.time-this.monsterHitAt<.22||this.time-this.knockbackAt<.7,time:t,enemyDistance:this.enemyDistance});m.position.z+=this.monsterMotion?.lunge||0;m.position.x+=this.monsterMotion?.aimX||0;
    const step=this.monsterMotion?.stepEvent;if(step&&(this.stepAttack!==a||this.stepIndex!==step.key)){this.stepAttack=a;this.stepIndex=step.key;this.clientEvent({type:'footstep',...step});this.footDust(step);}
    this.setMonsterOpacity(m,approach?.mode==='blink'&&a.phase==='flight'?approachOpacity(approach,a.age/a.flight):1);
    if(this.chargeGroup){const charging=a?.phase==='windup'&&(a.kind==='bolt'||a.kind==='sweep'||a.kind==='charge'&&FLOATERS.has(this.waveInfo.model));this.chargeGroup.visible=!!charging;const progress=charging?clamp(a.age/a.windup,0,1):0;this.chargeGroup.position.copy(this.monsterMotion.origin(this.monsterMotion.castSide(a)));this.heldRock.visible=charging&&this.waveInfo.model==='redking';this.chargeFlare.visible=!this.heldRock.visible;this.chargeFlare.material.color.setHex(this.waveInfo.color);this.chargeFlare.material.opacity=progress*.8;this.chargeFlare.scale.setScalar(.4+progress*2);}
    const hitAge=this.time-this.monsterHitAt,flash=hitAge>=0&&hitAge<.1?(1-hitAge/.1)*(this.reduced?.12:.28):0;
    m.traverse(o=>{if(o.isMesh&&o.material.userData.hitBase)o.material.emissive.copy(o.material.userData.hitBase).lerp(hitColor,flash);});
    if(hitAge>=0&&hitAge<.2){m.rotation.z=this.hitSide*Math.sin(hitAge/.2*Math.PI)*.055;m.position.z-=Math.sin(hitAge/.2*Math.PI)*.45;}else m.rotation.z=0;
    this.warningRing.visible=false;this.warningRing.material.opacity=.35+Math.sin(t*10)*.2;this.warningRing.scale.setScalar(1+winding*.15);this.safeZone.visible=false;if(a)this.safeZone.position.x=a.safeSide*6;this.monsterLight.intensity=(!approach||approach.mode==='ram'?winding*12:0)+this.hitFlash*8;
  }
  start(){
    super.start();this.stopCelebration();this.guardAmount=0;this.guardWasActive=false;this.shieldIgnition=0;this.defenseFlash=0;this.hurt=0;this.hitFlash=0;
    if(this.hands)this.hands.visible=false;if(this.shield)this.shield.material.uniforms.energy.value=0;if(this.shieldGlow)this.shieldGlow.material.opacity=0;
    this.hero?.reset();
  }
  punchHitPoint(side){
    const index=side==='left'?0:1,rig=this.hero.rigs[index];
    const wristWorld=this.hero.lens.effectPoint(rig.metrics().wrist);
    this.currentMonster.updateWorldMatrix(true,true);
    this.currentMonster.traverse(mesh=>{if(mesh.isSkinnedMesh){mesh.skeleton.update();mesh.computeBoundingSphere();}});
    const ray=new THREE.Raycaster(this.camera.getWorldPosition(V()),wristWorld.sub(this.camera.getWorldPosition(V())).normalize());
    const hit=ray.intersectObject(this.currentMonster,true)[0];if(hit)return hit.point;
    // Legacy meshes can have gaps between body plates. Keep the contact on the
    // fist ray, at the torso depth, instead of jumping back to a chest marker.
    const torso=this.getHitPoint(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(V()),torso);
    return ray.ray.intersectPlane(plane,V())||torso;
  }
  getHitPoint(){
    const core=this.currentMonster?.getObjectByName('ChestCore');
    if(!core){if(this.waveInfo.model==='ganq')return this.currentMonster.localToWorld(V(0,10.8,3.5));const chest=this.currentMonster?.getObjectByName('upperbody2')||this.currentMonster?.getObjectByName('Bip001_Spine1_015')||this.currentMonster?.getObjectByName('MUNE');return chest?chest.getWorldPosition(V()).add(V(0,0,1.5)):this.currentMonster.localToWorld(V(0,8.5,2));}
    core.updateWorldMatrix(true,false);if(!core.geometry.boundingBox)core.geometry.computeBoundingBox();
    return core.localToWorld(core.geometry.boundingBox.getCenter(V())).add(V(0,0,.13));
  }
  poseTigaFingers(arm,side,target){this.hero.poseHand(side==='L'?0:1,target>.5?'fist':'shield');}
  animateHands(dt){
    if(this.celebrating>0){
      // The celebration shows Tiga's whole body from behind the shoulders, so
      // the first-person arms and the shield layer step aside.
      this.hands.visible=false;this.guardAmount=0;this.guardWasActive=false;
      this.shield.material.uniforms.energy.value=0;this.shieldGlow.material.opacity=0;this.impactVeil.material.opacity=0;
      this.hurt=0;this.defenseFlash=0;this.hitFlash=0;
      return;
    }
    const factor=1-Math.exp(-dt*10);this.renderLean=mix(this.renderLean,this.lean,factor);
    const beam=this.effects.find(e=>e.kind==='beam'||e.kind==='zepellion'),disc=this.effects.find(e=>e.kind==='disc'),punch=this.effects.filter(e=>e.kind==='punch').at(-1);
    const palm=this.effects.find(e=>e.kind==='palm');
    const guard=!beam&&!disc&&!palm&&!punch&&this.guard&&this.guardEnergy>0?1:0;
    if(guard&&!this.guardWasActive)this.shieldIgnition=.55;this.guardWasActive=guard;this.shieldIgnition=Math.max(0,(this.shieldIgnition||0)-dt);this.guardAmount=mix(this.guardAmount,guard,factor);
    this.camera.position.x=this.renderLean*4.5;this.camera.position.y=9+(this.reduced?0:Math.sin(this.time*1.4)*.025+Math.sin(this.time*95)*this.hitFlash*.13);this.camera.rotation.z=this.reduced?0:-this.renderLean*.035;this.camera.rotation.y=-this.renderLean*.025;
    if(this.hero)this.hands.visible=this.hero.update({beam,disc,discPreparation:this.discGesture,zepPreparation:this.zepellionStage,palm,punch,guard,dt});
    if(this.hero){this.discPreview.visible=!!this.discGesture&&!beam&&!disc&&!palm&&!punch&&!guard;if(this.discPreview.visible){this.discPreview.position.copy(this.hero.socketWorld('disc'));this.discPreview.scale.setScalar((.25+.75*this.discGesture.progress)*this.hero.lens.scale);this.discPreview.rotation.z=this.time*10;}}
    this.shield.material.uniforms.energy.value=this.guardAmount*.7+this.defenseFlash+this.shieldIgnition*.5;this.shield.material.uniforms.time.value=this.reduced?0:this.time;this.shieldGlow.material.opacity=this.guardAmount*.28+this.defenseFlash*.35+this.shieldIgnition*.65;this.shieldGlow.rotation.z=this.time*.1;
    this.hurt=Math.max(0,this.hurt-dt);this.defenseFlash=Math.max(0,this.defenseFlash-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);this.impactVeil.material.opacity=this.hurt*.13;
  }
  animateEffects(dt){for(const e of this.visualEffects){e.age+=dt;const t=clamp(e.age/e.duration,0,1);if(e.kind==='disc'){
        const timing=e.timing||discTiming(e);
        if(e.age<timing.release){e.start.copy(this.hero.socketWorld('disc'));e.disc.position.copy(e.start);e.disc.scale.setScalar(e.discSize*(.15+.85*clamp(e.age/Math.max(.001,timing.ready),0,1)));}
        else{if(!e.released){e.start.copy(this.hero.socketWorld('disc'));e.released=true;}const flight=clamp((e.age-timing.release)/(timing.impact-timing.release),0,1);e.end.copy(this.getHitPoint());e.disc.position.lerpVectors(e.start,e.end,flight);e.disc.position.y+=Math.sin(flight*Math.PI)*.65;e.disc.scale.setScalar(e.discSize+flight*(3.6-e.discSize));}
        e.disc.rotation.z=e.age*16;e.disc.rotation.x=.18;
        const fade=e.age<timing.impact?1:clamp(1-(e.age-timing.impact)/.35,0,1);e.disc.visible=fade>0;
        for(const [i,trail]of e.trail.entries()){const progress=clamp((e.age-timing.release-i*.035)/(timing.impact-timing.release),0,1);trail.position.lerpVectors(e.start,e.end,progress);trail.position.y+=Math.sin(progress*Math.PI)*.65;trail.material.opacity=e.age<timing.release?0:(.22-i*.025)*fade;}
      }
      if(e.kind==='palm'){
        if(!e.released){e.start.copy(this.hero.socketWorld('palm'));if(e.age>=.18)e.released=true;}
        e.end.copy(this.getHitPoint());const flight=clamp((e.age-.18)/.16,0,1),point=e.start.clone().lerp(e.end,flight);
        e.orb.position.copy(point);e.core.position.copy(point);e.orb.material.opacity=e.age>.34?Math.max(0,1-(e.age-.34)/.2):1;e.core.material.opacity=e.orb.material.opacity;
      }
    if(e.kind==='beam'||e.kind==='zepellion'){
        e.start.copy(this.hero.socketWorld('beam'));e.end.copy(this.getHitPoint());
        const bt=e.timing||BEAM_TIMING;const firing=e.age>=bt.fire,reveal=clamp((e.age-bt.fire)/(bt.impact-bt.fire),0,1),fade=clamp((e.duration-e.age)/(e.duration-bt.fade),0,1);
        const [bottom,top]=this.hero.beamRail();e.volume.update(bottom,top,e.end,reveal,e.age,fade,this.reduced);
        const charge=clamp((e.age-.07)/(bt.fire-.07),0,1);
        e.launch.position.copy(e.start);e.launch.material.opacity=(firing?.45:charge*.25)*fade;e.launch.scale.setScalar(firing?.65:.18+charge*.4);
        e.sourceCore.position.copy(e.start);e.sourceCore.material.opacity=(firing?.9:charge*.55)*fade;
        e.contact.position.copy(e.end);e.contact.material.opacity=e.age>=bt.impact?.65*fade:0;e.light.position.copy(e.start);e.light.intensity=(firing?65:charge*18)*fade;
      }
      if(e.kind==='impact'){for(const [i,ring]of e.rings.entries()){ring.scale.setScalar(1+t*(3+i));ring.material.opacity=(1-t)*.85;}e.group.children.filter(o=>o.isSprite).forEach(o=>{o.material.opacity=1-t;});e.light.intensity*=Math.max(0,1-dt*8);}if(e.kind==='enemy-bolt'){const release=e.rock?.15:.2;if(t<release)e.start.copy(this.monsterMotion.origin(e.side));const flight=clamp((t-release)/(1-release),0,1);e.group.position.lerpVectors(e.start,e.end,flight);if(e.rock)e.group.position.y+=Math.sin(flight*Math.PI)*3;e.group.rotation.z=e.age*(e.rock?2:5);e.group.scale.setScalar(e.rock?1:1+flight*.8);}if(e.kind==='enemy-slam'){const travel=clamp((t-.28)/.72,0,1);e.group.visible=t>=.28;e.group.scale.setScalar(1+travel*this.enemyDistance);e.group.children[0].material.opacity=1-travel*.7;}if(e.kind==='enemy-sweep'){const start=this.monsterMotion.origin(e.side),end=V(-e.safeSide*11*(1-2*t),8,20),delta=end.clone().sub(start);e.beam.position.copy(start).addScaledVector(delta,.5);e.beam.quaternion.setFromUnitVectors(V(0,1,0),delta.clone().normalize());e.beam.scale.set(1,delta.length(),1);e.source.position.copy(start);const positions=e.sheet.geometry.attributes.position;positions.setXYZ(0,start.x,start.y-.12,start.z);positions.setXYZ(1,start.x,start.y+.12,start.z);positions.setXYZ(2,-e.safeSide*11,8,20);positions.setXYZ(3,end.x,end.y,end.z);positions.needsUpdate=true;e.group.visible=t>=.15;}if(e.kind==='enemy-charge'){
        if(e.blink){for(const [index,portal]of e.portals.entries()){const strength=index?Math.sin(Math.PI*clamp((t-.2)/.8,0,1)):Math.sin(Math.PI*clamp(t/.75,0,1));portal.rotation.z=e.age*(index?-1:1)*.6;portal.scale.setScalar(.85+Math.sin(t*Math.PI)*.2);portal.traverse(mesh=>{if(mesh.isMesh)mesh.material.opacity=strength*.55;});}}
        else if(e.ram)e.group.position.copy(this.currentMonster.position).add(V(0,10,0));
      }if(e.kind==='enemy-step'){e.group.scale.setScalar(1+t);e.group.children[0].material.opacity=(1-t)*.13;}
      if(e.kind==='sparks'){const points=e.group.children[0],array=points.geometry.attributes.position.array;e.velocity.forEach((v,i)=>{array[i*3]+=v.x*dt;array[i*3+1]+=v.y*dt;array[i*3+2]+=v.z*dt;v.y-=5*dt;});points.geometry.attributes.position.needsUpdate=true;points.material.opacity=1-t;}}
    this.visualEffects=this.visualEffects.filter(e=>{if(e.age<e.duration)return true;this.disposeObject(e.group);return false;});
  }
  advance(dt){if(this.loading)return;for(let remaining=dt;remaining>1e-8;){const step=Math.min(remaining,1/60);this.update(step);remaining-=step;}this.animateMonster(dt);this.animateHands(dt);this.animateEffects(dt);if(this.celebration)this.animateCelebration(dt);}
  frame(now){const dt=Math.min(Math.max(0,(now-this.lastNow)/1000),.25);this.lastNow=now;if(!this.paused&&(!this.finished||this.celebrating>0)){this.advance(dt);}this.renderer.render(this.renderScene,this.camera);this.frameCount++;}
  dispose(){this.disposed=true;this.selection=(this.selection||0)+1;this.renderer.setAnimationLoop(null);this.observer.disconnect();this.clearTransient();this.flareTexture?.dispose();this.renderer.dispose();}
}




