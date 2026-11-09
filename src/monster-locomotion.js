import * as THREE from 'three';
import {gaitSample,locomotionFor,approachProgress} from './locomotion.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion();
const clamp=t=>THREE.MathUtils.clamp(t,0,1),ease=t=>{t=clamp(t);return t*t*(3-2*t);};
/** Distance-driven gait with two-bone IK. Grounded feet oppose body travel. */
export class MonsterLocomotion {
 constructor(motion){this.motion=motion;this.root=motion.root;this.profile=locomotionFor(motion.type);this.legs={};this.lastTargets=null;this.lastAttack=null;this.finish=null;this.stepEvent=null;
  this.anchors=[];this.root.traverse(b=>{if(b.isBone&&!b.parent?.isBone)this.anchors.push({bone:b,position:b.position.clone()});});
  const root=this.root;root.updateWorldMatrix(true,true);const inv=root.getWorldQuaternion(Q()).invert();
  for(const side of ['L','R']){
   const rig=motion.rig;const hip=motion.type==='redking'?motion.node('leg.'+side):rig.thigh[side],knee=motion.type==='redking'?motion.node('knee.'+side):rig.shin[side];let ankle=motion.type==='redking'?motion.node('foot.'+side):rig.foot[side];
   if(!hip||!knee||!ankle)continue;
   if(ankle.parent?.isBone&&/足首-/.test(ankle.parent.name))ankle=ankle.parent;
   const h=hip.getWorldPosition(V()),k=knee.getWorldPosition(V()),f=ankle.getWorldPosition(V());
   this.legs[side]={hip,knee,ankle,upper:h.distanceTo(k),lower:k.distanceTo(f),height:h.y-f.y,lateral:h.x-f.x,longitudinal:h.z-f.z,rest:root.worldToLocal(f.clone()),floor:f.y,rotation:inv.clone().multiply(ankle.getWorldQuaternion(Q()))};
  }
  this.tentacles=[];
  for(const side of ['L','R']){const start=motion.node('腕5.'+side),end=motion.node('手首2.'+side),chain=[];for(let node=end;node?.isBone;node=node.parent){chain.push(node);if(node===start)break;}if(start&&chain.at(-1)===start)this.tentacles.push({side,chain:chain.reverse()});}
  const legs=Object.values(this.legs);this.length=legs.length?Math.min(...legs.map(l=>l.upper+l.lower)):4;
  this.swayX=legs.length===2?Math.abs(legs[0].rest.x-legs[1].rest.x)*this.root.getWorldScale(V()).x*(this.profile.mode==='run'?.07:this.profile.mode==='march'?.06:.13):0;
  this.drop=this.length*this.profile.drop;this.lift=this.length*this.profile.lift;
  const reach=legs.length?Math.min(...legs.map(l=>{const length=l.upper+l.lower,h=l.height-this.drop+this.length*(this.profile.bob+.01);return Math.max(.05,Math.sqrt(Math.max(.01,(length*.99)**2-h*h-(Math.abs(l.lateral)+this.swayX)**2))-Math.abs(l.longitudinal));})):1;
  this.stride=Math.max(.25,Math.min(this.length*this.profile.stride,reach/this.profile.duty*.9));
  if(motion.tail.length){const a=motion.tail[0].getWorldPosition(V()),b=motion.tail.at(-1).getWorldPosition(V());this.tailZ=root.worldToLocal(b).z-root.worldToLocal(a).z;}
 }
 flatFoot(leg){const world=this.root.getWorldQuaternion(Q()).multiply(leg.rotation);leg.ankle.quaternion.copy(leg.ankle.parent.getWorldQuaternion(Q()).invert().multiply(world));leg.ankle.updateWorldMatrix(false,true);}
 solve(leg,target){
  const m=this.motion,hip=leg.hip.getWorldPosition(V()),delta=target.clone().sub(hip),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(leg.upper-leg.lower)+.001,(leg.upper+leg.lower)*.995),axis=delta.normalize();
  const forward=V(0,0,1).applyQuaternion(this.root.getWorldQuaternion(Q())),bend=forward.addScaledVector(axis,-forward.dot(axis)).normalize();
  const along=(leg.upper**2+distance**2-leg.lower**2)/(2*distance),height=Math.sqrt(Math.max(0,leg.upper**2-along**2));
  const knee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,height),end=hip.clone().addScaledVector(axis,distance),inv=this.root.getWorldQuaternion(Q()).invert();
  m.aim(leg.hip.name,leg.knee.name,knee.clone().sub(hip).applyQuaternion(inv));
  m.aim(leg.knee.name,leg.ankle.name,end.sub(knee).applyQuaternion(inv));this.flatFoot(leg);
 }
 restTarget(leg){const p=this.root.localToWorld(leg.rest.clone());p.y=leg.floor;return p;}
 restore(){for(const {bone,position}of this.anchors)bone.position.copy(position);this.root.updateWorldMatrix(true,true);}
 body(weight,phase=0,blend=1,swayOverride){
  const p=this.profile,m=this.motion,bounce=(.5-.5*Math.cos(phase*Math.PI*4))*(p.mode==='run'?1:-1),shift=-this.drop*weight+bounce*this.length*p.bob*blend*weight;
  const shiftX=swayOverride??Math.cos(phase*Math.PI*2)*this.swayX*blend*weight;this.bodySway=shiftX;
  for(const {bone,position}of this.anchors){const inv=bone.parent.matrixWorld.clone().invert(),delta=V(shiftX,shift,0).applyMatrix4(inv).sub(V().applyMatrix4(inv));bone.position.copy(position).add(delta);}
  this.root.updateWorldMatrix(true,true);
  const chest=m.type==='redking'?m.node('upperbody1'):m.rig.chest,neck=m.type==='redking'?m.node('neck'):m.rig.neck;
  const yaw=Math.sin(phase*Math.PI*2)*p.sway*blend*weight;
  if(chest){m.turn(chest.name,V(0,1,0),yaw);m.turn(chest.name,V(0,0,1),yaw*.4);}
  if(neck)m.turn(neck.name,V(0,1,0),-yaw*.7);
  if(m.tail.length){const rise=Math.abs(this.tailZ||0)>1?Math.atan(this.drop*weight/Math.abs(this.tailZ))*(this.tailZ<0?1:-1):0;m.tail.forEach((bone,i)=>{m.turn(bone.name,V(0,1,0),Math.sin(phase*Math.PI*2-i*.35)*.018*weight);if(i===0)m.turn(bone.name,V(1,0,0),rise);});}
 }
 arms(samples,blend=1,swingBlend=blend){const m=this.motion,p=this.profile;
  for(const side of ['L','R']){const sign=side==='L'?1:-1,s=samples?.[side],swing=s?-s.forward/(this.stride*p.duty)*p.armSwing*swingBlend:0;let upper=V(sign*.16,-1,swing),lower=V(-sign*.06,-.85,.2+swing*.4);
   if(p.arms==='reptile'){upper=V(sign*.4,-.82,.24+swing);lower=V(-sign*.1,.25,.9-swing*.4);}
   if(p.arms==='heavy'){upper=V(sign*.28,-.98,swing*.1);lower=V(sign*.1,-.9,.16);}
   if(p.arms==='composed'){upper=V(sign*.12,-.9,-.26);lower=V(-sign*.12,-.65,-.55);}
   if(p.arms==='guard'||p.arms==='runner'){upper=V(sign*.25,-.65,swing-.1);lower=V(-sign*.12,.5,.65);}
   if(p.arms==='tentacles'){upper=V(sign*.6,-.7,.22+swing);lower=V(sign*.25,-.85,.35-swing*.4);}
   if(p.arms==='claws'){upper=V(sign*.35,-.25,.75);lower=V(-sign*.1,.3,.9);}
   const baseUpper=m.type==='redking'?V(sign*.45,-.75,.45):V(sign*.3,-1,.06),baseLower=m.type==='redking'?V(-sign*.1,.35,1):V(sign*.14,-1,.12);upper=baseUpper.lerp(upper,blend);lower=baseLower.lerp(lower,blend);
   if(m.type==='redking'){m.aim('upperarm.'+side,'forearm.'+side,upper);m.aim('forearm.'+side,'hand.'+side,lower);}else m.aimLimb(side,upper,lower,.5);
  }
  if(p.arms==='tentacles')for(const {side,chain}of this.tentacles){const sign=side==='L'?1:-1,s=samples?.[side],swing=s?-s.forward/(this.stride*p.duty)*p.armSwing*swingBlend:0;for(let i=0;i<chain.length-1;i++){const target=i<(chain.length-1)/2?V(sign*.8,-.65,-swing*.8):V(sign*.35,-.85,.3-swing*.5);m.aim(chain[i].name,chain[i+1].name,V(sign*.3,-1,.06).lerp(target,blend));}}
 }
 update(active,{current,fade,recovery,time,enemyDistance}){
  const p=this.profile;this.stepEvent=null;
  if(this.lastAttack!==active&&current){this.lastAttack=active;this.lastTargets=null;this.lastSamples=null;this.finish=null;}
  if(p.mode==='blink'){this.arms(null,current?(active.phase==='windup'?ease(active.age/Math.max(.001,active.windup)):1):fade);return;}
  if(p.mode==='hover'){
   const phase=(active.phase==='windup'?active.age:active.windup+active.age)/Math.max(.1,active.flight),m=this.motion;
   const chest=m.rig.chest;if(chest)m.turn(chest.name,V(0,0,1),Math.sin(phase*Math.PI*6)*p.sway*fade);
   return;
  }
  const legs=Object.values(this.legs);if(legs.length!==2){this.arms(null);return;}
  if(!current&&this.lastTargets){
   if(!this.finish){const airborne=['L','R'].find(s=>!this.lastTargets[s].planted)||'L';this.finish={first:airborne,sway:this.bodySway||0,start:{L:this.lastTargets.L.point.clone(),R:this.lastTargets.R.point.clone()},end:{L:this.restTarget(this.legs.L),R:this.restTarget(this.legs.R)}};}
   const t=ease(recovery);this.body(1-t,0,0,this.finish.sway*(1-t));this.arms(this.lastSamples,1-t,1-t);
   for(const side of ['L','R']){const first=side===this.finish.first,part=clamp(first?t*2:(t-.5)*2),point=this.finish.start[side].clone().lerp(this.finish.end[side],ease(part));point.y+=Math.sin(Math.PI*part)*this.lift*.35;this.solve(this.legs[side],point);}
   return;
  }
  if(active.phase==='windup'){this.body(ease(active.age/Math.max(.001,active.windup)),0,0);this.arms(null,ease(active.age/Math.max(.001,active.windup)));for(const leg of legs)this.solve(leg,this.restTarget(leg));return;}
  const start=active.startDistance??p.spawnDistance,distance=enemyDistance===undefined?(start-16.5)*approachProgress(p,active.age/active.flight):Math.max(0,start-enemyDistance),blend=ease(distance/(this.stride*.3)),samples={};
  for(const side of ['L','R'])samples[side]=gaitSample(distance,this.stride,side,p);
  this.body(1,distance/(2*this.stride),blend);this.arms(samples,1,blend);this.lastSamples=samples;this.lastTargets={};
  const scale=this.root.getWorldScale(V()).z;
  for(const side of ['L','R']){const leg=this.legs[side],sample=samples[side],point=this.root.localToWorld(leg.rest.clone().add(V(0,0,sample.forward/scale)));point.y=leg.floor+sample.lift*this.lift*blend;this.solve(leg,point);this.lastTargets[side]={...sample,point};}
  const index=samples.L.stepIndex;if(index>=0){const side=index%2?'L':'R';this.stepEvent={key:index,side,point:this.lastTargets[side].point.clone(),weight:p.weight,metal:p.metal};}
 }
}
