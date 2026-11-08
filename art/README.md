# 模型制作与替换

当前怪兽使用雷德王、巴尔坦星人、加恩Q 的第三方模型，来源见文末。旧版原创怪兽的 Blender 源文件作为归档保留；当前第一人称手臂基于 Extrazhang 的迪迦模型（CC BY-NC）适配。`.blend` 是可编辑源文件；浏览器加载导出的 `.glb`。Three.js 负责镜头、灯光、动画、技能、碰撞时机及画面渲染，不能直接打开 `.blend`。

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
- Kenney： https://kenney.nl/assets ，官方支持页 https://kenney.nl/support 说明资产页游戏资源为 CC0。适合补充城市、道具；具体包仍应检查随包许可和格式。当前城市使用 City Kit Commercial 2.1 的高楼模型与贴图。

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

`eye_to_shoulder` 记录双眼中点至 `armBase_L/R` 的偏移。眼位取自 `TigaEyes` 两侧发光网格的中心，坐标按玩家的右、上、朝向玩家三个方向写入 GLB。动画以原肩宽为基础，以略侧身的站姿展开上臂，光线定势时按镜头目标重新放置左肘与左腕。取景根据实际肩口的半径和视锥边界留出余量。光线定势按世界坐标的竖直方向放置右腕和右肘，右小臂在靠近玩家的一侧。左臂按上臂长度从外侧横过，使两条前臂在玩家视野里垂直相交。通过左腕与指根确定掌面，使左掌平行于地面。用游戏画面检查交叉和发光位置，用侧视检查前后倾角。

角色模型和衍生物按原下载页的 CC BY-NC 用于非商业游戏；公共页面的“制作与鸣谢”和 `THIRD_PARTY_NOTICES.md` 均保留作者、来源、许可标签及修改说明。没有执行或向网页导出原文件的旧驱动、控制器和脚本。

## 造型与色彩

怪兽使用连续截面的收腰躯干、锥形四肢、独立铠甲、爬行动物头骨与分节尾部；岩甲兽有岩脊，潮汐兽有冠鳍和鳃鳍，星焰龙有带翼指的蝠翼。身体枢轴与技能动画命名保持一致。

怪兽配色以 sRGB 十六进制定义，在建模脚本中明确转换到线性空间后写入 Principled BSDF，再由 glTF / Three.js 按线性材质加载。手部既有线性色值单独保留。场景使用中性补光，常驻青色核心灯在待机时关闭，蓄力/命中时才增强；皮肤与装甲采用高粗糙度、低金属度，避免塑料感和青白过曝。

`art/kaiju_shapes.py` 提供连续截面与装甲几何；`npm run test:models` 在实际浏览器验证第三方模型、材质贴图、远近战、突进、击退和远程打断。构建版本包含 GLB 文件内容哈希，模型 URL 带同一版本参数，避免旧模型被浏览器缓存。

## 外部全身动作试片
`import_body_motion.py` 使用 Extrazhang 原模型的连续身体、UV 和蒙皮权重，按原骨骼位置建立 52 根身体与手指骨骼。它在两个角色的静止姿势之间校准骨轴和掌面，将 Quaternius 的身体旋转逐帧转给迪迦，并按目标臂长校正腕部和落脚。`EyeAnchor` 位于原模型双眼的中心，随头骨移动。网页共用一个 AnimationMixer，双眼视图隐藏头部表面并看向怪兽。

输入为 [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) 免费 Standard 版中的 `Unreal-Godot/UAL1_Standard.glb`。已核验包内 CC0 声明。ZIP 的 SHA-256 为 `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`，输入 GLB 的 SHA-256 为 `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997`。

```powershell
& 'D:/software/Blender/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python art/import_body_motion.py -- --library 'PATH/UAL1_Standard.glb' --clip Punch_Cross
```

生成文件 `public/motion-preview/tiga-punch.glb` 包括完整角色、`Punch_Cross` 动作和眼位镜头。正常游戏和试片有各自的加载入口。导入其他骨架时需要核对其初始姿势、骨骼对应关系和素材许可。

## 庆祝升空片段

