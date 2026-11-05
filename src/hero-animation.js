import * as THREE from 'three';
import {BEAM_TIMING,DISC_TIMING} from './action-timing.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const q=()=>new THREE.Quaternion();
const clamp=THREE.MathUtils.clamp;
const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const fingers=['Index','Mid','Ring','Pinky'];
const shapes=['rest','fist','blade','shield','disc'];
const armScale=aspect=>aspect<1?.62:.68;

function frame(forward,normal){
  const y=forward.clone().normalize();
  let z=normal.clone().addScaledVector(y,-normal.dot(y));
  if(z.lengthSq()<.001)z=v(0,0,1).addScaledVector(y,-y.z);
  z.normalize();const x=y.clone().cross(z).normalize();z=x.clone().cross(y).normalize();
  return q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
function state(wrist,forearm,normal,upper,preset,scale=.76,handForward=forearm){
  return {wrist,forearm:frame(forearm,normal),hand:frame(handForward,normal),upper:upper.normalize(),shape:{[preset]:1},scale};
}
function copyPose(p){return{wrist:p.wrist.clone(),forearm:p.forearm.clone(),hand:p.hand.clone(),upper:p.upper.clone(),shape:{...p.shape},scale:p.scale};}
function blend(a,b,t){t=ease(t);const shape={};for(const n of shapes)shape[n]=(a.shape[n]||0)*(1-t)+(b.shape[n]||0)*t;
  return {wrist:a.wrist.clone().lerp(b.wrist,t),forearm:a.forearm.clone().slerp(b.forearm,t),hand:a.hand.clone().slerp(b.hand,t),upper:a.upper.clone().lerp(b.upper,t).normalize(),shape,scale:THREE.MathUtils.lerp(a.scale,b.scale,t)};
}

class ArmRig {
  constructor(root,side,camera){
    this.root=root;this.side=side;this.camera=camera;this.nodes={};this.rest=new Map();this.presets={};
    root.updateWorldMatrix(true,true);
    root.traverse(o=>{if(o.isBone){this.nodes[o.name]=o;this.rest.set(o,o.quaternion.clone());}});
    const suffix='_'+side;this.upper=this.nodes['UpperArm'+suffix];this.lower=this.nodes['LowerArm'+suffix];this.hand=this.nodes['Hand'+suffix];
    const rootInv=root.getWorldQuaternion(q()).invert();
    this.restUpperQ=rootInv.clone().multiply(this.upper.getWorldQuaternion(q()));
    this.restLowerQ=rootInv.clone().multiply(this.lower.getWorldQuaternion(q()));
    this.restHandQ=rootInv.clone().multiply(this.hand.getWorldQuaternion(q()));
    this.shoulder=this.point(this.upper);this.elbow=this.point(this.lower);this.wrist=this.point(this.hand);
    this.upperLength=this.shoulder.distanceTo(this.elbow);this.lowerLength=this.elbow.distanceTo(this.wrist);
    const across=this.point(this.nodes['Index1'+suffix]).sub(this.point(this.nodes['Pinky1'+suffix])).normalize().multiplyScalar(side==='L'?1:-1);
    this.long=this.tip('Mid').sub(this.point(this.nodes['Mid1'+suffix])).normalize();
    this.normal=across.clone().cross(this.long).normalize();this.across=this.long.clone().cross(this.normal).normalize();
    this.upperFrame=frame(this.elbow.clone().sub(this.shoulder),this.normal).invert();
    this.lowerFrame=frame(this.wrist.clone().sub(this.elbow),this.normal).invert();
    this.handFrame=frame(this.long,this.normal).invert();
    this.tipLocal={};
    for(const finger of [...fingers,'Thumb']){const bone=this.nodes[finger+'3'+suffix];const rootTip=this.tip(finger);this.tipLocal[finger]=bone.worldToLocal(root.localToWorld(rootTip));}
    this.fingerNodes=[...fingers,'Thumb'].flatMap(f=>[1,2,3].map(j=>this.nodes[f+j+suffix]));
    this.buildPresets();this.restore();
  }
  point(bone){return this.root.worldToLocal(bone.getWorldPosition(v()));}
  tip(finger){const a=this.root.userData.bone_tips?.[finger+'3_'+this.side];if(!a)throw new Error('Missing authored finger endpoint: '+finger);return new THREE.Vector3().fromArray(a);}
  liveTip(finger){return this.root.worldToLocal(this.nodes[finger+'3_'+this.side].localToWorld(this.tipLocal[finger].clone()));}
  restore(){for(const [bone,rotation]of this.rest)bone.quaternion.copy(rotation);this.root.updateWorldMatrix(true,true);}
  orientFinger(bone,direction){
    const rootQ=this.root.getWorldQuaternion(q()),boneQ=bone.getWorldQuaternion(q());
    const current=v(0,1,0).applyQuaternion(boneQ);const target=direction.clone().applyQuaternion(rootQ);
    const delta=q().setFromUnitVectors(current.normalize(),target.normalize());
    bone.quaternion.copy(bone.parent.getWorldQuaternion(q()).invert().multiply(delta).multiply(boneQ));bone.updateWorldMatrix(false,true);
  }
  poseThumb(preset){
    // Metacarpal, proximal and distal directions in the palm frame. The thumb folds
    // toward the PALM (-normal), never over the back of the hand. Authoring all three
    // segments also prevents the hooked thumb produced by an unconstrained tip IK.
    const directions={
      blade:[[.32,.88,-.10],[-.25,.86,-.10],[-.52,.74,.14]],
      fist:[[.18,.55,-.8],[-.8,.5,-.3],[-.95,.2,0]],
      rest:[[.4,.8,-.25],[-.3,.8,-.4],[-.65,.5,-.15]],
      disc:[[.4,.75,-.35],[-.5,.65,-.5],[-.85,.3,-.05]],
      shield:[[.65,.7,-.12],[.7,.65,-.05],[.5,.8,0]],
    }[preset];
    const side=this.side==='L'?1:-1;
    directions.forEach(([x,y,z],i)=>this.orientFinger(this.nodes['Thumb'+(i+1)+'_'+this.side],this.across.clone().multiplyScalar(x*side).addScaledVector(this.long,y).addScaledVector(this.normal,z).normalize()));
  }
  buildPresets(){
    // Explicit finger adduction is separate from flexion. Zero curl is not a blade hand.
    const suffix='_'+this.side;
    for(const preset of shapes){
      this.restore();const adduction={rest:.65,fist:1,blade:1,shield:.45,disc:.8}[preset];
      const bases=fingers.map(f=>this.point(this.nodes[f+'1'+suffix])),center=bases.reduce((sum,p)=>sum+p.dot(this.across),0)/4;
      for(const [i,finger]of fingers.entries()){
        const convergence=preset==='blade'?.36:preset==='fist'?.18:0;
        const length=bases[i].distanceTo(this.tip(finger));
        const direction=this.long.clone().addScaledVector(this.across,(center-bases[i].dot(this.across))*convergence/length).normalize();
        for(let joint=1;joint<=3;joint++){
          const bone=this.nodes[finger+joint+suffix];const before=bone.quaternion.clone();this.orientFinger(bone,direction);bone.quaternion.copy(before.slerp(bone.quaternion,adduction));bone.updateWorldMatrix(false,true);
        }
      }
      const curl={rest:[.35,.5,.28],fist:[1.15,1.45,1.0],blade:[.015,.015,.015],shield:[.035,.06,.025],disc:[.5,.65,.38]}[preset];
      for(const finger of fingers)for(let joint=1;joint<=3;joint++){
        const bone=this.nodes[finger+joint+suffix];const axis=this.normal.clone().cross(this.long).normalize();
        const worldAxis=axis.applyQuaternion(this.root.getWorldQuaternion(q()));const parentInv=bone.parent.getWorldQuaternion(q()).invert();
        const delta=q().setFromAxisAngle(worldAxis,curl[joint-1]);bone.quaternion.copy(parentInv.multiply(delta).multiply(bone.getWorldQuaternion(q())));bone.updateWorldMatrix(false,true);
      }
      this.poseThumb(preset);
      this.presets[preset]=new Map(this.fingerNodes.map(b=>[b,b.quaternion.clone()]));
    }
  }
  applyShape(weights){
    for(const bone of this.fingerNodes){let sum=0,rotation=q();for(const name of shapes){const weight=weights[name]||0;if(weight<.00001)continue;const target=this.presets[name].get(bone);if(sum===0)rotation.copy(target);else rotation.slerp(target,weight/(sum+weight));sum+=weight;}bone.quaternion.copy(sum?rotation:this.rest.get(bone));}
  }
  orient(bone,desiredCameraQ){const world=this.camera.getWorldQuaternion(q()).multiply(desiredCameraQ);bone.quaternion.copy(bone.parent.getWorldQuaternion(q()).invert().multiply(world));bone.updateWorldMatrix(false,true);}
  apply(pose){
    const forward=v(0,1,0).applyQuaternion(pose.forearm),normal=v(0,0,1).applyQuaternion(pose.forearm);
    const elbow=pose.wrist.clone().addScaledVector(forward,-this.lowerLength*pose.scale);
    const shoulder=elbow.clone().addScaledVector(pose.upper,this.upperLength*pose.scale);
    this.root.quaternion.identity();this.root.scale.setScalar(pose.scale);this.root.position.copy(shoulder).addScaledVector(this.shoulder,-pose.scale);this.root.updateWorldMatrix(true,true);
    this.orient(this.upper,frame(elbow.clone().sub(shoulder),normal).multiply(this.upperFrame).multiply(this.restUpperQ));
    this.orient(this.lower,pose.forearm.clone().multiply(this.lowerFrame).multiply(this.restLowerQ));
    this.orient(this.hand,pose.hand.clone().multiply(this.handFrame).multiply(this.restHandQ));
    this.applyShape(pose.shape);this.root.updateWorldMatrix(true,true);
    this.current={wrist:pose.wrist.clone(),elbow,shoulder,forearm:forward,normal,shape:{...pose.shape}};
  }
  metrics(){const cameraPoint=bone=>this.camera.worldToLocal(bone.getWorldPosition(v()));return{wrist:cameraPoint(this.hand),elbow:cameraPoint(this.lower),shoulder:cameraPoint(this.upper)};}
}

export class HeroAnimation {
  constructor(arms,camera){this.camera=camera;this.rigs=arms.map((arm,i)=>new ArmRig(arm,i?'R':'L',camera));this.current=null;this.action=null;this.entry=null;this.guard=0;this.sockets={beam:v(),disc:v()};this.reset();}
  neutral(aspect){const x=aspect<1?.42:.67;return[-1,1].map(side=>state(v(side*x,-1.65,-1.35),v(side*.15,1,-.1),v(0,0,1),v(side*.5,-.3,1),'rest',armScale(aspect)));}
  beamPose(aspect){
    const scale=armScale(aspect);
    // A taller camera frustum needs a lower elbow so the shoulder cut stays below
    // the image. Merely squeezing both arms sideways exposes the cut on phones.
    const wristY=-.07-(Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))-Math.tan(THREE.MathUtils.degToRad(57/2)))*2.4+(scale-.68)*1.3;
    const rightWrist=v(aspect<1?.12:.16,wristY,-2.35);
    const right=state(rightWrist,v(0,1,0),v(1,0,0),v(.7,-.9,.55),'blade',scale);
    const elbow=rightWrist.clone().add(v(0,-this.rigs[1].lowerLength*scale,0));
    // The FOREARMS cross: the left forearm passes in front of the right one,
    // with the crossing inside both elbow-to-wrist segments. Both hands are
    // straight blades; the left palm faces the target instead of cupping upward.
    const depth=-2.07,ratio=depth/rightWrist.z;
    const crossing=elbow.clone().lerp(rightWrist,.43);
    const crossPoint=v(crossing.x*ratio,crossing.y*ratio,depth);
    // On narrow screens turn the entire left forearm into depth, keeping the
    // wrist straight and its projected elbow-to-wrist line horizontal.
    const yaw=clamp((1.05-aspect)/.60,0,1)*Math.PI/4;
    const leftDirection=v(Math.cos(yaw),-Math.sin(yaw)*crossPoint.y/crossPoint.z,-Math.sin(yaw)).normalize();
    const leftWrist=crossPoint.clone().addScaledVector(leftDirection,this.rigs[0].lowerLength*scale*.5);
    const left=state(leftWrist,leftDirection,v(0,0,1),v(-.12,-1,Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))),'blade',scale);
    return[left,right];
  }
  shieldPose(aspect){const x=aspect<1?.20:.48;return[-1,1].map(side=>state(v(side*x,-.23,-1.55),v(side*.05,1,-.12),v(0,0,1),v(side*.5,-.2,1),'shield',armScale(aspect)));}
  punchPose(side,aspect,extended){const poses=this.shieldPose(aspect);for(const p of poses)p.shape={fist:1};const i=side==='left'?0:1,sign=i?1:-1;
    poses[i]=state(extended?v(sign*.10,-.24,-2.0):v(sign*(aspect<1?.24:.48),-.65,-1.25),extended?v(sign*-.1,.15,-1):v(sign*.08,1,-.25),extended?v(0,1,0):v(0,0,1),v(sign*.65,-.35,1),'fist',armScale(aspect));
    return poses;
  }
  discPose(aspect,release){const poses=this.neutral(aspect),scale=armScale(aspect);poses[1]=release?state(v(.12,-.25,-2.4),v(-.35,.18,-1),v(0,1,0),v(.65,-.6,1),'blade',scale,v(-.6,.05,-1)):state(v(aspect<1?.23:.55,-.25,-1.95),v(.08,1,-.05),v(0,0,1),v(.5,-.65,1),'disc',scale);return poses;}
  reset(){this.action=null;this.entry=null;this.guard=0;this.current=this.neutral(this.camera.aspect);this.rigs.forEach((r,i)=>{r.restore();r.apply(this.current[i]);});this.updateSockets();}
  update({beam,disc,punch,guard,dt}){
    const aspect=this.camera.aspect,neutral=this.neutral(aspect),active=beam||disc||punch;
    if(active)this.guard=0;
    if(active!==this.action){this.action=active;this.entry=this.current.map(copyPose);}
    let target;
    if(beam){
      const ready=this.beamPose(aspect),t=beam.age;let travel;
      if(t<BEAM_TIMING.ready){travel=t/BEAM_TIMING.ready;target=ready.map((p,i)=>blend(this.entry[i],p,travel));}
      else if(t<BEAM_TIMING.lightEnd)target=ready;
      else{travel=(t-BEAM_TIMING.lightEnd)/(BEAM_TIMING.end-BEAM_TIMING.lightEnd);target=ready.map((p,i)=>blend(p,neutral[i],travel));}
      // The oblique mobile forearm first separates toward the viewer, then
      // lowers. A direct pose blend sweeps it through the other arm on recovery.
      if(travel!==undefined)target[0].wrist.z+=.30*clamp((1.05-aspect)/.60,0,1)*Math.sin(Math.PI*clamp(travel,0,1))**2;
    }
    else if(disc){const held=this.discPose(aspect,false),release=this.discPose(aspect,true),t=disc.age;if(t<DISC_TIMING.ready)target=held.map((p,i)=>blend(this.entry[i],p,t/DISC_TIMING.ready));else if(t<DISC_TIMING.release)target=held.map((p,i)=>blend(p,release[i],(t-DISC_TIMING.ready)/(DISC_TIMING.release-DISC_TIMING.ready)));else target=release.map((p,i)=>blend(p,neutral[i],(t-DISC_TIMING.release)/(DISC_TIMING.end-DISC_TIMING.release)));}
    else if(punch){const chamber=this.punchPose(punch.side,aspect,false),hit=this.punchPose(punch.side,aspect,true),t=punch.age;if(t<.065)target=chamber.map((p,i)=>blend(this.entry[i],p,t/.065));else if(t<.18)target=chamber.map((p,i)=>blend(p,hit[i],(t-.065)/.115));else target=hit.map((p,i)=>blend(p,neutral[i],(t-.18)/.18));}
    else{const shield=this.shieldPose(aspect);this.guard=THREE.MathUtils.damp(this.guard,guard,16,dt);target=neutral.map((p,i)=>blend(p,shield[i],this.guard));}
    this.current=target;this.rigs.forEach((rig,i)=>rig.apply(target[i]));this.updateSockets();return !!active||this.guard>.01;
  }
  updateSockets(){
    const right=this.rigs[1].metrics();this.sockets.beam.copy(right.elbow).lerp(right.wrist,.73).add(v(0,0,-.11));
    this.sockets.disc.copy(right.wrist).addScaledVector(v(0,1,0).applyQuaternion(this.current[1].hand),this.current[1].scale).add(v(0,0,-.07));
  }
  socketWorld(name){this.camera.updateWorldMatrix(true,false);return this.camera.localToWorld(this.sockets[name].clone());}
  beamRail(){const right=this.rigs[1].metrics(),dir=right.wrist.clone().sub(right.elbow).normalize();return[right.elbow.clone().addScaledVector(dir,.10),right.wrist.clone().addScaledVector(dir,.40)].map(p=>this.camera.localToWorld(p.add(v(0,0,-.14))));}
  poseHand(index,preset){const rig=this.rigs[index];rig.applyShape({[preset]:1});rig.root.updateWorldMatrix(true,true);}
  diagnostics(){return this.rigs.map(r=>{const m=r.metrics();return{side:r.side,wrist:m.wrist.toArray(),elbow:m.elbow.toArray(),shoulder:m.shoulder.toArray(),forearmLength:m.wrist.distanceTo(m.elbow),upperLength:m.elbow.distanceTo(m.shoulder),shape:r.current.shape};});}
}
