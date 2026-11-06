import * as THREE from 'three';
import {BEAM_TIMING,DISC_TIMING} from './action-timing.js';
import {ViewmodelLens} from './viewmodel-lens.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const q=()=>new THREE.Quaternion();
const clamp=THREE.MathUtils.clamp;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const fingers=['Index','Mid','Ring','Pinky'];
const shapes=['rest','fist','blade','shield','disc'];

function frame(forward,normal){
  const y=forward.clone().normalize();
  let z=normal.clone().addScaledVector(y,-normal.dot(y));
  if(z.lengthSq()<.001){const alternate=Math.abs(y.z)<.85?v(0,0,1):v(1,0,0);z=alternate.clone().addScaledVector(y,-alternate.dot(y));}
  z.normalize();const x=y.clone().cross(z).normalize();z=x.clone().cross(y).normalize();
  return q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
function state(upper,forearm,normal,preset,handForward=forearm){
  return {upper:upper.normalize(),forearm:frame(forearm,normal),hand:frame(handForward,normal),shape:{[preset]:1}};
}
function copyPose(p){return{forearm:p.forearm.clone(),hand:p.hand.clone(),upper:p.upper.clone(),shift:p.shift?.clone()||v(),upperRoll:p.upperRoll||0,forearmScale:p.forearmScale||1,shape:{...p.shape}};}
function blend(a,b,t){t=ease(t);const shape={};for(const n of shapes)shape[n]=(a.shape[n]||0)*(1-t)+(b.shape[n]||0)*t;
  const swing=q().setFromUnitVectors(a.upper,b.upper);
  const shift=a.shift?.clone()||v(),destination=b.shift||v();
  const retracting=shift.lengthSq()>destination.lengthSq();
  shift.lerp(destination,retracting?Math.min(1,t*3):t);
  return {forearm:a.forearm.clone().slerp(b.forearm,t),hand:a.hand.clone().slerp(b.hand,t),upper:a.upper.clone().applyQuaternion(q().slerp(swing,t)),shift,upperRoll:THREE.MathUtils.lerp(a.upperRoll||0,b.upperRoll||0,t),forearmScale:THREE.MathUtils.lerp(a.forearmScale||1,b.forearmScale||1,t),shape};
}

class ArmRig {
  constructor(root,side,camera){
    this.root=root;this.side=side;this.camera=camera;this.nodes={};this.rest=new Map();this.presets={};
    root.updateWorldMatrix(true,true);
    root.traverse(o=>{if(o.isBone){this.nodes[o.name]=o;this.rest.set(o,o.quaternion.clone());}});
    const suffix='_'+side;this.upper=this.nodes['UpperArm'+suffix];this.lower=this.nodes['LowerArm'+suffix];this.hand=this.nodes['Hand'+suffix];this.handRestPosition=this.hand.position.clone();
    const rootInv=root.getWorldQuaternion(q()).invert();
    this.restUpperQ=rootInv.clone().multiply(this.upper.getWorldQuaternion(q()));
    this.restLowerQ=rootInv.clone().multiply(this.lower.getWorldQuaternion(q()));
    this.restHandQ=rootInv.clone().multiply(this.hand.getWorldQuaternion(q()));
    this.shoulder=this.point(this.upper);this.elbow=this.point(this.lower);this.wrist=this.point(this.hand);
    this.upperLength=this.shoulder.distanceTo(this.elbow);this.lowerLength=this.elbow.distanceTo(this.wrist);
    // The legacy GLB has the same mesh but no eye-to-shoulder extras.
    this.eyeOffset=v().fromArray(root.userData.eye_to_shoulder??[side==='L'?-.80965:.80965,-.78857,.65208]);
    this.mount=v();
    // Every vertex of the sleeve cut is bound to the upper arm. Its distance
    // from the shoulder therefore bounds the cut at every arm orientation.
    this.cutRadius=0;
    root.updateMatrixWorld(true);
    root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh||!mesh.material.name.includes('lining'))return;
      mesh.skeleton.update();
      for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        const point=root.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i,v())));
        this.cutRadius=Math.max(this.cutRadius,point.distanceTo(this.shoulder));
      }
    });
    const across=this.point(this.nodes['Index1'+suffix]).sub(this.point(this.nodes['Pinky1'+suffix])).normalize().multiplyScalar(side==='L'?1:-1);
    this.long=this.tip('Mid').sub(this.point(this.nodes['Mid1'+suffix])).normalize();
    this.normal=across.clone().cross(this.long).normalize();this.across=this.long.clone().cross(this.normal).normalize();
    this.upperFrame=frame(this.elbow.clone().sub(this.shoulder),this.normal).invert();
    this.lowerFrame=frame(this.wrist.clone().sub(this.elbow),this.normal).invert();
    this.handFrame=frame(this.long,this.normal).invert();
    // The bind fingers angle slightly away from the wrist-to-knuckle axis.
    // Use the knuckle plane itself when a pose calls for an oriented palm.
    this.palmLong=this.point(this.nodes['Mid1'+suffix]).sub(this.wrist).normalize();
    const palmNormal=across.clone().cross(this.palmLong).normalize();
    this.palmAcross=this.palmLong.clone().cross(palmNormal).normalize();
    this.palmAlignment=frame(this.palmLong,palmNormal).invert().multiply(frame(this.long,this.normal));
    this.tipLocal={};
    for(const finger of [...fingers,'Thumb']){const bone=this.nodes[finger+'3'+suffix];const rootTip=this.tip(finger);this.tipLocal[finger]=bone.worldToLocal(root.localToWorld(rootTip));}
    this.fingerNodes=[...fingers,'Thumb'].flatMap(f=>[1,2,3].map(j=>this.nodes[f+j+suffix]));
    this.forearmMeshes=[];
    if(side==='L')root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      const boneIndex=mesh.skeleton.bones.indexOf(this.lower),g=mesh.geometry,indices=g.attributes.skinIndex,skin=g.attributes.skinWeight;
      if(boneIndex<0)return;
      const weights=new Float32Array(g.attributes.position.count),components=['getX','getY','getZ','getW'];
      for(let i=0;i<weights.length;i++)for(const component of components)if(indices[component](i)===boneIndex)weights[i]+=skin[component](i);
      if(!weights.some(w=>w>0))return;
      mesh.geometry=g.clone();const positions=new Float32Array(weights.length*3),normals=new Float32Array(weights.length*3);
      for(let i=0;i<weights.length;i++)for(let j=0;j<3;j++){positions[i*3+j]=g.attributes.position[components[j]](i);normals[i*3+j]=g.attributes.normal[components[j]](i);}
      mesh.geometry.setAttribute('position',new THREE.BufferAttribute(positions.slice(),3));mesh.geometry.setAttribute('normal',new THREE.BufferAttribute(normals.slice(),3));
      const toGeometry=mesh.bindMatrix.clone().invert();
      const elbow=v().setFromMatrixPosition(mesh.skeleton.boneInverses[boneIndex].clone().invert()).applyMatrix4(toGeometry);
      const axis=v().setFromMatrixPosition(mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(this.hand)].clone().invert()).applyMatrix4(toGeometry).sub(elbow).normalize();
      this.forearmMeshes.push({mesh,positions,normals,weights,elbow,axis});
    });
    this.forearmScale=1;
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
      const fingerAxis=preset==='blade'?this.palmLong:this.long;
      const span=preset==='blade'?this.palmAcross:this.across;
      const bases=fingers.map(f=>this.point(this.nodes[f+'1'+suffix])),center=bases.reduce((sum,p)=>sum+p.dot(span),0)/4;
      for(const [i,finger]of fingers.entries()){
        const convergence=preset==='blade'?.36:preset==='fist'?.18:0;
        const length=bases[i].distanceTo(this.tip(finger));
        const direction=fingerAxis.clone().addScaledVector(span,(center-bases[i].dot(span))*convergence/length).normalize();
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
  fitForearm(scale){
    if(Math.abs(scale-this.forearmScale)<1e-7)return;
    this.forearmScale=scale;
    for(const {mesh,positions,normals,weights,elbow,axis}of this.forearmMeshes){
      const target=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
      for(let i=0;i<weights.length;i++){
        const j=i*3,along=(positions[j]-elbow.x)*axis.x+(positions[j+1]-elbow.y)*axis.y+(positions[j+2]-elbow.z)*axis.z;
        const extension=along*(scale-1)*weights[i];
        target.setXYZ(i,positions[j]+axis.x*extension,positions[j+1]+axis.y*extension,positions[j+2]+axis.z*extension);
        const tilt=(normals[j]*axis.x+normals[j+1]*axis.y+normals[j+2]*axis.z)*(1-1/scale)*weights[i];
        const x=normals[j]-axis.x*tilt,y=normals[j+1]-axis.y*tilt,z=normals[j+2]-axis.z*tilt,length=Math.hypot(x,y,z)||1;
        normal.setXYZ(i,x/length,y/length,z/length);
      }
      target.needsUpdate=true;normal.needsUpdate=true;mesh.boundingSphere=null;mesh.boundingBox=null;
    }
  }
  apply(pose){
    const scale=pose.forearmScale||1;this.fitForearm(scale);this.hand.position.copy(this.handRestPosition).multiplyScalar(scale);
    const forward=v(0,1,0).applyQuaternion(pose.forearm),normal=v(0,0,1).applyQuaternion(pose.forearm);
    const mount=this.mount.clone().add(pose.shift||v());
    const elbow=mount.clone().addScaledVector(pose.upper,this.upperLength);
    const wrist=elbow.clone().addScaledVector(forward,this.lowerLength*scale);
    this.root.quaternion.identity();this.root.scale.setScalar(1);this.root.position.copy(mount).sub(this.shoulder);this.root.updateWorldMatrix(true,true);
    const upperRotation=frame(pose.upper,normal).multiply(this.upperFrame).multiply(this.restUpperQ);
    this.orient(this.upper,q().setFromAxisAngle(pose.upper,pose.upperRoll||0).multiply(upperRotation));
    this.orient(this.lower,pose.forearm.clone().multiply(this.lowerFrame).multiply(this.restLowerQ));
    this.orient(this.hand,pose.hand.clone().multiply(this.handFrame).multiply(this.restHandQ));
    this.applyShape(pose.shape);this.root.updateWorldMatrix(true,true);
    this.current={wrist,elbow,shoulder:mount,forearm:forward,normal,forearmScale:scale,shape:{...pose.shape}};
  }
  metrics(){const cameraPoint=bone=>this.camera.worldToLocal(bone.getWorldPosition(v()));return{wrist:cameraPoint(this.hand),elbow:cameraPoint(this.lower),shoulder:cameraPoint(this.upper)};}
}

