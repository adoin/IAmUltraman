/** Keeps one warmed recognizer alive independently of camera/video lifetimes. */
export class PoseService {
  constructor({createWorker=()=>new Worker(new URL('./pose-worker.js',import.meta.url)),onState=()=>{},onResult=()=>{},onError=()=>{},timeoutMs=60000}={}){
    this.createWorker=createWorker;this.onState=onState;this.onResult=onResult;this.onError=onError;this.timeoutMs=timeoutMs;
    this.worker=null;this.promise=null;this.ready=false;this.busy=false;this.delegate='';this.cancel=null;
  }
  preload(){
    if(this.promise)return this.promise;
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});this.promise=promise;
    let worker=null,timer,settled=false;
    const fail=error=>{
      clearTimeout(timer);if(this.worker!==worker)return;
      worker?.terminate();this.worker=null;this.ready=false;this.busy=false;this.promise=null;this.cancel=null;
      if(!settled){settled=true;reject(error);}this.onState('error',this.delegate);this.onError(error);
    };
    try{
      worker=this.createWorker();this.worker=worker;
      this.cancel=()=>{clearTimeout(timer);if(!settled){settled=true;reject(new Error('识别准备已取消'));}};
      timer=setTimeout(()=>fail(new Error('动作识别准备超时，请重试')),this.timeoutMs);
      worker.onerror=()=>fail(new Error('无法准备动作识别，请使用新版浏览器后重试'));
      worker.onmessage=({data})=>{
        if(this.worker!==worker)return;
        if(data.type==='progress'){this.onState(data.phase,this.delegate);return;}
        if(data.type==='ready'){clearTimeout(timer);this.ready=true;this.delegate=data.delegate;this.cancel=null;settled=true;this.onState('ready',this.delegate);resolve();}
        else if(data.type==='error')fail(new Error(data.message));
        else if(data.type==='result'){this.busy=false;if(data.delegate)this.delegate=data.delegate;this.onResult(data);}
        else if(data.type==='frame-error'){this.busy=false;this.onError(new Error('无法读取动作画面，请重新开启影像'),data);}
      };
      this.onState('loading',this.delegate);worker.postMessage({type:'init'});
    }catch(error){fail(error);}
    return promise;
  }
  sendFrame(bitmap,time,epoch){
    if(!this.ready||!this.worker||this.busy){bitmap.close();return false;}
    this.busy=true;
    try{this.worker.postMessage({type:'frame',bitmap,time,epoch},[bitmap]);return true;}
    catch(error){this.busy=false;bitmap.close();this.onError(error);return false;}
  }
  dispose(){this.cancel?.();this.cancel=null;this.worker?.terminate();this.worker=null;this.promise=null;this.ready=false;this.busy=false;}
}
