## DesktopXPet - AI 工作监控桌面宠物

### 项目概述

DesktopXPet 是一款像素风桌面宠物应用，通过可爱的二次元角色实时展示你的 AI 工作状态。它支持多工具接入、可换肤、可交互，并能随你的使用习惯不断成长。

---

### 技术栈推荐：Electron + React + TypeScript

推荐理由：

- **透明窗口成熟**：Electron 对无边框、透明、置顶窗口的支持非常完善，这是桌面宠物的核心需求
- **皮肤系统友好**：像素风角色的换肤本质是图片/精灵图切换，CSS + Canvas 方案在 Web 技术栈中实现最自然
- **插件架构灵活**：Node.js 后端可以方便地调用系统 API、读取日志、发送 HTTP 请求来对接各种外部工具
- **后续扩展性好**：当你要加入语音提醒、快捷键、右键菜单等助手型功能时，Electron 生态都有现成方案
- **开发效率高**：React + TypeScript 组合开发速度快，类型安全

包体积方面，Electron 确实偏大（约 80-150MB），但对于个人桌面工具来说可以接受。如果后期需要极致轻量化，可以迁移到 Tauri 方案。

---

### 核心架构

```
┌─────────────────────────────────────────────────┐
│                  Electron Main                   │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Window   │  │  Monitor   │  │  Plugin    │  │
│  │  Manager  │  │  Service   │  │  Registry  │  │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘  │
│        │              │               │          │
│        ▼              ▼               ▼          │
│  ┌─────────────────────────────────────────────┐ │
│  │              IPC Bridge                      │ │
│  └─────────────────────────────────────────────┘ │
│        │              │               │          │
├────────┼──────────────┼───────────────┼──────────┤
│        ▼              ▼               ▼          │
│                  Electron Renderer               │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Pet      │  │  Status    │  │  Skin      │  │
│  │  Engine   │  │  Dashboard │  │  Manager   │  │
│  │ (Canvas)  │  │  (React)   │  │            │  │
│  └───────────┘  └────────────┘  └────────────┘  │
└─────────────────────────────────────────────────┘
```

**三层分离设计：**

1. **Main Process（主进程）**：窗口管理、系统监控、插件调度、数据存储
2. **IPC Bridge（通信层）**：主进程与渲染进程的安全通信
3. **Renderer Process（渲染进程）**：宠物绘制、动画引擎、UI 交互

---

### 工具接入方案（Plugin 系统）

采用插件化架构，每种 AI 工具对应一个 Monitor Plugin：

```
plugins/
├── qoderwork/        # QoderWork 任务状态
│   └── index.ts      # 通过定时任务 API / 日志文件获取数据
├── github/           # GitHub 编码活动
│   └── index.ts      # GitHub API - commits, PR, issues
├── cursor/           # Cursor 编辑器
│   └── index.ts      # 读取本地日志或扩展 API
├── local-ai/         # 本地 AI 服务
│   └── index.ts      # Ollama / LM Studio 等本地模型 API
├── openai/           # OpenAI API 使用量
│   └── index.ts      # 调用 usage API 统计 token 消耗
└── custom/           # 自定义插件
    └── index.ts      # 用户自定义 webhook / 脚本
```

**Plugin 接口统一规范：**

```typescript
interface MonitorPlugin {
  name: string;                    // 插件名称
  icon: string;                    // 图标路径
  pollInterval: number;            // 轮询间隔（毫秒）
  
  // 初始化（可选，用于建立连接）
  init?(config: PluginConfig): Promise<void>;
  
  // 拉取状态数据（核心方法）
  fetchStatus(): Promise<MonitorStatus>;
  
  // 清理资源
  dispose?(): Promise<void>;
}

interface MonitorStatus {
  tool: string;                    // 工具名
  status: 'idle' | 'working' | 'error' | 'completed';
  summary: string;                 // 简短描述
  details?: Record<string, any>;   // 详细数据
  timestamp: number;               // 时间戳
}
```

**接入方式总结：**

