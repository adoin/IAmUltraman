/** Original synthesized score and effects; all voices are bundled, never inferred in battle. */
import {SKILLS} from './combat.js';

export class GameAudio {
  constructor(){this.enabled=true;this.musicEnabled=true;this.voiceEnabled=true;this.active=false;this.voices=new Map();this.voiceHistory=new Map();this.finisherWave=0;this.hurtIndex=0;this.musicStep=0;this.musicURL=null;this.generation=0;}
  async unlock(){
    if(!this.enabled)return;
    try{if(!this.context){const a=this.context=new(window.AudioContext||window.webkitAudioContext)();this.master=a.createGain();this.master.gain.value=.65;const limiter=a.createDynamicsCompressor();limiter.threshold.value=-15;limiter.ratio.value=6;this.master.connect(limiter).connect(a.destination);this.musicGain=a.createGain();this.musicGain.gain.value=.16;this.musicGain.connect(this.master);this.fxGain=a.createGain();this.fxGain.gain.value=.5;this.fxGain.connect(this.master);this.voiceGain=a.createGain();this.voiceGain.gain.value=.95;this.voiceGain.connect(this.master);
      const buffer=a.createBuffer(1,a.sampleRate,a.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;this.noiseBuffer=buffer;this.timer=setInterval(()=>this.schedule(),100);this.preloading=this.preload();}
      this.context.resume().catch(()=>{});await this.preloading;
    }catch{/* Muted browsers still run the game. */}
  }
  prepare(){
    return this.voiceFilesPromise??=(async()=>{
      const files=new Map();
      try{const response=await fetch(new URL('../public/audio/voices.json'+new URL(import.meta.url).search,import.meta.url));if(!response.ok)return files;const manifest=await response.json();
        await Promise.all(Object.entries(manifest).map(async([name,file])=>{try{const r=await fetch(new URL('../public/audio/'+file,import.meta.url));if(r.ok)files.set(name,await r.arrayBuffer());}catch{}}));
      }catch{}return files;
    })();
  }
  async preload(){const generation=this.generation;for(const [name,bytes]of await this.prepare()){try{const buffer=await this.context.decodeAudioData(bytes.slice(0));if(generation===this.generation)this.voices.set(name,buffer);}catch{}}}
  note(frequency,duration,volume=.2,type='sine',when=this.context.currentTime,bus=this.fxGain,to=null,pan=0){
    const a=this.context,o=a.createOscillator(),gain=a.createGain();o.type=type;o.frequency.setValueAtTime(frequency,when);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),when+duration);gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(volume,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);let output=gain;if(pan&&a.createStereoPanner){const p=a.createStereoPanner();p.pan.value=pan;gain.connect(p);output=p;}o.connect(gain);output.connect(bus);o.start(when);o.stop(when+duration+.02);
  }
  noise(duration,volume,frequency,when,pan=0){const a=this.context,source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();source.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(frequency,when);filter.frequency.exponentialRampToValueAtTime(180,when+duration);gain.gain.setValueAtTime(volume,when);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);source.connect(filter).connect(gain);if(pan&&a.createStereoPanner){const p=a.createStereoPanner();p.pan.value=pan;gain.connect(p).connect(this.fxGain);}else gain.connect(this.fxGain);source.start(when);source.stop(when+duration);}
  effect(kind,side){if(!this.enabled||!this.context||!this.active)return;const now=this.context.currentTime,pan=side==='left'?-.35:side==='right'?.35:0;
    if(kind==='punch'){this.noise(.16,.17,3500,now,pan);return;}
    if(kind==='hit'||kind==='hurt'){this.noise(.18,.5,kind==='hurt'?1200:2200,now,pan);this.note(kind==='hurt'?95:155,.23,.45,'sine',now,this.fxGain,36,pan);return;}
    if(kind==='beam'){this.note(150,.55,.12,'sawtooth',now,this.fxGain,750);this.noise(1.1,.25,6000,now+.48);this.note(180,.9,.13,'triangle',now+.48,this.fxGain,65);return;}
 if(kind==='zepellion'){this.note(90,.8,.14,'sawtooth',now,this.fxGain,900);this.noise(1.6,.3,7000,now+.6);this.note(140,1.2,.15,'triangle',now+.6,this.fxGain,55);this.note(420,1.0,.08,'sine',now+.6,this.fxGain,40);return;}
    if(kind==='disc'){this.note(430,.45,.16,'triangle',now,this.fxGain,1500);this.noise(.35,.18,5500,now+.22,pan);return;}
    if(kind==='palm'){this.note(1050,.3,.2,'triangle',now,this.fxGain,180);return;}
    if(kind==='guard'){this.noise(.13,.26,7000,now);[720,1080,1440].forEach(f=>this.note(f,.4,.08,'sine',now));return;}
    if(kind==='charge'){this.noise(.9,.22,2400,now);this.note(90,.6,.2,'triangle',now,this.fxGain,200);return;}
    if(kind==='warning'){[0,.18].forEach(t=>this.note(330,.12,.08,'sine',now+t));return;}
    if(kind==='win'){[440,554,659,880].forEach((f,i)=>this.note(f,.4,.15,'triangle',now+i*.11));}
  }
  schedule(){
    if(!this.context||!this.active||this.ended||!this.enabled||!this.musicEnabled||this.musicURL)return;
    const a=this.context;if(a.state!=='running')return;
    if(!this.nextBeat||this.nextBeat<a.currentTime-.2)this.nextBeat=a.currentTime+.03;
    // Sea Bay theme: an original 16-bar score, in D minor, at 112 BPM.
    const melody=[74,0,77,79,81,0,79,77,74,0,72,74,77,0,76,72,70,0,74,77,79,0,77,74,72,0,69,72,74,0,0,0];
    const bass=[38,38,34,34,41,41,36,36],step=.267857;
    while(this.nextBeat<a.currentTime+.18){const i=this.musicStep++,t=this.nextBeat,midi=melody[i%melody.length];if(midi)this.note(440*2**((midi-69)/12),step*.9,.09,'triangle',t,this.musicGain);
      if(i%2===0){const low=bass[Math.floor(i/4)%bass.length];this.note(440*2**((low-69)/12),step*1.7,.19,'sine',t,this.musicGain);this.note(105,.1,.12,'sine',t,this.musicGain,38);}
      if(i%8===4)this.note(180,.06,.025,'triangle',t,this.musicGain,60);this.nextBeat+=step;
    }
  }
  setActive(value){this.active=!!value;if(!value){this.nextBeat=0;this.stopVoice();}this.syncMusic();}
  setEnabled(value){this.enabled=value;if(this.context)this.master.gain.setTargetAtTime(value?.65:0,this.context.currentTime,.04);if(!value)this.stopVoice();else this.unlock();this.syncMusic();}
  syncMusic(){if(this.musicElement){this.musicElement.volume=.22;if(this.active&&!this.ended&&this.enabled&&this.musicEnabled)this.musicElement.play().catch(()=>{});else this.musicElement.pause();}if(this.context)this.musicGain.gain.setTargetAtTime(this.active&&!this.ended&&this.enabled&&this.musicEnabled?.16:0,this.context.currentTime,.06);}
  setMusicFile(file){this.musicElement?.pause();if(this.musicURL)URL.revokeObjectURL(this.musicURL);this.musicURL=file?URL.createObjectURL(file):null;this.musicElement=file?new Audio(this.musicURL):null;if(this.musicElement)this.musicElement.loop=true;this.nextBeat=0;this.syncMusic();}
  stopVoice(){if(this.voiceSource){try{this.voiceSource.stop();}catch{}this.voiceSource=null;}this.voicePriority=0;this.syncMusic();}
  speak(name,priority=1,cooldown=8){if(!this.context||!this.active||!this.enabled||!this.voiceEnabled)return false;const a=this.context,buffer=this.voices.get(name);if(!buffer||a.currentTime-(this.voiceHistory.get(name)??-100)<cooldown||this.voiceSource&&this.voicePriority>=priority)return false;this.stopVoice();const source=a.createBufferSource();source.buffer=buffer;source.connect(this.voiceGain);this.voiceSource=source;this.voicePriority=priority;this.voiceHistory.set(name,a.currentTime);this.musicGain.gain.setTargetAtTime(.045,a.currentTime,.06);if(this.musicElement)this.musicElement.volume=.07;source.onended=()=>{if(this.voiceSource===source){this.voiceSource=null;this.voicePriority=0;this.syncMusic();}};source.start();return true;}
  fanfare(){if(!this.enabled||!this.context||!this.active)return;const now=this.context.currentTime;[587.33,739.99,880,1174.66,880,1174.66].forEach((frequency,index)=>this.note(frequency,.44,.16,'triangle',now+index*.13,this.fxGain));this.noise(.6,.13,6500,now);}
  event(event,battle){
    if(event.type==='wave'){this.ended=false;this.syncMusic();this.finisherWave=0;this.speak('start',2,0);}
    if(event.type==='punch')this.effect('punch',event.side);
    if(event.type==='hit')this.effect('hit',event.side);
    if(event.type==='cast')this.effect(event.skill,event.side);
    if(event.type==='telegraph')this.effect('warning');
    if(event.type==='enemy-cast')this.effect(event.attack.kind==='charge'?'charge':'palm');
    if(event.type==='attacked'){this.effect('hurt');this.speak(battle.heroHealth<=30?'low':this.hurtIndex++%2?'hurt2':'hurt1',2,14);}
    if(event.type==='defense'&&event.outcome==='block'){this.effect('guard');this.speak('block',1,15);}
    if(event.type==='defense'&&event.outcome==='dodge')this.speak('dodge',1,15);
    if(event.type==='knockback'){this.effect('hit');this.speak('push',1,12);}
    if(event.type==='defeat'){this.effect('win');}
    if(event.type==='victory'){this.fanfare();this.speak('victory',5,0);this.ended=false;this.syncMusic();}
    if(event.type==='celebration-end'){this.ended=true;this.syncMusic();}
    if(event.type==='over'){this.ended=true;this.syncMusic();this.speak('hurt1',4,0);}
  }
  update(b){if(!this.active||b.paused||!b.playing||b.finished||b.defeated)return;
    if(b.enemyDistance>=26&&b.monsterHealth<=46&&b.monsterHealth>0&&b.time-b.lastCast.beam>=SKILLS.beam.cooldown&&!b.effects.some(e=>e.kind!=='punch')&&this.finisherWave!==b.wave){if(this.speak('finish',3,0))this.finisherWave=b.wave;}
  }
  dispose(){this.generation++;clearInterval(this.timer);this.stopVoice();this.musicElement?.pause();if(this.musicURL)URL.revokeObjectURL(this.musicURL);this.context?.close();}
}
