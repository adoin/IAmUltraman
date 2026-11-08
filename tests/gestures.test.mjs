import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GestureRecognizer,POSE_HOLDS} from '../src/gestures.js';
import {BEAM_TIMING,ZEPELLION_TIMING} from '../src/action-timing.js';
function pose(coords){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));for(const [i,[x,y]] of Object.entries(coords))p[i]={x:x/640,y:y/480,visibility:1};return p;}
const cross=pose({11:[250,180],12:[390,180],13:[260,260],15:[395,260],14:[350,300],16:[350,185]});
const raised=pose({11:[250,180],12:[390,180],13:[230,180],15:[250,60],14:[410,260],16:[420,310]});
test('cross requires dwell and fires once until released',()=>{const r=new GestureRecognizer();for(let t=0;t<=400;t+=100)assert.equal(r.update(cross,t).skill,null);assert.equal(r.update(cross,500).skill,'beam');assert.equal(r.update(cross,600).skill,null);r.update(null,700);for(let t=800;t<=1200;t+=100)r.update(cross,t);assert.equal(r.update(cross,1300).skill,'beam');});
test('raised hand must charge then throw forward and down; stationary hand does not fire',()=>{const r=new GestureRecognizer();for(let t=0;t<=500;t+=100)assert.equal(r.update(raised,t).skill,null);assert.equal(r.update(raised,600).skill,null);const thrown=structuredClone(raised);thrown[15].x=140/640;thrown[15].y=180/480;assert.equal(r.update(thrown,700).skill,'disc');assert.equal(r.update(thrown,800).skill,null);});
test('lost or occluded wrists cancel pending charge',()=>{const r=new GestureRecognizer();r.update(cross,0);r.update(cross,300);const hidden=structuredClone(cross);hidden[15].visibility=.1;assert.equal(r.update(hidden,400).tracking,false);assert.equal(r.update(cross,500).skill,null);assert.equal(r.update(cross,800).skill,null);});
test('video seeks and frame gaps do not complete stale gestures',()=>{const r=new GestureRecognizer();r.update(cross,0);assert.equal(r.update(cross,1000).skill,null);assert.equal(r.update(cross,100).skill,null);});
test('low frame rate still permits deliberate held poses without repeated casts',()=>{const r=new GestureRecognizer();assert.equal(r.update(cross,0).skill,null);assert.equal(r.update(cross,550).skill,'beam');assert.equal(r.update(cross,1100).skill,null);});
test('same geometry survives different aspect ratios and scale',()=>{const r=new GestureRecognizer();const transformed=cross.map(p=>({...p,x:(p.x*640*.6+10)/1280,y:(p.y*480*.6+30)/720}));let result;for(let t=0;t<=500;t+=100)result=r.update(transformed,t,1280,720);assert.equal(result.skill,'beam');});
test('mirrored cross and right-hand disc both work',()=>{const r=new GestureRecognizer();const mirrored=cross.map(p=>({...p,x:1-p.x}));for(let t=0;t<=400;t+=100)r.update(mirrored,t);assert.equal(r.update(mirrored,500).skill,'beam');r.reset();const right=raised.map(p=>({...p,x:1-p.x}));for(let t=0;t<=500;t+=100)r.update(right,t);right[15].x=1-140/640;right[15].y=180/480;assert.equal(r.update(right,600).skill,'disc');});
test('diagonal X forearms guard without emitting an offensive skill',()=>{const r=new GestureRecognizer();const guard=pose({11:[250,180],12:[390,180],13:[220,300],15:[390,180],14:[420,300],16:[250,180]});for(let t=0;t<500;t+=100){const result=r.update(guard,t);assert.equal(result.skill,null);if(t>=200)assert.equal(result.guard,true);}assert.equal(r.update(null,500).guard,false);});
test('mirrored torso movement drives lean and reset recenters',()=>{const r=new GestureRecognizer();r.update(raised,0);const shifted=raised.map(p=>({...p,x:p.x+.1}));assert.ok(r.update(shifted,100).lean<-.5);r.reset();assert.ok(Math.abs(r.update(shifted,200).lean)<.001);});
function punchPoses(){const bent=pose({11:[250,180],12:[390,180],13:[210,220],15:[255,210],14:[410,240],16:[430,300]});const forward=structuredClone(bent);bent[13].z=-10/640;bent[15].z=-20/640;forward[13]={x:230/640,y:200/480,z:-65/640,visibility:1};forward[15]={x:210/640,y:220/480,z:-160/640,visibility:1};return{bent,forward};}
test('forward elbow extension punches once and requires retraction',()=>{const{bent,forward}=punchPoses();const r=new GestureRecognizer();assert.equal(r.update(bent,0).punch,null);assert.equal(r.update(forward,150).punch,'left');assert.equal(r.update(forward,300).punch,null);r.update(bent,450);assert.equal(r.update(forward,600).punch,'left');});
test('extended resting arm, stale bend and missing frames never count as punches',()=>{const{bent,forward}=punchPoses();const r=new GestureRecognizer();assert.equal(r.update(forward,0).punch,null);r.update(bent,100);r.update(null,200);assert.equal(r.update(forward,300).punch,null);r.update(bent,400);assert.equal(r.update(forward,1500).punch,null);});
test('mirrored and opposite arm forward punches are supported',()=>{const{bent,forward}=punchPoses();const r=new GestureRecognizer();r.update(bent.map(p=>({...p,x:1-p.x})),0);assert.equal(r.update(forward.map(p=>({...p,x:1-p.x})),150).punch,'left');r.reset();for(const [a,b]of [[11,12],[13,14],[15,16]]){[bent[a],bent[b]]=[bent[b],bent[a]];[forward[a],forward[b]]=[forward[b],forward[a]];}r.update(bent,0);assert.equal(r.update(forward,150).punch,'right');});

