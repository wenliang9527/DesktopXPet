# DesktopXPet

AI 工作监控桌面宠物 — 通过可爱的像素风角色实时展示你的 AI 编码工具工作状态。

<div align="center">

```
  /\_/\  
 ( o.o )  ← idle
  > ^ <
```

</div>

## 功能特性

- **透明悬浮宠物** — 无边框透明窗口，始终置顶，鼠标穿透（仅角色区域可交互）
- **实时状态监控** — 通过插件系统接入多种 AI 工具，宠物动画随工作状态自动切换
- **多工具并行监控** — 同时监控 Trae / Cursor / VS Code / Claude Code / OpenCode / Aider 等多个 AI 工具
- **精灵图动画引擎** — Canvas 2D 渲染，支持高 DPI，像素风锐利放大，按状态动态降频省电
- **多窗口架构** — 宠物窗口（常驻）+ 仪表盘窗口（按需打开），IPC 共享状态
- **插件化监控** — 内置 System / GitHub / Ollama 插件，支持自定义扩展
- **HTTP Push API** — `localhost:9527` 接收外部工具状态推送，token 校验
- **IDE 扩展** — 支持 Trae / Cursor / Windsurf / VS Code，自动检测 IDE 类型
- **CLI 接入** — 提供 Bash / PowerShell 脚本，支持 Claude Code hooks / OpenCode / Aider
- **皮肤系统** — 内置 5 套皮肤（橘猫 / 蝴蝶剑士标准版+HD版 / 蕾塞 / 专业团队），支持 64×64、128×128、384×384 多种帧规格，支持本地目录加载和自定义皮肤包
- **.xpet 一键安装** — 拖拽 `.xpet` 皮肤包到宠物窗口即可自动安装（含 zip slip 防护和 manifest 校验）
- **皮肤预览** — 仪表盘皮肤选择器悬停时播放 idle 动画预览，支持音效试听
- **番茄钟提醒** — 内置番茄工作法计时器（25分钟工作+5分钟休息循环），到时自动通知+音效
- **全局快捷键** — `Ctrl+Shift+P` 显隐宠物 / `Ctrl+Shift+D` 打开仪表盘 / `Ctrl+Shift+S` 切换皮肤
- **系统托盘** — 托盘图标 + 右键菜单，双击显隐宠物
- **闲置睡眠** — 长时间无操作自动进入睡眠状态，鼠标靠近唤醒
- **位置记忆** — 拖拽移动宠物位置，退出后下次启动自动恢复
- **安全沙箱** — 渲染进程 sandbox 隔离 + CSP 内容安全策略 + IPC 路径白名单

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Electron 36 |
| 构建 | electron-vite + Vite 6 + electron-builder |
| UI | React 18 + TypeScript 5 |
| 状态管理 | Zustand 5 |
| 持久化 | electron-store |
| 日志 | electron-log |
| 动画 | Canvas 2D (requestAnimationFrame) |
| 代码质量 | ESLint 9 + Prettier + husky + lint-staged |
| Schema 校验 | zod 4 |

## 项目结构

