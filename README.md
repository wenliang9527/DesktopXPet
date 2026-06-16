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
- **精灵图动画引擎** — Canvas 2D 渲染，支持高 DPI，像素风锐利放大
- **多窗口架构** — 宠物窗口（常驻）+ 仪表盘窗口（按需打开），IPC 共享状态
- **插件化监控** — 内置 System / GitHub / Ollama 插件，支持自定义扩展
- **HTTP Push API** — `localhost:9527` 接收外部工具状态推送，token 校验
- **皮肤系统** — 内置 3 套皮肤，支持本地目录加载和自定义皮肤包
- **全局快捷键** — `Ctrl+Shift+P` 显隐宠物 / `Ctrl+Shift+D` 打开仪表盘 / `Ctrl+Shift+S` 切换皮肤
- **系统托盘** — 托盘图标 + 右键菜单，双击显隐宠物
- **闲置睡眠** — 长时间无操作自动进入睡眠状态，鼠标靠近唤醒
- **位置记忆** — 拖拽移动宠物位置，退出后下次启动自动恢复

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

## 项目结构

```
DesktopXPet/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口：窗口创建、IPC、退出流程
│   │   ├── window.ts            # 宠物窗口管理（透明、穿透、DPI）
│   │   ├── tray.ts              # 系统托盘 + 右键菜单
│   │   ├── shortcuts.ts         # 全局快捷键
│   │   ├── store.ts             # electron-store 配置持久化
│   │   ├── skin-loader.ts       # 皮肤资源扫描与加载
│   │   ├── notify.ts            # 系统通知（防轰炸）
│   │   ├── server/api.ts        # HTTP API 服务器 (localhost:9527)
│   │   ├── monitor/             # 监控调度
│   │   │   ├── index.ts         # MonitorService（Poll + Push 聚合）
│   │   │   └── registry.ts      # PluginRegistry（插件注册中心）
│   │   └── plugins/             # 内置插件
│   │       ├── system.ts        # 系统资源监控（CPU/内存）
│   │       ├── github.ts        # GitHub 活动监控
│   │       └── ollama.ts        # Ollama 本地 AI 监控
│   ├── preload/                 # 预加载脚本（contextBridge）
│   │   └── index.ts
│   ├── renderer/                # React 渲染进程
│   │   ├── App.tsx              # 根组件（宠物窗口）
│   │   ├── main.tsx             # React 入口
│   │   ├── components/
│   │   │   ├── Pet/
│   │   │   │   ├── PetCanvas.tsx         # Canvas 宠物渲染
│   │   │   │   ├── SpriteAnimator.ts     # 精灵图动画引擎
│   │   │   │   └── PetStateMachine.ts    # 状态机逻辑
│   │   │   ├── Dashboard/Dashboard.tsx   # 仪表盘窗口
│   │   │   ├── Settings/Settings.tsx     # 设置面板
│   │   │   ├── SkinSelector/SkinSelector.tsx  # 皮肤选择器
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
│       └── plugin-api.ts        # 插件接口定义
├── resources/
│   ├── skins/                   # 内置皮肤
│   │   ├── default-cat/         # 橘猫
│   │   ├── butterfly-swordsman/ # 蝴蝶剑士
│   │   └── chibi-girl/          # Q 版女孩
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

### 构建打包

```bash
# 构建 + 打包 Windows 安装程序
npm run build:win

# 仅构建（不打包）
npm run build
```

## 外部工具接入

DesktopXPet 通过内嵌 HTTP API 接收外部工具的状态推送。

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查（无需 token） |
| POST | `/api/status` | 推送工具状态（需 token） |

### 请求格式

```bash
curl -X POST http://127.0.0.1:9527/api/status \
  -H "Content-Type: application/json" \
  -H "x-pet-token: YOUR_TOKEN" \
  -d '{
    "tool": "claude-code",
    "status": "working",
    "summary": "正在重构认证模块"
  }'
```

`status` 取值: `idle` | `working` | `error` | `completed`

Token 在首次启动时自动生成，保存在 `~/.xpet/config.json`。

### Claude Code Hook 示例

在项目的 `.claude/settings.json` 中添加:

```json
{
  "hooks": {
    "PreToolUse": "curl -s -X POST http://localhost:9527/api/status -H 'Content-Type: application/json' -H 'x-pet-token: $(cat ~/.xpet/config.json | node -e \"process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token)\")\" -d '{\"tool\":\"claude-code\",\"status\":\"working\",\"summary\":\"AI 使用 $CLAUDE_TOOL_NAME\"}'",
    "PostToolUse": "curl -s -X POST http://localhost:9527/api/status -H 'Content-Type: application/json' -H 'x-pet-token: $(cat ~/.xpet/config.json | node -e \"process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token)\")\" -d '{\"tool\":\"claude-code\",\"status\":\"completed\",\"summary\":\"$CLAUDE_TOOL_NAME 完成\"}'"
  }
}
```

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
└── preview.png      # 128x128 预览图
```

详细制作指南请参阅 [docs/SKIN_GUIDE.md](./docs/SKIN_GUIDE.md)。

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

# 开发模式（热重载）
npm run dev

# 构建预览
npm run preview
```

## 文档

- [PLAN.md](./docs/PLAN.md) — 项目总体计划与架构设计
- [IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) — 详细实施指南（数据流、IPC、API、插件接入）
- [SKIN_GUIDE.md](./docs/SKIN_GUIDE.md) — 皮肤制作完整指南（程序化/AI辅助/手绘）

## License

MIT
