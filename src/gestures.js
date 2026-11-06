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
/** Geometry uses image pixels (not normalized x/y) to preserve angles at any aspect ratio. */
export class GestureRecognizer {
  constructor(){this.mode='easy';this.reset();}
  reset(){this.palmSince=null;this.palmFired=false;this.crossSince=null;this.crossFired=false;this.raise=[null,null];this.armed=[null,null];this.previous=null;this.lastTime=null;this.center=null;this.guardSince=null;this.punchReady=[null,null];this.punchLast=[-Infinity,-Infinity];}
  update(points,time,width=640,height=480){
    const out={skill:null,skillSide:null,discPreparation:null,punch:null,charge:0,guard:false,lean:0,status:'收拳再向前推出可普攻；十字发光线，举手挥出光轮；胸前 X 交叉防御',tracking:false,debug:{}};
    if(!points || this.lastTime!==null && (time<this.lastTime || time-this.lastTime>900)) this.reset();
    this.lastTime=time;
    if(!points) return this.lost(out);
    const p=points.map(v=>({...v,x:v.x*width,y:v.y*height,z:(v.z??0)*width}));
    if(![11,12].every(i=>visible(p[i])))return this.lost(out);
    if(![13,14,15,16].every(i=>visible(p[i]))){
      this.crossSince=null;this.crossFired=false;this.guardSince=null;this.raise=[null,null];this.armed=[null,null];
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
    const cross=!this.armed.some(Boolean)&&horizontal<(easy?43:30) && vertical>(easy?47:60) && gap<(easy?.65:.4) && chest;
    const crossedWrists=(lw.x-rw.x)*(ls.x-rs.x)<0;
    const guardPose=crossedWrists&&chest&&angles.every(a=>a>25&&a<78)&&segmentsCross(le,lw,re,rw);
    if(guardPose){this.palmSince=null;this.palmFired=false;this.punchReady=[null,null];this.guardSince??=time;out.guard=time-this.guardSince>=120;out.status=out.guard?'已识别举臂防御':'胸前交叉双臂，准备防御';out.charge=out.guard?1:.4;this.raise=[null,null];this.armed=[null,null];return out;}
    this.guardSince=null;
    const extended=[elbowAngle(ls,le,lw),elbowAngle(rs,re,rw)];
    const palmPose=!this.armed.some(Boolean)&&!cross&&[[ls,lw,rs,rw],[rs,rw,ls,lw]].some(([s,w,other,rest],i)=>extended[i]>150&&Math.abs(w.y-s.y)<scale*.3&&rest.y>other.y+scale*.5&&(s.z-w.z>scale*.15||length(s,w)>scale*.9));
    if(palmPose){
      this.palmSince??=time;
      this.raise=[null,null];this.armed=[null,null];
      out.charge=clamp((time-this.palmSince)/650,0,1);out.status='单掌前推，保持片刻…';
      if(time-this.palmSince>=650&&!this.palmFired){out.skill='palm';out.status='手掌光箭！收回手臂再来一次';this.palmFired=true;this.punchReady=[null,null];return out;}
    }else{this.palmSince=null;this.palmFired=false;}
    const hold=easy?420:600;
    out.debug={horizontal:Math.round(horizontal),vertical:Math.round(vertical),gap:+gap.toFixed(2),cross,armed:this.armed.some(Boolean)};
    if(cross&&!guardPose){
      this.crossSince??=time;
      out.charge=clamp((time-this.crossSince)/hold,0,1);out.status='保持十字姿势，凝聚光线…';
      if(out.charge>=1&&!this.crossFired){out.skill='beam';this.crossFired=true;this.raise=[null,null];this.armed=[null,null];}
      if(this.crossFired)out.status='光线发射！放下双手，再来一次';
    }else{this.crossSince=null;this.crossFired=false;}
    const nose=p[0],headTop=visible(nose)&&nose.y<centerY-scale*.2?nose.y-scale*.4:centerY-scale*.65;
    for(let side=0;side<2;side++){
      if(cross||guardPose||palmPose)continue;
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
    if(cross||guardPose||out.skill||this.armed.some(Boolean)||this.raise.some(v=>v!==null)){this.punchReady=[null,null];return out;}
    this.detectPunch(p,time,scale,out);
    return out;
  }
  detectPunch(points,time,scale,out){
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
      const forward=ready.wrist.z-relative.z,lateral=Math.abs(relative.x-ready.wrist.x),travel=Math.hypot(relative.x-ready.wrist.x,relative.y-ready.wrist.y,relative.z-ready.wrist.z);
      const straight=angle>135&&angle-ready.angle>22;
      if(straight&&travel>.2&&(forward>.12||(travel>.4&&lateral<.6))&&time-this.punchLast[side]>260)candidates.push({side,score:forward+travel*.3});
    }
    if(!candidates.length)return;
    candidates.sort((a,b)=>b.score-a.score);const side=candidates[0].side;
    out.punch=side===0?'left':'right';out.status=side===0?'左直拳！收拳后继续':'右直拳！收拳后继续';this.punchLast[side]=time;this.punchReady[side]=null;
  }
  lost(out){this.palmSince=null;this.palmFired=false;this.punchReady=[null,null];this.crossSince=null;this.crossFired=false;this.guardSince=null;this.raise=[null,null];this.armed=[null,null];out.status='让肩膀、手肘和双手完整入镜';return out;}
}
