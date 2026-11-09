import {cp,mkdir,readFile,symlink,rename,lstat,readlink,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {treeDigest} from './deployment-assets.mjs';

export async function deployRelease({input,root,release,healthURL,healthCheck=verifyHealth}) {
  if(!/^[a-f0-9]{7,40}-\d+-\d+$/.test(release))throw new Error('Invalid release ID');
  input=path.resolve(input);root=path.resolve(root);
  if(root===path.parse(root).root||root===input||input.startsWith(root+path.sep))throw new Error('Unsafe deployment directories');
  const metadata=JSON.parse(await readFile(path.join(input,'deployment.json'),'utf8'));
  if(await treeDigest(path.join(input,'public'))!==metadata.assetVersion)throw new Error('Asset checksum mismatch');
  await readFile(path.join(input,'index.html'));
  const destination=path.join(root,'releases',release),assets=path.join(root,'assets',metadata.assetVersion);
  await mkdir(path.dirname(destination),{recursive:true});
  await mkdir(path.dirname(assets),{recursive:true});
  try{await lstat(assets);}catch(error){if(error.code!=='ENOENT')throw error;const staging=assets+'.'+release;await mkdir(staging);await cp(path.join(input,'public'),path.join(staging,'public'),{recursive:true});await rename(staging,assets);}
  await cp(input,destination,{recursive:true,errorOnExist:true,force:false});
  const current=path.join(root,'current'),pending=path.join(root,'.next-'+release);
  let previous;try{previous=await readlink(current);}catch(error){if(error.code!=='ENOENT')throw error;}
  await symlink(destination,pending,'dir');await rename(pending,current);
  try{if(healthURL)await healthCheck(healthURL,metadata);}
  catch(error){if(previous){await symlink(previous,pending,'dir');await rename(pending,current);}else await unlink(current);throw error;}
  return metadata;
}
async function verifyHealth(base,metadata) {
  const url=new URL('deployment.json',base.endsWith('/')?base:base+'/');url.searchParams.set('deploy',metadata.version);
  let lastError;
  for(let attempt=0;attempt<5;attempt++){
    try{const response=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const actual=await response.json();if(actual.version!==metadata.version||actual.revision!==metadata.revision||actual.cdnBase!==metadata.cdnBase)throw new Error('Unexpected deployed version');return;}
    catch(error){lastError=error;if(attempt<4)await new Promise(resolve=>setTimeout(resolve,2000));}
  }
  throw lastError;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.platform!=='linux')throw new Error('Production deployment requires Linux');
  if(!process.env.SITE_URL||!process.env.DEPLOY_INPUT)throw new Error('SITE_URL and DEPLOY_INPUT are required');
  const metadata=await deployRelease({input:process.env.DEPLOY_INPUT,root:process.env.DEPLOY_ROOT||'/srv/iamultraman',release:process.env.RELEASE_ID,healthURL:process.env.SITE_URL});
  console.log('Deployed',metadata.revision,metadata.version);
}