export class HeroAnimation {
  constructor(arms,camera){
    this.camera=camera;
    this.rigs=arms.map((arm,index)=>new ArmRig(arm,index?'R':'L',camera));
    this.lens=new ViewmodelLens(camera,arms);
    this.sockets={beam:v(),disc:v(),palm:v()};
    this.reset();
  }

  prepareLayout(){
    const {aspect,fov}=this.camera;
    if(aspect===this.aspect&&fov===this.fov)return;
    this.aspect=aspect;
    this.fov=fov;
    this.narrow=clamp((1.4-aspect)/.94,0,1);
    this.lens.resize(aspect);

    // The eye midpoint and shoulder span come from Tiga's rest mesh. Turn the
    // torso slightly into the stance and allow framing space in front of the
    // eyes. The beam fits its horizontal arm after the initial gather.
    const stance=THREE.MathUtils.degToRad(10);
    const vertical=Math.tan(THREE.MathUtils.degToRad(this.lens.camera.fov/2));
    const horizontal=vertical*aspect;
    let framingDepth=THREE.MathUtils.lerp(1.36,1.68,this.narrow);
    // Fit the eye frame to the actual mesh. Place each cut wholly beyond a
    // side or the bottom plane, including its full radius and a small margin.
    for(const rig of this.rigs){
      const eye=rig.eyeOffset;
      rig.mount.set(eye.x*Math.cos(stance),eye.y,eye.z+eye.x*Math.sin(stance));
      const radius=rig.cutRadius+.012;
      const sideDepth=(Math.abs(rig.mount.x)-radius*Math.hypot(1,horizontal))/horizontal;
      const lowerDepth=(-rig.mount.y-radius*Math.hypot(1,vertical))/vertical;
      framingDepth=Math.min(framingDepth,rig.mount.z+Math.max(sideDepth,lowerDepth));
    }
    for(const rig of this.rigs)rig.mount.z-=framingDepth;

    this.neutral=[-1,1].map(sign=>state(v(sign*.74,-.64,-.20),v(sign*.62,.65,-.43),v(0,0,1),'rest'));
    this.shield=[-1,1].map(sign=>state(v(-sign*.4,-.6,-1),v(-sign*.9,.9,-.10),v(0,0,1),'fist'));
    this.boxing=[-1,1].map(sign=>state(v(sign*.62,-.35,-.70),v(-sign*.60,.92,-.35),v(0,0,1),'fist'));
    this.beamUp=null;
    this.syncBeamPose();
    this.discHeld=this.discPose(false);
    this.discRelease=this.discPose(true);
  }

