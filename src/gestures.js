// Dwell times (ms) live here so the tests can prove a stronger pose costs more.
export const POSE_HOLDS = Object.freeze({beamEasy:420,beamNormal:600,zepellionEasy:700,zepellionNormal:950,gatherEasy:260,gatherNormal:340,gatherWindow:4500,spreadEasy:260,spreadNormal:340,spreadWindow:3000});
const length = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const visible = p => p && (p.visibility ?? 1) > .45 && Number.isFinite(p.x) && Number.isFinite(p.y);
function elbowAngle(s,e,w){const a=[s.x-e.x,s.y-e.y,(s.z??0)-(e.z??0)],b=[w.x-e.x,w.y-e.y,(w.z??0)-(e.z??0)];const d=Math.hypot(...a)*Math.hypot(...b);return d?Math.acos(clamp(a.reduce((sum,v,i)=>sum+v*b[i],0)/d,-1,1))*180/Math.PI:0;}
function segmentDistance(p,a,b) {
  const x=b.x-a.x,y=b.y-a.y,d=x*x+y*y;
  const t=d ? clamp(((p.x-a.x)*x+(p.y-a.y)*y)/d,0,1) : 0;
  return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
function segmentsCross(a,b,c,d){
  const side=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return side(a,b,c)*side(a,b,d)<=0&&side(c,d,a)*side(c,d,b)<=0;
}
// A real cross intersects inside both forearms. A shared wrist/end point is
// an L, even when landmark noise makes the two segments just touch.
function segmentIntersection(a,b,c,d){const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;if(Math.abs(den)<1e-6)return null;const x=c.x-a.x,y=c.y-a.y;return[(x*sy-y*sx)/den,(x*ry-y*rx)/den];}
/** Geometry uses image pixels (not normalized x/y) to preserve angles at any aspect ratio. */
export class GestureRecognizer {
  constructor(){this.mode='easy';this.reset();}
  reset(){this.clearSkillHolds();this.previous=null;this.lastTime=null;this.center=null;this.guardSince=null;this.punchReady=[null,null];this.punchLast=[-Infinity,-Infinity];}
  // A defensive pose or missing arm interrupts every offensive dwell. Keep
  // this list in one place so adding a skill cannot leave stale charge behind.
  clearSkillHolds(){this.palmSince=null;this.palmLast=null;this.palmSide=null;this.palmFired=false;this.crossSince=null;this.crossFired=false;this.lSince=null;this.lFired=false;this.gatherSince=null;this.gatherAt=null;this.spreadSince=null;this.spreadAt=null;this.raise=[null,null];this.armed=[null,null];}
  /**
   * One arm pushed forward, the other resting at the waist. Depth alone is
   * noisy on cheap webcams, so a foreshortened straight arm (short 2D reach with
   * forward depth) and an illustrated side reach both count, and the spare hand
   * only has to hang low beside the body or stay bent.
   */
  palmThrust(arm,scale,easy){
    const straight=arm.angle>(easy?118:132);
    const forward=(arm.s.z-arm.w.z)/scale;
    const reach=length(arm.s,arm.w)/scale;
    const lateral=Math.abs(arm.w.x-arm.s.x)/scale;
    const height=(arm.w.y-arm.s.y)/scale;
    const aimed=lateral<(easy?1.2:1.02)&&height<(easy?.6:.45)&&height>-(easy?.7:.5);
    const pushed=forward>(easy?.07:.11)||(reach>(easy?.95:1.1)&&forward>-(easy?.12:.06));
    const waistLow=(arm.otherW.y-arm.otherS.y)/scale>(easy?.26:.38);
    const waistClose=Math.abs(arm.otherW.x-arm.otherS.x)/scale<(easy?.85:.66);
    const otherBent=arm.otherAngle<(easy?156:148);
    const spare=(waistLow&&waistClose)||otherBent;
    return straight&&aimed&&pushed&&spare;
  }
  update(points,time,width=640,height=480){
    const out={skill:null,skillSide:null,discPreparation:null,punch:null,chargingSkill:null,charge:0,guard:false,lean:0,status:'收拳再向前推出可普攻；胸前十字＝梅特里姆光线，手臂摆成 L＝哉佩利敖光线，举手挥出光轮；胸前 X 交叉防御',tracking:false,zepellionStage:0,debug:{}};
    if(!points || this.lastTime!==null && (time<this.lastTime || time-this.lastTime>900)) this.reset();
    this.lastTime=time;
    if(!points) return this.lost(out);
    const p=points.map(v=>({...v,x:v.x*width,y:v.y*height,z:(v.z??0)*width}));
    if(![11,12].every(i=>visible(p[i])))return this.lost(out);
    if(![13,14,15,16].every(i=>visible(p[i]))){
      this.clearSkillHolds();this.guardSince=null;
      this.detectPunch(p,time,Math.max(length(p[11],p[12]),height*.07),out);
      out.status=out.punch?'直拳命中动作已识别':'让双臂完整入镜可使用绝招';return out;
    }
    const [ls,rs,le,re,lw,rw]=[11,12,13,14,15,16].map(i=>p[i]);
    const scale=Math.max(length(ls,rs),height*.07);
    if(length(ls,rs)<width*.055)return this.lost(out);
    out.tracking=true;
    this.center??=(ls.x+rs.x)/2;
    out.lean=clamp(-((ls.x+rs.x)/2-this.center)/scale*1.8,-1,1);
    const forearms=[[le,lw],[re,rw]];
    const angles=forearms.map(([a,b])=>Math.atan2(Math.abs(b.y-a.y),Math.abs(b.x-a.x))*180/Math.PI);
    const horizontal=Math.min(...angles),vertical=Math.max(...angles);
    const easy=this.mode==='easy';
    const gap=Math.min(segmentDistance(lw,re,rw),segmentDistance(rw,le,lw),segmentDistance(le,re,rw),segmentDistance(re,le,lw))/scale;
    const centerY=(ls.y+rs.y)/2;
    const chest=(lw.y+rw.y)/2 > centerY-scale*.75 && (lw.y+rw.y)/2 < centerY+scale*1.65;
    const forearmsCross=segmentsCross(le,lw,re,rw);
    const oneEach=!this.armed.some(Boolean)&&horizontal<(easy?43:30)&&vertical>(easy?47:60)&&gap<(easy?.65:.4)&&chest;
    // "+" (forearms crossing) is the Mebium ray. An "L" corner - one forearm
    // vertical, the other horizontal, wrists meeting but never crossing - is
    // Tiga's Zepellion pose.
    const intersection=segmentIntersection(le,lw,re,rw);
    const cross=oneEach&&intersection?.every(t=>t>.12&&t<.88);
    const zepellionPose=oneEach&&!cross;
    const crossedWrists=(lw.x-rw.x)*(ls.x-rs.x)<0;
    const guardPose=crossedWrists&&chest&&angles.every(a=>a>25&&a<78)&&forearmsCross;
    if(guardPose){this.clearSkillHolds();this.punchReady=[null,null];this.guardSince??=time;out.guard=time-this.guardSince>=120;out.status=out.guard?'已识别举臂防御':'胸前交叉双臂，准备防御';out.charge=out.guard?1:.4;this.raise=[null,null];this.armed=[null,null];return out;}
    this.guardSince=null;
    const extended=[elbowAngle(ls,le,lw),elbowAngle(rs,re,rw)];
    const arms=[
      {s:ls,e:le,w:lw,otherS:rs,otherE:re,otherW:rw,angle:extended[0],otherAngle:extended[1],side:'left'},
      {s:rs,e:re,w:rw,otherS:ls,otherE:le,otherW:lw,angle:extended[1],otherAngle:extended[0],side:'right'},
    ];
    const bodySign=Math.sign(rs.x-ls.x)||1;
    const spreadShape=Math.abs(lw.x-rw.x)/scale>(easy?2.6:3)&&
      (ls.x-lw.x)*bodySign>scale*.45&&(rw.x-rs.x)*bodySign>scale*.45&&
      [lw,rw].every((w,i)=>Math.abs(w.y-[ls,rs][i].y)/scale<(easy?.5:.38));
    const palmArm=!this.armed.some(Boolean)&&!oneEach&&!spreadShape?arms.find(arm=>this.palmThrust(arm,scale,easy)):null;
    const palmHold=easy?520:650;
    let palmInfo;
    if(palmArm){
      if(this.palmSide!==palmArm.side){this.palmSince=time;this.palmFired=false;}
      this.palmSide=palmArm.side;this.palmSince??=time;
      this.palmLast=time;
      this.raise=[null,null];this.armed=[null,null];
      palmInfo={side:palmArm.side,forward:+((palmArm.s.z-palmArm.w.z)/scale).toFixed(2),reach:+(length(palmArm.s,palmArm.w)/scale).toFixed(2),angle:Math.round(palmArm.angle)};
      out.chargingSkill='palm';out.charge=clamp((time-this.palmSince)/palmHold,0,1);out.status='单掌向前推出，保持一下…';
      if(time-this.palmSince>=palmHold&&!this.palmFired){out.skill='palm';out.skillSide=palmArm.side;out.status='手掌光剑！收回手臂再来一次';this.palmFired=true;this.punchReady=[null,null];return out;}
    }else if(this.palmSince!==null&&time-(this.palmLast??time)<=240){
      // A child's camera frame flickers. Keep the charge through short dropouts
      // instead of restarting the whole dwell on one noisy frame.
      out.chargingSkill='palm';out.charge=clamp((time-this.palmSince)/palmHold,0,1);out.status='保持前推，别松手…';
    }else{this.palmSince=null;this.palmSide=null;this.palmFired=false;}
    const hold=easy?POSE_HOLDS.beamEasy:POSE_HOLDS.beamNormal;
    // Stage 1 of the Zepellion pre-motion: both palms drawn together in front of
    // the chest. Tiga gathers first, then forms the L; the ray only fires when
    // the gather happened shortly before the L is complete.
    const clasp=length(lw,rw)/scale<(easy?.55:.42);
    const centered=Math.abs((lw.x+rw.x)/2-(ls.x+rs.x)/2)/scale<(easy?.4:.3);
    const gatherPose=!guardPose&&!oneEach&&!palmArm&&clasp&&centered&&chest&&Math.abs(lw.z-rw.z)/scale<(easy?.35:.25);
    const gatherHold=easy?POSE_HOLDS.gatherEasy:POSE_HOLDS.gatherNormal;
    if(gatherPose){out.chargingSkill='zepellion';
      this.gatherSince??=time;
      if(time-this.gatherSince>=gatherHold)this.gatherAt=time;
      out.status=this.gatherAt!==null?'聚气完成！双臂向两侧展开':'双手在胸前合拢，聚气…';
      if(this.gatherAt===null)out.charge=clamp((time-this.gatherSince)/gatherHold,0,1);
    }else this.gatherSince=null;
    const gathered=this.gatherAt!==null&&time-this.gatherAt<=POSE_HOLDS.gatherWindow;
    const spreadPose=gathered&&spreadShape&&extended.every(angle=>angle>(easy?140:155));
    if(spreadPose){out.chargingSkill='zepellion';
      this.spreadSince??=time;
      if(time-this.spreadSince>=(easy?POSE_HOLDS.spreadEasy:POSE_HOLDS.spreadNormal))this.spreadAt=time;
      out.status=this.spreadAt!==null?'展开完成！摆好发射姿势':'双臂向两侧拉开，保持一下…';
    }else this.spreadSince=null;
    const spreadReady=gathered&&this.spreadAt!==null&&time-this.spreadAt<=POSE_HOLDS.spreadWindow;
    out.zepellionStage=spreadReady&&(zepellionPose||cross)?3:spreadPose||spreadReady?2:gathered?1:0;
    out.debug={horizontal:Math.round(horizontal),vertical:Math.round(vertical),gap:+gap.toFixed(2),cross,l:zepellionPose,gather:gathered,spread:spreadReady,stage:out.zepellionStage,armed:this.armed.some(Boolean)};
    if(palmInfo)out.debug.palm=palmInfo;
    const finisherPose=zepellionPose||(cross&&(spreadReady||this.lFired));
    if(finisherPose&&!guardPose){out.chargingSkill='zepellion';
      if(spreadReady)this.lSince??=time;else this.lSince=null;
      const lHold=easy?POSE_HOLDS.zepellionEasy:POSE_HOLDS.zepellionNormal;
      out.charge=this.lSince===null?0:clamp((time-this.lSince)/lHold,0,1);
      out.status=spreadReady?'发射姿势就绪，凝聚哉佩利敖光线…':gathered?'先将双臂向两侧展开，再定姿':'先双手合拢聚气，再展开双臂';
      if(out.charge>=1&&!this.lFired&&spreadReady){out.skill='zepellion';out.skillSide='right';this.lFired=true;this.gatherAt=null;this.spreadAt=null;this.raise=[null,null];this.armed=[null,null];}
      if(this.lFired)out.status='哉佩利敖光线！放下双手，再来一次';
    }else{this.lSince=null;this.lFired=false;}
    if(cross&&!finisherPose&&!guardPose){
      out.chargingSkill='beam';this.crossSince??=time;
      out.charge=clamp((time-this.crossSince)/hold,0,1);out.status='保持十字姿势，凝聚光线…';
      if(out.charge>=1&&!this.crossFired){out.skill='beam';this.crossFired=true;this.raise=[null,null];this.armed=[null,null];}
      if(this.crossFired)out.status='光线发射！放下双手，再来一次';
    }else{this.crossSince=null;this.crossFired=false;}
    const nose=p[0],headTop=visible(nose)&&nose.y<centerY-scale*.2?nose.y-scale*.4:centerY-scale*.65;
    for(let side=0;side<2;side++){
      if(cross||zepellionPose||guardPose||palmArm)continue;
      const wrist=side===0?lw:rw,shoulder=side===0?ls:rs;
      const high=wrist.y<headTop-scale*.05&&angles[side]>50;
      const relative={x:(wrist.x-shoulder.x)/scale,y:(wrist.y-shoulder.y)/scale,z:(wrist.z-shoulder.z)/scale};
      if(this.armed[side]){
        const armed=this.armed[side],drop=relative.y-armed.relative.y,forward=armed.relative.z-relative.z;
        const outward=(relative.x-armed.relative.x)*(shoulder.x<(ls.x+rs.x)/2?-1:1);
        if(time-armed.time>2500){this.armed[side]=null;this.raise[side]=null;continue;}
        out.discPreparation={side:side===0?'left':'right',progress:1,armed:true};out.charge=1;out.status='光轮就绪，向前下方甩出！';
        if(drop>.4&&(forward>.1||outward>.45||drop>.85)){
          out.skill='disc';out.skillSide=side===0?'left':'right';out.status='八分光轮！';this.armed=[null,null];this.raise=[null,null];break;
        }
        if(high&&relative.y<armed.relative.y)armed.relative=relative;
      }else if(high){
        this.raise[side]??=time;const progress=clamp((time-this.raise[side])/(easy?320:480),0,1);
        out.discPreparation={side:side===0?'left':'right',progress,armed:progress>=1};out.charge=progress;out.status='手举过头顶，凝聚光轮…';
        if(progress>=1)this.armed[side]={relative,time};
      }else this.raise[side]=null;
    }
    if(gatherPose){out.chargingSkill='zepellion';this.detectPunch(p,time,scale,out,true);return out;}
    if(cross||zepellionPose||spreadPose||guardPose||out.skill||this.armed.some(Boolean)||this.raise.some(v=>v!==null)){this.punchReady=[null,null];return out;}
    this.detectPunch(p,time,scale,out);
    return out;
  }
  detectPunch(points,time,scale,out,primeOnly=false){
    const candidates=[];
    for(let side=0;side<2;side++){
      const [shoulder,elbow,wrist]=(side===0?[11,13,15]:[12,14,16]).map(i=>points[i]);
      if(![shoulder,elbow,wrist].every(visible)){this.punchReady[side]=null;continue;}
      const angle=elbowAngle(shoulder,elbow,wrist),relative={x:(wrist.x-shoulder.x)/scale,y:(wrist.y-shoulder.y)/scale,z:(wrist.z-shoulder.z)/scale};
      const chest=relative.y>-.4&&relative.y<1;
      if(angle<130&&chest){
        const ready=this.punchReady[side];
        if(!ready)this.punchReady[side]={time,wrist:relative,angle};
        else{ready.angle=Math.min(angle,ready.angle);if(relative.z>=ready.wrist.z-.02){ready.time=time;if(relative.z>ready.wrist.z)ready.wrist=relative;}}
      }
      const ready=this.punchReady[side];if(!ready)continue;
      if(!chest||time-ready.time>850){this.punchReady[side]=null;continue;}
      if(primeOnly)continue;
      const forward=ready.wrist.z-relative.z,lateral=Math.abs(relative.x-ready.wrist.x),travel=Math.hypot(relative.x-ready.wrist.x,relative.y-ready.wrist.y,relative.z-ready.wrist.z);
      const straight=angle>135&&angle-ready.angle>22;
      if(straight&&travel>.2&&(forward>.12||(travel>.4&&lateral<.6))&&time-this.punchLast[side]>260)candidates.push({side,score:forward+travel*.3});
    }
    if(!candidates.length)return;
    candidates.sort((a,b)=>b.score-a.score);const side=candidates[0].side;
    this.gatherAt=null;this.spreadAt=null;out.zepellionStage=0;out.punch=side===0?'left':'right';out.status=side===0?'左直拳！收拳后继续':'右直拳！收拳后继续';this.punchLast[side]=time;this.punchReady[side]=null;
  }
  lost(out){this.clearSkillHolds();this.punchReady=[null,null];this.guardSince=null;out.status='让肩膀、手肘和双手完整入镜';return out;}
}
