# Third-party notices

## Ultraman Tiga — first-person arms

"Ultraman Tiga" by **Extrazhang**, obtained from https://blendswap.com/blend/26877 and https://blendswap.com/blend/26877/download.

The creator's download page declares **CC-BY-NC** and asks users to credit Extrazhang. No license version is stated on that page. Creator profile: https://blendswap.com/profile/1180296 . The game and model derivative are noncommercial.

The game uses a first-person derivative of the continuous arm mesh. Each arm retains 18 articulated joints and includes the measured distance from the center of the eyes to the shoulder. The adaptation includes surface smoothing, the original UV pattern, calibrated suit colors, portable metallic-roughness materials and action poses anchored to the source eye and shoulder measurements. Source provenance and the original file hash are in `art/sources/tiga/SOURCE.md`.

The on-screen **制作与鸣谢** presents this attribution and modification notice. This is community fan art, with no official affiliation asserted.

## Full-body motion preview

The independent punch preview uses **Punch_Cross** by **Quaternius**, from [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html), licensed under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The motion is retargeted to the Extrazhang Tiga derivative above. Adaptations include wrist and foot placement for the different body proportions, a first-person head mask and a camera at the source eye midpoint. The combined character asset is distributed for this noncommercial game. Both source credits appear on the preview page.

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