游戏第五波结束后的庆祝改用**下载版迪迦全身模型**（`D:\download\迪迦`）：`art/import_tiga_flight.py` 保留原始 A-pose、重写材质并摆正朝向，输出 `public/motion-preview/tiga-flight.glb`（7 577 三角面，静态网格）。该包没有骨架对象、FBX 也没有权重，重建方式与朝向修正在 [sources/迪迦/SOURCE.md](sources/迪迦/SOURCE.md) 里记录。升空位移、后倾、转身、天空转深空与星空都在 `src/scene.js` 的 `startCelebration`/`animateCelebration` 里驱动。

下面这条命令仍然有效：它把 CC0 库里的 `Idle_Torch_Loop` 重定向到 Extrazhang 手臂骨架，可作为对照或备选姿势，输出 `public/motion-preview/tiga-torch.glb`（当前游戏未引用，按需生成）。

`import_body_motion.py` 同时接受两种 CC0 来源，骨架命名不同会自动映射：

| 来源 | 文件 | SHA-256 | 骨架命名 |
| --- | --- | --- | --- |
| Quaternius 官方 Standard 包 | `Unreal-Godot/UAL1_Standard.glb` | `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997` | `pelvis`/`upperarm_l` |
| itch.io 同包 glTF 镜像 | `glTF/AnimationLibrary_Godot_Standard.gltf`（同级放同名 `.bin`） | `0ff075c7ad6855c5c2c37a171592ee8f0d6ab2f58259e2be77a9b63dd8027765` | `DEF-hips`/`DEF-upper_arm.L`（`GODOT_MIRROR` 映射） |

```powershell
& 'E:/Software/Blender/blender-5.4.0-alpha/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python art/import_body_motion.py -- --library 'PATH/AnimationLibrary_Godot_Standard.gltf' --clip Idle_Torch_Loop --output public/motion-preview/tiga-torch.glb
```

`--clip` 现在接受库里任意动作名，文件名默认按 `--clip` 推导。对照页可用 `?model=tiga-torch.glb&clip=Idle_Torch_Loop` 检查同一段动作的全身与双眼视角。

## 当前第三方怪兽与城市

雷德王、巴尔坦星人、加恩Q 及 Kenney City Kit 的来源与许可见 THIRD_PARTY_NOTICES.md。雷德王转换脚本为 import_redking.py，保留蒙皮、缩小局部贴图并修正手脚骨骼的父子链。雷德王动作由 src/monster-motion.js 按独立攻击类型驱动。巴尔坦使用原始动画，适配根位移与命中时机。加恩Q 原素材是静态模型，使用整体运动和蓄力脉动。
光线动作在抬臂后，按画面中的肘、腕目标展开横臂。横臂袖子按骨骼权重做轴向长度补偿，手掌与手指维持原始尺寸。肩口检查包括面的朝向，背面不可见的裁切面不计入可见缺口。
## MMD 怪兽转换

`art/import_mmd.py` 把下载的 MMD 模型（`.pmd` / `.pmx`）转成网页用的**带骨骼** GLB：保留骨架与蒙皮权重（按每个 MMD 材质重建 Principled 贴图、身高归一到 16、脚底贴地、按脚踝→脚尖方向摆正到 Blender −Y 朝前），由游戏用骨骼驱动动作。注意 MMD 材质默认是 alpha 混合、贴图 alpha 是卡通遮罩，导出时必须压成不透明，否则大片身体会变黑或透明。

依赖：Blender 的 `mmd_tools` 插件（放在 `BLENDER_USER_SCRIPTS` 下的 `addons/mmd_tools`）与 Blender Python 里的 `opencc`（`python.exe -m pip install opencc-python-reimplemented`）。

```powershell
$env:BLENDER_USER_SCRIPTS = 'PATH/mmd_scripts'
& 'E:/Software/Blender/blender-5.4.0-alpha/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python art/import_mmd.py -- 'PATH/Basic Baltan.pmd' public/models/kaiju/baltan-new.glb
```

