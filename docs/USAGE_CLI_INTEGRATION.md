# CLI 工具接入

DesktopXPet 支持通过 HTTP API 接收任意 CLI 工具的状态推送，包括 **Claude Code**、**OpenCode**、**Aider**、**GitHub Copilot CLI** 等。

## 前置条件

1. DesktopXPet 已启动
2. `~/.xpet/config.json` 已生成（首次启动自动创建）
3. 将通知脚本复制到 `~/.xpet/` 目录：

```bash
# Linux / macOS / Git Bash / WSL
cp tools/xpet-notify.sh ~/.xpet/
chmod +x ~/.xpet/xpet-notify.sh

# Windows PowerShell
Copy-Item tools\xpet-notify.ps1 $env:USERPROFILE\.xpet\
```

## 状态取值

| 状态 | 含义 | 宠物表现 |
|------|------|---------|
| `working` | 工作中 | 切换到忙碌动画 |
| `completed` | 已完成 | 切换到开心动画 |
| `error` | 出错 | 切换到出错动画 |
| `idle` | 空闲 | 切换到待机动画 |

---

## Claude Code

Claude Code 原生支持 Hooks 机制，可自动推送状态。

### 步骤 1：复制通知脚本

```bash
cp tools/xpet-notify.sh ~/.xpet/
chmod +x ~/.xpet/xpet-notify.sh
```

### 步骤 2：配置 Hooks

在项目根目录创建或编辑 `.claude/settings.json`，添加以下内容：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.xpet/xpet-notify.sh claude-code working \"Claude Code: executing tool...\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.xpet/xpet-notify.sh claude-code completed \"Claude Code: tool completed\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.xpet/xpet-notify.sh claude-code idle \"Claude Code: session ended\""
          }
        ]
      }
    ]
  }
}
```

> 也可以配置全局 Hooks，编辑 `~/.claude/settings.json`（对所有项目生效）。

### Windows 用户

如果使用 Windows 原生终端（非 WSL/Git Bash），将 `command` 替换为 PowerShell 版：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File ~/.xpet/xpet-notify.ps1 -Tool claude-code -Status working -Summary \"Claude Code: executing tool...\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File ~/.xpet/xpet-notify.ps1 -Tool claude-code -Status completed -Summary \"Claude Code: tool completed\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File ~/.xpet/xpet-notify.ps1 -Tool claude-code -Status idle -Summary \"Claude Code: session ended\""
          }
        ]
      }
    ]
  }
}
```

---

## OpenCode

OpenCode 支持通过配置文件设置 hooks。

### 步骤 1：复制通知脚本

```bash
cp tools/xpet-notify.sh ~/.xpet/
chmod +x ~/.xpet/xpet-notify.sh
```

### 步骤 2：配置 OpenCode Hooks

编辑 OpenCode 配置文件（`~/.config/opencode/config.json` 或项目目录下 `opencode.json`）：

```json
{
  "hooks": {
    "on_message_start": "bash ~/.xpet/xpet-notify.sh opencode working \"OpenCode: processing...\"",
    "on_message_end": "bash ~/.xpet/xpet-notify.sh opencode completed \"OpenCode: response done\"",
    "on_error": "bash ~/.xpet/xpet-notify.sh opencode error \"OpenCode: error occurred\""
  }
}
```

### Windows 用户

```json
{
  "hooks": {
    "on_message_start": "powershell -File ~/.xpet/xpet-notify.ps1 -Tool opencode -Status working -Summary \"OpenCode: processing...\"",
    "on_message_end": "powershell -File ~/.xpet/xpet-notify.ps1 -Tool opencode -Status completed -Summary \"OpenCode: response done\"",
    "on_error": "powershell -File ~/.xpet/xpet-notify.ps1 -Tool opencode -Status error -Summary \"OpenCode: error occurred\""
  }
}
```

---

## Aider

Aider 没有原生 hook 机制，通过 shell wrapper 实现。

### Linux / macOS / Git Bash

创建 wrapper 脚本：

```bash
# 创建 ~/.local/bin/aider-xpet.sh
cat > ~/.local/bin/aider-xpet.sh << 'EOF'
#!/usr/bin/env bash
~/.xpet/xpet-notify.sh aider working "Aider: starting session..."
aider "$@"
EXIT_CODE=$?
~/.xpet/xpet-notify.sh aider completed "Aider: session ended"
exit $EXIT_CODE
EOF

chmod +x ~/.local/bin/aider-xpet.sh
```

