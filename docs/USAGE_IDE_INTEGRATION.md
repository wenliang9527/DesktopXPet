# IDE 扩展接入

DesktopXPet 提供一个 VS Code 扩展，支持所有基于 VS Code 的 IDE。安装后自动检测 IDE 类型并推送工作状态。

## 支持的 IDE

| IDE | 自动检测名称 | 图标 | AI 状态检测 |
|-----|-------------|------|------------|
| Trae | `trae` | 🚀 | ✅ 支持（Chat/Builder） |
| Trae SOLO CN | `trae` | 🚀 | ✅ 支持（Chat/Builder） |
| Cursor | `cursor` | 📝 | 基础编辑器事件 |
| Windsurf | `windsurf` | 🏄 | 基础编辑器事件 |
| VS Code | `vscode` | 💙 | 基础编辑器事件 |
| Cline (VS Code 扩展) | `cline` | 📐 | 通过 IDE 扩展自动监控 |
| Roo Code (VS Code 扩展) | `roo` | 🦘 | 通过 IDE 扩展自动监控 |
| Continue (VS Code 扩展) | `continue` | ▶️ | 通过 IDE 扩展自动监控 |

---

## 快速安装

### 步骤 1：编译扩展

```bash
cd extensions/desktopxpet-monitor
npm install
npm run compile
```

### 步骤 2：打包 VSIX

```bash
npx vsce package
```

生成 `desktopxpet-monitor-0.3.0.vsix` 文件。

### 步骤 3：在 IDE 中安装

在各 IDE 中安装 VSIX 文件：

---

## 首次连接流程

DesktopXPet 与 IDE 扩展之间采用**本地自动配对**机制,无需手动配置 token:

1. DesktopXPet 启动时,优先从 safeStorage 读取已存储的 token;若不存在(首次启动或 token 丢失),自动生成 32 字符 hex token
2. Token 加密存储到系统安全存储(Windows DPAPI / macOS Keychain / Linux libsecret)
   - Linux 上若 libsecret/keyring 不可用,回退到明文存储(仅在 electron-store 内部)
   - 解密失败时(如重装系统、切换 Windows 账户)也会回退到明文,若明文也不存在则触发新 token 生成
3. Token 同时以明文写入 CLI 配置文件(权限 0600),路径优先级:
   - `~/.xpet/config.json`(首选)
   - `~/.desktopxpet/config.json`(备选)
   - 系统临时目录 `desktopxpet-config.json`(兜底)
   - Windows 对应路径:`%USERPROFILE%\.xpet\config.json`
   - 若三个路径全部写入失败,仅记录日志告警,不阻塞应用启动,但 IDE 扩展将无法自动获取 token
4. IDE 扩展启动时按相同路径优先级读取 config.json,获取 token 和 port
   - 若 IDE 设置中手动配置了 `serverToken`,优先使用配置值,config.json 中的 token 作为 fallback
5. 扩展连接 `127.0.0.1:{port}`,携带 `x-pet-token` 请求头进行鉴权

> 整个流程全自动,只要 DesktopXPet 和 IDE 扩展在同一台电脑上运行,扩展就能自动找到 token 并连接。后续启动复用已存储的 token,无需重复配对。

---

## Trae

```
Ctrl+Shift+P → Extensions: Install from VSIX → 选择 desktopxpet-monitor-0.3.0.vsix
```

安装后扩展自动激活，状态栏显示 `XPet: Trae Idle`。

Trae 额外支持 **AI 状态检测**（Chat/Builder），无需额外配置，默认开启。

---

## Cursor

```
Ctrl+Shift+P → Extensions: Install from VSIX → 选择 desktopxpet-monitor-0.3.0.vsix
```

安装后扩展自动激活，状态栏显示 `XPet: Cursor Idle`。

---

## VS Code

```
Ctrl+Shift+P → Extensions: Install from VSIX → 选择 desktopxpet-monitor-0.3.0.vsix
```

安装后扩展自动激活，状态栏显示 `XPet: VS Code Idle`。

---

