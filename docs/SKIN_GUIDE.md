## DesktopXPet 皮肤制作指南

本文档面向皮肤作者，从零开始讲解如何为 DesktopXPet 制作一套完整的像素风皮肤。无论你是程序员、像素画师还是 AI 玩家，都能找到适合自己的路线。

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
└── preview.png      # 推荐 — 128x128 预览缩略图
```

#### 1.2 精灵图格式

精灵图（Sprite Sheet）是将多帧动画**横向排列**在一张 PNG 图片中：

```
┌────────┬────────┬────────┬────────┐
│ 帧 1   │ 帧 2   │ 帧 3   │ 帧 4   │   ← idle.png (4帧, 256x64)
└────────┴────────┴────────┴────────┘

┌────┬────┬────┬────┬────┬────┐
│ F1 │ F2 │ F3 │ F4 │ F5 │ F6 │       ← working.png (6帧, 384x64)
└────┴────┴────┴────┴────┴────┘
```

**关键参数：**

| 参数 | 值 | 说明 |
|------|-----|------|
| 单帧尺寸 | 64 x 64 px | 这是输出尺寸，也是精灵图中每帧的实际像素 |
| 色彩模式 | RGBA (32-bit PNG) | 必须支持透明通道 |
| 缩放方式 | NEAREST (最近邻) | 如果用 32x32 内部绘制，放大到 64x64 时用 NEAREST 保持像素锐利 |
| 背景 | 完全透明 | 精灵图背景必须是透明 (alpha=0) |

> **内部绘制分辨率可以是 32x32 或 64x64。** 项目现有皮肤采用 32x32 内部绘制 + 2 倍 NEAREST 缩放到 64x64 的方案，这样只需画 32x32 的细节，工作量减半。

#### 1.3 manifest.json 规范

```json
{
  "name": "我的皮肤名称",
  "author": "作者名",
  "version": "1.0.0",
  "preview": "preview.png",
  "description": "一句话描述你的皮肤",
  "frameSize": {
    "width": 64,
    "height": 64
  },
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
- `preview` — 预览图文件名，推荐 128x128 PNG
- `description` — 简短描述
- `frameSize` — 单帧尺寸，目前固定 64x64
- `animations` — 5 种动画状态的帧数和播放速度配置

**animations 中的参数：**

- `frames` — 该动画的总帧数（必须和精灵图中的帧数一致）
- `fps` — 每秒播放帧数（数值越大动画越快）
- `loop` — 是否循环播放。`idle`/`working`/`sleeping`/`error` 通常为 true，`happy` 通常为 false（播放一次后自动回到 idle）

#### 1.4 五种动画状态

| 状态 | 触发时机 | 推荐帧数 | 推荐 fps | 动画要点 |
|------|---------|---------|---------|---------|
| idle | 默认待机 | 2-6 帧 | 3-5 | 呼吸、眨眼、尾巴轻摆等微小动作 |
| working | AI 工具忙碌时 | 4-8 帧 | 6-10 | 打字、挥剑、能量粒子等活跃动作 |
| happy | 任务完成时 | 3-6 帧 | 5-8 | 跳跃、庆祝、星星特效（不循环） |
| sleeping | 长时间无活动 | 2-4 帧 | 1-2 | 蜷缩、Zzz 气泡、极慢节奏 |
| error | 工具出错时 | 2-4 帧 | 3-5 | 惊讶表情、汗珠、感叹号 |

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

这是本项目目前使用的方式。用代码逐像素绘制角色，适合快速迭代和批量生成。

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
        "frameSize": {"width": 64, "height": 64},
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

32x32 像素画中，颜色数量决定了画面复杂度。参考值：

| 角色类型 | 推荐颜色数 | 示例 |
|---------|-----------|------|
| 简单动物 | 15-20 色 | 橘猫（项目 default-cat，18 色） |
| 二次元人物 | 30-45 色 | 蝴蝶剑士（项目 butterfly-swordsman，40 色） |
| 复杂机甲/怪物 | 30-50 色 | — |

颜色不宜过多，否则在 32x32 画布上会显得杂乱。每个材质建议 2-3 个色调：亮色、中间色、暗色。

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
- 确保 "Trim" 未勾选（每帧必须保持 64x64）

或者直接在 Aseprite 中将画布设为 64x64，用 2x 的像素绘制（工作量大一倍但不需要缩放）。

**步骤 5: 生成 preview.png**

从 idle 的第 1 帧截图，放大到 128x128，保存为 preview.png。

#### 4.3 Piskel 在线工作流程

1. 访问 https://www.piskelapp.com/
2. Create New Sprite，设置 32x32
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

利用 AI 图像生成工具生成角色概念图，再手动或程序化转为像素风精灵图。

#### 5.1 工作流程

```
概念描述 → AI 生成参考图 → 像素化后处理 → 拆帧动画 → 组装精灵图
```

**步骤 1: 生成参考图**

使用 DALL-E、Stable Diffusion、Midjourney 等工具，Prompt 示例：

```
pixel art character, 32x32 sprite, anime swordswoman,
dark hair with purple highlights, white haori, katana,
butterfly motifs, chibi style, transparent background,
multiple poses: idle, working, happy, sleeping, error
```

**步骤 2: 像素化后处理**

AI 生成的图片通常不是严格的像素画，需要后处理：

```python
from PIL import Image

def pixelate(input_path, output_path, target_size=32):
    """将普通图片缩小到像素画尺寸，再放大回来"""
    img = Image.open(input_path)
    # 缩小到 32x32（最近邻 = 保留像素感）
    small = img.resize((target_size, target_size), Image.NEAREST)
    # 放大回 64x64
    big = small.resize((target_size * 2, target_size * 2), Image.NEAREST)
    big.save(output_path, 'PNG')
```

也可以用 Aseprite 打开 AI 图片，手动逐帧修正。

**步骤 3: 拆帧和组装**

如果 AI 一次生成了多帧，需要裁切：

```python
from PIL import Image

def split_spritesheet(input_path, frame_width=64, frame_height=64):
    """将单张精灵图裁切为独立帧"""
    img = Image.open(input_path)
    w, h = img.size
    cols = w // frame_width
    frames = []
    for i in range(cols):
        frame = img.crop((i * frame_width, 0, (i + 1) * frame_width, frame_height))
        frames.append(frame)
    return frames
```

#### 5.2 注意事项

- AI 生成的图像需要**大量手动调整**才能成为合格的像素画
- 帧与帧之间的连贯性 AI 很难保证，通常需要手动修正
- 建议将 AI 生成的图像作为**概念参考**，而非直接使用
- 如果追求效率，路线 A（程序化生成）通常比 AI 后处理更快

---

### 六、preview.png 预览图

皮肤选择器 UI 中会用 preview.png 展示皮肤缩略图。

**规格：** 128x128 PNG，RGBA 透明背景。

**生成方式：** 从 idle 精灵图的第 1 帧截取并放大：

```python
from PIL import Image

def generate_preview(skin_dir):
    """从 idle.png 第 1 帧生成 128x128 预览图"""
    idle = Image.open(os.path.join(skin_dir, 'idle.png'))
    # 裁取第一帧 (0,0 到 64,64)
    frame1 = idle.crop((0, 0, 64, 64))
    # 放大到 128x128
    preview = frame1.resize((128, 128), Image.NEAREST)
    preview.save(os.path.join(skin_dir, 'preview.png'), 'PNG')
    print(f"  Saved: {skin_dir}/preview.png")
```

---

### 七、测试与预览

#### 7.1 快速预览（无需启动应用）

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

#### 7.2 应用内测试

将皮肤文件夹放入 `resources/skins/` 目录，启动 DesktopXPet 后在设置中切换到新皮肤，即可看到实际效果。需要检查：

- [ ] 5 种动画状态是否都正常播放
- [ ] 帧率和循环行为是否符合预期
- [ ] 透明区域是否正确（没有黑色背景）
- [ ] 像素边缘是否锐利（不模糊）
- [ ] 状态切换时是否有明显的跳帧

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

用户收到 `.xpet` 文件后，直接拖拽到 DesktopXPet 窗口即可安装。

#### 8.2 分发渠道

- GitHub Releases — 在项目的 Release 页面附带 .xpet 文件
- 社区论坛 — 在 DesktopXPet 的社区板块分享
- 直接分享 — 将皮肤文件夹或 .xpet 文件发给朋友

---

### 九、参考实例

项目内置的两套皮肤是最好的学习参考：

#### default-cat（橘猫）

- **文件:** `resources/skins/default-cat/`
- **生成脚本:** `tools/generate_sprites.py`
- **复杂度:** 简单（18 色调色板，圆润可爱的 Q 版猫咪）
- **适合学习:** 基础的像素画绘制、帧动画原理、rect/px 绘图 API

#### butterfly-swordsman（蝴蝶剑士）

- **文件:** `resources/skins/butterfly-swordsman/`
- **生成脚本:** `tools/generate_butterfly_sprites.py`
- **复杂度:** 中等（40 色调色板，二次元人物 + 武器 + 蝴蝶特效）
- **适合学习:** 复杂角色绘制、多图层组合、眼睛表情系统、装饰粒子

---

### 十、常见问题

**Q: 可以用 64x64 内部绘制吗？**

可以。如果选择 64x64 内部绘制，把 `FRAME_SIZE` 设为 64，`SCALE` 设为 1。精灵图尺寸不变，但你需要画更多细节。

**Q: 可以增减帧数吗？**

可以。修改 `manifest.json` 中的 `frames` 值，确保和精灵图的实际帧数一致。帧数越多动画越流畅，但文件也越大。idle 建议 2-6 帧，working 建议 4-8 帧。

**Q: 可以修改 fps 吗？**

可以。fps 越高动画越快。idle 建议慢（3-5 fps），working 建议快（6-10 fps），sleeping 建议极慢（1-2 fps）。

**Q: happy 动画的 loop 为什么是 false？**

happy 是任务完成时的庆祝动画，播放一次后自动回到 idle。如果设为 true，宠物会一直庆祝不停。

**Q: 可以用 GIF 或 APNG 格式吗？**

目前不支持。DesktopXPet 的 SpriteAnimator 只支持横排 PNG 精灵图，因为它需要精确控制帧率和随机访问任意帧。

**Q: 生成的 PNG 文件很大怎么办？**

32x32 的像素画放大到 64x64 后，单帧只有 4KB 左右。如果文件异常大，检查是否使用了过多颜色或是否包含了不必要的元数据。可以用 `optipng` 或 `pngquant` 压缩。
