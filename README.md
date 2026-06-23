<div align="center">

# DesktopXPet

**AI 工作监控桌面宠物**

通过可爱的像素风角色，实时展示你的 AI 编码工具工作状态

```
  /\_/\  
 ( o.o )  ← idle
  > ^ <
```

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-36-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## ✨ 功能特性

| 类别 | 特性 |
|------|------|
| 🐱 **桌面宠物** | 透明悬浮、始终置顶、鼠标穿透、拖拽移动、位置记忆 |
| 🎬 **动画引擎** | Canvas 2D 渲染、高 DPI 支持、像素风锐利放大、动态降频省电 |
| 📡 **实时监控** | 插件系统 + HTTP Push API，宠物动画随工作状态自动切换 |
| 🎨 **皮肤系统** | 内置 5 套皮肤、拖拽 `.xpet` 一键安装、支持像素风/高清风/静态立绘 |
| 🔊 **音效系统** | 内置音效、皮肤专属音效、用户自定义音效、三级优先级覆盖 |
| 🍅 **番茄钟** | 25 分钟工作 + 5 分钟休息循环，到时自动通知 + 音效 |
| ⌨️ **全局快捷键** | `Ctrl+Shift+P` 显隐 / `Ctrl+Shift+D` 仪表盘 / `Ctrl+Shift+S` 切换皮肤 |
| 😴 **闲置睡眠** | 长时间无操作自动睡眠，鼠标靠近唤醒 |
| 🔒 **安全沙箱** | 渲染进程 sandbox 隔离 + CSP + IPC 路径白名单 |

---

## 🛠 支持的工具

### IDE 扩展（自动监控）

| IDE | 图标 | AI 状态检测 |
|-----|------|------------|
| Trae | 🚀 | ✅ Chat / Builder |
| Cursor | 📝 | 编辑器事件 |
| VS Code | 💙 | 编辑器事件 |
| Windsurf | 🏄 | 编辑器事件 |
| Cline / Roo / Continue | 📐🦘▶️ | 通过 IDE 扩展自动监控 |

### CLI 工具（Hooks / Wrapper）

| 工具 | 图标 | 接入方式 |
|------|------|---------|
| Claude Code | 🧠 | Hooks |
| OpenCode | ⚡ | Hooks |
| Codex CLI | 🔵 | Hooks |
| Aider | 🤝 | Shell Wrapper |
| GitHub Copilot CLI | 🤖 | Shell Wrapper |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
git clone https://github.com/wenliang9527/DesktopXPet.git
cd DesktopXPet
npm install
npm run dev
```

### 构建打包

```bash
npm run build:win    # 构建 + 打包 Windows 安装程序
npm run build        # 仅构建（不打包）
```

> 详细启动说明请参阅 [启动与基础使用](./docs/USAGE_GETTING_STARTED.md)

---

## 🔌 外部工具接入

### IDE 扩展

```bash
cd extensions/desktopxpet-monitor
npm install && npm run compile
npx vsce package
# 在 IDE 中 Ctrl+Shift+P → Install from VSIX → 选择 .vsix 文件
```

### Claude Code

```bash
cp tools/xpet-notify.sh ~/.xpet/ && chmod +x ~/.xpet/xpet-notify.sh
```

在 `.claude/settings.json` 中添加：

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "bash ~/.xpet/xpet-notify.sh claude-code working \"Claude Code: executing...\"" }] }],
    "PostToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "bash ~/.xpet/xpet-notify.sh claude-code completed \"Claude Code: completed\"" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "bash ~/.xpet/xpet-notify.sh claude-code idle \"Claude Code: session ended\"" }] }]
  }
}
```

### OpenCode

```bash
cp tools/xpet-notify.sh ~/.xpet/ && chmod +x ~/.xpet/xpet-notify.sh
```

在 OpenCode 配置中添加：

```json
{
  "hooks": {
    "on_message_start": "bash ~/.xpet/xpet-notify.sh opencode working \"OpenCode: processing...\"",
    "on_message_end": "bash ~/.xpet/xpet-notify.sh opencode completed \"OpenCode: done\"",
    "on_error": "bash ~/.xpet/xpet-notify.sh opencode error \"OpenCode: error\""
  }
}
```

### Aider

```bash
cat > ~/.local/bin/aider-xpet.sh << 'EOF'
#!/usr/bin/env bash
~/.xpet/xpet-notify.sh aider working "Aider: starting..."
aider "$@"
~/.xpet/xpet-notify.sh aider completed "Aider: done"
EOF
chmod +x ~/.local/bin/aider-xpet.sh && alias aider='~/.local/bin/aider-xpet.sh'
```

### HTTP API（任意工具）

```bash
curl -X POST http://127.0.0.1:9527/api/status \
  -H "Content-Type: application/json" \
  -H "x-pet-token: YOUR_TOKEN" \
  -d '{"tool":"my-tool","status":"working","summary":"正在工作..."}'
```

`status` 取值：`idle` | `working` | `error` | `completed`

Token 在首次启动时自动生成，保存在 `~/.xpet/config.json`。

> 完整接入说明（含 Windows PowerShell 版本、Copilot CLI、Codex、Cline 等）请参阅 [CLI 工具接入](./docs/USAGE_CLI_INTEGRATION.md)

---

## 🐾 宠物状态机

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

状态优先级：`error` > `working` > `happy` > `idle`

---

## 🎨 皮肤系统