test('extended single arm and lowered opposite hand cast one palm arrow after a dwell',()=>{const r=new GestureRecognizer();const p=pose({11:[250,180],12:[390,180],13:[215,180],15:[180,180],14:[420,240],16:[425,310]});p[13].z=-.14;p[15].z=-.40;let seen=0;for(let t=0;t<=1000;t+=100)if(r.update(p,t).skill==='palm')seen++;assert.equal(seen,1);r.update(null,1100);assert.equal(r.update(p,1200).skill,null);});

test('raising only to shoulder height never arms the disc, and horizontal waving cannot release it',()=>{const r=new GestureRecognizer();const low=structuredClone(raised);low[15].y=135/480;for(let t=0;t<700;t+=100)assert.equal(r.update(low,t).discPreparation,null);r.reset();let out;for(let t=0;t<=500;t+=100)out=r.update(raised,t);assert.equal(out.discPreparation.side,'left');assert.equal(out.discPreparation.armed,true);const waved=structuredClone(raised);waved[15].x=120/640;assert.equal(r.update(waved,600).skill,null);waved[15].y=200/480;out=r.update(waved,700);assert.equal(out.skill,'disc');assert.equal(out.skillSide,'left');assert.equal(out.discPreparation.armed,true);});

test('actual opposite hand index is preserved for prepared disc',()=>{const r=new GestureRecognizer();const p=structuredClone(raised);for(const [a,b]of [[11,12],[13,14],[15,16]])[p[a],p[b]]=[p[b],p[a]];for(let t=0;t<=500;t+=100)r.update(p,t);p[16].y=200/480;p[16].z=-.2;const out=r.update(p,650);assert.equal(out.skill,'disc');assert.equal(out.skillSide,'right');});

test('a visible hand can punch while the other wrist is occluded, without stale opposite punches',()=>{const {bent,forward}=punchPoses();bent[16].visibility=0;forward[16].visibility=0;const r=new GestureRecognizer();r.update(bent,0);const out=r.update(forward,150);assert.equal(out.tracking,false);assert.equal(out.punch,'left');assert.equal(out.skill,null);});

