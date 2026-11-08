import {BEAM_TIMING,DISC_TIMING,discTiming} from './action-timing.js';
export const WAVES = [
  {name:'雷德王',model:'redking',title:'海湾入侵者',hp:110,color:0xffcb7a,attacks:['bolt','charge','slam']},
  {name:'巴尔坦星人',model:'baltan',title:'宇宙忍者',hp:210,color:0x68d9ff,attacks:['bolt','charge','sweep']},
  {name:'巴尔坦星人 · 量产型',model:'baltan-basic',title:'分身战术',hp:235,color:0x5fd0ff,attacks:['bolt','sweep','charge']},
  {name:'加恩Q',model:'ganq',title:'巨眼的凝视',hp:185,color:0xee596d,attacks:['bolt','sweep','charge']},
  {name:'美菲拉斯星人',model:'mefilas',title:'幻影突袭',hp:200,color:0x62cfff,attacks:['sweep','bolt','charge']},
  {name:'巴尔坦星人 · 强化体',model:'baltan-powered',title:'能量增幅',hp:250,color:0x7ee0ff,attacks:['bolt','charge','sweep']},
  {name:'机械巴尔坦',model:'baltan-mecha',title:'改造追击者',hp:270,color:0x9ad7e8,attacks:['sweep','bolt','charge']},
  {name:'卡欧斯 · 赛文',model:'chaos-seven',title:'暗影头镖',hp:265,color:0xdc7bff,attacks:['bolt','sweep','charge']},
  {name:'卡欧斯 · 泰罗',model:'chaos-taro',title:'暗之王冠',hp:285,color:0xff9a7b,attacks:['sweep','bolt','charge']},
  {name:'卡欧斯 · 奥特曼',model:'chaos-ultraman',title:'光之逆影',hp:305,color:0xc7a6ff,attacks:['bolt','charge','sweep']},
  {name:'杰顿',model:'zetton',title:'宇宙恐龙',hp:400,color:0xff7a5c,attacks:['bolt','sweep','charge']},
  {name:'机械哥莫拉',model:'gomora-mecha',title:'钢铁咆哮',hp:340,color:0xffb066,attacks:['slam','bolt','charge']},
  {name:'迦拉克隆',model:'galactron',title:'光之要塞',hp:440,color:0x7fe7ff,attacks:['sweep','bolt','slam']},
  {name:'加坦杰厄',model:'gatanothor',title:'暗黑支配者',hp:560,color:0x9a8cff,attacks:['slam','sweep','bolt','charge']},
];
export const SKILLS={palm:{cooldown:2.2,damage:14,impact:.34,duration:.72},beam:{cooldown:6.5,damage:46,impact:BEAM_TIMING.impact,duration:BEAM_TIMING.end},zepellion:{cooldown:9,damage:82,impact:BEAM_TIMING.impact,duration:BEAM_TIMING.end},disc:{cooldown:2,damage:31,impact:DISC_TIMING.impact,duration:DISC_TIMING.end}};
export const PUNCH={cooldown:.28,damage:12,impact:.18,duration:.36};
export const SHIELD=Object.freeze({duration:2,cooldown:4,drain:10,recharge:14,blockCost:12});
/** The final monster defeat hands the screen to the victory dance before results. */
export const CELEBRATION=Object.freeze({duration:7.5});
export const MONSTER_ATTACK_NAMES={
  redking:{bolt:'岩石投掷',slam:'震地跺脚',melee:'近身直拳',charge:'蛮力冲锋'},
  baltan:{bolt:'钳爪光弹',sweep:'钳爪光线',melee:'钳爪突刺',charge:'幻影突进'},
  'baltan-basic':{bolt:'分身光弹',sweep:'分身光线',melee:'钳爪突刺',charge:'影分身突进'},
  ganq:{bolt:'巨眼光弹',sweep:'巨眼射线',melee:'巨眼撞击',charge:'巨眼突进'},
  mefilas:{bolt:'星人光弹',sweep:'星人射线',melee:'星人直拳',charge:'瞬移突进'},
  'baltan-powered':{bolt:'强化光弹',sweep:'增幅光线',melee:'钳爪猛击',charge:'能量冲锋'},
  'baltan-mecha':{bolt:'机械光弹',sweep:'切割光线',melee:'钢爪突刺',charge:'推进冲锋'},
  'chaos-seven':{bolt:'艾梅利姆光弹',sweep:'头镖横扫',melee:'暗影格斗拳',charge:'暗影突进'},
  'chaos-taro':{bolt:'宇宙光弹',sweep:'王者射线',melee:'宇宙拳击',charge:'王冠冲锋'},
  'chaos-ultraman':{bolt:'斯派修姆光弹',sweep:'逆光斯派修姆',melee:'奥特拳',charge:'高速突进'},
  'gomora-mecha':{bolt:'机械光线',sweep:'超振动波',melee:'机械重拳',charge:'蛮力冲锋'},
  zetton:{bolt:'一兆度火球',sweep:'杰顿光线',melee:'能量拳',charge:'瞬移突进'},
  galactron:{bolt:'迦拉克隆光线',sweep:'重力冲击波',melee:'巨体重击',charge:'暴走冲锋'},
  gatanothor:{bolt:'暗黑光弹',sweep:'触手横扫',melee:'巨钳重击',charge:'黑暗突进'},
};
export const ATTACKS={
  melee:{name:'近身重拳',hint:'胸前交叉双臂防御，或侧身闪避',damage:12,windup:1.0,flight:.3},
  bolt:{name:'能量弹',hint:'向左右侧身躲开，或胸前交叉双臂防御',damage:14,windup:2.2,flight:1.15},
  slam:{name:'大地震波',hint:'胸前交叉双臂，展开光之护盾',damage:20,windup:2.6,flight:1.25},
  sweep:{name:'横扫光束',hint:'躲向发光区域，或交叉双臂防御',damage:17,windup:2.4,flight:1.1},
  charge:{name:'巨兽冲锋',hint:'向侧面闪避，或用护盾挡住',damage:22,windup:2.7,flight:1.15},
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Deterministic combat simulation, independent of rendering and camera inference. */
export class BattleEngine {
  constructor(onEvent=()=>{}){this.onEvent=onEvent;this.difficulty='easy';this.practice=false;this.reset();}
  reset(){this.discGesture=null;this.enemyDistance=35;this.retreatTarget=35;this.retreatUntil=0;this.meleeHits=0;this.knockdowns=0;this.lastPunch=-100;this.time=0;this.wave=1;this.stars=0;this.heroHealth=100;this.guardEnergy=100;this.guard=false;this.guardHeld=false;this.guardUntil=0;this.guardReadyAt=0;this.lean=0;this.effects=[];this.lastCast={beam:-100,zepellion:-100,disc:-100,palm:-100};this.monsterMax=WAVES[0].hp;this.monsterHealth=this.monsterMax;this.defeated=false;this.finished=false;this.celebrating=0;this.playing=false;this.paused=false;this.nextAttack=3.5;this.attack=null;this.attackIndex=0;this.respawn=0;this.combo=0;this.stats={casts:0,hits:0,blocked:0,dodged:0,damageTaken:0};this.emit();}
  get waveInfo(){return WAVES[this.wave-1];}
  start(){this.reset();this.playing=true;this.onEvent({type:'wave',wave:1,info:this.waveInfo});}
  emit(){this.onEvent({type:'state',wave:this.wave,stars:this.stars,hero:this.heroHealth,monster:this.monsterHealth/this.monsterMax*100,monsterHP:this.monsterHealth,monsterMax:this.monsterMax,dead:this.defeated,guard:this.guardEnergy,info:this.waveInfo});}
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
    if(this.attack?.kind==='charge'&&this.attack.phase==='flight'){const progress=clamp((this.attack.age+dt)/this.attack.flight,0,1),eased=progress*progress*(3-2*progress);this.enemyDistance=(this.attack.startDistance??this.enemyDistance)*(1-eased)+16.5*eased;}
    if(this.inMelee){this.discGesture=null;this.interruptRemote();}
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
  punch(side='right'){if(!this.playing||this.paused||this.defeated||this.finished||this.effects.some(e=>SKILLS[e.kind])||this.time-(this.lastPunch??-100)<PUNCH.cooldown)return false;this.lastPunch=this.time;this.discGesture=null;this.lowerShield();this.stats.punches=(this.stats.punches||0)+1;this.effects.push({kind:'punch',side,age:0,duration:PUNCH.duration,hit:false});this.onEvent({type:'punch',side});return true;}
  setDiscPreparation(preparation){this.discGesture=this.playing&&!this.paused&&!this.defeated&&!this.finished&&!this.guard&&!this.inMelee&&this.time-this.lastCast.disc>=SKILLS.disc.cooldown&&!this.effects.some(e=>SKILLS[e.kind])?preparation:null;}
  cast(skill,side='right'){const config=SKILLS[skill];if(config&&this.inMelee&&this.playing&&!this.paused&&!this.finished&&!this.defeated){this.onEvent({type:'remote-interrupted'});if(!this.attack)this.beginAttack('melee');return false;}if(!config||!this.playing||this.paused||this.defeated||this.finished||this.effects.some(e=>SKILLS[e.kind]||(e.kind==='punch'&&e.age<PUNCH.impact))||this.time-this.lastCast[skill]<config.cooldown)return false;this.lowerShield();const prepared=skill==='disc'&&!!this.discGesture?.armed&&this.discGesture.side===side,timing=skill==='disc'?discTiming({prepared}):null;this.lastCast[skill]=this.time;this.stats.casts++;this.effects.push({kind:skill,side,prepared,age:0,duration:timing?.end??config.duration,impact:timing?.impact??config.impact,hit:false});this.discGesture=null;this.onEvent({type:'cast',skill,side,prepared,timing});return true;}
  damage(amount,source='hit',side=null){if(this.defeated||this.finished)return;if(source==='punch'){
      if(!this.inMelee)return;
      this.meleeHits++;
      if(this.meleeHits>=3){
        this.meleeHits=0;this.knockdowns++;this.retreatTarget=this.knockdowns%2===0?43:35;this.retreatUntil=this.time+1;this.attack=null;this.nextAttack=3;
        this.onEvent({type:'knockback',airborne:this.knockdowns%2===0});
      }
    }
    this.monsterHealth=Math.max(0,this.monsterHealth-amount);this.stats.hits++;this.onEvent({type:'hit',amount,source,side});
    if(this.attack&&this.attack.phase==='windup'&&amount>=40){this.attack=null;this.nextAttack=2.5;this.onEvent({type:'interrupt'});}
    if(this.monsterHealth===0){this.lowerShield();this.defeated=true;this.attack=null;this.stars+=3+this.wave;this.respawn=3;this.heroHealth=Math.min(100,this.heroHealth+15);this.guardEnergy=Math.min(100,this.guardEnergy+30);this.onEvent({type:'defeat',wave:this.wave});}this.emit();}
  beginAttack(kind){if(this.defeated||this.finished||this.attack)return;if(this.time<this.retreatUntil)return;const config=ATTACKS[kind];const fast=this.difficulty==='normal'?.8:1;this.attack={kind,name:MONSTER_ATTACK_NAMES[this.waveInfo.model]?.[kind]||config.name,phase:'windup',age:0,windup:config.windup*fast,flight:config.flight,originLean:this.lean,safeSide:this.attackIndex%2?-1:1};this.onEvent({type:'telegraph',attack:{...this.attack},config:{...config,name:this.attack.name}});}
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
  update(dt){if(!this.playing||this.paused||dt<=0)return;
    if(this.celebrating>0){
      this.time+=dt;this.celebrating=Math.max(0,this.celebrating-dt);
      if(this.celebrating===0)this.onEvent({type:'celebration-end',stars:this.stars,stats:{...this.stats}});
      return;
    }
    if(this.finished)return;
    this.time+=dt;this.updateShield(dt);this.updateDistance(dt);
    for(const effect of this.effects){effect.age+=dt;const config=effect.kind==='punch'?PUNCH:SKILLS[effect.kind];if(config&&!effect.hit&&effect.age>=(effect.impact??config.impact)){effect.hit=true;this.damage(config.damage,effect.kind,effect.side);}}
    this.effects=this.effects.filter(e=>e.age<e.duration);
    if(this.defeated){this.respawn-=dt;if(this.respawn<=0){if(this.wave===WAVES.length){this.finished=true;this.celebrating=CELEBRATION.duration;this.onEvent({type:'victory',stars:this.stars,stats:{...this.stats}});return;}this.enemyDistance=35;this.retreatTarget=35;this.retreatUntil=0;this.meleeHits=0;this.wave++;this.monsterMax=this.waveInfo.hp;this.monsterHealth=this.monsterMax;this.defeated=false;this.nextAttack=5;this.attackIndex=0;this.effects=[];this.onEvent({type:'wave',wave:this.wave,info:this.waveInfo});this.emit();}return;}
    if(this.attack){this.attack.age+=dt;if(this.attack.phase==='windup'&&this.attack.age>=this.attack.windup){this.attack.phase='flight';this.attack.age=0;this.attack.startDistance=this.enemyDistance;this.onEvent({type:'enemy-cast',attack:{...this.attack}});}else if(this.attack.phase==='flight'&&this.attack.age>=this.attack.flight)this.resolveAttack();}
    else{this.nextAttack-=dt;if(this.nextAttack<=0){const attacks=this.waveInfo.attacks;const kind=this.inMelee?'melee':attacks[this.attackIndex%attacks.length];this.attackIndex++;this.beginAttack(kind);}}
  }
}