每套皮肤是一个文件夹，包含精灵图 + `manifest.json`：

```
my-skin/
├── manifest.json    # 皮肤元信息和动画配置
├── idle.png         # 待机动画
├── working.png      # 工作动画
├── happy.png        # 开心动画
├── sleeping.png     # 睡眠动画
├── error.png        # 出错动画
├── preview.png      # 预览图
└── sounds/          # 皮肤专属音效（可选）
    ├── click.wav
    ├── complete.wav
    └── error.wav
```

**两种渲染模式：**

| 模式 | 帧尺寸 | 缩放算法 | 适用场景 |
|------|--------|---------|---------|
| 像素风 | ≤ 128×128 | 最近邻 (NEAREST) | 手绘像素画、程序化生成 |
| 高清风 | 384×384 | 双线性 (BILINEAR) | AI 生成、高清插画 |

**两种动画模式：**

| 模式 | `renderMode` | 图片要求 | 适用场景 |
|------|-------------|---------|---------|
| 精灵图动画 | `spritesheet`（默认） | 每种状态一张横排多帧精灵图 | 手绘/程序化多帧动画 |
| 静态立绘 | `static` | 每种状态一张单张立绘 | AI 生成单张角色图 |

**安装方式：** 拖拽 `.xpet` 包安装 / 手动复制到 `userData/skins/` / 自定义目录

> 详细说明请参阅 [皮肤系统](./docs/USAGE_SKINS.md) · [皮肤制作指南](./docs/SKIN_GUIDE.md) · [音效制作指南](./docs/SOUND_GUIDE.md)

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+P` | 显示 / 隐藏宠物 |
| `Ctrl+Shift+D` | 打开仪表盘 |
| `Ctrl+Shift+S` | 切换下一个皮肤 |

---

## 🏗 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Electron 36 |
| 构建 | electron-vite + Vite 6 + electron-builder |
| UI | React 18 + TypeScript 5 |
| 状态管理 | Zustand 5 |
| 持久化 | electron-store |
| 动画 | Canvas 2D (requestAnimationFrame) |
| 代码质量 | ESLint 9 + Prettier + husky + lint-staged |
| Schema 校验 | zod 4 |

---

## 📁 项目结构

```
DesktopXPet/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── bootstrap.ts         # 初始化流程 + 优雅关闭
│   │   ├── ipc-handlers.ts      # IPC 处理器
│   │   ├── window.ts            # 宠物窗口管理
│   │   ├── tray.ts              # 系统托盘
│   │   ├── skin-loader.ts       # 皮肤扫描与加载
│   │   ├── skin-installer.ts    # .xpet 皮肤包安装
│   │   ├── server/api.ts        # HTTP API 服务器
│   │   ├── monitor/             # 监控调度
│   │   └── plugins/             # 内置插件 (System/GitHub/Ollama)
│   ├── preload/                 # 预加载脚本
│   ├── renderer/                # React 渲染进程
│   │   ├── components/Pet/      # 宠物渲染 + 动画引擎 + 状态机
│   │   ├── components/Dashboard/ # 仪表盘
│   │   └── stores/              # Zustand 全局状态
│   └── shared/                  # 主/渲染进程共享类型与常量
├── resources/
│   ├── skins/                   # 内置皮肤（5 套）
│   ├── sounds/                  # 内置音效
│   └── icons/                   # 应用图标
├── extensions/
│   └── desktopxpet-monitor/     # VS Code 系 IDE 扩展
├── tools/                       # CLI 通知脚本 + 皮肤生成脚本
└── docs/                        # 项目文档
```

---

## 📚 文档

### 使用文档

| 文档 | 说明 |
|------|------|
| [启动与基础使用](./docs/USAGE_GETTING_STARTED.md) | 安装、启动、宠物交互、快捷键、配置 |
| [IDE 扩展接入](./docs/USAGE_IDE_INTEGRATION.md) | Trae / Cursor / Windsurf / VS Code / Cline / Roo / Continue |
| [CLI 工具接入](./docs/USAGE_CLI_INTEGRATION.md) | Claude Code / OpenCode / Aider / Copilot CLI / Codex |
| [仪表盘与多任务监控](./docs/USAGE_DASHBOARD.md) | 仪表盘布局、多工具并行监控、状态聚合规则 |
| [皮肤系统](./docs/USAGE_SKINS.md) | 皮肤切换、文件结构、自定义皮肤目录 |
| [音效系统](./docs/SOUND_GUIDE.md) | 音效制作、皮肤专属音效、用户自定义音效 |
| [HTTP API 参考](./docs/USAGE_API_REFERENCE.md) | API 端点、请求格式、认证、聚合规则 |

### 开发文档

| 文档 | 说明 |
|------|------|
| [PLAN.md](./docs/PLAN.md) | 项目总体计划与架构设计 |
| [IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) | 详细实施指南（数据流、IPC、API、插件接入） |
| [SKIN_GUIDE.md](./docs/SKIN_GUIDE.md) | 皮肤制作完整指南（两种渲染模式、两种动画模式） |
| [SOUND_GUIDE.md](./docs/SOUND_GUIDE.md) | 提示音制作完整指南（程序化/DAW/在线工具） |
| [OPTIMIZATION_AND_FEATURES.md](./docs/OPTIMIZATION_AND_FEATURES.md) | 优化方向与新功能建议 |
| [REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md) | 架构优化计划与执行记录 |

---

## 📄 License

[MIT](LICENSE)
