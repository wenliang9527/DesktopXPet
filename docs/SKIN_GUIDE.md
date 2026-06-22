## DesktopXPet 皮肤制作指南

本文档面向皮肤作者，从零开始讲解如何为 DesktopXPet 制作一套完整的皮肤。无论你是程序员、像素画师还是 AI 玩家，都能找到适合自己的路线。

---

### 一、皮肤技术规范

#### 1.1 文件结构

每套皮肤是一个独立文件夹，包含以下文件：

```
my-skin/
├── manifest.json    # 必须 — 皮肤元信息和动画配置
├── idle.png         # 必须 — 待机动画精灵图
├── working.png      # 必须 — 工作动画精灵图
├── happy.png        # 必须 — 开心动画精灵图
├── sleeping.png     # 必须 — 睡眠动画精灵图
├── error.png        # 必须 — 出错动画精灵图
├── preview.png      # 推荐 — 预览缩略图（推荐 128×128 或 256×256）
└── sounds/          # 可选 — 皮肤专属音效（切换皮肤时自动加载）
    ├── click.wav    # 覆盖内置点击音
    ├── complete.wav # 覆盖内置完成音
    └── error.wav    # 覆盖内置错误音
```

> **皮肤音效说明**：`sounds/` 子目录下的音效文件会覆盖内置音效，只需放入想覆盖的同名文件即可。不需要每个音效都有。音效优先级：用户音效 > 皮肤音效 > 内置音效。详见 [SOUND_GUIDE.md](./SOUND_GUIDE.md)。

#### 1.2 精灵图格式

精灵图（Sprite Sheet）是将多帧动画**横向排列**在一张 PNG 图片中：

```
┌────────┬────────┬────────┬────────┐
│ 帧 1   │ 帧 2   │ 帧 3   │ 帧 4   │   ← idle.png (4帧, 256×64)
└────────┴────────┴────────┴────────┘

┌────┬────┬────┬────┬────┬────┐
│ F1 │ F2 │ F3 │ F4 │ F5 │ F6 │       ← working.png (6帧, 384×64)
└────┴────┴────┴────┴────┴────┘
```

**关键参数：**

| 参数 | 值 | 说明 |
|------|-----|------|
| 色彩模式 | RGBA (32-bit PNG) | 必须支持透明通道 |
| 背景 | 完全透明 | 精灵图背景必须是透明 (alpha=0) |
| 布局 | 横向排列 | 所有帧横向排列，高度等于单帧高度 |
| 渲染优化 | 预缩放 | 系统加载时自动将精灵图预缩放到渲染尺寸，运行时不再缩放 |

> **支持的帧尺寸**：系统会根据 `manifest.json` 中的 `frameSize` 自动适配，不限定固定尺寸。项目现有皮肤使用了 64×64、128×128、384×384 三种规格。

#### 1.2.1 两种渲染模式

系统根据 `frameSize` 自动判断渲染模式，无需手动配置：

| 模式 | 判定条件 | 缩放算法 | 视觉效果 | 适用场景 |
|------|---------|---------|---------|---------|
| **像素风** | `frameSize` 最大边 ≤ 288 (192×1.5) | 最近邻 (NEAREST) | 放大后像素边缘锐利，无模糊 | 手绘像素画、程序化生成 |
| **高清风** | `frameSize` 最大边 > 288 | 双线性 (BILINEAR) | 缩放平滑，无锯齿 | AI 生成、高清插画 |

**渲染尺寸说明：**

所有皮肤都会被缩放到统一的渲染画布 (`PET_RENDER_SIZE = 192px`)。系统加载时：

1. 读取精灵图原始尺寸，计算单帧宽高比
2. 按宽高比将帧缩放到渲染画布内，**保持原始宽高比**（不会拉伸变形）
3. 角色在画布中**水平居中、底部对齐**（脚踩地面，不会"飘"在空中）
4. `displayScale` 可进一步调整角色在画布中的视觉大小

**像素风 vs 高清风的选择建议：**

- 手绘像素画 → 使用 64×64 或 128×128 帧尺寸，系统自动使用最近邻缩放，像素边缘保持锐利
- AI 生成角色 → 使用 384×384 帧尺寸，系统自动使用双线性缩放，画面平滑无锯齿
- 不建议将像素画设为 384×384（会被当作高清模式平滑缩放，失去像素锐利感）

#### 1.3 支持的帧尺寸规格

| 规格 | 帧尺寸 | 适用场景 | 示例皮肤 |
|------|--------|---------|---------|
| 标准像素风 | 64×64 | 32×32 内部绘制 + 2 倍放大，经典像素感 | butterfly-swordsman |
| 高清像素风 | 128×128 | 64×64 内部绘制或直接 128 绘制，细节更丰富 | default-cat |
| AI 生成高清 | 384×384 | AI 生成后直接使用，细节最丰富 | reze、professional-team、butterfly-swordsman-hd |

