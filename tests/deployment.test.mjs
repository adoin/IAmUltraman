import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,readlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {assetBase,treeDigest,rewriteAssets} from '../scripts/deployment-assets.mjs';
import {deployRelease} from '../scripts/deploy-release.mjs';

test('CDN configuration allows HTTPS prefixes and preserves module-relative code',()=>{
  assert.equal(assetBase('https://cdn.example.com/game/'),'https://cdn.example.com/game');
  for(const url of ['http://cdn.example.com','https://user:password@cdn.example.com','https://cdn.example.com/?key=secret'])assert.throws(()=>assetBase(url));
  const source="import './combat.js'; const model=new URL(`../public/models/${name}.glb?v=${revision}`,import.meta.url);importScripts('../public/vendor/vision_bundle.js');";
  const result=rewriteAssets(source,'https://cdn.example.com','123');
  assert.ok(result.includes("import './combat.js'"));
  assert.ok(result.includes('https://cdn.example.com/assets/123/public/models/${name}.glb'));
  assert.ok(!result.includes('?v=${revision}'));
  assert.ok(result.includes("importScripts('https://cdn.example.com/assets/123/public/vendor/vision_bundle.js')"));
  assert.equal(rewriteAssets(source,'','123'),source);
});
test('releases verify assets, retain earlier assets and roll back on failed health checks',{skip:process.platform==='win32'?'Production symlink replacement is Linux-only; exercised by the Linux CI job':false},async()=>{
  const parent=process.platform==='win32'?'D:/tmp/ultraman-deployment-20261109':path.join(process.env.RUNNER_TEMP||'/tmp','ultraman-deployment-tests');
  await mkdir(parent,{recursive:true});const folder=await mkdtemp(path.join(parent,'release-'));
  const input=path.join(folder,'input'),root=path.join(folder,'production');
  try{
    await mkdir(path.join(input,'public'),{recursive:true});await writeFile(path.join(input,'index.html'),'game');await writeFile(path.join(input,'public','model.glb'),'model-v1');
    const first=await treeDigest(path.join(input,'public'));
    const manifest=async(version,assetVersion=first)=>writeFile(path.join(input,'deployment.json'),JSON.stringify({version,assetVersion,revision:version}));
    await manifest('v1');await deployRelease({input,root,release:'abcdef1-1-1'});
    const target=await readlink(path.join(root,'current'));
    await manifest('v2');await assert.rejects(deployRelease({input,root,release:'abcdef2-2-1',healthURL:'https://game.example',healthCheck:async()=>{throw Error('unhealthy');}}),/unhealthy/);
    assert.equal(await readlink(path.join(root,'current')),target);
    await writeFile(path.join(input,'public','model.glb'),'model-v2');await assert.rejects(deployRelease({input,root,release:'abcdef3-3-1'}),/checksum/);
    const second=await treeDigest(path.join(input,'public'));assert.notEqual(first,second);await manifest('v3',second);await deployRelease({input,root,release:'abcdef3-3-1'});
    assert.equal(await readFile(path.join(root,'assets',first,'public','model.glb'),'utf8'),'model-v1');assert.equal(await readFile(path.join(root,'current','public','model.glb'),'utf8'),'model-v2');
    await assert.rejects(deployRelease({input,root,release:'../unsafe'}),/Invalid release/);
  }finally{assert.ok(path.resolve(folder).startsWith(path.resolve(parent)+path.sep));await rm(folder,{recursive:true,force:true});}
});
