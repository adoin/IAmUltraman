# 中文场景配音

来源：Qwen 团队官方 Qwen3-TTS Studio，https://huggingface.co/spaces/Qwen/Qwen3-TTS 。
模型：https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice ，模型许可 Apache-2.0，完整文本见 QWEN3-TTS-LICENSE.txt。固定 Ryan 音色、Chinese、1.7B。生成日期：2026-11-06。

指令：用清晰自然的标准普通话配音，年轻男性战斗指挥员，坚定、热血、充满希望，像在鼓励小朋友，节奏紧凑有力，不要嘶吼，不要模仿具体演员。

本游戏原创场景台词，终结提示按用户提供的措辞改写。不是电视剧音频，也没有上传或克隆演员录音。音频经响度统一和 Opus 24kHz 单声道压缩。文件、台词、时长和校验值见 clips.json；运行时清单见 voices.json。所有文件随站点预载，游戏不调用推理服务。

音乐与音效：src/game-audio.js 内原创合成。未打包中配剧集或其背景音乐；设置中可选择本地音频，仅本机播放。