**如何选择：**
- **手绘像素画** → 选 64×64 或 128×128，保持像素锐利感
- **AI 生成角色** → 选 384×384，直接使用 AI 输出，无需缩小
- **程序化生成** → 选 64×64（32 内部绘制 + 2 倍放大），工作量最小

#### 1.4 manifest.json 规范

```json
{
  "name": "我的皮肤名称",
  "author": "作者名",
  "version": "1.0.0",
  "preview": "preview.png",
  "description": "一句话描述你的皮肤",
  "frameSize": {
    "width": 128,
    "height": 128
  },
  "displayScale": 1.0,
  "animations": {
    "idle": {
      "frames": 4,
      "fps": 4,
      "loop": true
    },
    "working": {
      "frames": 6,
      "fps": 8,
      "loop": true
    },
    "happy": {
      "frames": 4,
      "fps": 6,
      "loop": false
    },
    "sleeping": {
      "frames": 2,
      "fps": 1,
      "loop": true
    },
    "error": {
      "frames": 3,
      "fps": 4,
      "loop": true
    }
  }
}
```

各字段说明：

- `name` — 皮肤显示名称，支持中英文
- `author` — 作者名
- `version` — 语义版本号 (SemVer)
- `preview` — 预览图文件名，推荐 128×128 PNG
- `description` — 简短描述
- `frameSize` — 单帧尺寸（width × height），必须与精灵图实际帧尺寸一致
- `displayScale` — **（可选）** 显示缩放因子，默认 1.0。控制角色在渲染画布中的视觉大小：
  - `1.0` — 角色占满渲染区域（默认）
  - `< 1.0` — 角色缩小（如 0.8 = 缩小到 80%），周围留出更多空间
  - `> 1.0` — 角色放大（如 1.2 = 放大到 120%），超出部分会被裁剪
  - 用途：不同帧尺寸的皮肤视觉大小可能差异很大，通过此参数统一调整
- `animations` — 5 种动画状态的帧数和播放速度配置

**animations 中的参数：**

- `frames` — 该动画的总帧数（必须和精灵图中的实际帧数一致）
- `fps` — 每秒播放帧数（数值越大动画越快）
- `loop` — 是否循环播放。`idle`/`working`/`sleeping`/`error` 通常为 true，`happy` 可设为 false（播放一次后自动回到 idle）或 true（循环庆祝）

> **注意**：`frameSize.width × frames` 必须等于精灵图 PNG 的实际宽度。例如 128×128 帧、4 帧动画，精灵图尺寸应为 512×128。

#### 1.4.1 两种动画模式

manifest.json 中的 `renderMode` 字段决定动画模式：

| 模式 | `renderMode` 值 | 图片要求 | 动画原理 | 适用场景 |
|------|----------------|---------|---------|---------|
| **精灵图动画** | `"spritesheet"`（默认） | 每种状态一张横排多帧精灵图 | 逐帧切换，类似 GIF | 手绘/程序化多帧动画 |
| **静态立绘** | `"static"` | 每种状态一张单张立绘 | Canvas 变换（浮动、呼吸、摇摆、弹跳） | AI 生成单张角色图 |

**精灵图动画模式**（默认，无需指定 `renderMode`）：

```json
{
  "renderMode": "spritesheet",
  "animations": {
    "idle": { "frames": 4, "fps": 4, "loop": true },
    "happy": { "frames": 4, "fps": 6, "loop": false }
  }
}
```

- 每种状态需要一张横排精灵图（如 `idle.png` 包含 4 帧）
- 动画通过逐帧切换实现，帧数越多越流畅
- 适合有明确帧动画的皮肤（手绘像素画、程序化生成）

**静态立绘模式**：

```json
{
  "renderMode": "static",
  "animations": {
    "idle": {
      "effects": [
        { "type": "float", "speed": 1.0, "intensity": 4 },
        { "type": "breathe", "speed": 1.0, "intensity": 0.012 }
      ]
    },
    "happy": {
      "effects": [
        { "type": "bounce", "speed": 2.0, "intensity": 8 },
        { "type": "sway", "speed": 1.5, "intensity": 0.03 }
      ],
      "duration": 3
    }
  }
}
```

- 每种状态只需要一张单张图片（如 `idle.png` 是单帧立绘，不是多帧精灵图）
- 动画通过 Canvas 变换实现，无需绘制多帧
- `effects` 数组中的效果会叠加，可自由组合

**4 种内置效果：**