| 工具 | 接入方式 | 数据内容 |
|------|---------|---------|
| QoderWork | 读取定时任务日志 / API | 任务状态、执行结果 |
| GitHub | GitHub REST API | commits、PR、issues 数量 |
| Cursor / VS Code | 读取本地扩展日志 | 编码时长、AI 补全次数 |
| Ollama / LM Studio | 本地 HTTP API (localhost:11434) | 模型运行状态、推理次数 |
| OpenAI / Claude API | API Key + usage endpoint | token 消耗、请求次数 |
| 自定义工具 | Webhook / 本地脚本 | 用户自定义指标 |

---

### 宠物形象与皮肤系统

**像素风角色设计要点：**

- 基础角色尺寸建议 64x64 或 128x128 像素，渲染时放大显示
- 每个角色由精灵图（Sprite Sheet）组成，包含多帧动画
- 支持通过 JSON 配置定义动画状态机

**角色状态机：**

```
           ┌──────────┐
           │  Idle    │ ← 默认状态，待机小动画
           └────┬─────┘
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
┌─────────┐ ┌────────┐ ┌──────────┐
│ Working │ │ Happy  │ │ Sleeping │
│ (忙碌)  │ │ (完成) │ │ (闲置)   │
└─────────┘ └────────┘ └─────┬────┘
     │                       │
     ▼                  鼠标进入
┌─────────┐                  ▼
│ Error   │            ┌──────────┐
│ (出错)  │            │ Waking   │  ← 过渡状态（1-2秒），
└─────────┘            │ (唤醒)   │     播放伸懒腰/睁眼动画
                       └─────┬────┘     完成后自动回到 Idle
                             │
                             ▼
                        ┌──────────┐
                        │  Idle    │
                        └──────────┘
```

**Waking 状态实现要点：** Waking 是一个非循环过渡动画（loop: false），播放完毕后通过 SpriteAnimator 的 `onFinish` 回调自动切换到 Idle。PetStateMachine 中，Waking 期间忽略新的状态变更请求（加锁），防止被打断。

**皮肤包结构：**

```
skins/
├── default-cat/           # 默认猫咪皮肤
│   ├── manifest.json      # 皮肤元信息（名称、作者、动画帧定义）
│   ├── idle.png           # 待机精灵图（多帧横排）
│   ├── working.png        # 工作状态精灵图
│   ├── happy.png          # 开心状态精灵图
│   ├── sleeping.png       # 睡觉状态精灵图
│   └── error.png          # 出错状态精灵图
├── pixel-robot/           # 像素机器人皮肤
│   └── ...
└── custom/                # 用户自定义皮肤目录
    └── ...
```

**manifest.json 示例：**

```json
{
  "name": "默认猫咪",
  "author": "DesktopXPet",
  "version": "1.0.0",
  "preview": "preview.png",
  "frameSize": { "width": 64, "height": 64 },
  "animations": {
    "idle": { "frames": 4, "fps": 4, "loop": true },
    "working": { "frames": 6, "fps": 8, "loop": true },
    "happy": { "frames": 4, "fps": 6, "loop": false },
    "sleeping": { "frames": 2, "fps": 1, "loop": true },
    "error": { "frames": 3, "fps": 4, "loop": true }
  }
}
```

`preview` 字段指向皮肤目录中的预览图（128x128 PNG），皮肤选择器用它展示缩略图。

---

### 交互设计

**基础展示型功能：**

- 透明无边框窗口，悬浮于桌面之上
- 宠物下方显示状态气泡（当前 AI 工具 + 工作状态摘要）
- 鼠标悬停时弹出详细面板（各工具详细数据）
- 双击宠物打开完整仪表盘窗口

**互动型功能：**

- 鼠标拖拽移动宠物位置（记住位置，下次启动恢复）
- 点击宠物触发反应动画（摸头开心、戳一下回头看你）
- 闲置一段时间后自动进入睡眠状态
- 鼠标靠近时自动唤醒
- 工作完成时播放庆祝动画 + 系统通知
- 右键菜单：打开仪表盘、切换皮肤、设置、置顶开关、重置位置、退出