  syncBeamPose(){
    const worldUp=v(0,1,0).applyQuaternion(this.camera.getWorldQuaternion(q()).invert());
    if(this.beamUp&&this.beamUp.distanceToSquared(worldUp)<1e-10)return;
    this.beamUp=worldUp;
    this.beamBase=this.beamPose(worldUp,0);
    this.beam=this.beamPose(worldUp);
  }

  beamPose(up,lead=1){
    const [left,right]=this.rigs;
    const responsive=clamp((this.aspect-1.2)/.3,0,1);
    const shoulderShift=v(0,THREE.MathUtils.lerp(.25,.08,this.narrow),-THREE.MathUtils.lerp(.2,.04,this.narrow)).multiplyScalar(lead*(1-clamp((this.aspect-.9)/.3,0,1)));
    const leftMount=left.mount.clone().add(shoulderShift);
    const mix=(wide,narrow)=>THREE.MathUtils.lerp(wide,narrow,this.narrow);
    const side=v(1,0,0).addScaledVector(up,-up.x).normalize();
    const forward=up.clone().cross(side).normalize();
    const elbowHeight=mix(-.97,-.89);
    // Keep the elbow open in the eye frame as the player leans. The wrist
    // still follows gravity, independently of the camera's pitch and roll.
    const lateral=(mix(.49,.245)-up.x*elbowHeight)/side.x;
    const dx=lateral-right.mount.dot(side);
    const dy=elbowHeight-right.mount.dot(up);
    const reach=Math.sqrt(Math.max(0,right.upperLength**2-dx**2-dy**2));
    const elbow=right.mount.clone().addScaledVector(side,dx).addScaledVector(up,dy).addScaledVector(forward,reach);
    // Follow the left shoulder's change of elevation when the torso rolls.
    const shoulderRise=(left.mount.x-right.mount.x)*up.x;
    const nearCross=elbow.clone().addScaledVector(up,right.lowerLength*mix(.38,.53)+shoulderRise);

    // The horizontal forearm passes on the monster side of the right one.
    // Both centerlines project through one crossing, with room for the skin.
    const separation=mix(.33,.41)-.06*lead*responsive;
    const farCross=nearCross.clone().multiplyScalar(1+separation/-nearCross.z);
    const offset=farCross.clone().sub(leftMount);
    // Back-project the horizontal stroke of the cross into a plane through
    // the eye. Perspective now keeps it square to the physically upright arm.
    const projectedUp=v(up.x-elbow.x/elbow.z*up.z,up.y-elbow.y/elbow.z*up.z).normalize();
    const stroke=v(projectedUp.y,-projectedUp.x);
    const plane=v(projectedUp.x,projectedUp.y,-projectedUp.dot(farCross)/farCross.z).normalize();
    const intoDepth=plane.clone().cross(stroke).normalize();
    const height=offset.dot(plane);
    const planar=offset.clone().addScaledVector(plane,-height);
    const distance=planar.length();
    const radius=Math.sqrt(Math.max(0,left.upperLength**2-height**2));
    const bearing=Math.atan2(planar.dot(intoDepth),planar.dot(stroke));
    // Select a reachable line through the crossing on the upper-arm sphere.
    const limit=Math.max(left.lowerLength*.72,distance-radius+.002);
    const tangent=Math.sqrt(Math.max(0,distance**2-radius**2));
    const halfAngle=limit<tangent
      ?Math.acos(clamp((distance**2+limit**2-radius**2)/(2*distance*limit),-1,1))
      :Math.asin(clamp(radius/distance,0,1));
    const yaw=clamp(THREE.MathUtils.degToRad(mix(12,36)),bearing-halfAngle,bearing+halfAngle);
    const across=stroke.multiplyScalar(Math.cos(yaw)).addScaledVector(intoDepth,Math.sin(yaw)).normalize();
    const along=planar.dot(across);
    const toCross=along-Math.sqrt(Math.max(0,radius**2-distance**2+along**2));
    const leftElbow=farCross.clone().addScaledVector(across,-toCross);
    const handAcross=across.clone().addScaledVector(up,-across.dot(up)).normalize();
    const horizontal=state(leftElbow.clone().sub(leftMount),across,up,'blade',handAcross);
    horizontal.shift=shoulderShift;
    const upright=state(elbow.sub(right.mount),up,side,'blade');
    horizontal.hand.multiply(left.palmAlignment);
    upright.hand.multiply(right.palmAlignment);
    // Fit the elbow and wrist to the illustrated first-person silhouette.
    // Compensate sleeve length along the forearm axis and preserve hand size.
    const wide=lead*clamp((this.aspect-1.2)/.3,0,1);
    if(wide===0)return [horizontal,upright];
    const mount=left.mount.clone().add(shoulderShift.clone().lerp(v(0,-.15*lead,0),responsive));
    const viewTangent=Math.tan(THREE.MathUtils.degToRad(this.lens.camera.fov/2));
    const targetX=.5-.388/this.aspect;
    const x=THREE.MathUtils.lerp(leftElbow.x/-leftElbow.z,(targetX*2-1)*viewTangent*this.aspect,wide);
    // Lower the elbow slightly to level the tapered sleeve outline.
    const ray=v(x,(plane.z-plane.x*x)/plane.y-.052*viewTangent*wide,-1);
    const projection=ray.dot(mount),discriminant=projection**2-ray.lengthSq()*(mount.lengthSq()-left.upperLength**2);
    if(discriminant<=0)return [horizontal,upright];
    const depth=(projection+Math.sqrt(Math.max(0,discriminant)))/ray.lengthSq();
    const elbowTarget=ray.multiplyScalar(depth),direction=farCross.clone().sub(elbowTarget).normalize();
    const oldWrist=leftElbow.clone().addScaledVector(across,left.lowerLength);
    const wristSlope=THREE.MathUtils.lerp(oldWrist.x/-oldWrist.z,.6156*viewTangent,wide);
    const length=(-wristSlope*elbowTarget.z-elbowTarget.x)/(direction.x+wristSlope*direction.z);
    const palmDirection=direction.clone().addScaledVector(up,-direction.dot(up)).normalize();
    const fitted=state(elbowTarget.clone().sub(mount),direction,up,'blade',palmDirection);
    fitted.hand.multiply(left.palmAlignment);fitted.shift=mount.sub(left.mount);
    fitted.upperRoll=THREE.MathUtils.degToRad(70)*wide;
    fitted.forearmScale=length/left.lowerLength;
    return [fitted,upright];
  }

