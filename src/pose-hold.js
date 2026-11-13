/** Confirmed pose time: brief geometric misses pause, never earn time. */
export class PoseHold {
  constructor(grace=220){this.grace=grace;this.reset();}
  reset(){this.elapsed=0;this.lastTime=null;this.lastMatch=null;this.matched=false;}
  update(matches,time){
    if(this.lastTime!==null&&(time<this.lastTime||time-this.lastTime>900))this.reset();
    if(this.lastMatch!==null&&time-this.lastMatch>this.grace&&!this.matched)this.elapsed=0;
    if(matches){if(this.matched&&this.lastTime!==null)this.elapsed+=time-this.lastTime;this.lastMatch=time;}
    else if(this.lastMatch!==null&&time-this.lastMatch>this.grace)this.elapsed=0;
    this.lastTime=time;this.matched=matches;return this.elapsed;
  }
  recent(time){return this.lastMatch!==null&&time-this.lastMatch<=this.grace;}
}
