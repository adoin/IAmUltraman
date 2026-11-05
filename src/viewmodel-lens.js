import * as THREE from 'three';

const MIN_VERTICAL_FOV=72;
const MIN_HORIZONTAL_FOV=47;

// Use a wider lens for the player's arms while keeping the city's perspective.
// Scaling clip-space XY is exactly a change of focal length. It preserves the
// skinned mesh, lighting normals and shared depth buffer in one render pass.
export class ViewmodelLens {
  constructor(worldCamera,arms){
    this.worldCamera=worldCamera;
    this.camera=new THREE.PerspectiveCamera();
    worldCamera.add(this.camera);
    const focal={value:1};
    const materials=new Set();
    for(const arm of arms)arm.traverse(node=>{
      if(node.isMesh)for(const material of [].concat(node.material))materials.add(material);
    });
    for(const material of materials){
      material.onBeforeCompile=shader=>{
        shader.uniforms.armFocalScale=focal;
        shader.vertexShader='uniform float armFocalScale;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ngl_Position.xy *= armFocalScale;');
      };
      material.onBeforeRender=(_renderer,_scene,camera)=>{focal.value=camera===worldCamera?this.scale:1;};
      material.customProgramCacheKey=()=>'tiga-viewmodel-lens-v1';
    }
  }

  resize(aspect){
    const vertical=Math.tan(THREE.MathUtils.degToRad(MIN_VERTICAL_FOV/2));
    const horizontal=Math.tan(THREE.MathUtils.degToRad(MIN_HORIZONTAL_FOV/2));
    const tangent=Math.max(vertical,horizontal/aspect);
    this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(tangent));
    this.camera.aspect=aspect;
    this.camera.near=this.worldCamera.near;
    this.camera.far=this.worldCamera.far;
    this.camera.updateProjectionMatrix();
    this.scale=Math.tan(THREE.MathUtils.degToRad(this.worldCamera.fov/2))/tangent;
  }

  // World-space effects use the city lens. Match their screen position to the
  // animated bone without changing the bone's distance from the camera.
  effectPoint(local){
    const point=new THREE.Vector3(local.x*this.scale,local.y*this.scale,local.z);
    return this.worldCamera.localToWorld(point);
  }
}