  punchPose(side,extended){
    const poses=this.boxing.map(copyPose);
    for(const pose of poses)pose.shape={fist:1};
    const index=side==='left'?0:1,sign=index?1:-1;
    poses[index]=extended
      ?state(v(-sign*.26,.18,-1),v(-sign*.32,.12,-1),v(0,1,0),'fist')
      :state(v(sign*.35,-.49,-.80),v(-sign*.40,.88,-.23),v(0,0,1),'fist');
    return poses;
  }

  discPose(release){
    const poses=this.neutral.map(copyPose);
    poses[1]=release
      ?state(v(-.24,.16,-1),v(-.40,.16,-1),v(0,1,0),'blade',v(-.62,.07,-1))
      :state(v(.35-.22*this.narrow,-.34,-.90),v(-.18-.15*this.narrow,.90,-.33),v(0,0,1),'disc');
    return poses;
  }

  reset(){
    this.prepareLayout();
    this.action=null;this.recover=null;
    this.entry=null;
    this.guard=0;
    this.current=this.neutral.map(copyPose);
    this.rigs.forEach((rig,index)=>{rig.restore();rig.apply(this.current[index]);});
    this.updateSockets();
  }

  update({beam,disc,palm,punch,guard,dt}){
    this.prepareLayout();
    const active=beam||disc||palm||punch;
    if(active)this.guard=0;
    if(active!==this.action){
      if(!active&&this.action&&this.action.age<this.action.duration-.03)this.recover={poses:this.current.map(copyPose),age:0};
      if(active)this.recover=null;
      this.action=active;
      this.entry=this.current.map(copyPose);
    }
    let target;
    if(beam){
      this.syncBeamPose();
      const t=beam.age;
      if(t<BEAM_TIMING.ready){
        const phase=t/BEAM_TIMING.ready;
        target=[blend(this.entry[0],this.beamBase[0],(phase-.15)/.85),blend(this.entry[1],this.beamBase[1],phase/.76)];
      }else if(t<BEAM_TIMING.lightEnd){
        const lead=clamp((t-BEAM_TIMING.ready)/.12,0,1);
        target=lead<1?this.beamPose(this.beamUp,lead):this.beam;
      }else{
        const phase=(t-BEAM_TIMING.lightEnd)/(BEAM_TIMING.end-BEAM_TIMING.lightEnd);
        target=[blend(this.beam[0],this.neutral[0],phase/.85),blend(this.beam[1],this.neutral[1],(phase-.24)/.76)];
      }
    }else if(palm){
      const poses=this.neutral.map(copyPose);
      poses[1]=state(v(-.26,.18,-1),v(-.22,.12,-1),v(0,0,1),'shield');
      target=poses.map((pose,i)=>palm.age<.18?blend(this.entry[i],pose,palm.age/.18):blend(pose,this.neutral[i],(palm.age-.36)/.36));
    }else if(disc){
      const t=disc.age;
      if(t<DISC_TIMING.ready)target=this.discHeld.map((p,i)=>blend(this.entry[i],p,t/DISC_TIMING.ready));
      else if(t<DISC_TIMING.release)target=this.discRelease.map((p,i)=>blend(this.discHeld[i],p,(t-DISC_TIMING.ready)/(DISC_TIMING.release-DISC_TIMING.ready)));
      else target=this.neutral.map((p,i)=>blend(this.discRelease[i],p,(t-DISC_TIMING.release)/(DISC_TIMING.end-DISC_TIMING.release)));
    }else if(punch){
      const chamber=this.punchPose(punch.side,false).map((pose,i)=>{
        const gathered=blend(this.entry[i],pose,.40);
        gathered.shape={fist:1};
        return gathered;
      });
      const hit=this.punchPose(punch.side,true),t=punch.age;
      if(t<.05)target=chamber.map((p,i)=>blend(this.entry[i],p,t/.05));
      else if(t<.18)target=hit.map((p,i)=>blend(chamber[i],p,(t-.05)/.13));
      else target=this.neutral.map((p,i)=>blend(hit[i],p,(t-.18)/.18));
    }else{
      this.guard=THREE.MathUtils.damp(this.guard,guard,9,dt);
      target=this.shield.map((p,i)=>blend(this.neutral[i],p,this.guard));
      if(this.recover){this.recover.age+=dt;target=target.map((pose,i)=>blend(this.recover.poses[i],pose,this.recover.age/.24));if(this.recover.age>=.24)this.recover=null;}
    }
    this.current=target;
    this.rigs.forEach((rig,index)=>rig.apply(target[index]));
    this.updateSockets();
    return !!active||!!this.recover||this.guard>.01;
  }