```
DesktopXPet/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口：app.whenReady + 错误处理
│   │   ├── bootstrap.ts         # 初始化流程 + 优雅关闭
│   │   ├── ipc-handlers.ts      # IPC 处理器 + 仪表盘/皮肤切换
│   │   ├── window.ts            # 宠物窗口管理（透明、穿透、DPI）
│   │   ├── tray.ts              # 系统托盘 + 右键菜单
│   │   ├── shortcuts.ts         # 全局快捷键
│   │   ├── store.ts             # electron-store 配置持久化
│   │   ├── skin-loader.ts       # 皮肤资源扫描与加载（zod 校验）
│   │   ├── skin-installer.ts    # .xpet 皮肤包安装（zip 解压 + 安全防护）
│   │   ├── notify.ts            # 系统通知（防轰炸）
│   │   ├── container.ts         # 依赖注入容器
│   │   ├── server/api.ts        # HTTP API 服务器 (localhost:9527)
│   │   ├── monitor/             # 监控调度
│   │   │   ├── index.ts         # MonitorService（Poll + Push 聚合）
│   │   │   └── registry.ts      # PluginRegistry（插件注册中心）
│   │   └── plugins/             # 内置插件
│   │       ├── system.ts        # 系统资源监控（CPU/内存）
│   │       ├── github.ts        # GitHub 活动监控
│   │       └── ollama.ts        # Ollama 本地 AI 监控
│   ├── preload/                 # 预加载脚本（contextBridge，强类型）
│   │   └── index.ts
│   ├── renderer/                # React 渲染进程
│   │   ├── App.tsx              # 根组件（宠物窗口 + 拖拽安装）
│   │   ├── main.tsx             # React 入口
│   │   ├── components/
│   │   │   ├── Pet/
│   │   │   │   ├── PetCanvas.tsx         # Canvas 宠物渲染（动态帧率）
│   │   │   │   ├── SpriteAnimator.ts     # 精灵图动画引擎
│   │   │   │   └── PetStateMachine.ts    # 状态机逻辑
│   │   │   ├── Dashboard/Dashboard.tsx   # 仪表盘窗口
│   │   │   ├── Settings/Settings.tsx     # 设置面板
│   │   │   ├── SkinSelector/
│   │   │   │   ├── SkinSelector.tsx      # 皮肤选择器
│   │   │   │   └── SkinPreviewCanvas.tsx # 皮肤动画预览
│   │   │   ├── PomodoroTimer/PomodoroTimer.tsx  # 番茄钟
│   │   │   ├── StatusBubble/StatusBubble.tsx   # 状态气泡
│   │   │   └── StatusDetail/StatusDetailPopup.tsx  # 悬停详情
│   │   ├── hooks/
│   │   │   ├── useClickThrough.ts  # 窗口穿透（像素透明度检测）
│   │   │   ├── useDraggable.ts     # 拖拽移动
│   │   │   └── useIdleTimer.ts     # 闲置计时器
│   │   ├── stores/appStore.ts      # Zustand 全局状态
│   │   └── styles/global.css
│   └── shared/                  # 主/渲染进程共享
│       ├── types.ts             # 公共类型定义
│       ├── constants.ts         # 常量（窗口尺寸、默认配置）
│       ├── ipc-channels.ts      # IPC 通道名常量
│       ├── skin-schema.ts       # zod 皮肤 manifest schema
│       └── plugin-api.ts        # 插件接口定义
├── resources/
│   ├── skins/                   # 内置皮肤
│   │   ├── default-cat/         # 橘猫（128×128）
│   │   ├── butterfly-swordsman/ # 蝴蝶剑士（标准版 64×64）
│   │   ├── butterfly-swordsman-hd/ # 蝴蝶剑士（HD版 384×384）
│   │   ├── reze/                # 蕾塞（384×384）
│   │   └── professional-team/   # 专业团队（384×384）
│   ├── sounds/                  # 内置音效
│   └── icons/                   # 应用图标
├── tools/                       # 皮肤生成脚本 (Python)
├── docs/                        # 项目文档
│   ├── PLAN.md                  # 总体计划
│   ├── IMPLEMENTATION.md        # 详细实施指南
│   └── SKIN_GUIDE.md            # 皮肤制作指南
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/your-username/DesktopXPet.git
cd DesktopXPet

# 安装依赖
npm install

# 开发模式运行
npm run dev
```

> 详细启动说明请参阅 [启动与基础使用](./docs/USAGE_GETTING_STARTED.md)

### 构建打包

```bash
# 构建 + 打包 Windows 安装程序
npm run build:win

# 仅构建（不打包）
npm run build
```

## 外部工具接入

DesktopXPet 支持两种接入方式：**IDE 扩展**和 **CLI 脚本**。

### 接入方式一览

| 方式 | 适用工具 | 文档 |
|------|----------|------|
| IDE 扩展 | Trae / Cursor / Windsurf / VS Code | [IDE 扩展接入](./docs/USAGE_IDE_INTEGRATION.md) |
| CLI 脚本 | Claude Code / OpenCode / Aider / 任意 CLI | [CLI 工具接入](./docs/USAGE_CLI_INTEGRATION.md) |
| HTTP API | 任意能发 HTTP 请求的程序 | [HTTP API 参考](./docs/USAGE_API_REFERENCE.md) |

### 快速示例

**IDE 扩展**（Trae / Cursor）：

```bash
cd extensions/desktopxpet-monitor
npm install && npm run compile
# 在 IDE 中按 F5 调试运行
```

**CLI 推送**（Claude Code / OpenCode）：

```bash
# Bash
./tools/xpet-notify.sh claude-code working "Generating code..."

# PowerShell
.\tools\xpet-notify.ps1 -Tool claude-code -Status working -Summary "Generating code..."
```

**HTTP API**：

```bash
curl -X POST http://127.0.0.1:9527/api/status \
  -H "Content-Type: application/json" \
  -H "x-pet-token: YOUR_TOKEN" \
  -d '{"tool":"claude-code","status":"working","summary":"正在重构认证模块"}'
```

`status` 取值: `idle` | `working` | `error` | `completed`

Token 在首次启动时自动生成，保存在 `~/.xpet/config.json`。

## 宠物状态机

```
         ┌──────────┐
         │   Idle   │ ← 默认状态
         └────┬─────┘
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
┌─────────┐ ┌────────┐ ┌──────────┐
│ Working │ │ Happy  │ │ Sleeping │
│  (忙碌) │ │ (庆祝) │ │  (闲置)  │
└─────────┘ └────────┘ └─────┬────┘
   │                    鼠标靠近
   ▼                         ▼
┌─────────┐            ┌──────────┐
│  Error  │            │  Waking  │ → 自动回到 Idle
│  (出错) │            │  (唤醒)  │
└─────────┘            └──────────┘
```