使用方式：

```bash
# 直接运行 wrapper
aider-xpet.sh

# 或设置 alias（加入 ~/.bashrc / ~/.zshrc）
alias aider='~/.local/bin/aider-xpet.sh'
```

### Windows PowerShell

创建 `aider-xpet.ps1`：

```powershell
# 保存到 PATH 中的任意位置，如 ~/bin/aider-xpet.ps1
& "$env:USERPROFILE\.xpet\xpet-notify.ps1" -Tool aider -Status working -Summary "Aider: starting session..."
aider @args
& "$env:USERPROFILE\.xpet\xpet-notify.ps1" -Tool aider -Status completed -Summary "Aider: session ended"
```

使用方式：

```powershell
# 直接运行
aider-xpet.ps1

# 或设置 alias（加入 $PROFILE）
Set-Alias aider aider-xpet.ps1
```

---

## GitHub Copilot CLI

Copilot CLI 没有原生 hook，通过 shell wrapper 实现。

### Linux / macOS / Git Bash

```bash
# 创建 ~/.local/bin/github-copilot-xpet.sh
cat > ~/.local/bin/github-copilot-xpet.sh << 'EOF'
#!/usr/bin/env bash
~/.xpet/xpet-notify.sh copilot working "Copilot CLI: processing..."
gh copilot "$@"
EXIT_CODE=$?
~/.xpet/xpet-notify.sh copilot completed "Copilot CLI: done"
exit $EXIT_CODE
EOF

chmod +x ~/.local/bin/github-copilot-xpet.sh
```

使用方式：

```bash
# 直接运行
github-copilot-xpet.sh suggest "how to list files"

# 或设置 alias
alias gh-copilot='~/.local/bin/github-copilot-xpet.sh'
```

### Windows PowerShell

```powershell
# 保存到 ~/bin/copilot-xpet.ps1
& "$env:USERPROFILE\.xpet\xpet-notify.ps1" -Tool copilot -Status working -Summary "Copilot CLI: processing..."
gh copilot @args
& "$env:USERPROFILE\.xpet\xpet-notify.ps1" -Tool copilot -Status completed -Summary "Copilot CLI: done"
```

---

## Cline / Roo Code

Cline 和 Roo Code 是 VS Code 扩展，通过安装 **DesktopXPet Monitor 扩展**自动监控，无需额外配置。

如果 Cline/Roo Code 运行在独立终端中，可使用 wrapper 方式：

### Linux / macOS / Git Bash

```bash
# Cline
cat > ~/.local/bin/cline-xpet.sh << 'EOF'
#!/usr/bin/env bash
~/.xpet/xpet-notify.sh cline working "Cline: processing..."
cline "$@"
EXIT_CODE=$?
~/.xpet/xpet-notify.sh cline completed "Cline: done"
exit $EXIT_CODE
EOF
chmod +x ~/.local/bin/cline-xpet.sh
```

---

## Codex CLI (OpenAI)

OpenAI Codex CLI 支持类似 Claude Code 的 hook 机制。

### 步骤 1：复制通知脚本

```bash
cp tools/xpet-notify.sh ~/.xpet/
chmod +x ~/.xpet/xpet-notify.sh
```

### 步骤 2：配置 Hooks

编辑 Codex CLI 配置文件（`~/.codex/config.json` 或项目目录下 `.codex/config.json`）：

```json
{
  "hooks": {
    "on_tool_start": "bash ~/.xpet/xpet-notify.sh codex working \"Codex: executing...\"",
    "on_tool_end": "bash ~/.xpet/xpet-notify.sh codex completed \"Codex: tool completed\"",
    "on_session_end": "bash ~/.xpet/xpet-notify.sh codex idle \"Codex: session ended\""
  }
}
```

> Codex CLI 的 hook 事件名可能随版本变化，请参考其官方文档确认最新事件名。

---

## 任意 CLI 工具接入

任何能执行 HTTP 请求或 shell 命令的工具都可以接入。

### 通用 Wrapper 模板

