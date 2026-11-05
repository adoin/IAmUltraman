# 模型制作与替换

三种怪兽由本项目用 Blender 5.2 制作；当前第一人称手臂基于 Extrazhang 的迪迦模型（CC BY-NC）适配。`.blend` 是可编辑源文件；浏览器加载导出的 `.glb`。Three.js 负责镜头、灯光、动画、技能、碰撞时机及画面渲染，不能直接打开 `.blend`。

## 文件

| 源文件 | 网页模型 | 用途 |
| --- | --- | --- |
| models/basalt.blend | ../public/models/kaiju/basalt.glb | 岩甲兽，岩甲与近战技能 |
| models/leviathan.blend | ../public/models/kaiju/leviathan.glb | 潮汐兽，头鳍与横扫技能 |
| models/nova.blend | ../public/models/kaiju/nova.glb | 星焰龙，双翼、冠角、最终战 |
| models/tiga-first-person.blend | ../public/models/kaiju/hero-hands.glb | Extrazhang 迪迦模型的第一人称蒙皮双臂，CC BY-NC |

怪兽朝 Blender -Y 方向，Z 轴向上；导出 glTF 后朝 +Z，Y 轴向上。怪兽材质使用 Principled BSDF，无外部纹理；迪迦手臂使用原模型的打包颜色贴图。怪兽通过 Body、Head、Jaw、ArmL/R、ForearmL/R、Tail、WingL/R 节点动画，不依赖骨骼。修改怪兽时保留这些命名枢轴和局部原点。身体枢轴初始高度 4.9，头、手臂的坐标相对父节点。

重建三只怪兽（会覆盖其源文件和 GLB；存在迪迦派生源时保留当前手臂，手动编辑后请另存文件）：

```powershell
& 'D:/software/Blender/blender.exe' --background --factory-startup --python art/create_models.py
```

手动编辑：在 Blender 打开 .blend，完成后 File → Export → glTF 2.0，格式 GLB；不导出灯光、相机，网页驱动枢轴或骨骼，因此无需导出动画片段。迪迦手臂必须保留变形骨骼、蒙皮权重和纹理。随后 npm run build 并运行浏览器测试。

## 免费外部模型路线

- Quaternius Ultimate Monsters： https://quaternius.com/packs/ultimatemonsters.html ，有带动画的怪兽模型。当前网站许可是 QAL，允许免费用于游戏和商业作品，禁止作为独立模型资产重新分发；下载时保存实际许可，不能只凭旧页面的 CC0 标识。许可： https://quaternius.com/license.html 。本版没有引入该模型包。
- Kenney： https://kenney.nl/assets ，官方支持页 https://kenney.nl/support 说明资产页游戏资源为 CC0。适合补充城市、道具；具体包仍应检查随包许可和格式。本版城市是程序生成，没有引入 Kenney 资源。

如果外部模型已有 GLB，可直接用 GLTFLoader 加载。有骨骼动画的模型要通过 AnimationMixer 将 idle / attack / hit / death 对应战斗事件，无需先转 .blend；需要改外形、贴图、减面或动画才导入 Blender，再导出 GLB。不要用本版命名枢轴动画硬套到不同骨骼模型。

## 验证记录

模型可由脚本重建，网页从同源加载，三种怪兽各自有独立网格细节与轮廓。发布前使用实际浏览器分别检查三个模型、手部、技能与低画质路径，参见项目 README 的测试说明。

## 当前第一人称迪迦手臂

`sources/tiga/Ultraman Tiga.blend` 是用户从 BlendSwap 下载的 Extrazhang 原始模型，保持原样。来源与署名见 `sources/tiga/SOURCE.md`。原人物有约 200 根控制/变形骨骼，原始 Eevee 材质含视角相关节点组，直接导出不能保持同样效果。本项目提取其连续手臂网格，保留 UV 与 Multi-Type 颜色贴图，转换成 PBR；每侧使用 18 根手臂和手指动作骨骼，保留连续网格和原始 UV。

重新生成：

```powershell
& 'D:/software/Blender/blender.exe' --background --factory-startup --disable-autoexec --python art/import_tiga.py
```

派生可编辑文件为 `models/tiga-first-person.blend`，颜色贴图为 `textures/tiga/tiga-multi-color.jpg`，输出仍为网页既有 `hero-hands.glb` 接口。`models/hero-hands.blend` 是归档的旧几何拼接版本；当迪迦派生源存在时，`create_models.py` 不会覆盖新手臂。

`tiga-multi-color.jpg` 保留原始贴图的缩小版本；运行时使用适配物理灯光的 `tiga-pbr-color.jpg` 与 `tiga-metal-rough.png`。后者按原图的红紫衣料/银色区域分配不同的金属度与粗糙度，缓和原 toon 材质颜色直接用于 PBR 后的高饱和塑料感，不改变作者的 UV 图案。两张运行时纹理嵌入 GLB，无额外下载依赖。

每个 `HeroArmL/R` 节点的 `bone_tips` 元数据记录 glTF Y-up 空间中的实际骨尾位置，供运行时准确计算五指末端；不能从骨骼名称猜测关节轴向。动画控制器先校准原始骨架的掌面和骨骼滚转，再用四元数驱动肘腕与分指姿态。手刀的并指、拇指收拢与拳头的屈指分别处理，避免反折到手背。

`eye_to_shoulder` 记录双眼中点至 `armBase_L/R` 的偏移。眼位取自 `TigaEyes` 两侧发光网格的中心，坐标按玩家的右、上、朝向玩家三个方向写入 GLB。动画按原肩宽放置两个固定肩根，以略侧身的站姿展开上臂。取景根据实际肩口的半径和视锥边界留出余量，使裁切端始终处在画面之外。动作镜头的垂直视场至少为 72°，水平视场至少为 47°。光线动作中，两条前臂的投影在肘与腕之间相交。右前臂竖起并挡在玩家一侧，左前臂横过外侧。动作和光效应在实际第一人称画面中一起检查。

角色模型和衍生物按原下载页的 CC BY-NC 用于非商业游戏；公共页面的“制作与鸣谢”和 `THIRD_PARTY_NOTICES.md` 均保留作者、来源、许可标签及修改说明。没有执行或向网页导出原文件的旧驱动、控制器和脚本。

## 造型与色彩

怪兽使用连续截面的收腰躯干、锥形四肢、独立铠甲、爬行动物头骨与分节尾部；岩甲兽有岩脊，潮汐兽有冠鳍和鳃鳍，星焰龙有带翼指的蝠翼。身体枢轴与技能动画命名保持一致。

怪兽配色以 sRGB 十六进制定义，在建模脚本中明确转换到线性空间后写入 Principled BSDF，再由 glTF / Three.js 按线性材质加载。手部既有线性色值单独保留。场景使用中性补光，常驻青色核心灯在待机时关闭，蓄力/命中时才增强；皮肤与装甲采用高粗糙度、低金属度，避免塑料感和青白过曝。

`art/kaiju_shapes.py` 提供连续截面与装甲几何；`npm run test:models` 在实际浏览器验证三种材质颜色、腰胸比、模型枢轴、面数及手机画幅。构建版本包含 GLB 文件内容哈希，模型 URL 带同一版本参数，避免旧模型被浏览器缓存。
