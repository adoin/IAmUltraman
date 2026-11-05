const length = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const visible = p => p && (p.visibility ?? 1) > .45 && Number.isFinite(p.x) && Number.isFinite(p.y);
function elbowAngle(s,e,w){const a=[s.x-e.x,s.y-e.y,(s.z??0)-(e.z??0)],b=[w.x-e.x,w.y-e.y,(w.z??0)-(e.z??0)];const d=Math.hypot(...a)*Math.hypot(...b);return d?Math.acos(clamp(a.reduce((sum,v,i)=>sum+v*b[i],0)/d,-1,1))*180/Math.PI:0;}
function segmentDistance(p,a,b) {
  const x=b.x-a.x,y=b.y-a.y,d=x*x+y*y;
  const t=d ? clamp(((p.x-a.x)*x+(p.y-a.y)*y)/d,0,1) : 0;
  return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
/** Geometry uses image pixels (not normalized x/y) to preserve angles at any aspect ratio. */
export class GestureRecognizer {
  constructor(){this.mode='easy';this.reset();}
  reset(){this.crossSince=null;this.crossFired=false;this.raise=[null,null];this.armed=[null,null];this.previous=null;this.lastTime=null;this.center=null;this.guardSince=null;this.punchReady=[null,null];}
  update(points,time,width=640,height=480){
    const out={skill:null,punch:null,charge:0,guard:false,lean:0,status:'收拳再向前推出可普攻；十字发光线，举手挥出光轮',tracking:false,debug:{}};
    if(!points || this.lastTime!==null && (time<this.lastTime || time-this.lastTime>900)) this.reset();
    this.lastTime=time;
    if(!points) return this.lost(out);
    const p=points.map(v=>({...v,x:v.x*width,y:v.y*height,z:(v.z??0)*width}));
    if(![11,12,13,14,15,16].every(i=>visible(p[i]))) return this.lost(out);
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
    const cross=horizontal<(easy?43:30) && vertical>(easy?47:60) && gap<(easy?.65:.4) && chest;
    const guardPose=!cross&&lw.y<ls.y+scale*.35&&rw.y<rs.y+scale*.35&&length(lw,rw)>scale*.8&&angles.every(a=>a>45);
    if(guardPose){this.punchReady=[null,null];this.guardSince??=time;out.guard=time-this.guardSince>=120;out.status=out.guard?'已识别举臂防御':'举起双臂，准备防御';out.charge=out.guard?1:.4;this.raise=[null,null];this.armed=[null,null];return out;}
    this.guardSince=null;
    const hold=easy?420:600;
    out.debug={horizontal:Math.round(horizontal),vertical:Math.round(vertical),gap:+gap.toFixed(2),cross,armed:this.armed.some(Boolean)};
    if(cross){
      this.crossSince??=time;
      out.charge=clamp((time-this.crossSince)/hold,0,1);out.status='保持十字姿势，凝聚光线…';
      if(out.charge>=1&&!this.crossFired){out.skill='beam';this.crossFired=true;this.raise=[null,null];this.armed=[null,null];}
      if(this.crossFired)out.status='光线发射！放下双手，再来一次';
    }else{this.crossSince=null;this.crossFired=false;}
    for(let side=0;side<2;side++){
      if(cross)continue;
      const wrist=side===0?lw:rw,shoulder=side===0?ls:rs;
      if(this.armed[side]){
        const armed=this.armed[side];
        const outward=shoulder.x < (ls.x+rs.x)/2 ? -1 : 1;
        const displacement=(wrist.x-armed.x)*outward/scale;
        const motion=length(wrist,armed)/scale;
        if(time-armed.time>2000){this.armed[side]=null;this.raise[side]=null;}
        else if(displacement>(easy?.5:.75) && motion>.55){out.skill='disc';out.status='八分光轮，出发！';this.armed=[null,null];this.raise=[null,null];break;}
        else{out.charge=1;out.status='光轮就绪！向身体外侧挥手';}
      }else if(wrist.y<shoulder.y-scale*.12){
        this.raise[side]??=time;
        const charge=clamp((time-this.raise[side])/hold,0,1);
        if(charge>out.charge){out.charge=charge;out.status='举手蓄力…稍停一下';}
        if(charge>=1){this.armed[side]={...wrist,time};out.status='光轮就绪！向身体外侧挥手';}
      }else this.raise[side]=null;
    }
    if(cross||guardPose||out.skill||this.armed.some(Boolean)){this.punchReady=[null,null];return out;}
    for(let side=0;side<2;side++){
      const [shoulder,elbow,wrist]=side===0?[ls,le,lw]:[rs,re,rw];const angle=elbowAngle(shoulder,elbow,wrist);
      const chestHeight=wrist.y>shoulder.y-scale*.35&&wrist.y<shoulder.y+scale*.9;
      if(angle<112&&chestHeight)this.punchReady[side]={time,wrist:{...wrist},angle};
      const ready=this.punchReady[side];if(!ready)continue;
      if(time-ready.time>850||!chestHeight){this.punchReady[side]=null;continue;}
      const travel=Math.hypot(wrist.x-ready.wrist.x,wrist.y-ready.wrist.y,wrist.z-ready.wrist.z)/scale;
      const forward=(ready.wrist.z-wrist.z)/scale;
      if(angle>145&&angle-ready.angle>35&&travel>.35&&(forward>.18||travel>.65)){out.punch=side===0?'left':'right';out.status='向前出拳！收回手臂，再出下一拳';this.punchReady[side]=null;break;}
    }
    return out;
  }
  lost(out){this.punchReady=[null,null];this.crossSince=null;this.crossFired=false;this.guardSince=null;this.raise=[null,null];this.armed=[null,null];out.status='让肩膀、手肘和双手完整入镜';return out;}
}