```bash
#!/usr/bin/env bash
# ~/.local/bin/<tool>-xpet.sh — 通用 wrapper 模板
TOOL_NAME="my-tool"  # ← 改为你的工具名

~/.xpet/xpet-notify.sh "$TOOL_NAME" working "$TOOL_NAME: running..."
<your-command> "$@"   # ← 改为实际命令
EXIT_CODE=$?
~/.xpet/xpet-notify.sh "$TOOL_NAME" completed "$TOOL_NAME: done"
exit $EXIT_CODE
```

### 手动 curl

```bash
# 读取 token
TOKEN=$(cat ~/.xpet/config.json | grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"token"[[:space:]]*:[[:space:]]*"//;s/"$//')

# 推送状态
curl -X POST http://127.0.0.1:9527/api/status \
  -H "Content-Type: application/json" \
  -H "x-pet-token: $TOKEN" \
  -d '{"tool":"my-tool","status":"working","summary":"正在工作..."}'
```

### Python 示例

```python
import requests, json, os

config = json.load(open(os.path.expanduser('~/.xpet/config.json')))

def notify_xpet(status, summary, tool='my-tool'):
    requests.post(
        f'http://127.0.0.1:{config["port"]}/api/status',
        json={'tool': tool, 'status': status, 'summary': summary},
        headers={'x-pet-token': config['token']},
        timeout=3
    )

# 使用
notify_xpet('working', '正在训练模型...')
notify_xpet('completed', '训练完成')
```

### Node.js 示例

```javascript
const fs = require('fs');
const path = require('path');
const http = require('http');

const config = JSON.parse(
  fs.readFileSync(path.join(require('os').homedir(), '.xpet', 'config.json'), 'utf-8')
);

function notifyXpet(status, summary, tool = 'my-tool') {
  const body = JSON.stringify({ tool, status, summary });
  const req = http.request({
    hostname: '127.0.0.1',
    port: config.port,
    path: '/api/status',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-pet-token': config.token,
    },
  });
  req.write(body);
  req.end();
}

// 使用
notifyXpet('working', '正在构建项目...');
notifyXpet('completed', '构建完成');
```

---

## 已支持的图标映射

以下工具名会自动匹配图标：

| 工具名 | 图标 | 接入方式 |
|--------|------|---------|
| `claude-code` / `claude` | 🧠 | Hooks |
| `opencode` | ⚡ | Hooks |
| `codex` | 🔵 | Hooks |
| `cursor` | 📝 | IDE 扩展 |
| `trae` | 🚀 | IDE 扩展 |
| `vscode` | 💙 | IDE 扩展 |
| `windsurf` | 🏄 | IDE 扩展 |
| `copilot` | 🤖 | Wrapper |
| `aider` | 🤝 | Wrapper |
| `cline` | 📐 | IDE 扩展 / Wrapper |
| `roo` | 🦘 | IDE 扩展 / Wrapper |
| `chatgpt` | 💬 | Wrapper |
| `gemini` | 💎 | Wrapper |
| `continue` | ▶️ | IDE 扩展 |
| 其他 | 🔧 | Wrapper / curl |

如果工具名包含上述关键词（不区分大小写），也会自动匹配。

---

## 常见问题

### Q: 推送后宠物没有反应？

1. 确认 DesktopXPet 已启动
2. 检查 `~/.xpet/config.json` 是否存在且包含 `token` 和 `port`
3. 手动测试推送：

```bash
# Linux / macOS
bash ~/.xpet/xpet-notify.sh test working "Test message"

# Windows
powershell -File ~/.xpet/xpet-notify.ps1 -Tool test -Status working -Summary "Test message"
```

### Q: Token 从哪里获取？

DesktopXPet 首次启动时自动生成，保存在 `~/.xpet/config.json`：

```json
{
  "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "port": 9527
}
```

通知脚本会自动读取此文件，无需手动配置。

### Q: 支持同时监控多个工具吗？

支持。每个工具使用不同的 `tool` 名称即可，宠物会同时显示所有活跃工具的状态。

### Q: 推送状态多久过期？

推送状态 TTL 为 5 分钟。如果工具超过 5 分钟没有新推送，状态会自动过期，宠物回到待机。建议在长时间运行时定期推送 `working` 状态。
