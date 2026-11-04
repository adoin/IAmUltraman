self.exports = {};
importScripts('../public/vendor/vision_bundle.js');
const { FilesetResolver, PoseLandmarker } = self.exports;
let model,delegate='GPU';
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      const vision=await FilesetResolver.forVisionTasks(new URL('../public/vendor/wasm/',self.location.href).href);
      const options={baseOptions:{modelAssetPath:new URL('../public/models/pose_landmarker_lite.task',self.location.href).href,delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45,minTrackingConfidence:.45};
      try{model=await PoseLandmarker.createFromOptions(vision,options);}catch{options.baseOptions.delegate='CPU';model=await PoseLandmarker.createFromOptions(vision,options);}
      delegate=options.baseOptions.delegate;
      self.postMessage({type:'progress',phase:'warming'});
      // Compile and run the graph before the player grants camera access or enters battle.
      const canvas=new OffscreenCanvas(256,256);canvas.getContext('2d').fillRect(0,0,256,256);
      const bitmap=await createImageBitmap(canvas);
      try{
        const start=performance.now();model.detectForVideo(bitmap,0);
        if(delegate==='GPU'&&performance.now()-start>300){await model.setOptions({baseOptions:{delegate:'CPU'}});delegate='CPU';}
        model.detectForVideo(bitmap,1);
      }finally{bitmap.close();}
      self.postMessage({type:'ready',delegate});
    }catch(error){self.postMessage({type:'error',message:'姿态模型加载失败，请刷新重试，或先用按键游玩。',detail:String(error)});}
  }
  if(data.type==='frame'&&model){
    try{const start=performance.now();const result=model.detectForVideo(data.bitmap,data.time);const ms=performance.now()-start;
      // Software WebGL can be much slower than the CPU on machines without usable graphics acceleration.
      if(delegate==='GPU'&&ms>300){try{await model.setOptions({baseOptions:{delegate:'CPU'}});delegate='CPU';}catch{/* Keep the working GPU graph if fallback is unavailable. */}}
      self.postMessage({type:'result',points:result.landmarks[0]||null,time:data.time,epoch:data.epoch,ms,delegate,width:data.bitmap.width,height:data.bitmap.height});}
    catch(error){self.postMessage({type:'frame-error',epoch:data.epoch,detail:String(error)});}
    finally{data.bitmap.close();}
  }
};
