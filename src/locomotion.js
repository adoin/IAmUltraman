// Locomotion is an approach, not a contact attack. Only Gan-Q deliberately rams.
const common={mode:'walk',prepare:.1,duration:2.4,spawnDistance:32,startDelay:.1,recovery:.45,duty:.64,stride:.62,lift:.12,drop:.1,bob:.012,sway:.025,armSwing:.25,arms:'low',weight:1,metal:false};
const definitions={
 redking:{label:'重步逼近',spawnDistance:30,startDelay:.05,duration:2.35,duty:.66,arms:'reptile',weight:1.4,sway:.035,armSwing:.18},
 baltan:{label:'分身瞬移',mode:'blink',prepare:.45,duration:.85,startDelay:.25,recovery:.6,arms:'claws',weight:0,portal:'rings'},
 ganq:{label:'巨眼撞击',mode:'ram',prepare:.7,duration:.8,startDelay:.4,recovery:.5,damage:22,weight:0},
 mefilas:{label:'从容逼近',prepare:.3,duration:2.35,spawnDistance:31,arms:'composed',armSwing:.08,weight:.65,sway:.018},
 'chaos-seven':{label:'战术跑进',mode:'run',duration:1.65,prepare:.16,duty:.44,stride:.8,lift:.24,bob:.04,arms:'guard',armSwing:.55,weight:.8},
 'chaos-taro':{label:'疾步压上',mode:'run',duration:1.4,prepare:.18,duty:.42,stride:.85,lift:.26,bob:.055,arms:'runner',armSwing:.75,weight:1},
 'chaos-ultraman':{label:'格斗步接近',mode:'run',duration:1.8,prepare:.12,duty:.49,stride:.7,lift:.18,bob:.025,arms:'guard',armSwing:.38,weight:.9},
 zetton:{label:'空间转移',mode:'blink',prepare:.5,duration:.95,startDelay:.2,recovery:.65,arms:'guard',weight:0,portal:'pillar'},
 'gomora-mecha':{label:'铁甲进军',mode:'march',duration:2.6,duty:.69,stride:.65,lift:.1,drop:.12,bob:.008,sway:.008,arms:'heavy',armSwing:.12,weight:1.6,metal:true},
 galactron:{label:'重装步进',mode:'march',duration:3,duty:.67,stride:.6,lift:.09,drop:.1,bob:.004,sway:.004,arms:'guard',armSwing:.04,weight:1.2,metal:true},
 gatanothor:{label:'重躯缓行',mode:'creep',prepare:.2,duration:3.1,spawnDistance:33,duty:.73,stride:.43,lift:.07,drop:.11,bob:.006,arms:'tentacles',weight:1.7,sway:.01,armSwing:.45},
};
export const LOCOMOTION=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([model,p])=>[model,Object.freeze({...common,...p,model,damage:p.damage||0})])));
export const locomotionFor=model=>LOCOMOTION[model]||Object.freeze({...common,model,mode:'hover',label:'悬浮接近',damage:0});
const clamp=t=>Math.max(0,Math.min(1,t));const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
export function approachProgress(profile,phase){const p=clamp(phase);if(profile.mode==='blink')return smooth((p-.38)/.16);const edge=.12,normal=1-edge;if(p<edge)return p*p/(2*edge*normal);if(p>1-edge)return 1-(1-p)**2/(2*edge*normal);return(p-edge/2)/normal;}
export function approachOpacity(profile,phase){if(profile.mode!=='blink')return 1;const p=clamp(phase);return p<.2?1-smooth(p/.2):p<.65?0:smooth((p-.65)/.35);}
export function gaitSample(distance,stride,side,profile){const cycle=2*stride,q=distance/cycle+profile.duty/2+(side==='R'?.5:0),index=Math.floor(q),p=q-index,planted=p<profile.duty,half=stride*profile.duty;const swing=(p-profile.duty)/(1-profile.duty);return{planted,cycle:index,phase:p,forward:planted?half-cycle*p:-half+2*half*smooth(swing),lift:planted?0:Math.sin(Math.PI*swing),stepIndex:Math.floor((distance/cycle-(.5-profile.duty/2))*2)};}
