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
      self.postMessage({type:'ready',delegate});
    }catch(error){self.postMessage({type:'error',message:'姿态模型加载失败，请刷新重试，或先用按键游玩。',detail:String(error)});}
  }
  if(data.type==='frame'&&model){
    try{const start=performance.now();const result=model.detectForVideo(data.bitmap,data.time);const ms=performance.now()-start;
      // Software WebGL can be much slower than the CPU on machines without usable graphics acceleration.
      if(delegate==='GPU'&&ms>300){try{await model.setOptions({baseOptions:{delegate:'CPU'}});delegate='CPU';}catch{/* Keep the working GPU graph if fallback is unavailable. */}}
      self.postMessage({type:'result',points:result.landmarks[0]||null,time:data.time,ms,delegate,width:data.bitmap.width,height:data.bitmap.height});}
    catch(error){self.postMessage({type:'frame-error',detail:String(error)});}
    finally{data.bitmap.close();}
  }
};
