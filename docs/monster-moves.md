# MMD 怪兽招式设计与原作出处

游戏把每只怪兽的攻击拆成五个槽位：`bolt`（远程光弹）、`sweep`（横扫光束/冲击波）、`slam`（震地/重压）、`melee`（近身）、`charge`（冲锋）。下表把每个槽位对应到该怪兽在《奥特曼》系列里的代表招式，并说明本作用什么动作表现它。

- 动作由 `src/monster-poses.js` 的 `MONSTER_MOVES` 描述：每只怪兽、每个槽位各有独立的「蓄力」与「出手」两组姿势（手臂方向、下臂方向、胸/头/髋旋转、可选腿部），由 `src/monster-motion.js` 直接驱动真实骨骼。
- 表格里的「中文名」与 `src/combat.js` 的 `MONSTER_ATTACK_NAMES` 必须逐条一致（`tests/moves.test.mjs` 会断言）。
- 出处链接为二级资料（Fandom 奥特曼维基 / 日文维基）。**本次开发环境无法访问外网**（连接 wikipedia / fandom / google 全部超时），因此链接是给读者核对用的参考地址，招式名与动作要点由本仓库作者依据设定资料整理；若某槽位没有严格对应的原作招式，表中会注明「以 XX 为原型改写」。

| 怪兽 | 槽位 | 中文名 | 原作名 | 动作要点（本作表现） | 出处 |
| --- | --- | --- | --- | --- | --- |
| baltan | bolt | 白色破坏光弹 | ホワイト・デストレイ・ショット / White Destruction Ray | 双钳先向两侧抬起蓄能，再同时前推，光弹从钳爪发出 | https://ultra.fandom.com/wiki/Alien_Baltan |
| baltan | sweep | 冷冻光线 | 冷凍光線 / Freeze Ray | 双臂高举后向一侧横抹，光束沿地平扫过 | https://ultra.fandom.com/wiki/Alien_Baltan |
| baltan | melee | 巴尔坦钳爪突刺 | バルタン・クロー | 一臂后收、另一臂前刺，钳爪张开 | https://ultra.fandom.com/wiki/Alien_Baltan |
| baltan | charge | 分身突进 | 分身 / テレポート | 双臂后掠、上身压低冲入 | https://ultra.fandom.com/wiki/Alien_Baltan |
| mefilas | bolt | 美菲拉斯光弹 | 以原作的光弹为原型改写 | 双手抬到胸高、掌心向前推出 | https://ultra.fandom.com/wiki/Alien_Mefilas |
| mefilas | sweep | 念力波动 | 念力 / サイコキネシス | 双臂横向张开后一起前推，形成扇形波动 | https://ultra.fandom.com/wiki/Alien_Mefilas |
| mefilas | melee | 怪力直拳 | 以原作的怪力为原型改写 | 单臂后收蓄力、直拳前冲 | https://ultra.fandom.com/wiki/Alien_Mefilas |
| mefilas | charge | 瞬间移动 | 瞬間移動 / Teleportation | 双臂贴身收拢、身体前倾急停急进 | https://ultra.fandom.com/wiki/Alien_Mefilas |
| chaos-seven | bolt | 艾梅利姆光线 | エメリウム光線 / Emerium Ray | 右手抬到头侧凝光，再向斜前下方射出（额头/头镖位置） | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-seven | sweep | 头镖飞旋 | アイスラッガー / Eye Slugger | 右手抓向头侧取镖，随后横向甩出 | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-seven | melee | 赛文式连击 | セブン流格闘術 | 一臂护面、另一臂短促前击 | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-seven | charge | 暗影突进 | 以原作的高速突进为原型改写 | 双臂后摆、上身压低 | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-taro | bolt | 斯特利姆光线 | ストリウム光線 / Storium Ray | 双手收到胸前聚气，然后双臂水平张开成 T 形发射 | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-taro | sweep | 新斯特利姆光线 | ネオストリウム光線 | 单臂上举后横扫，光带贴地扫过 | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-taro | melee | 燕式踢 | スワローキック / Swallow Kick | 抬膝起跳、单腿前踢（腿部骨骼参与） | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-taro | charge | 王者冲锋 | 以原作的高机动冲刺为原型改写 | 双臂贴身后掠、肩部前压 | https://ultra.fandom.com/wiki/Chaosroid |
| chaos-ultraman | bolt | 卡欧斯斯派修姆光线 | カオススペシウム光線 / Chaos Specium Ray | 双臂在胸前交叉成「＋」后同时前推 | https://ultra.fandom.com/wiki/Chaos_Ultraman |
| chaos-ultraman | sweep | 卡欧斯光轮 | カオススラッシュ / Ultra Slash | 单手高举过头凝轮，再横向下劈 | https://ultra.fandom.com/wiki/Chaos_Ultraman |
| chaos-ultraman | melee | 奥特拳 | ウルトラパンチ | 标准直立直拳 | https://ultra.fandom.com/wiki/Chaos_Ultraman |
| chaos-ultraman | charge | 高速突进 | 高速移動 | 双臂收在体侧、上身笔直前冲 | https://ultra.fandom.com/wiki/Chaos_Ultraman |
| zetton | bolt | 一兆度火球 | 一兆度の火球 / Trillion Degree Fireball | 双手抬到脸侧聚热，火球从面部（口部）射出，双臂随之后甩 | https://ultra.fandom.com/wiki/Zetton |
| zetton | sweep | 杰顿光线 | ゼットン光線 | 双臂前伸并拢，光束从双手之间发出 | https://ultra.fandom.com/wiki/Zetton |
| zetton | melee | 能量拳 | ゼットンパンチ（以原作近身为原型改写） | 短促上勾拳 | https://ultra.fandom.com/wiki/Zetton |
| zetton | charge | 瞬间移动 | テレポート / Teleportation | 双臂内收、身体瞬间前移 | https://ultra.fandom.com/wiki/Zetton |
| gomora-mecha | bolt | 机械光弹 | 以原作的指爪光弹为原型改写 | 单臂抬起前指，弹从指爪发出 | https://ultra.fandom.com/wiki/Mecha_Gomora |
| gomora-mecha | sweep | 超振动波 | 超振動波 / Super Oscillatory Wave | 头角上抬蓄力、上身立起，波从头部角发出 | https://ultra.fandom.com/wiki/Mecha_Gomora |
| gomora-mecha | slam | 大地踏击 | メガトン・スタンプ（以原作的巨体踏击为原型改写） | 双臂下压、髋部前倾砸向地面 | https://ultra.fandom.com/wiki/Mecha_Gomora |
| gomora-mecha | melee | 机械重拳 | 以原作的怪力拳为原型改写 | 抬拳过肩后重砸 | https://ultra.fandom.com/wiki/Mecha_Gomora |
| gomora-mecha | charge | 蛮力突进 | 以原作的巨体冲撞为原型改写 | 低头、双臂后掠冲撞 | https://ultra.fandom.com/wiki/Mecha_Gomora |
| galactron | bolt | 迦拉克隆光线 | ガラクトロン光線 / Galactron Ray | 双臂外张、胸甲后仰聚能，随后胸部核心向前发光 | https://ultra.fandom.com/wiki/Galactron |
| galactron | sweep | 重力冲击波 | グラビティ・ショック（以原作的引力/冲击为原型改写） | 双臂下压、身体下沉，冲击波贴地扩散 | https://ultra.fandom.com/wiki/Galactron |
| galactron | slam | 巨体重压 | ボディプレス | 双臂高举后同时下砸 | https://ultra.fandom.com/wiki/Galactron |
| galactron | melee | 腕刃斩击 | ガラクトロン・ブレード | 单臂横挥，刃口向前扫过 | https://ultra.fandom.com/wiki/Galactron |
| galactron | charge | 暴走冲锋 | 以原作的突进为原型改写 | 双臂张开、上身前倾 | https://ultra.fandom.com/wiki/Galactron |
| gatanothor | bolt | 怪光线 | 怪光線 / Gatanothor's beam | 双臂张开、口部（头内）聚光后射出 | https://ultra.fandom.com/wiki/Gatanothor |
| gatanothor | sweep | 触手横扫 | 触手攻撃 / Tentacle attack | 双臂横张，触手在身前扫过 | https://ultra.fandom.com/wiki/Gatanothor |
| gatanothor | slam | 触手砸击 | 以原作的触手叩きつけ为原型改写 | 双臂高举后并拢下砸（双手同高同时下压） | https://ultra.fandom.com/wiki/Gatanothor |
| gatanothor | melee | 大镰重击 | 大鎌による打撃 | 单臂横向重击 | https://ultra.fandom.com/wiki/Gatanothor |
| gatanothor | charge | 黑暗突进 | 以原作的巨体突进为原型改写 | 双臂内收、身体前压 | https://ultra.fandom.com/wiki/Gatanothor |

## 发射点

光弹不必都从手骨发出，`MONSTER_MOVES[model][kind].emit` 决定起点：

| emit | 位置 | 用到的怪兽 |
| --- | --- | --- |
| `hand` | 手骨（默认，带前臂方向微调） | 巴尔坦、美菲拉斯、卡欧斯·赛文（头镖）、卡欧斯·泰罗、卡欧斯·奥特曼、杰顿（杰顿光线）、机械哥莫拉（光弹/重拳）、迦拉克隆（冲击波/刃击）、加坦杰厄（触手/镰击） |
| `mouth` | 头部前方下部（口部） | 杰顿的 bolt（一兆度火球）、加坦杰厄的 bolt（怪光线） |
| `forehead` | 头部前方上部 | 卡欧斯·赛文的 bolt（艾梅利姆光线） |
| `horn` | 头顶角 | 机械哥莫拉的 sweep（超振动波） |
| `chest` | 胸甲前方 | 迦拉克隆的 bolt（迦拉克隆光线） |

`src/monster-motion.js` 的 `origin(side)` 会按当前招式的 `emit` 返回世界坐标，光效与命中判定因此都跟着真实发射点走。