| 效果 | `type` | 说明 | `intensity` 含义 | 推荐值 |
|------|--------|------|-----------------|-------|
| 浮动 | `"float"` | 柔和上下浮动 | 浮动幅度（像素） | 3-6 |
| 呼吸 | `"breathe"` | 水平微缩+垂直微扩，模拟呼吸 | 缩放幅度（比例） | 0.01-0.02 |
| 摇摆 | `"sway"` | 左右旋转摇摆 | 摇摆角度（弧度） | 0.02-0.05 |
| 弹跳 | `"bounce"` | 向上弹跳 | 弹跳高度（像素） | 5-10 |

**效果参数：**

- `speed` — 速度倍率（可选，默认 1.0）。值越大动画越快
- `intensity` — 效果强度（可选，有默认值）。值越大效果越明显
- 多个效果可叠加，例如 idle 同时浮动+呼吸，happy 同时弹跳+摇摆

**`duration` 字段**（仅静态模式）：

- 非循环动画的持续时间（秒），如 `happy` 设为 3 表示庆祝 3 秒后回到 idle
- 不设置则永久循环（适合 idle、working、sleeping）

**各状态推荐效果组合：**

| 状态 | 推荐效果 | 说明 |
|------|---------|------|
| idle | float + breathe | 安静浮动+轻微呼吸 |
| working | breathe + sway | 呼吸+轻微摇摆（像在思考） |
| happy | bounce + sway | 弹跳+摇摆（庆祝感） |
| sleeping | breathe + float | 缓慢呼吸+轻微浮动（梦境感） |
| error | bounce + sway | 快速弹跳+剧烈摇摆（惊慌感） |

> **选择建议**：如果你有 AI 生成的角色立绘（单张图片），用静态立绘模式最省事——只需 5 张图 + 配置 effects 即可。如果你需要精细的动作表现（如走路、挥手），则用精灵图动画模式。

#### 1.5 五种动画状态

| 状态 | 触发时机 | 推荐帧数 | 推荐 fps | 动画要点 |
|------|---------|---------|---------|---------|
| idle | 默认待机 | 2-12 帧 | 3-6 | 呼吸、眨眼、尾巴轻摆等微小动作 |
| working | AI 工具忙碌时 | 4-12 帧 | 6-10 | 打字、挥剑、能量粒子等活跃动作 |
| happy | 任务完成时 | 3-12 帧 | 5-8 | 跳跃、庆祝、星星特效 |
| sleeping | 长时间无活动 | 2-12 帧 | 1-3 | 蜷缩、Zzz 气泡、极慢节奏 |
| error | 工具出错时 | 2-12 帧 | 3-6 | 惊讶表情、汗珠、感叹号 |

> 帧数越多动画越流畅，但精灵图文件也越大。AI 生成皮肤通常用 12 帧，程序化生成皮肤通常用 2-6 帧。

---

### 二、制作方式总览

DesktopXPet 支持三种皮肤制作路线，可根据你的技能和工具选择：

| 路线 | 适合人群 | 所需工具 | 学习曲线 | 灵活度 |
|------|---------|---------|---------|-------|
| A. 程序化生成 | 程序员 | Python + Pillow | 低（会写代码就行） | 中 |
| B. 手绘像素画 | 像素画师 | Aseprite / Piskel / LibreSprite | 中-高 | 高 |
| C. AI 辅助生成 | 任何人 | 图像生成 AI + 后处理工具 | 低 | 中 |

---

### 三、路线 A — 程序化生成（Python + Pillow）

这是本项目内置皮肤使用的方式。用代码逐像素绘制角色，适合快速迭代和批量生成。

#### 3.1 环境准备

```bash
# 需要 Python 3.8+
pip install Pillow
```

#### 3.2 脚本模板

以下是一个可直接运行的最小模板，包含完整的骨架结构：

