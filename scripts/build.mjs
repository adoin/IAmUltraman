import { mkdir, cp, rm, stat } from 'node:fs/promises';
await stat('public/models/pose_landmarker_lite.task');
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for (const file of ['index.html','style.css','src']) await cp(file,`dist/${file}`,{recursive:true});
await cp('public','dist/public',{recursive:true});
await cp('public/.nojekyll','dist/.nojekyll');
console.log('Static site built in dist/');
