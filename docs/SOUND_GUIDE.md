# DesktopXPet 提示音制作指南

本文档讲解 DesktopXPet 提示音系统的规范、触发机制，以及如何制作和替换自定义提示音。

---

## 一、提示音系统概述

DesktopXPet 通过音效反馈宠物状态变化，让用户即使不看屏幕也能感知 AI 工具的工作进度。

### 1.1 内置提示音

项目内置 3 个提示音，位于 `resources/sounds/` 目录：

| 文件 | 触发时机 | 情感色彩 | 时长 |
|------|---------|---------|------|
| `click.wav` | 点击宠物身体（设置中开启时） | 清脆、轻快 | ~40ms |
| `complete.wav` | 任务完成（`completed` 状态） | 愉悦、上行 | ~370ms |
| `error.wav` | 工具出错（`error` 状态） | 警示、下行 | ~330ms |

### 1.2 触发机制

提示音由主进程的 `src/main/sound.ts` 管理，通过 IPC 通知渲染进程播放：

```
状态变化 → MonitorService.emitUpdate()
         → App.tsx 检测 petState
         → window.desktopXPet.playSound(name)
         → 主进程查找 soundPaths
         → IPC 发送 'sound:play-file' 到渲染进程
         → 渲染进程 new Audio(filePath).play()
```

**关键代码位置：**
- 主进程音效初始化：[src/main/sound.ts](../src/main/sound.ts)
- 状态触发逻辑：[src/renderer/App.tsx](../src/renderer/App.tsx) 的 `onStatusUpdate` 回调
- 渲染进程播放：[src/preload/index.ts](../src/preload/index.ts) 的 `sound:play-file` 监听

### 1.3 去重机制

- **complete 音效** — 同一 `completed` 事件（`tool + timestamp`）在 30 秒窗口内只播放一次，由 `MonitorService.notifiedCompletedKeys` 去重
- **error 音效** — 每次 `error` 状态切换都会播放（无去重）
- **click 音效** — 每次点击宠物身体播放一次

---

## 二、音效技术规范

### 2.1 文件格式

| 参数 | 要求 |
|------|------|
| 格式 | WAV (PCM) 或 MP3 |
| 采样率 | 44100 Hz（推荐）或 22050 Hz |
| 位深 | 16-bit（WAV）|
| 声道 | 单声道（mono）即可，立体声也支持 |
| 时长 | 建议 < 1 秒，最长不超过 3 秒 |
| 文件大小 | 建议 < 100KB |

> **为什么推荐 WAV？** Electron 的 `Audio` API 对 WAV 支持最好，无解码延迟，适合需要即时反馈的短音效。MP3 也可用，但首次播放可能有微小延迟。

### 2.2 音量规范

- 系统播放时固定音量为 `0.5`（在 preload 中设置）
- 制作音效时应以 **0.5 音量下仍清晰可辨** 为目标
- 避免音效过响（会吓到用户）或过轻（听不见）
- 建议峰值音量在 `-6dB ~ -3dB` 之间

### 2.3 命名规范

文件名必须与代码中引用的名称一致：

```typescript
// src/main/sound.ts
const sounds = ['click.wav', 'complete.wav', 'error.wav']
```

如需添加新音效，需同步修改 `sound.ts` 中的 `sounds` 数组。

---

## 三、音效设计原则

### 3.1 各音效的设计要点

#### click.wav（点击音）

- **情感**：轻快、确认感
- **频率**：中高频（800-2000Hz）
- **时长**：极短（30-80ms）
- **包络**：快速衰减（指数衰减）
- **参考**：电子游戏中的菜单选择音、鼠标点击音

**设计示例**：800Hz 主音 + 1200Hz 泛音，指数衰减，40ms

#### complete.wav（完成音）

- **情感**：愉悦、满足、奖励感
- **频率**：上行音阶（如 C5 → E5 → G5）
- **时长**：300-500ms
- **包络**：每个音符有淡入淡出，音符间有短暂间隔
- **参考**：游戏通关音、成就解锁音、消息提示音

**设计示例**：C5 (523Hz) 150ms + 间隔 20ms + E5→G5 滑音 200ms

#### error.wav（错误音）

