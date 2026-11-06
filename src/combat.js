import {BEAM_TIMING,DISC_TIMING} from './action-timing.js';
export const WAVES = [
  {name:'雷德王',model:'redking',title:'海湾入侵者',hp:110,color:0xffcb7a,attacks:['charge','bolt','slam']},
  {name:'巴尔坦星人',model:'baltan',title:'宇宙忍者',hp:145,color:0x68d9ff,attacks:['charge','bolt','sweep']},
  {name:'加恩Q',model:'ganq',title:'巨眼的凝视',hp:175,color:0xee596d,attacks:['slam','charge','bolt']},
  {name:'巴尔坦星人 · 强袭',model:'baltan',title:'幻影突袭',hp:200,color:0x62cfff,attacks:['sweep','bolt','charge']},
  {name:'巴尔坦星人 · 决战',model:'baltan',title:'最终守护战',hp:290,color:0xff8960,attacks:['bolt','sweep','slam','charge']},
];
export const SKILLS={palm:{cooldown:2.2,damage:20,impact:.34,duration:.72},beam:{cooldown:3.2,damage:46,impact:BEAM_TIMING.impact,duration:BEAM_TIMING.end},disc:{cooldown:1.65,damage:31,impact:DISC_TIMING.impact,duration:DISC_TIMING.end}};
export const PUNCH={cooldown:.38,damage:12,impact:.18,duration:.36};
export const SHIELD=Object.freeze({duration:2,cooldown:4,drain:10,recharge:14,blockCost:12});
export const ATTACKS={
  melee:{name:'近身重拳',hint:'胸前交叉双臂防御，或侧身闪避',damage:12,windup:1.0,flight:.3},
  bolt:{name:'能量弹',hint:'向左右侧身躲开，或举起双臂防御',damage:14,windup:2.2,flight:1.15},
  slam:{name:'大地震波',hint:'胸前交叉双臂，展开光之护盾',damage:20,windup:2.6,flight:1.25},
  sweep:{name:'横扫光束',hint:'躲向发光区域，或交叉双臂防御',damage:17,windup:2.4,flight:1.1},
  charge:{name:'巨兽冲锋',hint:'向侧面闪避，或用护盾挡住',damage:22,windup:2.7,flight:1.15},
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Deterministic combat simulation, independent of rendering and camera inference. */
export class BattleEngine {
  constructor(onEvent=()=>{}){this.onEvent=onEvent;this.difficulty='easy';this.practice=false;this.reset();}
  reset(){this.enemyDistance=35;this.retreatTarget=35;this.retreatUntil=0;this.meleeHits=0;this.knockdowns=0;this.lastPunch=-100;this.time=0;this.wave=1;this.stars=0;this.heroHealth=100;this.guardEnergy=100;this.guard=false;this.guardHeld=false;this.guardUntil=0;this.guardReadyAt=0;this.lean=0;this.effects=[];this.lastCast={beam:-100,disc:-100,palm:-100};this.monsterMax=WAVES[0].hp;this.monsterHealth=this.monsterMax;this.defeated=false;this.finished=false;this.playing=false;this.paused=false;this.nextAttack=6;this.attack=null;this.attackIndex=0;this.respawn=0;this.combo=0;this.stats={casts:0,hits:0,blocked:0,dodged:0,damageTaken:0};this.emit();}
  get waveInfo(){return WAVES[this.wave-1];}
  start(){this.reset();this.playing=true;this.onEvent({type:'wave',wave:1,info:this.waveInfo});}
  emit(){this.onEvent({type:'state',wave:this.wave,stars:this.stars,hero:this.heroHealth,monster:this.monsterHealth/this.monsterMax*100,dead:this.defeated,guard:this.guardEnergy,info:this.waveInfo});}
  get inMelee(){return this.enemyDistance<=18;}
  interruptRemote(){
    const canceled=this.effects.filter(e=>e.kind!=='punch');
    if(!canceled.length)return;
    this.effects=this.effects.filter(e=>e.kind==='punch');
    this.onEvent({type:'remote-interrupted'});
  }
  updateDistance(dt){
    if(this.defeated)return;
    if(this.time<this.retreatUntil){this.enemyDistance=Math.min(this.retreatTarget,this.enemyDistance+34*dt);return;}
    if(this.attack?.kind==='charge'&&this.attack.phase==='flight')this.enemyDistance=Math.max(16.5,this.enemyDistance-28*dt);
    if(this.inMelee)this.interruptRemote();
  }
  get guardRemaining(){return this.guard?Math.max(0,this.guardUntil-this.time):0;}
  get guardCooldown(){return Math.max(0,this.guardReadyAt-this.time);}
  raiseShield(){
    if(!this.playing||this.paused||this.defeated||this.finished||this.guard||this.guardCooldown>0)return false;
    if(this.guardEnergy<=SHIELD.blockCost||this.effects.length)return false;
    this.guard=true;
    this.guardUntil=this.time+SHIELD.duration;
    return true;
  }
  lowerShield(at=this.time){
    if(!this.guard)return;
    this.guard=false;
    this.guardReadyAt=at+SHIELD.cooldown;
  }
  setDefense(held,lean=0){
    this.lean=clamp(lean,-1,1);
    if(this.guardHeld===!!held)return;
    this.guardHeld=!!held;
    if(this.guardHeld)this.raiseShield();else this.lowerShield();
  }
  updateShield(dt){
    const previousEnergy=this.guardEnergy;
    const start=this.time-dt;
    let activeTime=0;
    if(this.guard){
      const endsAt=Math.min(this.guardUntil,start+Math.max(0,this.guardEnergy-SHIELD.blockCost)/SHIELD.drain);
      activeTime=clamp(endsAt-start,0,dt);
      if(this.time>=endsAt)this.lowerShield(endsAt);
    }
    this.guardEnergy=clamp(this.guardEnergy-activeTime*SHIELD.drain+(dt-activeTime)*SHIELD.recharge,0,100);
    if(Math.floor(previousEnergy/2)!==Math.floor(this.guardEnergy/2))this.emit();
  }
  punch(side='right'){if(!this.playing||this.paused||this.defeated||this.finished||this.effects.some(e=>SKILLS[e.kind])||this.time-(this.lastPunch??-100)<PUNCH.cooldown)return false;this.lastPunch=this.time;this.lowerShield();this.stats.punches=(this.stats.punches||0)+1;this.effects.push({kind:'punch',side,age:0,duration:PUNCH.duration,hit:false});this.onEvent({type:'punch',side});return true;}
  cast(skill){const config=SKILLS[skill];if(config&&this.inMelee&&this.playing&&!this.paused&&!this.finished&&!this.defeated){this.onEvent({type:'remote-interrupted'});if(!this.attack)this.beginAttack('melee');return false;}if(!config||!this.playing||this.paused||this.defeated||this.finished||this.effects.some(e=>SKILLS[e.kind]||(e.kind==='punch'&&e.age<PUNCH.impact))||this.time-this.lastCast[skill]<config.cooldown)return false;this.lowerShield();this.lastCast[skill]=this.time;this.stats.casts++;this.effects.push({kind:skill,age:0,duration:config.duration,hit:false});this.onEvent({type:'cast',skill});return true;}
  damage(amount,source='hit'){if(this.defeated||this.finished)return;if(source==='punch'){
      if(!this.inMelee)return;
      this.meleeHits++;
      if(this.meleeHits>=3){
        this.meleeHits=0;this.knockdowns++;this.retreatTarget=this.knockdowns%2===0?43:35;this.retreatUntil=this.time+1;this.attack=null;this.nextAttack=3;
        this.onEvent({type:'knockback',airborne:this.knockdowns%2===0});
      }
    }
    this.monsterHealth=Math.max(0,this.monsterHealth-amount);this.stats.hits++;this.onEvent({type:'hit',amount,source});
    if(this.attack&&this.attack.phase==='windup'&&amount>=40){this.attack=null;this.nextAttack=2.5;this.onEvent({type:'interrupt'});}
    if(this.monsterHealth===0){this.lowerShield();this.defeated=true;this.attack=null;this.stars+=3+this.wave;this.respawn=3;this.heroHealth=Math.min(100,this.heroHealth+15);this.guardEnergy=Math.min(100,this.guardEnergy+30);this.onEvent({type:'defeat',wave:this.wave});}this.emit();}
  beginAttack(kind){if(this.defeated||this.finished||this.attack)return;if(this.time<this.retreatUntil)return;const config=ATTACKS[kind];const fast=this.difficulty==='normal'?.8:1;this.attack={kind,phase:'windup',age:0,windup:config.windup*fast,flight:config.flight,originLean:this.lean,safeSide:this.attackIndex%2?-1:1};this.onEvent({type:'telegraph',attack:{...this.attack},config});}
  resolveAttack(){const attack=this.attack;if(!attack)return;const config=ATTACKS[attack.kind];let outcome='hit';
    const dodged=attack.kind==='sweep'?this.lean*attack.safeSide>.4:attack.kind!=='slam'&&Math.abs(this.lean-attack.originLean)>.48;
    if(dodged){outcome='dodge';this.stats.dodged++;this.combo++;this.stars++;}
    else if(this.guard&&this.guardEnergy>=SHIELD.blockCost){outcome='block';this.guardEnergy-=SHIELD.blockCost;if(this.guardEnergy<=SHIELD.blockCost)this.lowerShield();this.stats.blocked++;this.combo++;this.stars++;}
    else if(!this.practice){const damage=this.difficulty==='normal'?Math.round(config.damage*1.2):config.damage;this.heroHealth=Math.max(0,this.heroHealth-damage);this.stats.damageTaken+=damage;this.combo=0;}
    else outcome='practice';
    this.onEvent({type:'defense',outcome,kind:attack.kind});
    if(outcome==='hit'&&!this.practice)this.onEvent({type:'attacked'});
    this.attack=null;this.nextAttack=this.difficulty==='normal'?3.5:4.5;this.emit();
    if(this.heroHealth===0){this.finished=true;this.onEvent({type:'over',stars:this.stars,stats:{...this.stats}});}
  }
  update(dt){if(!this.playing||this.paused||this.finished||dt<=0)return;this.time+=dt;this.updateShield(dt);this.updateDistance(dt);
    for(const effect of this.effects){effect.age+=dt;const config=effect.kind==='punch'?PUNCH:SKILLS[effect.kind];if(config&&!effect.hit&&effect.age>=config.impact){effect.hit=true;this.damage(config.damage,effect.kind);}}
    this.effects=this.effects.filter(e=>e.age<e.duration);
    if(this.defeated){this.respawn-=dt;if(this.respawn<=0){if(this.wave===WAVES.length){this.finished=true;this.onEvent({type:'victory',stars:this.stars,stats:{...this.stats}});return;}this.enemyDistance=35;this.retreatTarget=35;this.retreatUntil=0;this.meleeHits=0;this.wave++;this.monsterMax=this.waveInfo.hp;this.monsterHealth=this.monsterMax;this.defeated=false;this.nextAttack=5;this.attackIndex=0;this.effects=[];this.onEvent({type:'wave',wave:this.wave,info:this.waveInfo});this.emit();}return;}
    if(this.attack){this.attack.age+=dt;if(this.attack.phase==='windup'&&this.attack.age>=this.attack.windup){this.attack.phase='flight';this.attack.age=0;this.onEvent({type:'enemy-cast',attack:{...this.attack}});}else if(this.attack.phase==='flight'&&this.attack.age>=this.attack.flight)this.resolveAttack();}
    else{this.nextAttack-=dt;if(this.nextAttack<=0){const attacks=this.waveInfo.attacks;const kind=this.inMelee?'melee':attacks[this.attackIndex%attacks.length];this.attackIndex++;this.beginAttack(kind);}}
  }
}
