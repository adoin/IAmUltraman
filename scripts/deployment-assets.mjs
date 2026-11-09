import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

export function assetBase(value='') {
  if (!value) return '';
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('ASSET_BASE_URL must be an HTTPS URL without credentials, query or fragment');
  return url.href.replace(/\/$/,'');
}
export async function treeDigest(directory) {
  const hash=createHash('sha256');
  async function walk(relative='') {
    for(const entry of (await readdir(path.join(directory,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      const key=relative?relative+'/'+entry.name:entry.name;
      if(entry.isDirectory())await walk(key);
      else if(entry.isFile()){hash.update(key+'\0');hash.update(await readFile(path.join(directory,key)));hash.update('\0');}
      else throw new Error('Unexpected link in assets: '+key);
    }
  }
  await walk();return hash.digest('hex').slice(0,20);
}
export function rewriteAssets(source,base,version) {
  if(!base)return source;
  return source.replace(/(['"`])\.\.\/public\//g,(_,quote)=>quote+base+'/assets/'+version+'/public/').replaceAll('?v=${revision}','');
}
