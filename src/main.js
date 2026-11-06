import {GameAudio} from './game-audio.js';
import { BattleScene } from './scene.js';
import { GestureRecognizer } from './gestures.js';
import {PoseService} from './pose-service.js';
import {BattleEngine, ATTACKS, SKILLS, SHIELD} from './combat.js';
const $=id=>document.getElementById(id);
const recognizer=new GestureRecognizer();
const audio=new GameAudio();audio.prepare();
let video=null;
const state={started:false,starting:false,manualPause:false,mode:'keyboard',workerReady:false,busy:false,epoch:0,lastFrame:-1,lastDetect:0,lastResult:0,stream:null,url:null,sound:true,context:null,debug:[],tracking:false,delegate:'',pending:false,keys:new Set(),gestureGuard:false,gestureLean:0,dodgeUntil:0,dodgeDirection:0};
let calloutTimer;
function say(text,duration=1800){$('callout').textContent=text;$('callout').classList.add('visible');clearTimeout(calloutTimer);calloutTimer=setTimeout(()=>$('callout').classList.remove('visible'),duration);}
function battleEvent(event){
  if(scene)audio.event(event,scene);
  if(event.type==='state'){$('wave').textContent=event.wave;$('score').textContent=`守护星星 ${event.stars}`;$('hero-health').style.width=event.hero+'%';$('monster-health').style.width=event.monster+'%';$('hero-hp').textContent=`${Math.ceil(event.hero)} / 100`;$('monster-hp').textContent=`${Math.ceil(event.monsterHP)} / ${event.monsterMax}`;$('monster-name').textContent=event.info.name;$('monster-type').textContent=event.info.title;$('mission-number').textContent=String(event.wave).padStart(2,'0');$('guard-fill').style.width=event.guard+'%';$('guard-value').textContent=Math.ceil(event.guard);}
  if(event.type==='cast'){say(event.skill==='beam'?'梅特里姆光线！':event.skill==='palm'?'手掌光箭！':'八分光轮！',1000);log('释放 '+event.skill);}
  if(event.type==='defeat'){say('太棒了！又守护了一片街区',2000);$('scene-status').textContent='怪兽退散，城市的灯又亮起来了';}
  if(event.type==='wave'){say(event.wave===5?'最后一战，相信光！':`第 ${event.wave} 波 · 新的挑战`);$('scene-status').textContent='摆出招式，守护城市';}
  if(event.type==='attacked'){$('scene-status').textContent='守护能量正在消耗，释放绝招击退怪兽';}
  if(event.type==='telegraph'){$('threat').hidden=false;$('threat-name').textContent=`${event.config.name} · 正在蓄力`;$('threat-hint').textContent=event.attack.kind==='sweep'?`向${event.attack.safeSide>0?'右':'左'}侧身，或交叉双臂防御`:event.config.hint;}
  if(event.type==='enemy-cast'){$('threat-name').textContent=`${event.attack.name||ATTACKS[event.attack.kind].name} · 来了！`;}
  if(event.type==='interrupt'){$('threat').hidden=true;say('打断成功！',1000);}
  if(event.type==='defense'){$('threat').hidden=true;if(event.outcome==='block'){say('护盾挡住了！',1000);}if(event.outcome==='dodge'){say('漂亮的闪避！',1000);}}
  if(event.type==='wave'||event.type==='defeat')$('threat').hidden=true;
  if(event.type==='assets-ready'){$('load-status').textContent=state.workerReady?'海湾准备就绪':'场景已就绪，正在准备动作识别…';$('load-status').classList.toggle('ready',state.workerReady);}
  if(event.type==='load-error'||event.type==='graphics-lost'){$('load-status').textContent=event.type==='graphics-lost'?'画面连接中断，请刷新页面重试':'模型加载失败，请检查网络后刷新';$('welcome').hidden=false;$('start-camera').disabled=true;$('start-keyboard').disabled=true;}
  if(event.type==='victory'||event.type==='over'){leaveBattleView();const win=event.type==='victory';$('pause-panel').querySelector('.little-tag').textContent=win?'你就是城市的光':'每一次尝试，都会更勇敢';$('pause-panel').querySelector('h2').textContent=win?'守护成功！':'小英雄，补充能量吧';$('pause-panel').querySelector('p').textContent=`收集了 ${event.stars} 颗守护星星。${win?'日落海湾为你欢呼！':'休息一下，再来挑战！'}`;$('resume').hidden=true;$('restart').textContent='再来一次 →';$('pause-panel').hidden=false;}
}
let scene;
try{scene=new BattleScene($('game'),battleEvent);}catch(error){scene=new BattleEngine(battleEvent);scene.ready=Promise.reject(error);scene.ready.catch(()=>{});$('load-status').textContent='无法开启 3D 画面，请启用浏览器硬件加速后刷新';$('start-camera').disabled=true;$('start-keyboard').disabled=true;}
function enterBattleView(){document.body.classList.add('in-battle');$('game').focus({preventScroll:true});window.scrollTo(0,0);scene.resize?.();}
function leaveBattleView(){document.body.classList.remove('in-battle');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});scene.resize?.();}
function log(text){state.debug.unshift(`${new Date().toLocaleTimeString()} ${text}`);state.debug=state.debug.slice(0,6);}
async function start(){await audio.unlock();if(state.started)return;if(state.starting)return;state.starting=true;try{await scene.ready;if(pose.promise)await pose.promise.catch(()=>{});if(state.mode==='camera')await waitForInputFrame(state.epoch);state.started=true;enterBattleView();audio.setActive(true);scene.start();$('welcome').hidden=true;$('pause').hidden=false;$('scene-status').textContent='十字发光线 · 胸前交叉开护盾 · 侧身躲攻击';say('相信自己，相信光！');syncPause();}catch{$('load-status').textContent='游戏尚未准备好，请检查影像或刷新重试';}finally{state.starting=false;}}
function syncPause(){scene.paused=state.manualPause||!!document.querySelector('dialog[open]')||document.hidden;audio.setActive(state.started&&!scene.paused&&!scene.finished);}
function manualPause(value){if(!state.started||scene.finished)return;clearDefense();state.manualPause=value;if(value)leaveBattleView();else enterBattleView();$('pause-panel').hidden=!value;$('resume').hidden=false;$('pause-panel').querySelector('h2').textContent='小英雄休息中';$('pause-panel').querySelector('p').textContent='准备好了，就继续守护城市。';$('pause-panel').querySelector('.little-tag').textContent='补充一点光的力量';$('pause').textContent=value?'▶':'Ⅱ';$('pause').setAttribute('aria-label',value?'继续游戏':'暂停游戏');recognizer.reset();syncPause();}
async function cast(skill,side='right'){audio.unlock();if(!state.started)await start();scene.cast(skill,side);}
$('start-keyboard').onclick=()=>{if(video||state.pending||state.mode!=='keyboard')stopInput();return start();};
let nextFist='left';async function punch(side){audio.unlock();if(!state.started)await start();if(typeof side!=='string')side=nextFist;if(scene.punch(side))nextFist=side==='left'?'right':'left';}
$('punch-button').onclick=punch;
$('game').addEventListener('click',()=>{if(document.body.classList.contains('in-battle'))punch();});
$('game').addEventListener('touchstart',e=>{if(e.touches.length>1&&document.body.classList.contains('in-battle')){e.preventDefault();manualPause(true);}},{passive:false});
$('beam-button').onclick=()=>cast('beam');$('disc-button').onclick=()=>cast('disc');$('palm-button').onclick=()=>cast('palm');
$('pause').onclick=()=>manualPause(!state.manualPause);$('resume').onclick=async()=>{if(pose.promise)await pose.promise.catch(()=>{});manualPause(false);};
$('restart').onclick=async()=>{if(pose.promise)await pose.promise.catch(()=>{});clearDefense();$('threat').hidden=true;enterBattleView();audio.setActive(true);scene.start();state.manualPause=false;$('pause-panel').hidden=true;recognizer.reset();syncPause();say('新的冒险，出发！');};
const heldKeys=new Set(['a','d','l','arrowleft','arrowright']);
const battleKeys=new Set([...heldKeys,'w','f','z','x','j','k','o','p','escape',' ']);
function gameplayKey(event){
  if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return '';
  if(document.querySelector('dialog[open]')||event.target?.closest?.('input,select,textarea,[contenteditable="true"]'))return '';
  const key=event.key.toLowerCase();
  if(!battleKeys.has(key))return '';
  if(document.body.classList.contains('in-battle')){
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  return key;
}
function syncDefenseInput(now=performance.now()){
  const left=state.keys.has('a')||state.keys.has('arrowleft');
  const right=state.keys.has('d')||state.keys.has('arrowright');
  const lean=Number(right)-Number(left)||(now<state.dodgeUntil?state.dodgeDirection:state.gestureLean);
  scene.setDefense(state.keys.has('l')||state.gestureGuard,lean);
}
window.addEventListener('keydown',event=>{
  const key=gameplayKey(event);
  if(!key||event.repeat)return;
  if(heldKeys.has(key)){
    event.preventDefault();
    state.keys.add(key);
    syncDefenseInput();
  }
  if(key==='f')punch();if(key==='z')punch('left');if(key==='x')punch('right');
  if(key==='j')cast('beam');
  if(key==='k')cast('disc');if(key==='o')cast('palm');
  if(key==='escape'||key==='p'||key===' '){event.preventDefault();manualPause(!state.manualPause);}
},{capture:true});
window.addEventListener('keyup',event=>{
  gameplayKey(event);
  if(state.keys.delete(event.key.toLowerCase()))syncDefenseInput();
},{capture:true});
function clearDefense(){
  state.keys.clear();state.gestureGuard=false;state.gestureLean=0;state.dodgeUntil=0;
  scene.setDefense(false,0);scene.lowerShield();scene.setDiscPreparation(null);
}
window.addEventListener('blur',clearDefense);
$('guard-button').onclick=async()=>{
  if(!state.started)await start();
  if(scene.guard)scene.lowerShield();
  else scene.raiseShield();
};
$('show-moves').onclick=()=>{$('help-dialog').showModal();clearDefense();syncPause();};
for(const [id,direction]of [['dodge-left',-1],['dodge-right',1]])$(id).onclick=()=>{state.dodgeDirection=direction;state.dodgeUntil=performance.now()+1200;};
document.querySelectorAll('[data-battle]').forEach(button=>button.onclick=()=>{const action=button.dataset.battle;if(action==='help')$('show-moves').click();else if(action==='guard')$('guard-button').click();else if(action==='left'||action==='right')$('dodge-'+action).click();else cast(action);});
$('difficulty').onchange=e=>scene.difficulty=e.target.value;
$('quality').onchange=e=>scene.setQuality?.(e.target.value);
$('recenter').onclick=()=>{recognizer.reset();state.gestureLean=0;state.gestureGuard=false;log('已校准侧身中心');};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.arena').requestFullscreen();}catch{say('浏览器不支持全屏，可横屏游玩');}};
for(const [id,button] of [['help-dialog','help'],['settings-dialog','settings'],['credits-dialog','credits']]){const dialog=$(id);$(button).onclick=()=>{dialog.showModal();syncPause();};dialog.addEventListener('close',()=>{recognizer.reset();syncPause();});dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
document.addEventListener('visibilitychange',()=>{recognizer.reset();clearDefense();syncPause();});
$('sound').onclick=()=>{state.sound=!state.sound;audio.setEnabled(state.sound);updateSound();};
function updateSound(){$('sound').setAttribute('aria-pressed',String(state.sound));$('sound').setAttribute('aria-label',state.sound?'关闭声音':'开启声音');$('sound').textContent=state.sound?'♪':'♩';}updateSound();
$('music-enabled').onchange=e=>{audio.musicEnabled=e.target.checked;audio.syncMusic();};
$('voice-enabled').onchange=e=>{audio.voiceEnabled=e.target.checked;if(!audio.voiceEnabled)audio.stopVoice();};
$('music-file').onchange=e=>{const file=e.target.files?.[0];if(!file)return;audio.setMusicFile(file);$('music-file-name').textContent=file.name;$('music-reset').hidden=false;e.target.value='';};
$('music-reset').onclick=()=>{audio.setMusicFile(null);$('music-file-name').textContent='选择音频';$('music-reset').hidden=true;};
$('sensitivity').onchange=e=>{recognizer.mode=e.target.value;recognizer.reset();};$('practice').onchange=e=>{scene.practice=e.target.checked;};
$('show-debug').onchange=e=>{$('debug').hidden=!e.target.checked;};$('show-skeleton').onchange=()=>{if(!$('show-skeleton').checked)clearSkeleton();};
$('replay-speed').onchange=e=>{if(video)video.playbackRate=Number(e.target.value);recognizer.reset();};
$('replay-toggle').onclick=()=>{if(!video)return;if(video.paused)video.play().catch(()=>{});else video.pause();recognizer.reset();};
function attachVideo(){
  const input=document.createElement('video');
  input.id='input-video';
  input.muted=true;
  input.playsInline=true;
  input.disablePictureInPicture=true;
  input.disableRemotePlayback=true;
  input.tabIndex=-1;
  input.addEventListener('seeked',()=>{recognizer.reset();state.lastFrame=-1;});
  $('preview').prepend(input);
  video=input;
  return input;
}
function releaseVideo(){
  if(!video)return;
  video.pause();
  video.srcObject=null;
  video.removeAttribute('src');
  video.load();
  video.remove();
  video=null;
}
function setMode(mode){state.mode=mode;state.lastFrame=-1;recognizer.reset();$('input-label').textContent=mode==='camera'?'摄像头体感':mode==='video'?'动作视频回放':'按键 / 点击操作';$('camera-empty').hidden=mode!=='keyboard';$('replay-controls').hidden=mode!=='video';$('camera-toggle').textContent=mode==='camera'?'关闭摄像头':'开启摄像头';$('tracking-tip').hidden=true;$('gesture-status').textContent=mode==='keyboard'?'点击招式卡，或按 J / K 释放绝招':'让肩膀、手肘和双手完整入镜';}
let inputWaiter=null,firstFrameEpoch=-1;
function waitForInputFrame(epoch){
  if(firstFrameEpoch===epoch)return Promise.resolve();if(inputWaiter?.epoch===epoch)return inputWaiter.promise;
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const timer=setTimeout(()=>{inputWaiter=null;reject(new Error('摄像头画面暂未就绪，请重新开启'));},15000);
  inputWaiter={epoch,resolve,reject,promise,timer};return promise;
}
function stopInput({dispose=false}={}){if(inputWaiter){clearTimeout(inputWaiter.timer);inputWaiter.reject(new Error('影像已关闭'));inputWaiter=null;}if(document.body.classList.contains('in-battle'))manualPause(true);state.gestureGuard=false;state.gestureLean=0;state.epoch++;state.pending=false;state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;releaseVideo();if(state.url)URL.revokeObjectURL(state.url);state.url=null;if(dispose){pose.dispose();state.workerReady=false;state.busy=false;}state.tracking=false;clearSkeleton();setMode('keyboard');$('camera-state').textContent='摄像头未开启';$('charge').style.width='0%';buttonsBusy(false);}
function buttonsBusy(value){$('start-camera').disabled=value||!state.workerReady||!!scene.modelError||!('assetReady' in scene);$('camera-toggle').disabled=value;}
function onPoseState(phase,delegate){
  state.workerReady=phase==='ready';if(delegate)state.delegate=delegate;
  const labels={loading:'动作识别：准备中…',warming:'动作识别：正在热身…',ready:'动作识别：已就绪',error:'动作识别：暂不可用，请重试'};
  const graphicsFailed=!!scene.modelError||!('assetReady' in scene);$('start-keyboard').disabled=graphicsFailed||phase==='loading'||phase==='warming';if(scene.assetReady){$('load-status').textContent=phase==='ready'?'海湾准备就绪':phase==='error'?'动作识别暂不可用，可先用按键试玩':phase==='warming'?'场景已就绪，动作识别正在热身…':'场景已就绪，正在准备动作识别…';$('load-status').classList.toggle('ready',phase==='ready');}$('pose-status').textContent=labels[phase]||labels.loading;$('pose-status').dataset.state=phase;$('retry-pose').hidden=phase!=='error';buttonsBusy(state.pending);
}
const pose=new PoseService({onState:onPoseState,onResult:data=>{state.busy=false;if(data.epoch!==state.epoch)return;state.lastResult=performance.now();firstFrameEpoch=data.epoch;handlePose(data);if(inputWaiter?.epoch===data.epoch){clearTimeout(inputWaiter.timer);inputWaiter.resolve();inputWaiter=null;}},onError:(error,frame)=>{state.busy=false;if(frame&&frame.epoch!==state.epoch)return;log(error.message);if(state.mode!=='keyboard')stopInput();}});
function makeWorker(){return pose.preload();}
$('retry-pose').onclick=()=>{makeWorker().catch(()=>{});};
async function camera(autoEnter=false){if(state.pending)return;if(state.mode==='camera'){if(autoEnter){try{await waitForInputFrame(state.epoch);await start();}catch(error){$('camera-state').textContent=error.message;}}else stopInput();return;}stopInput();state.pending=true;const epoch=state.epoch;buttonsBusy(true);$('camera-state').textContent='等待摄像头授权…';let stream;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('此浏览器不支持摄像头，请通过 HTTPS 用新版浏览器打开');stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});if(epoch!==state.epoch){stream.getTracks().forEach(t=>t.stop());return;}state.stream=stream;const input=attachVideo();input.srcObject=stream;await input.play();if(epoch!==state.epoch)return;setMode('camera');$('camera-state').textContent=state.workerReady?'识别已就绪 · 正在连接影像…':'正在准备动作识别…';await makeWorker();if(epoch!==state.epoch)return;$('camera-state').textContent='识别已开启 · 请完整入镜';state.lastResult=performance.now();if(autoEnter){await waitForInputFrame(epoch);if(epoch!==state.epoch)return;await start();}log('摄像头开启 '+state.delegate);stream.getVideoTracks()[0].addEventListener('ended',()=>{if(state.stream===stream){stopInput();$('camera-state').textContent='摄像头已断开，可重试';}});}catch(error){if(epoch!==state.epoch)return;const msg=error.name==='NotAllowedError'?'摄像头权限未允许，可在地址栏设置中开启':error.name==='NotFoundError'?'没有找到摄像头，可先按键试玩或导入视频':error.name==='NotReadableError'?'摄像头被占用，请关闭其他使用摄像头的程序':error.message;stopInput();$('camera-state').textContent=msg;say('可以先用按键或视频游玩',2400);log(msg);}finally{if(epoch===state.epoch){state.pending=false;buttonsBusy(false);}}}
$('start-camera').onclick=()=>{audio.unlock();return camera(true);};$('camera-toggle').onclick=()=>camera(false);$('stop-input').onclick=stopInput;
$('video-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;stopInput();state.pending=true;const epoch=state.epoch;buttonsBusy(true);try{state.url=URL.createObjectURL(file);const input=attachVideo();input.src=state.url;input.loop=true;input.playbackRate=Number($('replay-speed').value);await input.play();if(epoch!==state.epoch)return;setMode('video');$('camera-state').textContent=state.workerReady?'识别已就绪 · 正在连接视频…':'正在准备动作识别…';await makeWorker();if(epoch!==state.epoch)return;$('camera-state').textContent='视频识别中 · 仅本机播放';state.lastResult=performance.now();log('导入视频 '+file.name);}catch{if(epoch===state.epoch){stopInput();$('camera-state').textContent='视频或模型加载失败，请换用 MP4 视频重试';}}finally{e.target.value='';if(epoch===state.epoch){state.pending=false;buttonsBusy(false);}}};
function clearSkeleton(){const c=$('skeleton');c.getContext('2d').clearRect(0,0,c.width,c.height);}
function skeleton(points,width,height){const canvas=$('skeleton');if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const c=canvas.getContext('2d');c.clearRect(0,0,width,height);if(!points||!$('show-skeleton').checked)return;const connections=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]];c.strokeStyle='#89fff0';c.lineWidth=Math.max(2,width/240);for(const [a,b]of connections){if((points[a].visibility??1)<.45||(points[b].visibility??1)<.45)continue;c.beginPath();c.moveTo(points[a].x*width,points[a].y*height);c.lineTo(points[b].x*width,points[b].y*height);c.stroke();}c.fillStyle='#ffda8c';for(const i of [11,12,13,14,15,16]){const p=points[i];if((p.visibility??1)<.45)continue;c.beginPath();c.arc(p.x*width,p.y*height,Math.max(3,width/150),0,Math.PI*2);c.fill();}}
function handlePose(data){if(state.mode==='keyboard')return;if(data.delegate)state.delegate=data.delegate;const result=recognizer.update(data.points,data.time,data.width,data.height);state.tracking=result.tracking;state.gestureGuard=result.guard;state.gestureLean=result.lean;skeleton(data.points,data.width,data.height);$('tracking-tip').hidden=result.tracking||!state.started;$('gesture-status').textContent=result.status;$('charge').style.width=result.charge*100+'%';$('camera-state').textContent=result.tracking?'已找到小英雄 · 动作识别中':'调整站位，让双臂完整入镜';scene.setDiscPreparation(result.discPreparation);if(result.punch&&!scene.paused)scene.punch(result.punch);if(result.skill&&!scene.paused)scene.cast(result.skill,result.skillSide||'right');if($('show-debug').checked)$('debug').textContent=`输入：${state.mode} / ${state.delegate}\n推理：${Math.round(data.ms)} ms\n上半身：${result.tracking?'可见':'不完整'}\n判定：${JSON.stringify(result.debug)}\n${state.debug.join('\n')}`;}
function updateShieldCard(){
  const cooldown=scene.guardCooldown;
  const active=scene.guard;
  const seconds=value=>(Math.ceil(value*10)/10).toFixed(1);
  let label='就绪',fill=scene.guardEnergy;
  if(active){label='防御中 '+seconds(scene.guardRemaining)+' 秒';fill=100*scene.guardRemaining/SHIELD.duration;}
  else if(cooldown>0){label='冷却 '+seconds(cooldown)+' 秒';fill=100*cooldown/SHIELD.cooldown;}
  else if(scene.guardEnergy<=SHIELD.blockCost)label='能量恢复中';
  const button=$('guard-button'),touch=document.querySelector('[data-battle=guard]');
  if($('shield-status').textContent!==label)$('shield-status').textContent=label;
  $('shield-card-fill').style.width=fill+'%';
  button.classList.toggle('is-guarding',active);
  button.classList.toggle('is-cooling',cooldown>0);
  button.setAttribute('aria-label','光之护盾，'+label);
  button.setAttribute('aria-disabled',String(cooldown>0));
  button.setAttribute('aria-pressed',String(active));
  touch.setAttribute('aria-pressed',String(active));
  touch.textContent=cooldown>0?'护盾 '+seconds(cooldown)+'s':'护盾';
}
async function detectLoop(now){audio.update(scene);if(state.workerReady&&!state.busy&&state.mode!=='keyboard'&&video&&!video.paused&&video.readyState>=2&&now-state.lastDetect>=65&&video.currentTime!==state.lastFrame){state.busy=true;state.lastDetect=now;state.lastFrame=video.currentTime;const epoch=state.epoch;try{const scale=Math.min(1,640/video.videoWidth);const bitmap=await createImageBitmap(video,{resizeWidth:Math.round(video.videoWidth*scale),resizeHeight:Math.round(video.videoHeight*scale)});if(epoch!==state.epoch||!state.workerReady){bitmap.close();state.busy=false;}else if(!pose.sendFrame(bitmap,performance.now(),epoch))state.busy=false;}catch{if(epoch===state.epoch){state.busy=false;$('camera-state').textContent='无法读取视频帧，请重开影像';}}}
  if(state.mode!=='keyboard'&&state.workerReady&&now-state.lastResult>2500){recognizer.reset();scene.setDiscPreparation(null);state.gestureGuard=false;state.gestureLean=0;$('tracking-tip').hidden=false;$('tracking-tip').textContent='影像暂时没有更新，可重开摄像头或检查视频播放';}else $('tracking-tip').textContent='让肩膀、手肘和双手都出现在画面里';
  for(const skill of ['beam','disc','palm']){const cd=SKILLS[skill].cooldown;const remaining=Math.max(0,cd-(scene.time-scene.lastCast[skill]));$(skill+'-cooldown').style.width=(remaining/cd*100)+'%';const label=remaining>0?'冷却 '+(Math.ceil(remaining*10)/10).toFixed(1)+' 秒':scene.inMelee?'近身中':'就绪';if($(skill+'-status').textContent!==label)$(skill+'-status').textContent=label;$(skill+'-button').classList.toggle('is-cooling',remaining>0);$(skill+'-button').setAttribute('aria-disabled',String(remaining>0||scene.inMelee));const touch=document.querySelector('[data-battle='+skill+']');touch.textContent=(skill==='beam'?'光线':skill==='palm'?'光箭':'光轮')+(remaining>0?' '+remaining.toFixed(1)+'s':'');$(skill+'-button').setAttribute('aria-label',(skill==='beam'?'梅特里姆光线':skill==='palm'?'手掌光箭':'八分光轮')+(remaining>0?`，冷却 ${remaining.toFixed(1)} 秒`:scene.inMelee?'，先用普通拳拉开距离':'，可以释放'));}syncDefenseInput(now);updateShieldCard();if(scene.attack){const a=scene.attack;const progress=a.phase==='windup'?a.age/a.windup:1;$('threat-fill').style.width=Math.min(100,progress*100)+'%';}requestAnimationFrame(detectLoop);}
requestAnimationFrame(detectLoop);
makeWorker().catch(()=>{});
window.addEventListener('pagehide',()=>{audio.setActive(false);stopInput({dispose:true});});
window.addEventListener('pageshow',e=>{if(e.persisted)makeWorker().catch(()=>{});});
export {scene as battle};
