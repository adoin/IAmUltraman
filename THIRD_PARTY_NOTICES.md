# Third-party notices

## Ultraman Tiga — first-person arms

"Ultraman Tiga" by **Extrazhang**, obtained from https://blendswap.com/blend/26877 and https://blendswap.com/blend/26877/download.

The creator's download page declares **CC-BY-NC** and asks users to credit Extrazhang. No license version is stated on that page. Creator profile: https://blendswap.com/profile/1180296 . The game and model derivative are noncommercial.

The game uses a first-person derivative of the continuous arm mesh. Each arm retains 18 articulated joints and includes the measured distance from the center of the eyes to the shoulder. The adaptation includes surface smoothing, the original UV pattern, calibrated suit colors, portable metallic-roughness materials and action poses anchored to the source eye and shoulder measurements. Source provenance and the original file hash are in `art/sources/tiga/SOURCE.md`.

The on-screen **制作与鸣谢** presents this attribution and modification notice. This is community fan art, with no official affiliation asserted.

## Full-body motion preview

The independent punch preview uses **Punch_Cross** by **Quaternius**, from [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html), licensed under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The motion is retargeted to the Extrazhang Tiga derivative above. Adaptations include wrist and foot placement for the different body proportions, a first-person head mask and a camera at the source eye midpoint. The combined character asset is distributed for this noncommercial game. Both source credits appear on the preview page.

## Victory take-off

The end-of-adventure celebration uses the **downloaded community Tiga model** described in `art/sources/迪迦/SOURCE.md`. That pack ships 60 Max-Biped vertex groups but no armature, and its FBX has no weights at all. `art/import_tiga_flight.py` keeps the authored A-pose, rewrites the material as Principled BSDF (base colour, emissive, normal), turns the figure to face -Y using the toe direction and exports `public/motion-preview/tiga-flight.glb`. Raising an arm was attempted twice (rebuilt skeleton, then vertex-space rotation) and rejected: the deltoid is blended between the clavicle and two twist bones, so a ~150° swing tears the shoulder seam in this mesh. The ascent, body tilt, turn, sky darkening and star fade are authored in `src/scene.js`.

The pack carries no author credit and states that it is for non-commercial study only; the game is non-commercial fan work and this limitation is recorded with the pack's file hashes in `art/sources/迪迦/SOURCE.md`.

The **Idle_Torch_Loop** retarget (Quaternius Universal Animation Library, CC0 1.0) remains reproducible through the same script for the Extrazhang arm rig, but the game no longer references it.

## Three.js

Three.js 0.180.0, copyright 2010-2025 three.js authors. MIT license, full text in public/vendor/three/LICENSE. Runtime modules and GLTFLoader are copied from the pinned npm package by scripts/build.mjs.

## Original game models

The basalt, leviathan and nova creature models were authored for this project using art/create_models.py in Blender. They do not use downloaded creature meshes, textures or animations. Editable masters are in art/models; runtime GLBs in public/models/kaiju. Runtime movement animates their named node pivots. The original procedural gauntlet master remains as an archived source; the current first-person arms use the separately attributed Tiga derivative above.

## MediaPipe Tasks Vision

Copyright Google LLC. Licensed under Apache License 2.0.

Package: @mediapipe/tasks-vision 0.10.32

Upstream: https://github.com/google-ai-edge/mediapipe

Distributed runtime files are copied unmodified from the npm package into public/vendor. License text: public/vendor/LICENSE.

## Pose Landmarker Lite

Google MediaPipe Pose Landmarker Lite (float16, version 1), unmodified.

Model source: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

Documentation/model cards: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker

Distributed under Apache-2.0; see public/vendor/LICENSE and the upstream model documentation.

## Optional font

Noto Sans SC via Google Fonts, SIL Open Font License. The page falls back to installed system fonts. No font binaries are redistributed.

## Kenney City Kit Commercial 2.1

Building models by Kenney, CC0. https://kenney.nl/assets/city-kit-commercial
Original license is included at public/models/city/License.txt.

## Red King
Model by Violi / SlightlyPurplish, published by chaosFerEBIRTH (syafiq14), CC BY 4.0.
https://sketchfab.com/3d-models/red-king-ultraman-kaiju-all-time-2b1f4461cf454c178814b2948a442fd0
Adapted materials and textures, repaired hand/foot parent chains and authored runtime combat motion.

## Alien Baltan
Published by peak_9.20, CC BY 4.0.
https://sketchfab.com/3d-models/alien-baltan-892f5bc4c9064d96a42790872c5a6977
**No longer shipped** — wave 2 and the Baltan waves now use the converted MMD Baltan below. The credit stays for provenance of earlier builds. Character designs belong to their respective rights holders.

## Gan Q from Ultraman Gaia
By aquanort, CC BY 4.0.
https://sketchfab.com/3d-models/gan-q-from-ultraman-gaia-67e87e6be58d46e7b7b87aaf1eb40f72
Adapted the legacy material to metallic-roughness and corrected the display-root orientation. Original static mesh and textures, with game-side whole-body motion.

## Qwen3-TTS generated narration
Eight original Chinese gameplay cues generated with the Qwen team official Studio using Qwen3-TTS-12Hz-1.7B-CustomVoice, Ryan speaker. Model license Apache-2.0; https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice . The model is not redistributed. Texts, processing notes and checksums: public/audio/SOURCE.md and public/audio/clips.json. A copy of the model license is included at public/audio/QWEN3-TTS-LICENSE.txt. No television dialogue recordings or soundtrack audio are bundled. Music and effects are original procedural audio.
## MMD kaiju models (Alien Mefilas, Baltan, Zetton, Mecha Gomora, Galactron)

Downloaded MMD models distributed by the Sketchfab uploader **这是我的刀盾** (folders named `*_by_这是我的刀盾_*` in the user's local `D:\download`). Formats: `.pmd` / `.pmx` with PNG textures. No author or licence statement ships with the archives, so they are used here as non-commercial fan assets; contact the uploader for the original credit. Zetton comes from `Zetton.zip` (`杰顿_x/杰顿/Zetton (50m).pmx`); Galactron from `迦拉克隆.zip` (`迦拉克隆_x/Galactron (MMDCharizard)/Galactron.pmx`).

Converted with `art/import_mmd.py` (Blender 5.4 + the `mmd_tools` addon): rest-pose mesh only, one Principled material per MMD material with its own diffuse texture, arms lowered from the MMD T-pose, height normalised to 16 units, feet on the ground, facing -Y. Outputs: `baltan.glb` (wave 2), `baltan-basic.glb` (3), `mefilas.glb` (5), `baltan-powered.glb` (6), `baltan-mecha.glb` (7), `chaos-seven.glb` (8), `chaos-taro.glb` (9), `chaos-ultraman.glb` (10), `zetton.glb` (11), `gomora-mecha.glb` (12) and `galactron.glb` (13). Each keeps its MMD skeleton; `src/monster-motion.js` drives the limb bones and reads the hand bone for projectile origins, so no animation clips are bundled.

`art/mmd_tail.py` re-weights a tail chain that hangs past the feet and bends it along a quarter ellipse from the leg root down to the ground, so the tail trails behind the model instead of standing in front of its legs. The edit is baked into the shipped GLB; only source geometry, skin weights and bone poses from the original model are altered.