**全局快捷键：**

- `Ctrl+Shift+P` — 显示/隐藏宠物
- `Ctrl+Shift+D` — 打开仪表盘
- `Ctrl+Shift+S` — 快速切换下一个皮肤

---

### 项目目录结构

```
DesktopXPet/
├── package.json
├── tsconfig.json
├── electron-builder.yml          # 打包配置
├── vite.config.ts                # Vite 构建配置
├── electron.vite.config.ts       # Electron Vite 配置
│
├── src/
│   ├── main/                     # Electron 主进程
│   │   ├── index.ts              # 入口，创建窗口，退出流程
│   │   ├── window.ts             # 窗口管理（透明、置顶、穿透、DPI）
│   │   ├── tray.ts               # 系统托盘 + 右键菜单
│   │   ├── shortcuts.ts          # 全局快捷键注册
│   │   ├── store.ts              # 持久化存储（electron-store）
│   │   ├── server/               # 本地 HTTP API 服务
│   │   │   └── api.ts            # localhost:9527 服务 + token 校验
│   │   ├── monitor/              # 监控服务
│   │   │   ├── index.ts          # 监控调度器（Poll + Push 合并）
│   │   │   └── scheduler.ts      # 定时轮询逻辑
│   │   └── plugins/              # 内置插件
│   │       ├── qoderwork.ts
│   │       ├── github.ts
│   │       ├── local-ai.ts
│   │       ├── system.ts         # 系统资源监控（CPU/内存）
│   │       └── file-watcher.ts   # 文件监控基类
│   │
│   ├── preload/                  # 预加载脚本
│   │   └── index.ts              # 暴露安全的 IPC API
│   │
│   ├── renderer/                 # 渲染进程（React）
│   │   ├── index.html
│   │   ├── main.tsx              # React 入口
│   │   ├── App.tsx               # 根组件
│   │   ├── components/
│   │   │   ├── Pet/
│   │   │   │   ├── PetCanvas.tsx         # 宠物绘制（Canvas + 穿透检测）
│   │   │   │   ├── SpriteAnimator.ts     # 精灵图动画引擎
│   │   │   │   └── PetStateMachine.ts    # 状态机逻辑
│   │   │   ├── StatusBubble/
│   │   │   │   └── StatusBubble.tsx      # 状态气泡组件
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.tsx         # 详细仪表盘
│   │   │   │   ├── ToolCard.tsx          # 单个工具卡片
│   │   │   │   └── StatsChart.tsx        # 统计图表
│   │   │   ├── Settings/
│   │   │   │   └── Settings.tsx          # 设置面板
│   │   │   └── SkinSelector/
│   │   │       └── SkinSelector.tsx      # 皮肤选择器
│   │   ├── hooks/
│   │   │   ├── usePetStatus.ts          # 获取宠物状态
│   │   │   ├── useMonitor.ts            # 监控数据 hook
│   │   │   ├── useDraggable.ts          # 拖拽 hook
│   │   │   ├── useClickThrough.ts       # 窗口穿透 hook
│   │   │   └── useIdleTimer.ts          # 闲置计时器 hook
│   │   ├── stores/
│   │   │   └── appStore.ts              # Zustand 状态管理
│   │   └── styles/
│   │       └── global.css
│   │
│   └── shared/                   # 共享类型和工具
│       ├── types.ts              # 类型定义
│       ├── plugin-api.ts         # 插件接口定义
│       ├── ipc-channels.ts       # IPC 通道常量
│       └── constants.ts
│
├── resources/
│   ├── skins/                    # 内置皮肤
│   │   ├── default-cat/          # 默认橘猫
│   │   └── butterfly-swordsman/  # 蝴蝶剑士
│   ├── icons/                    # 应用图标
│   │   ├── tray-icon.png         # 32x32 系统托盘图标
│   │   └── app-icon.png          # 512x512 应用图标
│   └── sounds/                   # 音效资源
│       ├── click.wav
│       ├── complete.wav
│       └── error.wav
│
├── tools/                        # 开发辅助工具
│   ├── generate_sprites.py       # 橘猫皮肤生成脚本
│   ├── generate_butterfly_sprites.py  # 蝴蝶剑士皮肤生成脚本
│   └── xpet-cli.ts               # CLI 伴侣工具源码
│
└── docs/
    ├── PLAN.md                   # 总体项目计划（本文档）
    └── IMPLEMENTATION.md         # 详细实施指南
```