## Windsurf

```
Ctrl+Shift+P → Extensions: Install from VSIX → 选择 desktopxpet-monitor-0.3.0.vsix
```

安装后扩展自动激活，状态栏显示 `XPet: Windsurf Idle`。

---

## Cline / Roo Code / Continue

这些是 VS Code 系 IDE 内的 AI 编程扩展。安装 DesktopXPet Monitor 扩展后，会自动监控编辑器活动（包括 AI 扩展触发的文件变更），无需额外配置。

安装方式同上，在宿主 IDE（VS Code / Cursor / Trae 等）中安装 VSIX 即可。

---

## 开发调试模式

如果需要调试扩展代码：

1. 在 IDE 中打开 `extensions/desktopxpet-monitor` 目录
2. 按 `F5` 启动扩展调试（会打开一个新的 IDE 窗口）
3. 在新窗口中编辑文件，观察状态栏和宠物反应

---

## 配置项

在 IDE 设置中搜索 `desktopxpet`：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `desktopxpet-monitor.enabled` | `true` | 启用/禁用监控 |
| `desktopxpet-monitor.toolName` | `auto` | 工具名称，`auto` 自动检测 IDE 类型 |
| `desktopxpet-monitor.serverPort` | `9527` | DesktopXPet API 端口 |
| `desktopxpet-monitor.serverToken` | `""` | API token（留空则自动从 config.json 读取,手动填写可覆盖） |
| `desktopxpet-monitor.idleTimeout` | `60` | 闲置超时秒数 |
| `desktopxpet-monitor.traeAIMonitor` | `true` | 启用 Trae AI 状态检测（仅 Trae IDE 生效） |

### 自定义工具名称

如果 `auto` 检测不准确，或你想用自定义名称：

```json
{
  "desktopxpet-monitor.toolName": "my-custom-tool"
}
```

---

## 监控的事件

扩展会监听以下编辑器事件并推送状态：

| 事件 | 推送状态 | 摘要示例 |
|------|----------|----------|
| 保存文件 | `working` | `Saved App.tsx (TypeScript)` |
| 切换标签页 | `working` | `Editing App.tsx:42 (TypeScript)` |
| 输入内容 | `working` | `Editing App.tsx:42 (TypeScript)` |
| 切换可见编辑器 | `working` | `Editing utils.ts:1 (TypeScript)` |
| 闲置超时 | `idle` | `No activity` |

---

## Trae AI 状态检测

在 Trae IDE 中，扩展额外提供 **AI 工作状态检测**，能识别 Trae 的 AI Chat 和 AI Builder 两种模式。

### 检测原理

Trae 没有公开的 AI 状态 API，扩展通过多种信号综合判断 AI 工作状态：

| 信号 | 检测方式 | AI 模式 |
|------|----------|---------|
| AI Chat 面板 | 检测 webview 面板可见性 | `chatting` |
| 流式代码生成 | 500ms 内 5+ 次文档变更 | `building` |
| 多文件同时修改 | 3 秒内 3+ 文件变更 | `building` |
| 文件新建/删除 | AI Builder 创建/删除文件 | `building` |
| AI 终端命令 | 检测 AI 创建的终端 | `building` |

### AI 状态推送

| AI 状态 | 推送状态 | 摘要示例 |
|---------|----------|----------|
| AI Chat 活跃 | `working` | `AI chatting: Chat panel active` |
| AI Builder 生成 | `working` | `AI building: Generating App.tsx` |
| AI Builder 修改 | `working` | `AI building: 5 files changed` |
| AI Builder 创建 | `working` | `AI building: Created: utils.ts, types.ts` |
| AI 空闲 | `idle` | `AI idle` |

### AI 状态优先级

- AI 工作状态优先于普通编辑器事件
- AI 操作停止 30 秒后自动回 `idle`
- 编辑器闲置超时不覆盖 AI 工作状态

### 配置

```json
{
  "desktopxpet-monitor.traeAIMonitor": true
}
```

或通过命令面板：`DesktopXPet Monitor: Toggle Trae AI Monitor`

