import * as THREE from 'three';
const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
function handFrame(long,across){const z=long.normalize(),y=z.clone().cross(across).normalize(),x=y.clone().cross(z).normalize();return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));}
/** Full continuous Tiga mesh; retarget the same authored arm and finger poses. */
export class ThirdPersonHero {
  constructor(model,scene){
    this.model=model;this.root=new THREE.Group();this.root.name='ThirdPersonTiga';this.root.add(model);scene.add(this.root);
    const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y,center=box.getCenter(V()),scale=13.5/height;
    model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    this.root.position.set(0,0,20);this.root.rotation.y=Math.PI;this.root.visible=false;this.root.updateMatrixWorld(true);
    this.bones=new Map();this.rest=new Map();model.traverse(n=>{if(n.isBone){this.bones.set(n.name,n);this.rest.set(n,n.quaternion.clone());}if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});
    const tips=model.getObjectByName('TigaBodyRig').userData.bone_tips;this.tips=new Map();
    for(const [name,tail]of Object.entries(tips)){const bone=this.bones.get(name);if(bone)this.tips.set(bone,bone.worldToLocal(model.localToWorld(new THREE.Vector3().fromArray(tail))));}
    this.handCorrection={};
    for(const side of ['L','R']){const hand=this.bones.get('Hand_'+side),long=this.point('Mid1_'+side).sub(hand.getWorldPosition(V())),across=this.point('Index1_'+side).sub(this.point('Pinky1_'+side));this.handCorrection[side]=handFrame(long,across).invert().multiply(hand.getWorldQuaternion(Q()));}
  }
  point(name){return this.bones.get(name).getWorldPosition(V());}
  orient(bone,world){bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(world));bone.updateWorldMatrix(false,true);}
  aim(bone,direction){const origin=bone.getWorldPosition(V()),current=bone.localToWorld(this.tips.get(bone).clone()).sub(origin).normalize();this.orient(bone,Q().setFromUnitVectors(current,direction.normalize()).multiply(bone.getWorldQuaternion(Q())));}
  update(hero,{lean,time,punch,contactTarget,inMelee}){
    for(const [bone,rotation]of this.rest)bone.quaternion.copy(rotation);
    const strike=punch?Math.sin(Math.min(1,punch.age/punch.duration)*Math.PI):0;
    this.root.position.set(lean*4.5,0,20);this.root.rotation.set(0,Math.PI,-lean*.055);this.root.updateMatrixWorld(true);
    const chest=this.bones.get('spineChest');chest.rotation.x+=Math.sin(time*1.5)*.008+(punch?.08:0);this.root.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      const source=hero.rigs[i],side=i?'R':'L';
      this.aim(this.bones.get('UpperArm_'+side),source.lower.getWorldPosition(V()).sub(source.upper.getWorldPosition(V())));
      this.aim(this.bones.get('LowerArm_'+side),source.hand.getWorldPosition(V()).sub(source.lower.getWorldPosition(V())));
      const hand=this.bones.get('Hand_'+side),long=source.nodes['Mid1_'+side].getWorldPosition(V()).sub(source.hand.getWorldPosition(V())),across=source.nodes['Index1_'+side].getWorldPosition(V()).sub(source.nodes['Pinky1_'+side].getWorldPosition(V()));
      this.orient(hand,handFrame(long,across).multiply(this.handCorrection[side]));
      for(const finger of ['Index','Mid','Ring','Pinky','Thumb'])for(let joint=1;joint<=3;joint++){
        const name=finger+joint+'_'+side,bone=this.bones.get(name),start=source.nodes[name].getWorldPosition(V()),end=joint<3?source.nodes[finger+(joint+1)+'_'+side].getWorldPosition(V()):source.root.localToWorld(source.liveTip(finger));
        this.aim(bone,end.sub(start));
      }
    }
    if(punch&&inMelee&&contactTarget){
      // The first-person range is deliberately generous. Step the complete
      // character in for contact instead of stretching its skin or punching air.
      const fist=this.point('Hand_'+(punch.side==='left'?'L':'R'));
      this.root.position.z-=Math.max(0,Math.min(13,fist.z-contactTarget.z))*strike;
      this.root.position.x+=(contactTarget.x-fist.x)*strike*.7;
      const side=punch.side==='left'?'R':'L';this.bones.get('Thigh_'+side).rotation.x+=strike*.35;this.bones.get('Shin_'+side).rotation.x-=strike*.3;
    }
    this.root.updateMatrixWorld(true);
  }
  beamRail(){return [this.point('LowerArm_R'),this.point('Hand_R')];}
  socketWorld(kind,hero){if(kind==='beam'||kind==='zepellion'){const [bottom,top]=this.beamRail();return bottom.lerp(top,.6);}const side=(kind==='disc'?hero.discSide:hero.palmSide)==='left'?'L':'R',finger=this.bones.get('Mid3_'+side);return finger.localToWorld(this.tips.get(finger).clone()).lerp(this.point('Hand_'+side),kind==='disc'?.1:.45);}
}
