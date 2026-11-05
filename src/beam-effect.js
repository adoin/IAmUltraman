import * as THREE from 'three';

/** A ribbon of parallel energy filaments emitted by the knife edge of the arm.
 * Its near edge follows the actual skeleton; the far edge terminates on the target.
 * The translucent sheet supplies bloom-like falloff without a full-screen post pass.
 */
export class BeamVolume extends THREE.Group {
  constructor(){
    super();
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
    geometry.setIndex([0,1,2,2,1,3]);
    this.sheet=new THREE.Mesh(geometry,new THREE.ShaderMaterial({
      uniforms:{age:{value:0},strength:{value:0},motion:{value:1}},
      transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
      vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec2 coord;uniform float age;uniform float strength;uniform float motion;
        void main(){
          float edge=pow(max(0.0,sin(coord.y*3.14159265)),.7);
          float streams=.6+.4*pow(.5+.5*sin(coord.y*110.0+sin(coord.x*25.0-age*20.0*motion)),4.0);
          float pulse=.75+.25*sin(coord.x*65.0-age*45.0*motion);
          vec3 color=mix(vec3(.20,.36,1.0),vec3(.40,.95,1.0),streams);
          gl_FragColor=vec4(color,edge*streams*pulse*strength*.28);
          #include <colorspace_fragment>
        }`,
    }));
    this.sheet.frustumCulled=false;this.add(this.sheet);
    this.filaments=Array.from({length:9},(_,i)=>{
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(i%2?.012:.019,i%2?.012:.019,1,8,1,true),new THREE.MeshBasicMaterial({color:i%3?0x90eeff:0xe4e5ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false}));
      mesh.frustumCulled=false;this.add(mesh);return mesh;
    });
    this.up=new THREE.Vector3(0,1,0);this.sourceBottom=new THREE.Vector3();this.sourceTop=new THREE.Vector3();
    this.tip=new THREE.Vector3();this.farBottom=new THREE.Vector3();this.farTop=new THREE.Vector3();this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.direction=new THREE.Vector3();
  }
  update(bottom,top,target,reveal,age,fade,reduced){
    this.visible=reveal>0&&fade>0;
    this.sourceBottom.copy(bottom);this.sourceTop.copy(top);this.tip.copy(target);
    this.farBottom.copy(target).addScaledVector(this.up,-.55);
    this.farTop.copy(target).addScaledVector(this.up,.55);
    const position=this.sheet.geometry.attributes.position;
    position.setXYZ(0,bottom.x,bottom.y,bottom.z);this.a.copy(bottom).lerp(this.farBottom,reveal);position.setXYZ(1,this.a.x,this.a.y,this.a.z);
    position.setXYZ(2,top.x,top.y,top.z);this.a.copy(top).lerp(this.farTop,reveal);position.setXYZ(3,this.a.x,this.a.y,this.a.z);position.needsUpdate=true;
    this.sheet.material.uniforms.age.value=age;this.sheet.material.uniforms.strength.value=fade;this.sheet.material.uniforms.motion.value=reduced?0:1;
    this.filaments.forEach((mesh,i)=>{
      const t=(i+.5)/this.filaments.length;this.a.copy(bottom).lerp(top,t);this.b.copy(this.farBottom).lerp(this.farTop,t).lerp(this.a,1-reveal);
      this.direction.copy(this.b).sub(this.a);const length=this.direction.length();mesh.position.copy(this.a).addScaledVector(this.direction,.5);
      if(length>.0001)mesh.quaternion.setFromUnitVectors(this.up,this.direction.divideScalar(length));
      mesh.scale.set(1,Math.max(length,.0001),1);mesh.material.opacity=fade*(reduced?.65:.55+.2*Math.sin(age*24+i*1.7));
    });
  }
}
