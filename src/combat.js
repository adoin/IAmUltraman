import {locomotionFor,approachProgress,approachOpacity} from './locomotion.js';
﻿import {BEAM_TIMING,DISC_TIMING,ZEPELLION_TIMING,discTiming,beamTimingFor} from './action-timing.js';
export const WAVES = [
  {name:'雷德王',model:'redking',title:'海湾入侵者',hp:110,color:0xffcb7a,attacks:['bolt','charge','slam']},
  {name:'巴尔坦星人',model:'baltan',title:'宇宙忍者',hp:210,color:0x68d9ff,attacks:['bolt','charge','sweep']},
  {name:'加恩Q',model:'ganq',title:'巨眼的凝视',hp:185,color:0xee596d,attacks:['bolt','sweep','charge']},
  {name:'美菲拉斯星人',model:'mefilas',title:'幻影突袭',hp:200,color:0x62cfff,attacks:['sweep','bolt','charge']},
  {name:'卡欧斯 · 赛文',model:'chaos-seven',title:'暗影头镖',hp:265,color:0xdc7bff,attacks:['bolt','sweep','charge']},
  {name:'卡欧斯 · 泰罗',model:'chaos-taro',title:'暗之王冠',hp:285,color:0xff9a7b,attacks:['sweep','bolt','charge']},
  {name:'卡欧斯 · 奥特曼',model:'chaos-ultraman',title:'光之逆影',hp:305,color:0xc7a6ff,attacks:['bolt','charge','sweep']},
  {name:'杰顿',model:'zetton',title:'宇宙恐龙',hp:400,color:0xff7a5c,attacks:['bolt','sweep','charge']},
  {name:'机械哥莫拉',model:'gomora-mecha',title:'钢铁咆哮',hp:340,color:0xffb066,attacks:['sweep','slam','bolt','charge']},
  {name:'迦拉克隆',model:'galactron',title:'光之要塞',hp:440,color:0x7fe7ff,attacks:['sweep','bolt','slam','charge']},
  {name:'加坦杰厄',model:'gatanothor',title:'暗黑支配者',hp:560,color:0x9a8cff,attacks:['slam','sweep','bolt','charge']},
];
export const SKILLS={palm:{cooldown:2.2,damage:14,impact:.34,duration:.72},beam:{cooldown:6.5,damage:46,impact:BEAM_TIMING.impact,duration:BEAM_TIMING.end},zepellion:{cooldown:9,damage:82,impact:ZEPELLION_TIMING.impact,duration:ZEPELLION_TIMING.end},disc:{cooldown:2,damage:31,impact:DISC_TIMING.impact,duration:DISC_TIMING.end}};
export const PUNCH={cooldown:.28,damage:12,impact:.18,duration:.36};
export const SHIELD=Object.freeze({duration:2,cooldown:4,drain:10,recharge:14,blockCost:12});
/** The final monster defeat hands the screen to the victory dance before results. */
export const CELEBRATION=Object.freeze({duration:7.5});
export const MONSTER_ATTACK_NAMES={
  redking:{bolt:'岩石投掷',slam:'震地跺脚',melee:'近身直拳',charge:'蛮力冲锋'},
  baltan:{bolt:'白色破坏光弹',sweep:'冷冻光线',melee:'巴尔坦钳爪突刺',charge:'分身突进'},
  ganq:{bolt:'巨眼光弹',sweep:'巨眼射线',melee:'巨眼撞击',charge:'巨眼突进'},
  mefilas:{bolt:'美菲拉斯光弹',sweep:'念力波动',melee:'怪力直拳',charge:'瞬间移动'},
  'chaos-seven':{bolt:'艾梅利姆光线',sweep:'头镖飞旋',melee:'赛文式连击',charge:'暗影突进'},
  'chaos-taro':{bolt:'斯特利姆光线',sweep:'新斯特利姆光线',melee:'燕式踢',charge:'王者冲锋'},
  'chaos-ultraman':{bolt:'卡欧斯斯派修姆光线',sweep:'卡欧斯光轮',melee:'奥特拳',charge:'高速突进'},
  'gomora-mecha':{bolt:'机械光弹',sweep:'超振动波',slam:'大地踏击',melee:'机械重拳',charge:'蛮力突进'},
  zetton:{bolt:'一兆度火球',sweep:'杰顿光线',melee:'能量拳',charge:'瞬间移动'},
  galactron:{bolt:'迦拉克隆光线',sweep:'重力冲击波',slam:'巨体重压',melee:'腕刃斩击',charge:'暴走冲锋'},
  gatanothor:{bolt:'怪光线',sweep:'触手横扫',slam:'触手砸击',melee:'大镰重击',charge:'黑暗突进'},
};
export const ATTACKS={
  melee:{name:'近身重拳',hint:'胸前交叉双臂防御，或侧身闪避',damage:12,windup:.8,flight:.3},
  bolt:{name:'能量弹',hint:'向左右侧身躲开，或胸前交叉双臂防御',damage:14,windup:1.1,flight:.7},
  slam:{name:'大地震波',hint:'胸前交叉双臂，展开光之护盾',damage:20,windup:1.5,flight:.8},
  sweep:{name:'横扫光束',hint:'躲向发光区域，或交叉双臂防御',damage:17,windup:1.3,flight:.7},
  charge:{name:'巨兽冲锋',hint:'向侧面闪避，或用护盾挡住',damage:22,windup:.9,flight:.75},
};
// Waiting, telegraphing and recovery are separate knobs: pressure should come
// from less idle time, while children still see a readable incoming attack.
export const PACING=Object.freeze({
  easy:Object.freeze({rest:1.8,minRest:.9,interrupted:.85}),
  normal:Object.freeze({rest:1.45,minRest:.65,interrupted:.65}),
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Deterministic combat simulation, independent of rendering and camera inference. */
export class BattleEngine {
  constructor(onEvent=()=>{}){this.onEvent=onEvent;this.difficulty='easy';this.practice=false;this.reset();}
  reset(){this.loading=false;this.zepellionStage=0;this.rangedWindowUntil=0;this.rangedCursor=0;this.discGesture=null;this.enemyDistance=locomotionFor(WAVES[0].model).spawnDistance;this.retreatTarget=35;this.retreatUntil=0;this.meleeHits=0;this.knockdowns=0;this.lastPunch=-100;this.time=0;this.wave=1;this.stars=0;this.heroHealth=100;this.guardEnergy=100;this.guard=false;this.guardHeld=false;this.guardQueued=false;this.guardUntil=0;this.guardReadyAt=0;this.lean=0;this.effects=[];this.lastCast={beam:-100,zepellion:-100,disc:-100,palm:-100};this.monsterMax=WAVES[0].hp;this.monsterHealth=this.monsterMax;this.defeated=false;this.finished=false;this.celebrating=0;this.playing=false;this.paused=false;this.nextAttack=this.entranceDelay();this.attack=null;this.attackIndex=0;this.respawn=0;this.combo=0;this.stats={casts:0,hits:0,blocked:0,dodged:0,damageTaken:0};this.emit();}
  get waveInfo(){return WAVES[this.wave-1];}
  get pacing(){return PACING[this.difficulty]||PACING.easy;}
  entranceDelay(){return locomotionFor(this.waveInfo.model).startDelay;}
  attackDelay(){return Math.max(this.pacing.minRest,this.pacing.rest-(this.wave-1)*.1);}
  chooseAttack(){
    if(this.inMelee)return 'melee';
    // Telegraph early enough to close promptly, but never eat the earned
    // counter window while a player is pushing the monster back.
    const p=locomotionFor(this.waveInfo.model);const approachLead=p.prepare*(this.difficulty==='normal'?.8:1)+p.duration*.7;
    if(this.time+approachLead>=this.rangedWindowUntil)return 'charge';
    const ranged=this.waveInfo.attacks.filter(kind=>kind!=='charge');
    return ranged[this.rangedCursor++%ranged.length]||'charge';
  }
  start(){this.reset();this.playing=true;this.onEvent({type:'wave',wave:1,info:this.waveInfo});}
  emit(){this.onEvent({type:'state',wave:this.wave,stars:this.stars,hero:this.heroHealth,monster:this.monsterHealth/this.monsterMax*100,monsterHP:this.monsterHealth,monsterMax:this.monsterMax,dead:this.defeated,guard:this.guardEnergy,info:this.waveInfo});}
  get canAct(){return this.playing&&!this.paused&&!this.loading&&!this.defeated&&!this.finished;}
  get inMelee(){if(this.enemyDistance>18)return false;const a=this.attack;if(a?.approach?.mode==='blink'&&a.phase==='flight'&&approachOpacity(a.approach,a.age/a.flight)<.85)return false;return true;}
  interruptRemote(){
    const canceled=this.effects.filter(e=>e.kind!=='punch');
    if(!canceled.length)return;
    this.effects=this.effects.filter(e=>e.kind==='punch');
    this.onEvent({type:'remote-interrupted'});
  }
  updateDistance(dt){
    if(this.defeated)return;
    if(this.time<this.retreatUntil){this.enemyDistance=Math.min(this.retreatTarget,this.enemyDistance+34*dt);return;}
    if(this.attack?.kind==='charge'&&this.attack.phase==='flight'){const progress=clamp((this.attack.age+dt)/this.attack.flight,0,1),eased=approachProgress(this.attack.approach||locomotionFor(this.waveInfo.model),progress);this.enemyDistance=(this.attack.startDistance??this.enemyDistance)*(1-eased)+16.5*eased;}
    if(this.inMelee){this.discGesture=null;this.zepellionStage=0;this.interruptRemote();}
  }
  get guardRemaining(){return this.guard?Math.max(0,this.guardUntil-this.time):0;}
  get guardCooldown(){return Math.max(0,this.guardReadyAt-this.time);}
  raiseShield(){
    if(!this.canAct||this.guard||this.guardCooldown>0)return false;
    if(this.guardEnergy<=SHIELD.blockCost||this.effects.length)return false;
    this.zepellionStage=0;this.discGesture=null;this.guard=true;
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
    if(this.guardHeld){const raised=this.raiseShield();this.guardQueued=!raised&&this.canAct&&this.guardCooldown===0&&this.guardEnergy>SHIELD.blockCost&&this.effects.length>0;}else{this.guardQueued=false;this.lowerShield();}
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
  punch(side='right'){if(!this.canAct||this.effects.some(e=>SKILLS[e.kind])||this.time-(this.lastPunch??-100)<PUNCH.cooldown)return false;this.lastPunch=this.time;this.discGesture=null;this.lowerShield();this.zepellionStage=0;this.stats.punches=(this.stats.punches||0)+1;this.effects.push({kind:'punch',side,age:0,duration:PUNCH.duration,hit:false});this.onEvent({type:'punch',side});return true;}
  setDiscPreparation(preparation){this.discGesture=this.canAct&&!this.guard&&!this.inMelee&&this.time-this.lastCast.disc>=SKILLS.disc.cooldown&&!this.effects.some(e=>SKILLS[e.kind])?preparation:null;}
  setPoseStage(stage){this.zepellionStage=this.canAct&&!this.guard&&!this.inMelee&&!this.discGesture&&!this.effects.some(e=>SKILLS[e.kind])?Math.max(0,Math.min(3,stage|0)):0;}
  cast(skill,side='right'){const config=SKILLS[skill];if(config&&this.inMelee&&this.canAct){this.onEvent({type:'remote-interrupted'});if(!this.attack)this.beginAttack('melee');return false;}if(!config||!this.canAct||this.effects.some(e=>SKILLS[e.kind]||(e.kind==='punch'&&e.age<PUNCH.impact))||this.time-this.lastCast[skill]<config.cooldown)return false;this.lowerShield();const prepared=skill==='disc'?!!this.discGesture?.armed&&this.discGesture.side===side:skill==='zepellion'&&this.zepellionStage===3,timing=skill==='disc'?discTiming({prepared}):skill==='zepellion'?beamTimingFor(skill,prepared):null;this.lastCast[skill]=this.time;this.stats.casts++;this.effects.push({kind:skill,side,prepared,timing,age:0,duration:timing?.end??config.duration,impact:timing?.impact??config.impact,hit:false});this.discGesture=null;this.zepellionStage=0;this.onEvent({type:'cast',skill,side,prepared,timing});return true;}
  damage(amount,source='hit',side=null){if(this.defeated||this.finished)return;if(source==='punch'){
      if(!this.inMelee)return;
      this.meleeHits++;
      if(this.meleeHits>=3){
        this.meleeHits=0;this.knockdowns++;this.retreatTarget=this.knockdowns%2===0?43:35;this.retreatUntil=this.time+1;this.rangedWindowUntil=this.time+3.2;this.attack=null;this.nextAttack=Math.max(1.2,this.attackDelay()-0.6);
        this.onEvent({type:'knockback',airborne:this.knockdowns%2===0});
      }
    }
    this.monsterHealth=Math.max(0,this.monsterHealth-amount);this.stats.hits++;this.onEvent({type:'hit',amount,source,side});
    if(this.attack&&this.attack.phase==='windup'&&this.attack.kind!=='charge'&&amount>=40){this.attack=null;this.nextAttack=this.pacing.interrupted;this.onEvent({type:'interrupt'});}
    if(this.monsterHealth===0){this.lowerShield();this.defeated=true;this.attack=null;this.stars+=3+this.wave;this.respawn=3;this.heroHealth=Math.min(100,this.heroHealth+15);this.guardEnergy=Math.min(100,this.guardEnergy+30);this.onEvent({type:'defeat',wave:this.wave});}this.emit();}
  beginAttack(kind,{opening=false}={}){if(this.defeated||this.finished||this.attack)return;if(this.time<this.retreatUntil)return;const config=ATTACKS[kind],approach=kind==='charge'?locomotionFor(this.waveInfo.model):null;const fast=this.difficulty==='normal'?.8:1;this.attack={kind,approach,damage:approach?approach.damage:config.damage,name:approach?.label||MONSTER_ATTACK_NAMES[this.waveInfo.model]?.[kind]||config.name,phase:'windup',age:0,windup:(approach?approach.prepare:config.windup)*fast,flight:approach?approach.duration*(this.difficulty==='normal'?.9:1):config.flight,originLean:this.lean,safeSide:this.attackIndex%2?-1:1};this.onEvent({type:'telegraph',attack:{...this.attack},config:{...config,name:this.attack.name,hint:approach&&approach.mode!=='ram'?'怪兽正在接近，准备近身出拳':config.hint}});}
  resolveAttack(){const attack=this.attack;if(!attack)return;if(attack.approach&&attack.approach.mode!=='ram'){this.attack=null;this.nextAttack=attack.approach.recovery;this.onEvent({type:'approach-end',mode:attack.approach.mode});this.emit();return;}const config=ATTACKS[attack.kind];let outcome='hit';
    const dodged=attack.kind==='sweep'?this.lean*attack.safeSide>.4:attack.kind!=='slam'&&Math.abs(this.lean-attack.originLean)>.48;
    if(dodged){outcome='dodge';this.stats.dodged++;this.combo++;this.stars++;}
    else if(this.guard&&this.guardEnergy>=SHIELD.blockCost){outcome='block';this.guardEnergy-=SHIELD.blockCost;if(this.guardEnergy<=SHIELD.blockCost)this.lowerShield();this.stats.blocked++;this.combo++;this.stars++;}
    else if(!this.practice){const damage=this.difficulty==='normal'?Math.round((attack.damage??config.damage)*1.2):(attack.damage??config.damage);this.heroHealth=Math.max(0,this.heroHealth-damage);this.stats.damageTaken+=damage;this.combo=0;}
    else outcome='practice';
    this.onEvent({type:'defense',outcome,kind:attack.kind});
    if(outcome==='hit'&&!this.practice)this.onEvent({type:'attacked'});
    this.attack=null;this.nextAttack=this.inMelee?this.attackDelay():Math.min(this.pacing.interrupted,this.attackDelay());this.emit();
    if(this.heroHealth===0){this.finished=true;this.onEvent({type:'over',stars:this.stars,stats:{...this.stats}});}
  }
  update(dt){if(!this.playing||this.paused||this.loading||dt<=0)return;
    if(this.celebrating>0){
      this.time+=dt;this.celebrating=Math.max(0,this.celebrating-dt);
      if(this.celebrating===0)this.onEvent({type:'celebration-end',stars:this.stars,stats:{...this.stats}});
      return;
    }
    if(this.finished)return;
    this.time+=dt;this.updateShield(dt);this.updateDistance(dt);
    for(const effect of this.effects){effect.age+=dt;const config=effect.kind==='punch'?PUNCH:SKILLS[effect.kind];if(config&&!effect.hit&&effect.age>=(effect.impact??config.impact)){effect.hit=true;this.damage(config.damage,effect.kind,effect.side);}}
    this.effects=this.effects.filter(e=>e.age<e.duration);
    if(this.guardQueued&&this.guardHeld&&!this.effects.length){this.guardQueued=false;this.raiseShield();}
    if(this.defeated){this.respawn-=dt;if(this.respawn<=0){if(this.wave===WAVES.length){this.finished=true;this.celebrating=CELEBRATION.duration;this.onEvent({type:'victory',stars:this.stars,stats:{...this.stats}});return;}this.enemyDistance=35;this.retreatTarget=35;this.retreatUntil=0;this.meleeHits=0;this.wave++;this.enemyDistance=locomotionFor(this.waveInfo.model).spawnDistance;this.monsterMax=this.waveInfo.hp;this.monsterHealth=this.monsterMax;this.defeated=false;this.nextAttack=this.entranceDelay();this.attackIndex=0;this.rangedCursor=0;this.rangedWindowUntil=0;this.effects=[];this.onEvent({type:'wave',wave:this.wave,info:this.waveInfo});this.emit();}return;}
    if(this.attack){this.attack.age+=dt;if(this.attack.phase==='windup'&&this.attack.age>=this.attack.windup){this.attack.phase='flight';this.attack.age=0;this.attack.startDistance=this.enemyDistance;this.onEvent({type:'enemy-cast',attack:{...this.attack}});}else if(this.attack.phase==='flight'&&this.attack.age>=this.attack.flight)this.resolveAttack();}
    else{this.nextAttack-=dt;if(this.nextAttack<=0){const kind=this.chooseAttack();const opening=this.attackIndex===0;this.attackIndex++;this.beginAttack(kind,{opening});}}
  }
}