---

## 状态栏指示器

IDE 底部状态栏显示：

| 状态 | 显示 | 颜色 |
|------|------|------|
| 工作中 | `🔄 XPet: Trae Working` | 默认 |
| 空闲 | `XPet: Trae Idle` | 默认 |
| 连接错误 | `⚠️ XPet: Error` | 红色背景 |
| 完成 | `✅ XPet: Done` | 默认 |

---

## 命令

| 命令 | 说明 |
|------|------|
| `DesktopXPet Monitor: Toggle` | 启用/禁用监控 |
| `DesktopXPet Monitor: Show Status` | 查看当前连接状态（Trae 额外显示 AI 状态） |
| `DesktopXPet Monitor: Toggle Trae AI Monitor` | 启用/禁用 Trae AI 状态检测 |

---

## 多 IDE 同时使用

如果同时打开多个 IDE，每个都安装扩展，它们会各自推送状态：

| IDE | 推送 tool 名 | 图标 |
|-----|-------------|------|
| Trae | `trae` | 🚀 |
| Cursor | `cursor` | 📝 |
| VS Code | `vscode` | 💙 |
| Windsurf | `windsurf` | 🏄 |

宠物会同时显示所有活跃工具的工作状态，气泡显示 `2 个工具并行中`。

---

## 换电脑 / 新环境

每台电脑的 DesktopXPet 实例独立运行,token 各自独立生成:

- **同一台电脑**:DesktopXPet 和 IDE 扩展共享同一个 config.json,自动配对
- **换到新电脑**:新电脑上首次启动 DesktopXPet 会生成新 token,写入新电脑的 config.json。IDE 扩展读取新电脑的 config.json 即可自动连接
- **跨电脑监控不支持**:API 服务器绑定 127.0.0.1,只接受本机连接。如需跨电脑监控,需修改 API 绑定地址并配置远程主机

### 新电脑快速接入

1. 在新电脑安装 DesktopXPet 并启动(首次启动自动生成 token + config.json)
2. 在新电脑的 IDE 中安装 DesktopXPet Monitor 扩展
3. 扩展自动读取本机 config.json,无需任何手动配置

> Token 是每台机器独立的,不需要从旧电脑复制配置文件。

---

## 故障排查

### 状态栏显示 Error

1. 确认 DesktopXPet 已启动(托盘有图标)
2. 确认 `~/.xpet/config.json` 存在且 token 正确 — 应用启动时若三个路径都写入失败,仅记录日志告警,不阻塞启动,但扩展无法获取 token
3. 确认端口未被占用(查看 config.json 中的 port)

### 状态不更新

- 检查 `desktopxpet-monitor.enabled` 是否为 `true`
- 尝试执行 `Toggle` 命令重新启用
- 查看 IDE 开发者工具控制台（`Help → Toggle Developer Tools`）

### Trae AI 状态不准确

- AI 状态依赖事件信号推断，非官方 API，可能存在误判
- 可通过 `traeAIMonitor` 配置关闭 AI 检测，仅保留编辑器事件
- 如果 AI 操作未被检测到，可能是信号阈值不匹配，可在设置中调整

### 端口冲突 / 多实例

DesktopXPet 使用单例锁(requestSingleInstanceLock),同一台电脑只能运行一个实例。如果尝试启动第二个实例,它会自动退出。

如果 9527 端口被其他程序占用(非 DesktopXPet),API 服务器会自动依次尝试 9528、9529... 9537(10 个备选端口,共 11 个候选)。实际端口写入 config.json,IDE 扩展自动读取。

如果 IDE 扩展连接失败:
1. 检查 config.json 是否成功写入(`~/.xpet/config.json` 是否存在) — 若三个路径全部写入失败,扩展无法获取 token
2. 检查 config.json 中的 port 是否与日志显示的监听端口一致
3. 如果不一致,删除 config.json 重启 DesktopXPet(会重新生成)
4. 或在 IDE 设置中手动指定 `desktopxpet-monitor.serverPort`