  updateSockets(){
    const rig=this.rigs[1],right=rig.metrics();
    this.sockets.palm.copy(right.wrist).add(v(0,0,-.14));
    this.sockets.beam.copy(right.elbow).lerp(right.wrist,.73).add(v(0,0,-.18));
    const tip=rig.nodes.Mid3_R.localToWorld(rig.tipLocal.Mid.clone());
    const forward=v(0,1,0).applyQuaternion(this.current[1].hand);
    this.sockets.disc.copy(this.camera.worldToLocal(tip)).addScaledVector(forward,this.aspect<1?.28:.35).add(v(0,0,-.04));
  }

  socketWorld(name){return this.lens.effectPoint(this.sockets[name]);}
  beamRail(){
    const right=this.rigs[1].metrics(),axis=right.wrist.clone().sub(right.elbow).normalize();
    return [right.elbow.clone().addScaledVector(axis,.14),right.wrist.clone().addScaledVector(axis,.54)].map(point=>this.lens.effectPoint(point.add(v(0,0,-.18))));
  }
  poseHand(index,preset){const rig=this.rigs[index];rig.applyShape({[preset]:1});rig.root.updateWorldMatrix(true,true);}
  diagnostics(){return this.rigs.map(r=>{const m=r.metrics();return{side:r.side,wrist:m.wrist.toArray(),elbow:m.elbow.toArray(),shoulder:m.shoulder.toArray(),forearmLength:m.wrist.distanceTo(m.elbow),upperLength:m.elbow.distanceTo(m.shoulder),forearmScale:r.current.forearmScale,shape:r.current.shape};});}
}
