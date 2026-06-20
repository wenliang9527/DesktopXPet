# 皮肤系统

## 内置皮肤

| 皮肤 | 目录 | 帧尺寸 | 说明 |
|------|------|--------|------|
| 橘猫 | `resources/skins/default-cat/` | 128×128 | 默认皮肤，程序化生成的 Q 版猫咪 |
| 蝴蝶剑士 | `resources/skins/butterfly-swordsman/` | 64×64 | 武侠风格标准版，程序化生成 |
| 蝴蝶剑士 HD | `resources/skins/butterfly-swordsman-hd/` | 384×384 | 武侠风格 HD 版，AI 辅助生成 |
| 蕾塞 | `resources/skins/reze/` | 384×384 | 电锯人角色，AI 生成 |
| 专业团队 | `resources/skins/professional-team/` | 384×384 | 商务人士梗图，AI 生成 |

## 切换皮肤

三种方式：

1. **快捷键** — `Ctrl+Shift+S` 循环切换
2. **右键宠物** → `🎨 切换皮肤` → 选择皮肤
3. **仪表盘** → 底部皮肤选择器 → 点击切换

## 皮肤预览

在仪表盘的皮肤选择器中:

- **悬停皮肤卡片** — 自动播放该皮肤的 idle 动画循环,无需点击即可预览效果
- **音效试听按钮** — 悬停时显示 🔊 和 ✅ 按钮,点击试听对应音效
- **当前皮肤标识** — 当前使用的皮肤右上角显示绿色"当前"徽章

## 皮肤文件结构

每套皮肤是一个文件夹，包含以下文件：

```
my-skin/
├── manifest.json    # 皮肤元信息和动画配置
├── idle.png         # 待机动画精灵图
├── working.png      # 工作动画
├── happy.png        # 开心动画
├── sleeping.png     # 睡眠动画
├── error.png        # 出错动画
└── preview.png      # 预览图（推荐 128×128）
```

## manifest.json 格式

```json
{
  "name": "my-skin",
  "author": "Your Name",
  "version": "1.0.0",
  "preview": "preview.png",
  "description": "我的自定义皮肤",
  "frameSize": {
    "width": 128,
    "height": 128
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
      "fps": 2,
      "loop": true
    },
    "error": {
      "frames": 4,
      "fps": 4,
      "loop": true
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 皮肤名称（唯一标识） |
| `author` | string | 作者 |
| `version` | string | 版本号 |
| `preview` | string | 预览图文件名 |
| `description` | string | 描述（可选） |
| `frameSize.width` | number | 单帧宽度（像素） |
| `frameSize.height` | number | 单帧高度（像素） |
| `animations` | object | 各状态的动画配置 |

### 动画配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `frames` | number | 帧数（精灵图中的帧数） |
| `fps` | number | 帧率（每秒帧数） |
| `loop` | boolean | 是否循环播放 |

### 支持的帧尺寸

系统根据 `frameSize` 自动适配，不限定固定尺寸：

| 规格 | 帧尺寸 | 适用场景 |
|------|--------|---------|
| 标准像素风 | 64×64 | 32×32 内部绘制 + 2 倍放大 |
| 高清像素风 | 128×128 | 程序化生成或精细像素画 |
| AI 生成高清 | 384×384 | AI 生成后直接使用 |

## 精灵图要求

- 格式：PNG（支持透明背景）
- 布局：横排排列所有帧
- 帧尺寸：由 `frameSize` 指定，所有帧尺寸一致
- 背景：完全透明（alpha=0）
- 渲染：像素风（`image-rendering: pixelated`）

示例（4 帧动画，每帧 128×128）：

```
┌──────┬──────┬──────┬──────┐
│帧 1  │帧 2  │帧 3  │帧 4  │  尺寸: 512×128
└──────┴──────┴──────┴──────┘
```

> **注意**：`frameSize.width × frames` 必须等于精灵图 PNG 的实际宽度。

## 安装皮肤

### 方式一：拖拽安装 .xpet 包（推荐）

将 `.xpet` 皮肤包文件拖拽到宠物窗口上即可自动安装。

**.xpet 包制作：**

`.xpet` 本质是 zip 压缩包,改扩展名即可:

```bash
# Windows (PowerShell)
cd resources\skins\my-skin
Compress-Archive -Path * -DestinationPath ..\..\..\my-skin.xpet

# Linux/Mac
cd resources/skins/my-skin
zip -r ../../../my-skin.xpet .
```

**安装步骤：**

1. 将 `.xpet` 文件拖到宠物窗口上
2. 应用自动解压到 `userData/skins/` 目录
3. 安装成功后皮肤列表自动刷新
4. 在皮肤选择器中即可看到新皮肤

**安全防护：**
- ✅ zip slip 路径遍历攻击防护
- ✅ 文件数限制(最多 500 个文件)
- ✅ 总大小限制(最大 100MB)
- ✅ manifest.json zod schema 校验
- ✅ 校验失败自动清理已解压文件

### 方式二：手动复制到用户皮肤目录

将皮肤文件夹复制到用户数据目录:

- **Windows:** `%APPDATA%/desktopxpet/skins/`
- **macOS:** `~/Library/Application Support/desktopxpet/skins/`
- **Linux:** `~/.config/desktopxpet/skins/`

重启应用后自动出现在皮肤选择器中。

也可通过右键宠物 → `📁 打开皮肤目录` 直接打开该目录。

### 方式三：自定义皮肤目录

在设置中添加自定义皮肤目录：

1. 打开仪表盘 → 设置面板
2. 在"皮肤"区域添加自定义皮肤目录路径
3. 将皮肤文件夹放入该目录
4. 皮肤会自动出现在皮肤选择器中

也可以通过代码添加：

```typescript
// 主进程
const skinLoader = container.get('skinLoader')
skinLoader.addDirectory('/path/to/my/skins')
await skinLoader.scan()
```

## 皮肤制作工具

项目提供 Python 脚本生成精灵图：

```
tools/
├── generate_sprites.py              # 生成橘猫皮肤
├── generate_butterfly_sprites.py    # 生成蝴蝶剑士标准版
├── generate_butterfly_hd_sprites.py # 生成蝴蝶剑士 HD 版
├── compose_reze_sprites.py          # 组装蕾塞皮肤
├── compose_team_sprites.py          # 组装专业团队皮肤
└── compose_chibi_hd_sprites.py      # 组装 Q 版 HD 皮肤
```

详细制作指南请参阅 [SKIN_GUIDE.md](./SKIN_GUIDE.md)。