- **情感**：警示、但不刺耳
- **频率**：下行音阶（如 A4 → F4 → D4）
- **时长**：300-400ms
- **包络**：每个音符有淡入淡出，可加入轻微方波增加粗糙感
- **参考**：错误提示音、警告声

**设计示例**：A4 (440Hz) 120ms + 间隔 30ms + F4→D4 下行滑音 180ms

### 3.2 通用设计原则

1. **短促有力** — 提示音不应超过 1 秒，避免干扰用户
2. **频率区分** — 三个音效应在不同频段，便于区分：
   - click：中高频（800-2000Hz）
   - complete：中频上行（400-1000Hz）
   - error：中低频下行（300-600Hz）
3. **避免突兀** — 所有音效必须有淡入（至少 3ms）避免"咔嗒"声
4. **避免疲劳** — complete 音效会频繁触发，旋律应简单不抓耳
5. **音量一致** — 三个音效的响度应接近，避免用户频繁调整音量

---

## 四、制作方式

### 4.1 路线 A — 程序化生成（Python）

项目内置音效即用此方式生成，脚本位于 [resources/sounds/generate_sounds.py](../resources/sounds/generate_sounds.py)。

#### 环境准备

```bash
# Python 3.8+，无需第三方库（仅用标准库 wave + struct + math）
python resources/sounds/generate_sounds.py
```

#### 自定义音效生成模板

```python
"""
DesktopXPet 自定义提示音生成模板
产出: click.wav, complete.wav, error.wav
"""
import wave
import struct
import math
import os

SAMPLE_RATE = 44100
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


def write_wav(filename: str, samples: list[int], channels: int = 1):
    """写入 16-bit PCM WAV 文件"""
    path = os.path.join(OUTPUT_DIR, filename)
    with wave.open(path, 'w') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(SAMPLE_RATE)
        for s in samples:
            w.writeframes(struct.pack('<h', max(-32768, min(32767, s))))
    print(f"  Written: {path} ({len(samples)} samples, {len(samples)/SAMPLE_RATE:.3f}s)")


def generate_tone(freq: float, duration_ms: float, volume: float = 0.5,
                  fade_in_ms: float = 5, fade_out_ms: float = 30) -> list[int]:
    """生成单一频率的正弦波，带淡入淡出"""
    n = int(SAMPLE_RATE * duration_ms / 1000)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # 包络：淡入 + 淡出
        env = 1.0
        if i < int(SAMPLE_RATE * fade_in_ms / 1000):
            env = i / (SAMPLE_RATE * fade_in_ms / 1000)
        elif i > n - int(SAMPLE_RATE * fade_out_ms / 1000):
            env = (n - i) / (SAMPLE_RATE * fade_out_ms / 1000)
        val = math.sin(2 * math.pi * freq * t) * volume * env
        samples.append(int(val * 32767))
    return samples


def generate_click():
    """清脆点击音：短促的高频脉冲"""
    n = int(SAMPLE_RATE * 0.04)  # 40ms
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 120)  # 指数衰减
        val = (math.sin(2 * math.pi * 800 * t) * 0.4 +
               math.sin(2 * math.pi * 1200 * t) * 0.2) * env
        samples.append(int(val * 32767))
    write_wav('click.wav', samples)


def generate_complete():
    """完成音：上行双音阶，愉悦感"""
    # 第一音：C5 (523Hz)，150ms
    tone1 = generate_tone(523, 150, volume=0.45, fade_in_ms=5, fade_out_ms=20)
    gap = [0] * int(SAMPLE_RATE * 0.02)  # 20ms 静音
    # 第二音：E5 (659Hz) → G5 (784Hz) 滑音，200ms
    n2 = int(SAMPLE_RATE * 0.20)
    tone2 = []
    for i in range(n2):
        t = i / SAMPLE_RATE
        progress = i / n2
        freq = 659 + (784 - 659) * progress  # 滑音
        env = 1.0
        if i < int(SAMPLE_RATE * 0.005):
            env = i / (SAMPLE_RATE * 0.005)
        elif i > n2 - int(SAMPLE_RATE * 0.04):
            env = (n2 - i) / (SAMPLE_RATE * 0.04)
        val = math.sin(2 * math.pi * freq * t) * 0.45 * env
        val += math.sin(2 * math.pi * freq * 2 * t) * 0.1 * env  # 泛音
        tone2.append(int(val * 32767))
    write_wav('complete.wav', tone1 + gap + tone2)


def generate_error():
    """错误音：下行双音，略带紧张感"""
    tone1 = generate_tone(440, 120, volume=0.4, fade_in_ms=3, fade_out_ms=15)
    gap = [0] * int(SAMPLE_RATE * 0.03)
    n2 = int(SAMPLE_RATE * 0.18)
    tone2 = []
    for i in range(n2):
        t = i / SAMPLE_RATE
        progress = i / n2
        freq = 349 - (349 - 293) * progress  # 下行滑音
        env = 1.0
        if i < int(SAMPLE_RATE * 0.003):
            env = i / (SAMPLE_RATE * 0.003)
        elif i > n2 - int(SAMPLE_RATE * 0.05):
            env = (n2 - i) / (SAMPLE_RATE * 0.05)
        val = math.sin(2 * math.pi * freq * t) * 0.4 * env
        val += (1 if math.sin(2 * math.pi * freq * t) > 0 else -1) * 0.08 * env  # 方波色彩
        tone2.append(int(val * 32767))
    write_wav('error.wav', tone1 + gap + tone2)


if __name__ == '__main__':
    print("Generating DesktopXPet sound effects...")
    generate_click()
    generate_complete()
    generate_error()
    print("Done!")
```