状态优先级: `error` > `working` > `happy` > `idle`

## 皮肤制作

每套皮肤是一个文件夹，包含 5 张精灵图 + manifest.json:

```
my-skin/
├── manifest.json    # 皮肤元信息和动画配置
├── idle.png         # 待机动画精灵图（横排多帧）
├── working.png      # 工作动画
├── happy.png        # 开心动画
├── sleeping.png     # 睡眠动画
├── error.png        # 出错动画
└── preview.png      # 预览图（推荐 128x128 或 256x256）
```

**两种渲染模式：**

| 模式 | 帧尺寸 | 缩放算法 | 适用场景 |
|------|--------|---------|---------|
| 像素风 | ≤ 128×128 | 最近邻 (NEAREST) | 手绘像素画、程序化生成 |
| 高清风 | 384×384 | 双线性 (BILINEAR) | AI 生成、高清插画 |

系统根据 `frameSize` 自动判断渲染模式，角色在画布中水平居中、底部对齐，保持原始宽高比。

**两种动画模式：**

| 模式 | `renderMode` | 图片要求 | 适用场景 |
|------|-------------|---------|---------|
| 精灵图动画 | `spritesheet`（默认） | 每种状态一张横排多帧精灵图 | 手绘/程序化多帧动画 |
| 静态立绘 | `static` | 每种状态一张单张立绘 | AI 生成单张角色图 |

静态立绘模式内置 4 种 Canvas 变换效果：浮动、呼吸、摇摆、弹跳，可自由组合叠加。

**安装方式：**
1. **拖拽安装** — 将 `.xpet` 皮肤包拖到宠物窗口自动安装
2. **手动安装** — 复制皮肤文件夹到 `userData/skins/` 目录
3. **自定义目录** — 在设置中添加自定义皮肤目录

> 详细使用说明请参阅 [皮肤系统](./docs/USAGE_SKINS.md)
>
> 制作指南请参阅 [SKIN_GUIDE.md](./docs/SKIN_GUIDE.md)

## 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+P` | 显示/隐藏宠物 |
| `Ctrl+Shift+D` | 打开仪表盘 |
| `Ctrl+Shift+S` | 切换下一个皮肤 |

## 配置存储

应用设置保存在 electron-store 中（`desktopxpet-config.json`），支持以下配置:

- **宠物** — 位置、缩放、置顶、点击音效
- **行为** — 闲置睡眠时间、通知开关、气泡开关
- **监控** — 轮询间隔、插件启用/禁用
- **皮肤** — 当前皮肤、自定义皮肤目录
- **通用** — 开机自启、语言、主题

## 开发

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format

# 开发模式（热重载）
npm run dev

# 构建预览
npm run preview
```

**代码质量门禁：**
- 提交时 husky 自动运行 lint-staged（ESLint + Prettier）
- ESLint 9 flat config,TypeScript + React + React Hooks 规则
- Prettier 统一格式化风格

## 文档

### 使用文档

| 文档 | 说明 |
|------|------|
| [启动与基础使用](./docs/USAGE_GETTING_STARTED.md) | 安装、启动、宠物交互、快捷键、配置 |
| [IDE 扩展接入](./docs/USAGE_IDE_INTEGRATION.md) | Trae / Cursor / Windsurf / VS Code 扩展安装与配置 |
| [CLI 工具接入](./docs/USAGE_CLI_INTEGRATION.md) | Claude Code / OpenCode / Aider 等 CLI 工具接入 |
| [仪表盘与多任务监控](./docs/USAGE_DASHBOARD.md) | 仪表盘布局、多工具并行监控、状态聚合规则 |
| [皮肤系统](./docs/USAGE_SKINS.md) | 皮肤切换、文件结构、自定义皮肤目录 |
| [HTTP API 参考](./docs/USAGE_API_REFERENCE.md) | API 端点、请求格式、认证、聚合规则 |

### 开发文档

| 文档 | 说明 |
|------|------|
| [PLAN.md](./docs/PLAN.md) | 项目总体计划与架构设计 |
| [IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) | 详细实施指南（数据流、IPC、API、插件接入） |
| [SKIN_GUIDE.md](./docs/SKIN_GUIDE.md) | 皮肤制作完整指南（程序化/AI辅助/手绘） |
| [SOUND_GUIDE.md](./docs/SOUND_GUIDE.md) | 提示音制作完整指南（程序化/DAW/在线工具） |
| [OPTIMIZATION_AND_FEATURES.md](./docs/OPTIMIZATION_AND_FEATURES.md) | 优化方向与新功能建议 |
| [REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md) | 架构优化计划与执行记录 |

## License

MIT
