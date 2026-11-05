# Ultraman Tiga — source and attribution

- Work: **Ultraman Tiga** (fan art)
- Creator: **Extrazhang** — https://blendswap.com/profile/1180296
- Source: https://blendswap.com/blend/26877
- Download and license declaration: https://blendswap.com/blend/26877/download
- Declared license: **CC-BY-NC** (Attribution–NonCommercial). The download page does not state a version number; preserve its original declaration rather than assuming one.
- Retrieved: 2026-11-05, through the user's signed-in BlendSwap browser session.
- Original file: `Ultraman Tiga.blend`, 23,953,708 bytes.
- SHA-256: `71d40ef6620787a120d46e0bda6377f31ccdab79473bb3474ee430305d7e5246`.

The original file is kept unchanged. `art/import_tiga.py` creates an adapted first-person version: arm-only mesh extraction, simplified deform skeleton and skin weights, preserved articulated fingers, one surface subdivision, portable PBR materials, and a 2048-pixel conversion of the author's packed Multi-Type color texture. The original procedural Eevee shaders, controllers, dependency cycles, and drivers are not used by the website. External-file auto-execution stays disabled during import.

Runtime derivative: `public/models/kaiju/hero-hands.glb`.
Editable derivative: `art/models/tiga-first-person.blend`.
Texture derivative: `art/textures/tiga/tiga-multi-color.jpg`.

The physical-material adaptation additionally produces `tiga-pbr-color.jpg` (muted suit colors, original UV patterns) and `tiga-metal-rough.png` (separate silver and colored-suit responses). The exported skeleton includes exact bone-tip metadata. Runtime actions articulate shoulders, elbows, wrists and individual fingers, including blade-hand adduction, palm-side thumb poses and closed fists. These are project-authored adaptations, not animations supplied by the original creator.

Public attribution is shown in the preparation screen's **制作与鸣谢**, including the author, source, original license label, and modification description. The model and its derivatives are for this noncommercial game; no official affiliation is claimed.