test('torso translation alone and lateral straight-arm waving do not punch',()=>{const {bent}=punchPoses(),r=new GestureRecognizer();r.update(bent,0);const shifted=bent.map(p=>({...p,x:p.x+.15}));assert.equal(r.update(shifted,150).punch,null);r.reset();r.update(bent,0);const waved=structuredClone(bent);waved[13]={x:180/640,y:190/480,z:0,visibility:1};waved[15]={x:100/640,y:180/480,z:0,visibility:1};assert.equal(r.update(waved,150).punch,null);});

// A child pushing one palm at the camera keeps a slightly bent elbow and the
// spare hand near the chest, which the old strict test rejected outright.
function palmPush({elbowBend=0,spareY=225}={}){
  const p=pose({11:[250,180],12:[390,180],13:[230,190],15:[255,185],14:[410,240],16:[420,spareY]});
  p[13].z=-.10;p[15].z=-.35-elbowBend;p[11].z=0;p[12].z=0;
  return p;
}
test('a slightly bent forward palm with the spare hand at chest height fires once',()=>{
  const r=new GestureRecognizer(),p=palmPush({elbowBend:.05,spareY:225});
  let fired=0,last;
  for(let t=0;t<=1200;t+=80){last=r.update(p,t);if(last.skill==='palm')fired++;}
  assert.equal(fired,1);assert.equal(last.skill,null);
});
test('one noisy frame does not restart the palm dwell',()=>{
  const r=new GestureRecognizer(),p=palmPush(),standing=p.map(v=>({...v}));
  standing[13]={x:255/640,y:260/480,z:0,visibility:1};standing[15]={x:258/640,y:330/480,z:0,visibility:1};
  assert.equal(r.update(p,0).skill,null);
  assert.equal(r.update(p,160).skill,null);
  assert.equal(r.update(standing,240).skill,null);
  assert.equal(r.update(p,320).skill,null);
  assert.equal(r.update(p,560).skill,'palm');
});
test('wide side reach and lowered arms never read as a palm push',()=>{
  const r=new GestureRecognizer();const wide=pose({11:[250,180],12:[390,180],13:[180,180],15:[120,180],14:[420,235],16:[430,245]});
  for(let t=0;t<=900;t+=100)assert.equal(r.update(wide,t).skill,null);
  r.reset();const down=pose({11:[250,180],12:[390,180],13:[255,260],15:[258,330],14:[385,260],16:[382,330]});
  for(let t=0;t<=900;t+=100)assert.equal(r.update(down,t).skill,null);
});
test('releasing the forward palm re-arms the next arrow',()=>{
  const r=new GestureRecognizer(),p=palmPush();const away=p.map(v=>({...v,x:1-v.x}));
  let fired=0;for(let t=0;t<=700;t+=70)if(r.update(p,t).skill==='palm')fired++;
  assert.equal(fired,1);r.update(null,760);
  for(let t=800;t<=1500;t+=70)if(r.update(p,t).skill==='palm')fired++;
  assert.equal(fired,2);assert.equal(r.update(away,1560).skill,null);
});