#### 常用音符频率参考

| 音符 | 频率 (Hz) | 音符 | 频率 (Hz) |
|------|----------|------|----------|
| C4 (Do) | 262 | C5 (Do) | 523 |
| D4 (Re) | 294 | D5 (Re) | 587 |
| E4 (Mi) | 330 | E5 (Mi) | 659 |
| F4 (Fa) | 349 | F5 (Fa) | 698 |
| G4 (Sol) | 392 | G5 (Sol) | 784 |
| A4 (La) | 440 | A5 (La) | 880 |
| B4 (Si) | 494 | B5 (Si) | 988 |

### 4.2 路线 B — DAW 制作（FL Studio / Ableton / GarageBand）

适合有音乐制作基础的用户。

#### 工作流程

1. **新建项目** — 采样率 44100Hz，位深 16-bit
2. **设计旋律** — 按上文的设计原则编写 MIDI
3. **选择音色** — 推荐使用合成器（Synth）音色：
   - click：方波（Square）或正弦波（Sine）
   - complete：三角波（Triangle）+ 轻微混响
   - error：锯齿波（Saw）+ 失真
4. **混音** — 确保峰值在 `-6dB ~ -3dB`
5. **导出** — Export as WAV，单声道，44100Hz

#### GarageBand 简易流程

1. 新建项目 → Software Instrument
2. 选择合成器音色（如 "Sine Lead" 或 "Square Lead"）
3. 在钢琴卷帘中绘制音符
4. Share → Export Song to Disk → WAV 格式

### 4.3 路线 C — 在线工具生成

无需安装软件，适合快速原型。

#### 推荐工具