```python
"""
DesktopXPet 皮肤生成模板
用法: python generate_my_skin.py
产出: resources/skins/my-skin/ 目录下的 5 张精灵图 + manifest.json
"""

from PIL import Image, ImageDraw
import os, json

# ============================================================
# 配置
# ============================================================
FRAME_SIZE = 32        # 内部绘制分辨率（推荐 32，放大到 64）
SCALE = 2              # 缩放倍数
OUTPUT_SIZE = FRAME_SIZE * SCALE
OUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "resources", "skins", "my-skin"
)

# ============================================================
# 调色板 — 在这里定义你的角色配色
# RGBA 格式: (R, G, B, Alpha)，Alpha=0 为透明，255 为不透明
# ============================================================
C = {
    't':          (0, 0, 0, 0),          # 透明
    'outline':    (40, 30, 30, 255),      # 描边色（深色）
    'body':       (200, 150, 100, 255),   # 主体色
    'body_light': (230, 190, 140, 255),   # 亮部
    'body_dark':  (160, 110, 70, 255),    # 暗部 / 阴影
    'eye_white':  (255, 255, 255, 255),
    'eye_pupil':  (40, 40, 40, 255),
    'eye_shine':  (255, 255, 255, 255),
    'blush':      (255, 170, 170, 120),   # 半透明腮红
    'sparkle':    (255, 255, 100, 255),   # 星星 / 特效
    'zzz':        (150, 150, 220, 200),   # 睡眠 Z
    'sweat':      (130, 200, 255, 255),   # 汗珠
}


def new_frame():
    """创建空白透明帧"""
    return Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), C['t'])


def rect(d, x, y, w, h, color):
    """画填充矩形"""
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


def px(d, x, y, color):
    """画单个像素"""
    d.point((x, y), fill=color)


# ============================================================
# 角色绘制函数 — 在这里画你的角色
# ============================================================

def draw_head(d, oy=0, eyes='open'):
    """
    绘制头部。
    参数:
      d    — ImageDraw.Draw 对象
      oy   — Y 轴偏移（用于呼吸动画）
      eyes — 眼睛状态: 'open', 'closed', 'half', 'wide', 'blink', 'closed_up'
    """
    ol = C['outline']
    body = C['body']

    # 示例: 圆形头部
    d.rounded_rectangle([10, 6+oy, 22, 16+oy], radius=3, fill=body, outline=ol)

    # 眼睛
    if eyes == 'open':
        rect(d, 12, 10+oy, 3, 3, C['eye_white'])
        rect(d, 13, 11+oy, 2, 2, C['eye_pupil'])
        px(d, 14, 10+oy, C['eye_shine'])

        rect(d, 18, 10+oy, 3, 3, C['eye_white'])
        rect(d, 19, 11+oy, 2, 2, C['eye_pupil'])
        px(d, 20, 10+oy, C['eye_shine'])
    elif eyes == 'closed':
        d.line([(12, 12+oy), (15, 12+oy)], fill=ol, width=1)
        d.line([(18, 12+oy), (21, 12+oy)], fill=ol, width=1)
    # ... 补充其他眼睛状态


def draw_body(d, oy=0):
    """绘制身体"""
    ol = C['outline']
    body = C['body']
    d.rounded_rectangle([11, 16+oy, 21, 26+oy], radius=2, fill=body, outline=ol)


# ============================================================
# 动画帧生成 — 每个状态一个函数
# ============================================================

def make_idle_frames(count=4):
    """待机: 呼吸 + 眨眼"""
    frames = []
    for i in range(count):
        img = new_frame()
        d = ImageDraw.Draw(img)
        if i == 2:
            draw_head(d, oy=0, eyes='blink')
        else:
            draw_head(d, oy=0, eyes='open')
        draw_body(d, oy=0)
        frames.append(img)
    return frames


def make_working_frames(count=6):
    """工作: 专注表情 + 动作"""
    frames = []
    for i in range(count):
        img = new_frame()
        d = ImageDraw.Draw(img)
        draw_head(d, oy=0, eyes='half')
        draw_body(d, oy=0)
        # 添加工作特效（粒子、打字动画等）
        frames.append(img)
    return frames


def make_happy_frames(count=4):
    """开心: 跳跃 + 星星"""
    frames = []
    for i in range(count):
        img = new_frame()
        d = ImageDraw.Draw(img)
        oy = [0, -2, -3, 0][i]  # 跳跃弧线
        draw_head(d, oy=oy, eyes='closed_up')
        draw_body(d, oy=oy)
        frames.append(img)
    return frames


def make_sleeping_frames(count=2):
    """睡眠: 蜷缩 + Zzz"""
    frames = []
    for i in range(count):
        img = new_frame()
        d = ImageDraw.Draw(img)
        draw_head(d, oy=2, eyes='closed')
        draw_body(d, oy=2)
        frames.append(img)
    return frames


def make_error_frames(count=3):
    """出错: 惊讶 + 汗珠"""
    frames = []
    for i in range(count):
        img = new_frame()
        d = ImageDraw.Draw(img)
        draw_head(d, oy=0, eyes='wide')
        draw_body(d, oy=0)
        frames.append(img)
    return frames


# ============================================================
# 精灵图组装
# ============================================================

def assemble_spritesheet(frames, output_path):
    """将帧列表合并为横向精灵图，自动放大"""
    w = OUTPUT_SIZE * len(frames)
    h = OUTPUT_SIZE
    sheet = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        scaled = frame.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.NEAREST)
        sheet.paste(scaled, (i * OUTPUT_SIZE, 0))
    sheet.save(output_path, 'PNG')
    print(f"  Saved: {output_path} ({w}x{h}, {len(frames)} frames)")


# ============================================================
# 入口
# ============================================================

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Output: {os.path.abspath(OUT_DIR)}\n")

    configs = [
        # (名称, 生成函数, 帧数, fps, 是否循环)
        ('idle',     make_idle_frames,     4, 4, True),
        ('working',  make_working_frames,  6, 8, True),
        ('happy',    make_happy_frames,    4, 6, False),
        ('sleeping', make_sleeping_frames, 2, 1, True),
        ('error',    make_error_frames,    3, 4, True),
    ]

    for name, gen, count, *_ in configs:
        print(f"Generating '{name}' ({count} frames)...")
        frames = gen(count)
        assemble_spritesheet(frames, os.path.join(OUT_DIR, f"{name}.png"))

    # manifest 的 animations 从 configs 动态生成，避免帧数重复定义
    manifest = {
        "name": "我的皮肤",
        "author": "作者名",
        "version": "1.0.0",
        "preview": "preview.png",
        "description": "皮肤描述",
        "frameSize": {"width": OUTPUT_SIZE, "height": OUTPUT_SIZE},
        "animations": {
            name: {"frames": count, "fps": fps, "loop": loop}
            for name, _, count, fps, loop in configs
        }
    }

    mp = os.path.join(OUT_DIR, "manifest.json")
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {mp}")
    print("\nDone!")


if __name__ == '__main__':
    main()
```