test('a punch spread over several camera frames retains its original retracted depth',()=>{const {bent,forward}=punchPoses(),r=new GestureRecognizer();r.update(bent,0);let seen=[];for(let n=1;n<=7;n++){const t=n/7,p=bent.map((a,i)=>({x:a.x+(forward[i].x-a.x)*t,y:a.y+(forward[i].y-a.y)*t,z:(a.z||0)+((forward[i].z||0)-(a.z||0))*t,visibility:1}));const out=r.update(p,n*65);if(out.punch)seen.push(out.punch);}assert.deepEqual(seen,['left']);});
function poseFrom(coords){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));for(const [i,[x,y]] of Object.entries(coords))p[i]={x:x/640,y:y/480,visibility:1};return p;}
// Stage 1: both palms drawn together in front of the chest (Tiga gathers first).
const gatherPose=poseFrom({11:[250,180],12:[390,180],13:[270,240],15:[310,250],14:[370,240],16:[330,250]});
// Stage 2: the L from the hand book, forearms meeting without crossing.
const lPose=poseFrom({11:[250,180],12:[390,180],13:[255,300],15:[255,190],14:[400,300],16:[275,300]});
test('the L pose alone never fires the ray: the gather has to come first',()=>{
  const r=new GestureRecognizer();let fired=0,stages=new Set();
  for(let t=0;t<=1600;t+=100){const out=r.update(lPose,t);if(out.skill==='zepellion')fired++;stages.add(out.zepellionStage);}
  assert.equal(fired,0,'an L without the gather must not fire');
  assert.deepEqual([...stages],[0]);
});
test('gather then L fires the Zepellion ray once and reports both stages',()=>{
  const r=new GestureRecognizer();const stages=[];let fired=0;
  for(let t=0;t<=400;t+=100){const out=r.update(gatherPose,t);stages.push(out.zepellionStage);}
  assert.ok(stages.includes(1),'gathering must report stage 1');
  let firedStage=null;
  for(let t=500;t<=1800;t+=100){const out=r.update(lPose,t);stages.push(out.zepellionStage);if(out.skill==='zepellion'){fired++;firedStage=out.zepellionStage;}}
  assert.equal(fired,1);
  assert.equal(firedStage,2,'the ray fires from the formed L');
  assert.ok(stages.includes(2));
});
test('gathering and then flashing an L too briefly does not fire',()=>{
  const r=new GestureRecognizer();
  for(let t=0;t<=400;t+=100)r.update(gatherPose,t);
  let fired=0;
  // Hold the L for less than the dwell, then drop out of it, twice.
  for(let t=500;t<=900;t+=100){if(r.update(lPose,t).skill==='zepellion')fired++;}
  r.update(null,1000);
  for(let t=1100;t<=1400;t+=100){if(r.update(lPose,t).skill==='zepellion')fired++;}
  assert.equal(fired,0);
});
test('the Zepellion dwell is at least 1.5x the Mebium dwell and the ray needs more time',()=>{
  assert.ok(POSE_HOLDS.zepellionEasy>=POSE_HOLDS.beamEasy*1.5);
  assert.ok(POSE_HOLDS.zepellionNormal>=POSE_HOLDS.beamNormal*1.5);
  assert.ok(POSE_HOLDS.gatherEasy>0&&POSE_HOLDS.gatherNormal>POSE_HOLDS.gatherEasy);
  assert.ok(ZEPELLION_TIMING.ready>=BEAM_TIMING.ready*1.5,'the Zepellion ready phase must be longer');
  assert.ok(ZEPELLION_TIMING.impact>=BEAM_TIMING.impact+.2,'contact must land later than the Mebium ray');
  assert.ok(ZEPELLION_TIMING.reach<ZEPELLION_TIMING.pull&&ZEPELLION_TIMING.pull<ZEPELLION_TIMING.cross&&ZEPELLION_TIMING.cross<=ZEPELLION_TIMING.fire,'the wind-up must read as reach -> pull -> cross before the shot');
  assert.ok(ZEPELLION_TIMING.pull-ZEPELLION_TIMING.reach>=.4&&ZEPELLION_TIMING.cross-ZEPELLION_TIMING.pull>=.4,'every wind-up beat needs its own beat of time');
});
test('a waist-high spare hand with a forward arm is enough for the palm sword',()=>{
  const pose=coords=>{const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));for(const [i,[x,y]] of Object.entries(coords))p[i]={x:x/640,y:y/480,visibility:1};return p;};
  const waist=pose({11:[250,180],12:[390,180],13:[228,196],15:[252,188],14:[400,300],16:[398,320]});
  waist[13].z=-.1;waist[15].z=-.38;
  const r=new GestureRecognizer();let fired=0;
  for(let t=0;t<=1200;t+=80)if(r.update(waist,t).skill==='palm')fired++;
  assert.equal(fired,1);
});
