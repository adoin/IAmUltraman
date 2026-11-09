import * as THREE from 'three';
const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
const normal=name=>name.replace(/[ ._]/g,'').toLowerCase();
function bonesUnder(nodes){const set=new Set();for(const n of nodes)n.traverse(b=>{if(b.isBone)set.add(b);});return set;}
function weightedVertices(root,bones,threshold=.25){const points=[];root.updateMatrixWorld(true);root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const ids=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;if(!ids||!w)return;for(let i=0;i<ids.count;i++){const indices=[ids.getX(i),ids.getY(i),ids.getZ(i),ids.getW(i)],weights=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];let total=0;for(let j=0;j<4;j++)if(bones.has(mesh.skeleton.bones[indices[j]]))total+=weights[j];if(total>threshold)points.push({mesh,index:i});}});return points;}
export function footGround(root){const feet=[];root.traverse(n=>{if(n.isBone&&/^(foot[lr]|[lr](ashi|foot)|足首[lr])$/.test(normal(n.name)))feet.push(n);});if(!feet.length)return null;const vertices=weightedVertices(root,bonesUnder(feet));if(!vertices.length)return null;return Math.min(...vertices.map(({mesh,index})=>mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).y));}
/** Correct a baked tail that used to define the bounding-box floor below the shoes. */
export function liftGroundTail(root){let start;root.traverse(n=>{if(n.isBone&&/^(hair|tail|尻尾|しっぽ)$/.test(n.name)&&!start)start=n;});if(!start)return 0;const vertices=weightedVertices(root,bonesUnder([start]),.5);if(!vertices.length)return 0;
 const minY=()=>{root.updateMatrixWorld(true);root.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});let y=Infinity;for(const {mesh,index}of vertices)y=Math.min(y,mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).y);return y;};
 if(minY()>-.01)return 0;
 const base=start.getWorldQuaternion(Q()),parent=start.parent.getWorldQuaternion(Q()).invert(),axis=new THREE.Vector3(1,0,0).applyQuaternion(root.getWorldQuaternion(Q()));
 const pivot=start.getWorldPosition(V());let meanZ=0;for(const {mesh,index}of vertices)meanZ+=mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld).z;const sign=meanZ/vertices.length<pivot.z?1:-1;
 const pose=angle=>{start.quaternion.copy(parent.clone().multiply(Q().setFromAxisAngle(axis,angle*sign).multiply(base)));start.updateWorldMatrix(false,true);};
 let lo=0,hi=.08;pose(hi);while(minY()<.02&&hi<.6){hi+=.04;pose(hi);}for(let i=0;i<12;i++){const mid=(lo+hi)/2;pose(mid);if(minY()<.02)lo=mid;else hi=mid;}pose(hi);minY();root.traverse(n=>{if(n.isSkinnedMesh){n.computeBoundingSphere();if(n.boundingBox)n.computeBoundingBox();}});return hi*sign;
}