#### 3.3 工作流程

1. **复制模板** — 将上面的模板保存为 `tools/generate_my_skin.py`
2. **定义调色板** — 在 `C = { ... }` 中配置你角色的所有颜色
3. **编写绘制函数** — 用 `rect()`, `px()`, `d.line()`, `d.ellipse()` 等 API 逐像素画角色
4. **编写帧生成器** — 在 `make_*_frames()` 中组合不同姿态
5. **运行脚本** — `python tools/generate_my_skin.py`
6. **检查产出** — 打开 `resources/skins/my-skin/` 目录，查看生成的 PNG 文件
7. **迭代调整** — 修改像素坐标和颜色，重新运行，直到满意

#### 3.4 调色板设计建议

32×32 像素画中，颜色数量决定了画面复杂度。参考值：

| 角色类型 | 推荐颜色数 | 示例 |
|---------|-----------|------|
| 简单动物 | 15-20 色 | 橘猫（项目 default-cat，18 色） |
| 二次元人物 | 30-45 色 | 蝴蝶剑士（项目 butterfly-swordsman，40 色） |
| 复杂机甲/怪物 | 30-50 色 | — |

颜色不宜过多，否则在 32×32 画布上会显得杂乱。每个材质建议 2-3 个色调：亮色、中间色、暗色。

---

### 四、路线 B — 手绘像素画（Aseprite / Piskel）

适合有像素画基础或希望精细控制每个像素的创作者。

#### 4.1 工具选择

