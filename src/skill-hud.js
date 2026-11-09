import {SKILLS,SHIELD,ATTACKS} from './combat.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const names={beam:'梅特里姆光线',zepellion:'哉佩利敖光线',disc:'八分光轮',palm:'手掌光剑',guard:'光之护盾'};
const labels={beam:'十字',zepellion:'L 光线',disc:'光轮',palm:'光剑',guard:'护盾'};
const icons={
  beam:'<path d="M15 4v23M5 17h23M19 5l4 4m-2-6 4 4"/>',
  zepellion:'<path d="M22 4v22H5M18 4v18H5"/>',
  disc:'<ellipse cx="16" cy="16" rx="12" ry="7" transform="rotate(-25 16 16)"/><ellipse cx="16" cy="16" rx="6" ry="3.5" transform="rotate(-25 16 16)"/><path d="M26 4l-2 5M5 24l-2 4"/>',
  palm:'<path d="M10 26 5 17q-1-3 2-2l4 4V8q0-4 3-2v9-10q0-4 3-1v11-9q0-3 3-1v12-6q0-3 3-1v12l-4 5z"/>',
  guard:'<path d="m16 3 11 4v9q-1 8-11 13Q6 24 5 16V7zM11 11l10 10m0-10L11 21"/>'
};

/** Read the simulation clock and accepted pose state; never start a UI timer. */
export function skillHudStates(battle,pose=null) {
  return ['beam','zepellion','disc','palm','guard'].map(skill=>{
    const shield=skill==='guard',duration=shield?SHIELD.cooldown:SKILLS[skill].cooldown;
    const remaining=shield?battle.guardCooldown:Math.max(0,duration-(battle.time-battle.lastCast[skill]));
    let state='ready',progress=1,text='',description='就绪';
    const active=shield?battle.guard:battle.effects.some(e=>e.kind===skill);
    if(shield&&active){state='guarding';progress=clamp(battle.guardRemaining/SHIELD.duration);text=battle.guardRemaining.toFixed(1);description='防御中，剩余 '+text+' 秒';}
    else if(remaining>0){state='cooldown';progress=clamp(remaining/duration);text=(Math.ceil(remaining*10)/10).toFixed(1);description='冷却 '+text+' 秒';}
    else if(!shield&&battle.inMelee){state='locked';progress=0;description='先用普通拳拉开距离';}
    else if(shield&&battle.guardEnergy<=SHIELD.blockCost){state='empty';progress=clamp(battle.guardEnergy/(SHIELD.blockCost+1));description='能量恢复中';}
    else if(!battle.canAct||battle.effects.some(e=>SKILLS[e.kind])){state='busy';progress=0;description='等待出招结束';}
    else if(!shield){
      const preparation=skill==='disc'?battle.discGesture:null,stage=skill==='zepellion'?battle.zepellionStage:0;
      const charge=pose?.tracking&&pose.chargingSkill===skill?pose.charge:0;
      if(preparation||stage||charge>0){state='charging';progress=preparation?clamp(preparation.progress):skill==='zepellion'?clamp(stage===3?(2+charge)/3:stage?stage/3:charge/3):clamp(charge);description=preparation?.armed?'光轮就绪，向前甩出':stage===1?'聚气完成，双臂展开':stage===2?'展开完成，摆发射姿势':'保持姿势';}
    }
    return {skill,state,progress,text,active,description,name:names[skill],remaining};
  });
}

export class SkillHUD {
  constructor(parent,onUse){
    this.root=document.createElement('div');this.root.className='combat-skills';this.root.setAttribute('role','group');this.root.setAttribute('aria-label','技能状态');
    this.cells=new Map();this.lastUpdate=-Infinity;
    for(const skill of ['beam','zepellion','disc','palm','guard']){
      const button=document.createElement('button');button.type='button';button.className='combat-skill';button.dataset.skill=skill;
      button.innerHTML=`<span class="combat-skill-disc"><svg class="combat-skill-ring" viewBox="0 0 60 60" aria-hidden="true"><circle class="ring-track" cx="30" cy="30" r="26"/><circle class="ring-value" cx="30" cy="30" r="26" pathLength="100"/></svg><svg class="combat-skill-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">${icons[skill]}</svg><span class="combat-skill-time"></span><svg class="combat-skill-lock" viewBox="0 0 16 18" fill="none" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2M2 7h12v9H2z"/></svg></span><span class="combat-skill-label">${labels[skill]}</span>`;
      button.onclick=event=>{event.stopPropagation();if(button.getAttribute('aria-disabled')!=='true')onUse(skill);};
      this.root.append(button);this.cells.set(skill,{button,ring:button.querySelector('.ring-value'),time:button.querySelector('.combat-skill-time'),state:null});
    }
    parent.append(this.root);
  }
  update(battle,pose,now=performance.now()){
    if(now-this.lastUpdate<80)return;this.lastUpdate=now;
    for(const item of skillHudStates(battle,pose)){
      const cell=this.cells.get(item.skill),{button}=cell;
      const attack=battle.attack,untilImpact=attack?(attack.phase==='windup'?attack.windup-attack.age:0)+attack.flight-(attack.phase==='flight'?attack.age:0):Infinity;
      const needsGuard=item.skill==='guard'&&ATTACKS[attack?.kind]?.defense==='guard'&&untilImpact<=SHIELD.duration-.15&&!battle.guard&&!battle.paused;
      button.classList.toggle('needs-guard',needsGuard);
      button.querySelector('.combat-skill-label').textContent=needsGuard?'举盾':labels[item.skill];
      if(cell.state==='cooldown'&&item.state==='ready'&&!battle.paused){button.classList.remove('skill-ready-pop');void button.offsetWidth;button.classList.add('skill-ready-pop');}
      if(item.state!=='ready')button.classList.remove('skill-ready-pop');
      button.dataset.state=item.state;button.classList.toggle('is-active',item.active);
      cell.ring.style.strokeDashoffset=String(100*(1-item.progress));
      if(cell.time.textContent!==item.text)cell.time.textContent=item.text;
      const label=item.name+'，'+(needsGuard?'重击来袭，请举盾；':'')+item.description;if(button.getAttribute('aria-label')!==label){button.setAttribute('aria-label',label);button.title=label;}
      button.setAttribute('aria-disabled',String(!['ready','charging','guarding'].includes(item.state)||battle.paused));
      if(item.skill==='guard')button.setAttribute('aria-pressed',String(item.active));
      cell.state=item.state;
    }
  }
}
