# 模型制作与替换

本版通过本机 Blender 5.2 制作了三种原创怪兽和一对第一人称红银护臂。`.blend` 是可编辑源文件；浏览器加载导出的 `.glb`。Three.js 负责镜头、灯光、动画、技能、碰撞时机及画面渲染，不能直接打开 `.blend`。

## 文件

| 源文件 | 网页模型 | 用途 |
| --- | --- | --- |
| models/basalt.blend | ../public/models/kaiju/basalt.glb | 岩甲兽，岩甲与近战技能 |
| models/leviathan.blend | ../public/models/kaiju/leviathan.glb | 潮汐兽，头鳍与横扫技能 |
| models/nova.blend | ../public/models/kaiju/nova.glb | 星焰龙，双翼、冠角、最终战 |
| models/hero-hands.blend | ../public/models/kaiju/hero-hands.glb | 第一人称护臂与双手 |

怪兽朝 Blender -Y 方向，Z 轴向上；导出 glTF 后朝 +Z，Y 轴向上。所有材质使用 Principled BSDF，无外部纹理。模型在游戏中通过 Body、Head、Jaw、ArmL/R、ForearmL/R、Tail、WingL/R 节点动画，不依赖骨骼。修改模型时保留这些命名枢轴和局部原点。身体枢轴初始高度 4.9，头、手臂的坐标相对父节点。

重建全部源模型（会覆盖这四个源文件和 GLB，手动编辑后请另存文件）：

```powershell
& 'D:/software/Blender/blender.exe' --background --factory-startup --python art/create_models.py
```

手动编辑：在 Blender 打开 .blend，完成后 File → Export → glTF 2.0，格式 GLB；不导出灯光、相机，本版由网页动画控制枢轴，因此无需导出动画。随后 npm run build 并运行浏览器测试。

## 免费外部模型路线

- Quaternius Ultimate Monsters： https://quaternius.com/packs/ultimatemonsters.html ，有带动画的怪兽模型。当前网站许可是 QAL，允许免费用于游戏和商业作品，禁止作为独立模型资产重新分发；下载时保存实际许可，不能只凭旧页面的 CC0 标识。许可： https://quaternius.com/license.html 。本版没有引入该模型包。
- Kenney： https://kenney.nl/assets ，官方支持页 https://kenney.nl/support 说明资产页游戏资源为 CC0。适合补充城市、道具；具体包仍应检查随包许可和格式。本版城市是程序生成，没有引入 Kenney 资源。

如果外部模型已有 GLB，可直接用 GLTFLoader 加载。有骨骼动画的模型要通过 AnimationMixer 将 idle / attack / hit / death 对应战斗事件，无需先转 .blend；需要改外形、贴图、减面或动画才导入 Blender，再导出 GLB。不要用本版命名枢轴动画硬套到不同骨骼模型。

## 验证记录

模型可由脚本重建，网页从同源加载，三种怪兽各自有独立网格细节与轮廓。发布前使用实际浏览器分别检查三个模型、手部、技能与低画质路径，参见项目 README 的测试说明。