| 工具 | 价格 | 平台 | 特点 |
|------|------|------|------|
| [Aseprite](https://www.aseprite.org/) | $19.99 | Win/Mac/Linux | 业界标杆，动画功能强大，支持导出 Sprite Sheet |
| [LibreSprite](https://libresprite.github.io/) | 免费开源 | Win/Mac/Linux | Aseprite 的开源分支，功能相似 |
| [Piskel](https://www.piskelapp.com/) | 免费 | 浏览器 | 在线工具，无需安装，适合快速原型 |
| [GraphicsGale](https://graphicsgale.com/) | 免费 | Windows | 老牌像素画工具，轻量 |

**推荐 Aseprite**，它的动画时间线和 Sprite Sheet 导出功能最契合本项目的流程。

#### 4.2 Aseprite 工作流程

**步骤 1: 创建画布**

File > New，设置 Width=32, Height=32, Color Mode=RGBA。

**步骤 2: 绘制角色**

在 Layer 1 上绘制角色的基本姿态。建议使用以下图层结构：

```
├── Outline       (描边层)
├── Body          (身体 / 衣服)
├── Face          (表情)
├── Accessories   (配饰 / 武器)
└── Effects       (特效：星星、粒子)
```

**步骤 3: 制作动画帧**

对每个动画状态，在 Timeline 中添加对应帧数：

- idle: 新建 4 帧 (Frame > New Frame x4)，微调呼吸和眨眼
- working: 新建 6 帧，绘制活跃动作
- happy: 新建 4 帧，绘制跳跃庆祝
- sleeping: 新建 2 帧，绘制蜷缩 + Zzz
- error: 新建 3 帧，绘制惊讶表情

**步骤 4: 导出精灵图**

File > Export Sprite Sheet：

- Layout: Horizontal (横向排列)
- Sheet type: Packed 或 Horizontal Strip
- 勾选 "Merge duplicate frames"（可选）
- Output: 分别导出 5 个 PNG（idle.png, working.png, happy.png, sleeping.png, error.png）
- Scale: 2x（从 32 放大到 64）
- 确保 "Trim" 未勾选（每帧必须保持 64×64）

或者直接在 Aseprite 中将画布设为 64×64，用 2x 的像素绘制（工作量大一倍但不需要缩放）。

**步骤 5: 生成 preview.png**

从 idle 的第 1 帧截图，放大到 128×128，保存为 preview.png。

#### 4.3 Piskel 在线工作流程

1. 访问 https://www.piskelapp.com/
2. Create New Sprite，设置 32×32
3. 在帧面板中为每个动画状态添加帧
4. Export > PNG Spritesheet，选择 Horizontal 布局
5. 手动拆分为 5 张精灵图（或使用脚本裁切）

#### 4.4 像素画技巧

- **先画轮廓** — 用 1px 深色描边勾勒角色外形，再填充
- **限制调色板** — 开始前就确定颜色方案，避免后期颜色混乱
- **参考已有皮肤** — 项目中的 `default-cat` 和 `butterfly-swordsman` 是现成的参考
- **动画原则** — idle 动画幅度要小（1-2px 偏移），happy 动画幅度可以大（2-3px 跳跃）
- **预览** — 在 Aseprite 中按 F5 预览动画循环效果，调整帧延迟

---

### 五、路线 C — AI 辅助生成

利用 AI 图像生成工具生成角色精灵图。项目中的 `reze`、`professional-team`、`butterfly-swordsman-hd` 皮肤均采用此方式，帧尺寸 384×384，每状态 12 帧。

#### 5.1 工作流程

```
角色描述 → AI 生成多帧精灵图 → 裁切为横排精灵图 → 编写 manifest.json → 测试
```

**步骤 1: 生成精灵图**

使用支持 sprite sheet 生成的 AI 工具（如 NovelAI、Stable Diffusion + sprite sheet 插件、或专门的 AI 动画工具），Prompt 示例：

```
pixel art character, 384x384 sprite, anime girl with bomb powers,
chibi style, transparent background,
12 frames horizontal sprite sheet, idle animation,
consistent character across all frames
```

**步骤 2: 裁切与组装**

如果 AI 一次生成了多帧排列图，需要裁切为横排精灵图：

```python
from PIL import Image

def split_and_assemble(input_path, frame_size=384, frames=12, output_path='idle.png'):
    """将 AI 生成的精灵图裁切并重新组装为横排"""
    img = Image.open(input_path)
    # 假设 AI 输出是 3x4 网格，需要重组为 1x12 横排
    cols = img.width // frame_size
    rows = img.height // frame_size

    sheet = Image.new('RGBA', (frame_size * frames, frame_size), (0, 0, 0, 0))
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= frames:
                break
            frame = img.crop((c * frame_size, r * frame_size,
                              (c + 1) * frame_size, (r + 1) * frame_size))
            sheet.paste(frame, (idx * frame_size, 0))
            idx += 1
    sheet.save(output_path, 'PNG')
    print(f"  Saved: {output_path} ({frame_size * frames}x{frame_size})")
```

**步骤 3: 去除背景**

AI 生成的图片通常有背景，需要去除：

```python
from PIL import Image

def remove_background(input_path, output_path, threshold=30):
    """将接近白色的像素设为透明"""
    img = Image.open(input_path).convert('RGBA')
    data = img.getdata()
    new_data = []
    for pixel in data:
        r, g, b, a = pixel
        # 接近白色的像素设为透明
        if r > 255 - threshold and g > 255 - threshold and b > 255 - threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append(pixel)
    img.putdata(new_data)
    img.save(output_path, 'PNG')
```

也可以用 [rembg](https://github.com/danielgatis/rembg) 等专门的去背景工具：

```bash
pip install rembg
rembg p input.png output.png
```

#### 5.2 注意事项

- **帧间一致性** — AI 很难保证 12 帧角色完全一致，通常需要手动修正
- **背景处理** — 必须确保最终 PNG 背景完全透明（alpha=0），否则会显示白色方块
- **帧尺寸统一** — 所有 5 张精灵图的帧尺寸必须一致，在 manifest.json 中声明
- **建议将 AI 生成的图像作为起点**，用 Aseprite 或 Photoshop 手动修正帧间不一致的地方

#### 5.3 参考脚本

项目提供了多个 AI 皮肤生成脚本，可作为参考：

| 脚本 | 用途 |
|------|------|
| `tools/generate_butterfly_hd_sprites.py` | 蝴蝶剑士 HD 版（384×384） |
| `tools/compose_reze_sprites.py` | 蕾塞皮肤（384×384） |
| `tools/compose_team_sprites.py` | 专业团队皮肤（384×384） |
| `tools/compose_chibi_hd_sprites.py` | Q 版 HD 皮肤组装 |

---

### 六、preview.png 预览图

皮肤选择器 UI 中会用 preview.png 展示皮肤缩略图。

**规格：** 128×128 或 256×256 PNG，RGBA 透明背景。

**生成方式：** 从 idle 精灵图的第 1 帧截取并放大：

```python
from PIL import Image

def generate_preview(skin_dir, frame_size=128):
    """从 idle.png 第 1 帧生成 128x128 预览图"""
    idle = Image.open(os.path.join(skin_dir, 'idle.png'))
    # 裁取第一帧 (0,0 到 frame_size,frame_size)
    frame1 = idle.crop((0, 0, frame_size, frame_size))
    # 放大到 128x128（如果帧尺寸小于 128）
    if frame_size < 128:
        preview = frame1.resize((128, 128), Image.NEAREST)
    else:
        preview = frame1.resize((128, 128), Image.LANCZOS)
    preview.save(os.path.join(skin_dir, 'preview.png'), 'PNG')
    print(f"  Saved: {skin_dir}/preview.png")
```

---

### 七、安装与测试

#### 7.1 安装皮肤

**方式一：直接放入内置目录**

将皮肤文件夹复制到 `resources/skins/` 目录：

```
resources/skins/
├── default-cat/
├── butterfly-swordsman/
└── my-skin/          ← 新皮肤放这里
    ├── manifest.json
    ├── idle.png
    ├── working.png
    ├── happy.png
    ├── sleeping.png
    ├── error.png
    └── preview.png
```

重启应用后，新皮肤会自动出现在皮肤选择器中。

**方式二：自定义皮肤目录**

如果不想修改内置目录，可以在设置中添加自定义皮肤目录：

1. 打开仪表盘 → 设置面板
2. 在"皮肤"区域添加自定义皮肤目录路径
3. 将皮肤文件夹放入该目录
4. 皮肤会自动出现在皮肤选择器中

**方式三：.xpet 皮肤包（规划中）**

将皮肤文件夹打包为 zip 格式，改扩展名为 `.xpet`。未来版本支持拖拽 `.xpet` 文件到宠物窗口直接安装。

当前可通过命令行手动解压安装：

```bash
# Windows (PowerShell)
Expand-Archive -Path my-skin.xpet -DestinationPath resources/skins/my-skin

# Linux/Mac
unzip my-skin.xpet -d resources/skins/my-skin
```

#### 7.2 快速预览（无需启动应用）

在开发阶段，可以用简单的 Python 脚本快速预览动画效果：

```python
from PIL import Image
import time

def preview_animation(sprite_path, frame_size=64, fps=4, loops=3):
    """在终端中预览精灵图动画（ASCII art 方式）"""
    sheet = Image.open(sprite_path)
    cols = sheet.width // frame_size
    frames = []
    for i in range(cols):
        f = sheet.crop((i * frame_size, 0, (i + 1) * frame_size, frame_size))
        frames.append(f)

    print(f"Previewing {sprite_path} ({cols} frames @ {fps}fps)")
    for _ in range(loops):
        for f in frames:
            f.show()  # 用系统图片查看器显示
            time.sleep(1.0 / fps)
```

#### 7.3 应用内测试

将皮肤文件夹放入 `resources/skins/` 目录，启动 DesktopXPet 后在设置中切换到新皮肤，即可看到实际效果。需要检查：

- [ ] 5 种动画状态是否都正常播放
- [ ] 帧率和循环行为是否符合预期
- [ ] 透明区域是否正确（没有黑色或白色背景）
- [ ] 像素边缘是否锐利（不模糊）
- [ ] 状态切换时是否有明显的跳帧
- [ ] `frameSize` 与精灵图实际尺寸是否匹配

---

### 八、打包与分发

#### 8.1 .xpet 皮肤包

将皮肤文件夹打包为 zip 格式，改扩展名为 `.xpet`：

```bash
# Linux/Mac
cd resources/skins/my-skin
zip -r ../../../my-skin.xpet .

# Windows (PowerShell)
cd resources\skins\my-skin
Compress-Archive -Path * -DestinationPath ..\..\..\my-skin.xpet
```

#### 8.2 分发渠道

- GitHub Releases — 在项目的 Release 页面附带 .xpet 文件
- 社区论坛 — 在 DesktopXPet 的社区板块分享
- 直接分享 — 将皮肤文件夹或 .xpet 文件发给朋友

---

### 九、参考实例

项目内置的 5 套皮肤是最好的学习参考：

#### default-cat（橘猫）

- **文件:** `resources/skins/default-cat/`
- **生成脚本:** `tools/generate_sprites.py`
- **帧尺寸:** 128×128，每状态 2-6 帧
- **复杂度:** 简单（18 色调色板，圆润可爱的 Q 版猫咪）
- **适合学习:** 基础的像素画绘制、帧动画原理、rect/px 绘图 API

#### butterfly-swordsman（蝴蝶剑士 标准版）

- **文件:** `resources/skins/butterfly-swordsman/`
- **生成脚本:** `tools/generate_butterfly_sprites.py`
- **帧尺寸:** 64×64，每状态 2-6 帧
- **复杂度:** 中等（40 色调色板，二次元人物 + 武器 + 蝴蝶特效）
- **适合学习:** 复杂角色绘制、多图层组合、眼睛表情系统、装饰粒子

#### butterfly-swordsman-hd（蝴蝶剑士 HD 版）

- **文件:** `resources/skins/butterfly-swordsman-hd/`
- **生成脚本:** `tools/generate_butterfly_hd_sprites.py`
- **帧尺寸:** 384×384，每状态 12 帧
- **复杂度:** 高（AI 辅助生成，精细的 Q 版人物）
- **适合学习:** AI 生成皮肤的工作流、高清精灵图处理

#### reze（蕾塞）

- **文件:** `resources/skins/reze/`
- **生成脚本:** `tools/compose_reze_sprites.py`
- **帧尺寸:** 384×384，每状态 12 帧
- **复杂度:** 高（AI 生成，电锯人角色）
- **适合学习:** AI 生成 + 后处理去背景

#### professional-team（专业团队）

- **文件:** `resources/skins/professional-team/`
- **生成脚本:** `tools/compose_team_sprites.py`
- **帧尺寸:** 384×384，每状态 12 帧
- **复杂度:** 高（AI 生成，商务人士梗图）
- **适合学习:** AI 生成皮肤的 manifest 配置

---

### 十、常见问题

**Q: 可以用 64×64 内部绘制吗？**

可以。如果选择 64×64 内部绘制，把 `FRAME_SIZE` 设为 64，`SCALE` 设为 1。精灵图尺寸不变，但你需要画更多细节。

**Q: 可以增减帧数吗？**

可以。修改 `manifest.json` 中的 `frames` 值，确保和精灵图的实际帧数一致。帧数越多动画越流畅，但文件也越大。idle 建议 2-6 帧，working 建议 4-12 帧。

**Q: 可以修改 fps 吗？**

可以。fps 越高动画越快。idle 建议慢（3-5 fps），working 建议快（6-10 fps），sleeping 建议极慢（1-3 fps）。

**Q: happy 动画的 loop 应该设 true 还是 false？**

都可以。设为 false 时，happy 播放一次后自动回到 idle；设为 true 时，happy 会循环播放直到状态切换。项目中的程序化皮肤设为 false，AI 皮肤多设为 true。

**Q: 可以用 GIF 或 APNG 格式吗？**

目前不支持。DesktopXPet 的 SpriteAnimator 只支持横排 PNG 精灵图，因为它需要精确控制帧率和随机访问任意帧。

**Q: 生成的 PNG 文件很大怎么办？**

像素风皮肤（64×64、128×128）单帧只有几 KB。如果文件异常大（AI 生成的 384×384 皮肤可能较大），可以用 `optipng` 或 `pngquant` 压缩：

```bash
# 无损压缩
optipng -o7 idle.png

# 有损压缩（可减少 60-80% 体积）
pngquant --quality=65-80 --force --output idle.png idle.png
```

**Q: AI 生成的皮肤帧间角色不一致怎么办？**

这是 AI 生成皮肤的最大挑战。建议：
1. 使用支持角色一致性的 AI 工具（如 NovelAI 的角色参考功能）
2. 生成后用 Aseprite 手动修正不一致的帧
3. 适当降低 fps（如 6 fps），减少帧间差异的感知
4. 优先保证 idle 和 working 状态的质量，其他状态可简化

**Q: 如何让皮肤在状态切换时更流畅？**

- 确保相邻状态的第一帧姿态相近（如 idle 和 working 的起始帧都是站立）
- 适当增加帧数（6-12 帧）
- 调整 fps 使动画速度自然
- 利用系统的过渡动画（皮肤切换时有 250ms 淡出 + 350ms 淡入）