当前使用（全部带骨骼）：`Baltan.pmd` → `baltan.glb`（第 2 波，31 根骨；同包的 Basic / Powered / Mecha Baltan 已不再使用，只保留这一只）、`Alien Mefilas.pmd` → `mefilas.glb`（第 4 波，54 根骨）、`Ultraseven.pmd` → `chaos-seven.glb`（第 5 波）、`Ultraman Taro.pmd` → `chaos-taro.glb`（第 6 波）、`Ultraman.pmd` → `chaos-ultraman.glb`（第 7 波）、`Zetton (50m).pmx` → `zetton.glb`（第 8 波，40 根骨）、`Mecha Gomora Kaiju Size 1.2.pmx` → `gomora-mecha.glb`（第 9 波，111 根骨）、`Galactron.pmx` → `galactron.glb`（第 10 波，92 根骨）、`Gatanothor.pmx`（`Gatanothor (MMDCharizard)` 包，作者 十三月）→ `gatanothor.glb`（第 11 波最终 boss，155 根骨、6214 面；没有 `ひじ`/`UDE`，用 `腕3` 作前臂，脚下贴地、没有垂地尾巴）。骨骼命名两种都有：罗马字（`KOSHI` 髋、`MUNE` 胸、`KUBI` 颈、`L/R_ZYOUWAN` 上臂、`L/R_UDE` 前臂、`L/R_TE` 手、`L/R_MOMO` 大腿、`L/R_SUNE` 小腿、`L/R_ASHI` 脚）与日文（`下半身`/`上半身`/`首`/`腕.L`/`ひじ.L`/`手首.L`/`足.L`/`ひざ.L`/`足首.L`）；`src/monster-motion.js` 两套名字都能解析，攻击光弹从手骨位置发出。同包的 `Powered Baltan.pmd`、`Mecha Baltan.pmd`、`机械哥莫拉`、`铁三角（卡欧斯S/T/U）` 都可以用同一脚本转换。

### 招式：每只怪兽一套动作

`src/monster-poses.js` 是一张「怪兽 × 招式」的姿势表（蓄力/出手两个阶段、手臂与前臂方向、胸/头/髋旋转、可选腿部动作、发射点），`src/monster-motion.js` 的 `moveStage()` 负责插值、`aimLimb()` 负责把整条手臂骨链指向目标方向，`origin()` 按 `emit` 返回口部/额头/头角/胸甲等真实发射点。原作招式名、动作要点与出处见 `docs/monster-moves.md`。

`npm run test:poses` 会逐只怪兽抓骨骼签名（含方向，避免短手臂怪兽失真），断言与待机不同、与其它怪兽的同名招式不同，并检查斯派修姆「＋」、斯特利姆 T、赛文手贴头镖、杰顿面部发火球、哥莫拉头顶角发波、加坦杰厄双手下砸，截图写到 `artifacts/poses/`。

### 尾巴：折到身后并做柔性弯曲

`art/mmd_tail.py` 是转换流程里的一步，专门处理垂到脚底以下的尾巴。下载模型里的尾巴（迦拉克隆是 `hair`～`hair11` 十一节，机械哥莫拉是 `tail1…`）有两个毛病：一是整条竖直垂在腿前、还穿过地面；二是每节权重都是 1.0，弯折像铰链硬折。

`pose_tail()` 在缩放归一化之前运行：

1. 只认真正被蒙皮的尾巴链（`hair` / `尻尾` / `tail`，跳过 `_shadow_`/`_dummy_`/`hairCTRL` 这类物理辅助骨）；链条末端高于脚踝就判定为「不是垂下的尾巴」，整步跳过，所以其他怪兽不受影响；
2. 沿链条按弧长把每个顶点重新权重到相邻两根骨之间（0.5 混合），弯折变成连续曲线；
3. 从腿根（`足.L`/`足.R` 高度）开始，用一段四分之一椭圆把尾巴顺到地面：起点竖直向下、末端与地面相切，水平半轴按链条总长求解，于是尾巴一路顺到腿根再折向身后拖着地面；
4. 摆好姿势后先取求值网格的顶点位置，再把姿势烘焙进静止骨架，最后把顶点写回网格——只 `pose.armature_apply()` 会让蒙皮回弹成原始形状；
5. 归一化与贴地改为读取求值网格的包围盒，尾巴不再被当成最低点，脚自然踩在地面上。

运行时会读同一批骨名（`src/monster-motion.js` 的 `this.tail`），逐节递增幅度做小幅世界坐标摆动，让尾巴看起来是柔性体而不是整根硬摆；尾巴尖高于胯部（例如头顶的头发链）则不启用。