---

### 开发路线图

**Phase 0 - 技术验证（预研）**

目标：验证 Electron 核心能力在当前系统上可用

- 透明无边框窗口可行性验证
- Canvas 像素渲染 + imageSmoothingEnabled 验证
- 窗口穿透（setIgnoreMouseEvents）行为验证
- DPI 缩放行为确认
- 系统托盘 + electron-store 基础功能验证
- 产出最小 demo 保留在 tools/poc/ 目录

**Phase 1 - 基础框架 + 基础交互（第 1-2 周）**

目标：让宠物在桌面上跑起来

- 初始化 Electron + React + TypeScript + Vite 项目
- 实现透明无边框窗口 + 系统托盘
- 编写精灵图动画引擎（SpriteAnimator）
- 实现宠物基础状态机（idle / sleeping）
- 鼠标拖拽移动 + 位置记忆
- 制作/获取第一套像素风皮肤（默认猫咪）

**Phase 2 - 监控系统 + 外部连接（第 3-4 周）**

目标：接入 AI 工具数据

- 设计并实现 Plugin 接口和 PluginRegistry
- 开发系统资源监控插件（CPU / 内存 / GPU）
- 开发 QoderWork 监控插件
- 开发 GitHub 活动监控插件
- 实现状态气泡 UI
- 宠物状态与监控数据联动（忙碌时切换 working 动画）

**Phase 3 - 交互增强（第 5-6 周）**

目标：让宠物更好玩

- 点击互动动画（摸头、戳）
- 闲置自动睡眠 + 鼠标靠近唤醒
- 任务完成庆祝动画 + 系统通知
- 状态详情面板（悬停展示）
- 完整仪表盘窗口（双击打开）

**Phase 4 - 皮肤与扩展（第 7-8 周）**

目标：个性化与生态

- 皮肤管理器 UI（浏览、预览、切换）
- 皮肤包加载机制（支持外部目录）
- 制作 2-3 套内置皮肤
- 设置面板（轮询间隔、通知偏好、开机自启）
- 打包发布（electron-builder）

---

### 关键依赖库

| 库名 | 用途 | 版本建议 |
|------|------|---------|
| electron | 桌面运行时 | ^33.x |
| electron-vite | 构建工具 | ^2.x |
| react + react-dom | UI 框架 | ^18.x |
| zustand | 状态管理 | ^5.x |
| electron-store | 持久化存储 | ^10.x |
| electron-log | 应用日志 | ^5.x |
| @electron-toolkit/utils | Electron 工具集 | ^3.x |
| framer-motion | 动画库 | ^11.x |
| recharts | 图表库 | ^2.x |
| octokit | GitHub API | ^4.x |

---

### 性能与资源优化

- 宠物窗口渲染使用 `requestAnimationFrame`，保持 30fps 即可（像素风不需要 60fps）
- 监控数据轮询间隔默认 30 秒，可在设置中调整
- 皮肤精灵图预加载到内存，切换状态时无延迟
- 窗口使用硬件加速但限制 GPU 占用
- 内存占用目标：< 100MB 常驻

---

### 下一步行动

1. 确认此方案是否满足你的需求
2. 初始化项目并搭建基础框架
3. 制作或获取第一套像素风角色素材
4. 开始 Phase 1 开发

> 各阶段的详细任务拆分、技术方案、数据流设计、验收标准等细节，请参阅 [IMPLEMENTATION.md](./IMPLEMENTATION.md)
