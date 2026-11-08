import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BattleScene} from '../../src/scene.js';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const play = document.querySelector('#play');
const seek = document.querySelector('#seek');
const stamp = document.querySelector('#stamp');
const slow = document.querySelector('#slow');

// ?model=<file.glb>&clip=<ActionName> previews any retargeted clip on the same rig.
const query = new URLSearchParams(location.search);
const modelFile = query.get('model') || 'tiga-punch.glb';
const clipName = query.get('clip') || 'Punch_Cross';

async function start() {
  const world = new BattleScene(canvas, () => {});
  const loader = new GLTFLoader();
  const [, model] = await Promise.all([world.ready, loader.loadAsync('./' + modelFile)]);
  world.renderer.setAnimationLoop(null);
  world.start();
  world.camera.visible = false;
  const actor = model.scene;
  const bounds = new THREE.Box3().setFromObject(actor);
  const size = bounds.getSize(new THREE.Vector3());
  const uniform = 10 / Math.max(.001, size.y);
  actor.scale.setScalar(uniform);
  actor.position.set(0, -bounds.min.y * uniform, 20);
  world.renderScene.add(actor);

  const eye = actor.getObjectByName('EyeAnchor');
  const clip = model.animations.find(animation => animation.name === clipName) || model.animations[0] || null;
  const twoView = !!(eye && clip);
  document.title = '迪迦 · ' + clipName;
  document.querySelector('h1').textContent = '迪迦 · ' + clipName;
  const head = [];
  actor.traverse(node => {
    if (node.userData.hide_at_eye) head.push(node);
    if (node.isMesh) {
      node.frustumCulled = false;
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  const mixer = clip ? new THREE.AnimationMixer(actor) : null;
  if (mixer) mixer.clipAction(clip).play();
  const front = new THREE.PerspectiveCamera(35, 1, .035, 700);
  front.position.set(12, 5.3, 3.5);
  front.lookAt(0, 4.5, 20);
  const pov = new THREE.PerspectiveCamera(77, 1, .035, 700);
  const renderer = world.renderer;
  renderer.shadowMap.autoUpdate = false;
  renderer.setScissorTest(true);
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let time = playing ? 0 : .27;
  let previous = performance.now();
  let dirty = true;

  function draw(camera, x, y, w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setScissor(x, y, w, h);
    renderer.setViewport(x, y, w, h);
    renderer.render(world.renderScene, camera);
  }

  function render() {
    if (mixer) mixer.setTime(Math.min(time, clip.duration - .00001));
    actor.updateMatrixWorld(true);
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.shadowMap.needsUpdate = true;
    if (!twoView) {
      draw(front, 0, 0, width, height);
      play.disabled = seek.disabled = true;
      stamp.value = '静置姿势';
      return;
    }
    const stacked = matchMedia('(max-width:700px)').matches;
    const split = Math.floor((stacked ? height : width) / 2);
    head.forEach(node => { node.visible = true; });
    if (stacked) draw(front, 0, split, width, height - split);
    else draw(front, 0, 0, split, height);

    // The two renders share the exact same pose. Only the first-person pass
    // hides the head surface and uses the eye location with a level horizon.
    head.forEach(node => { node.visible = false; });
    eye.getWorldPosition(pov.position);
    pov.lookAt(world.getHitPoint());
    if (stacked) draw(pov, 0, 0, width, split);
    else draw(pov, split, 0, width - split, height);
    seek.value = String(Math.round(time / clip.duration * 1000));
    stamp.value = `${time.toFixed(2)} s`;
    play.textContent = playing ? '暂停' : '播放';
  }

  play.addEventListener('click', () => {
    playing = !playing;
    dirty = true;
    previous = performance.now();
  });
  seek.addEventListener('input', () => {
    playing = false;
    time = Number(seek.value) / 1000 * clip.duration;
    dirty = true;
  });
  const observer = new ResizeObserver(() => { dirty = true; });
  observer.observe(canvas);
  play.disabled = seek.disabled = false;
  status.hidden = true;
  renderer.setAnimationLoop(now => {
    const dt = Math.min(Math.max((now - previous) / 1000, 0), .05);
    previous = now;
    if (playing && clip) time = (time + dt * (slow.checked ? .4 : 1)) % clip.duration;
    if (playing || dirty) render();
    dirty = false;
  });
}

start().catch(error => {
  console.error(error);
  status.textContent = '预览加载失败，请刷新重试。';
});