| 工具 | 网址 | 特点 |
|------|------|------|
| [jsfxr](https://sfxr.me/) | https://sfxr.me/ | 8-bit 游戏音效生成器，一键随机 |
| [Bfxr](https://www.bfxr.net/) | https://www.bfxr.net/ | jsfxr 增强版，更多参数 |
| [Freesound](https://freesound.org/) | https://freesound.org/ | 免费音效素材库 |
| [Mixkit](https://mixkit.co/free-sound-effects/) | https://mixkit.co/free-sound-effects/ | 免费商用音效 |

#### jsfxr 工作流程

1. 访问 https://sfxr.me/
2. 点击预设按钮（Pickup/Coin, Laser/Shoot, etc.）或随机生成
3. 调整参数（频率、衰减、滑音等）
4. 点击 Export WAV 下载
5. 重命名为 `click.wav` / `complete.wav` / `error.wav`

---

## 五、安装与替换

### 5.1 音效优先级

系统按以下顺序加载音效，后者覆盖前者：

| 优先级 | 目录 | 说明 |
|--------|------|------|
| 最低 | `resources/sounds/` | 内置音效，所有皮肤共享 |
| 中等 | `resources/skins/<皮肤名>/sounds/` | 皮肤专属音效，切换皮肤时自动加载 |
| 最高 | `%APPDATA%/desktopxpet/sounds/` | 用户自定义音效，全局覆盖 |

> 只需放入同名文件即可覆盖，无需修改代码。

### 5.2 替换内置音效

直接覆盖 `resources/sounds/` 目录下的文件：

```
resources/sounds/
├── click.wav       ← 替换为你的点击音
├── complete.wav    ← 替换为你的完成音
├── error.wav       ← 替换为你的错误音
└── generate_sounds.py
```

重启应用后生效。

### 5.3 添加皮肤专属音效

在皮肤目录下创建 `sounds/` 子目录，放入同名音效文件：

```
my-skin/
├── manifest.json
├── idle.png
├── working.png
├── ...
└── sounds/              ← 皮肤专属音效
    ├── click.wav        ← 覆盖内置 click
    ├── complete.wav     ← 覆盖内置 complete
    └── error.wav        ← 覆盖内置 error
```

- 切换到该皮肤时自动加载其专属音效
- 切回其他皮肤时恢复默认音效
- 不需要每个音效都有，只放想覆盖的即可
- 也可通过右键宠物 → `🎵 打开音效目录` 打开用户音效目录

### 5.4 用户自定义音效

将音效文件放入用户数据目录，全局覆盖所有皮肤的音效：

- **Windows:** `%APPDATA%/desktopxpet/sounds/`
- **macOS:** `~/Library/Application Support/desktopxpet/sounds/`
- **Linux:** `~/.config/desktopxpet/sounds/`

也可通过右键宠物 → `🎵 打开音效目录` 直接打开该目录。

### 5.5 开关音效

在仪表盘 → 设置面板中：

- **点击音效** — 控制 `click.wav` 的播放（不影响 complete 和 error）
- complete 和 error 音效目前无独立开关，可通过设置系统通知开关间接控制

### 5.6 音量调节

当前音量固定为 `0.5`，如需修改，编辑 [src/preload/index.ts](../src/preload/index.ts)：

```typescript
ipcRenderer.on('sound:play-file', (_, filePath: string) => {
  try {
    const audio = new Audio(`file:///${filePath.replace(/\\/g, '/')}`)
    audio.volume = 0.5  // ← 修改此处（0.0 ~ 1.0）
    audio.play().catch(() => {})
  } catch {
    // 静默忽略
  }
})
```

---

## 六、进阶：添加新音效

如需添加新的音效类型（如 `working.wav` 工作开始音），需要修改 3 个文件：

### 6.1 主进程 — 注册音效

编辑 [src/main/sound.ts](../src/main/sound.ts)：

```typescript
const sounds = ['click.wav', 'complete.wav', 'error.wav', 'working.wav']
//                                                          ^^^^^^^^^^^^^ 新增
```

### 6.2 渲染进程 — 触发音效

编辑 [src/renderer/App.tsx](../src/renderer/App.tsx) 的 `onStatusUpdate` 回调：

```typescript
cleanupStatus = window.desktopXPet.onStatusUpdate((status: any) => {
  if (!status || !status.petState) return

  if (status.petState === 'happy' && status.newCompleted) {
    window.desktopXPet.playSound('complete')
  } else if (status.petState === 'error') {
    window.desktopXPet.playSound('error')
  } else if (status.petState === 'working') {
    // 新增：进入工作状态时播放 working 音效
    window.desktopXPet.playSound('working')
  }
  useAppStore.getState().setMonitorData(status)
})
```

### 6.3 添加音效文件

将 `working.wav` 放入 `resources/sounds/` 目录。

### 6.4 去重处理（可选）

如果新音效可能频繁触发，参考 `MonitorService.notifiedCompletedKeys` 的模式添加去重逻辑，避免每次状态轮询都播放。

---

## 七、测试

### 7.1 快速预览

用 Python 播放 WAV 文件检查效果：

```python
import wave
import struct
import pyaudio  # pip install pyaudio

def play_wav(filename):
    with wave.open(filename, 'rb') as w:
        p = pyaudio.PyAudio()
        stream = p.open(format=p.get_format_from_width(w.getsampwidth()),
                        channels=w.getnchannels(),
                        rate=w.getframerate(),
                        output=True)
        data = w.readframes(w.getnframes())
        stream.write(data)
        stream.close()
        p.terminate()

play_wav('complete.wav')
```

或直接用系统命令：

```bash
# Windows
start complete.wav

# macOS
afplay complete.wav

# Linux
aplay complete.wav
```

### 7.2 应用内测试

1. 替换 `resources/sounds/` 下的音效文件
2. 启动应用 `npm run dev`
3. 触发各状态：
   - **click** — 点击宠物身体
   - **complete** — 通过 HTTP API 推送 `completed` 状态：
     ```bash
     curl -X POST http://127.0.0.1:9527/api/status \
       -H "Content-Type: application/json" \
       -H "x-pet-token: YOUR_TOKEN" \
       -d '{"tool":"test","status":"completed","summary":"测试完成音"}'
     ```
   - **error** — 推送 `error` 状态：
     ```bash
     curl -X POST http://127.0.0.1:9527/api/status \
       -H "Content-Type: application/json" \
       -H "x-pet-token: YOUR_TOKEN" \
       -d '{"tool":"test","status":"error","summary":"测试错误音"}'
     ```

### 7.3 检查清单

- [ ] 音效文件格式为 WAV 或 MP3
- [ ] 文件名正确（`click.wav` / `complete.wav` / `error.wav`）
- [ ] 时长不超过 3 秒
- [ ] 音量适中（0.5 播放音量下清晰可辨，不刺耳）
- [ ] 有淡入淡出，无"咔嗒"爆音
- [ ] 三个音效频段区分明显
- [ ] complete 音效不会因频繁触发而令人烦躁

---

## 八、常见问题

**Q: 为什么我的音效不播放？**

检查以下几点：
1. 文件是否在 `resources/sounds/` 目录下
2. 文件名是否完全匹配（区分大小写）
3. 启动日志中是否有 `Sound file not found` 警告
4. 文件格式是否为 WAV 或 MP3
5. 系统音量是否为 0

**Q: 可以用 MP3 格式吗？**

可以。Electron 的 `Audio` API 支持 MP3。但 WAV 首次播放无解码延迟，更适合短音效。

**Q: 如何调整音量？**

当前固定为 0.5，需修改 `src/preload/index.ts` 中的 `audio.volume`。未来版本计划添加设置面板中的音量滑块。

**Q: 音效播放有延迟怎么办？**

- 确保使用 WAV 格式（无解码延迟）
- 缩短音效时长（< 500ms）
- 检查系统 CPU 占用是否过高

**Q: 如何制作 8-bit 风格的音效？**

8-bit 音效的特点：
- 使用方波（Square wave）或三角波（Triangle wave）
- 采样率较低（22050Hz 或更低）
- 位深较低（8-bit 模拟）
- 旋律简单、循环短

用 jsfxr (https://sfxr.me/) 可以快速生成 8-bit 风格音效。

**Q: 可以让不同皮肤有不同的音效吗？**

可以！在皮肤目录下创建 `sounds/` 子目录，放入同名音效文件即可。音效优先级：用户音效 > 皮肤音效 > 内置音效。

```
my-skin/
├── manifest.json
├── idle.png
├── sounds/          ← 皮肤专属音效
│   ├── click.wav    ← 覆盖内置 click
│   ├── complete.wav ← 覆盖内置 complete
│   └── error.wav    ← 覆盖内置 error
└── preview.png
```

切换到该皮肤时自动加载其专属音效，切回其他皮肤时恢复默认音效。详见 [SKIN_GUIDE.md](./SKIN_GUIDE.md) 的音效章节。

**Q: complete 音效为什么有时不播放？**

complete 音效有去重机制：同一 `completed` 事件（`tool + timestamp`）在 30 秒窗口内只播放一次。如果短时间内多次推送相同的 completed 状态，只会播放第一次。这是为了避免任务完成时音效轰炸。

---

## 九、参考资源

- [项目内置音效生成脚本](../resources/sounds/generate_sounds.py) — 完整的 Python 生成代码
- [Web Audio API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API) — 浏览器音频 API 文档
- [jsfxr](https://sfxr.me/) — 在线 8-bit 音效生成器
- [Freesound](https://freesound.org/) — 免费音效素材库（注意授权协议）
- [Audacity](https://www.audacityteam.org/) — 免费开源音频编辑软件
