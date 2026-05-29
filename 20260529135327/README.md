# FFmpeg 音频特效工坊

基于 **FFmpeg.wasm + Web Audio API** 的纯前端音频特效处理器，支持 **mp4 / wav** 输入，提供 **5 大类共 21 种** 基于真实声学数据的音效。

## 在线体验

部署后访问 EdgeOne Pages 提供的链接即可。

## 本地运行

由于 FFmpeg.wasm 需要 `SharedArrayBuffer`，必须使用启用了跨域隔离的服务器：

```bash
python3 server.py
# 访问 http://localhost:8765/index.html
```

## 21 种音效

| 类别 | 效果 | 声学参数依据 |
|------|------|-------------|
| 🏛️ 空间混响 | 大厅 / 教堂 / 浴室 / 小房间 / 录音棚 | ISO 3382 房间声学（RT60: 0.25s ~ 4.5s） |
| 📞 通讯效果 | 电话 / 对讲机 / 老式收音机 / 留声机 | ITU-T G.712、AM 广播、78 RPM 黑胶频响 |
| 🌊 环境模拟 | 水下 / 隔门 / 隔墙 / 太空 / 山谷 | 介质衰减 + 遮挡传递函数 |
| 💭 叙事效果 | 内心独白 / 回忆 / 梦境 / 闪回 | 影视音效设计标准 |
| 🎧 立体声/空间 | 立体声扩展 / 3D 环绕 / HRTF / 双耳渲染 | MIT KEMAR HRTF 数据集 |

## 技术栈

- **FFmpeg.wasm 0.11**：从 mp4 抽取音轨为 PCM WAV
- **Web Audio API**：实时试听 + `OfflineAudioContext` 离线渲染
- **合成 IR 卷积混响**：按 `e^(-6.91·t/RT60)` 公式生成脉冲响应

## 文件清单

```
index.html       # 页面
styles.css       # 样式
effects.js       # 21 种效果参数定义
app.js           # 主程序（FFmpeg + Web Audio）
ffmpeg/          # FFmpeg.wasm 核心文件（本地）
server.py        # 带 COOP/COEP 的本地服务器
_headers         # 部署平台响应头配置
edgeone.json     # EdgeOne Pages 响应头配置
```

## 部署要求

部署平台必须支持以下响应头（已通过 `_headers` 与 `edgeone.json` 配置）：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```
