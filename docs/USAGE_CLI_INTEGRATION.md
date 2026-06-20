# CLI 工具接入

DesktopXPet 支持通过 HTTP API 接收任意 CLI 工具的状态推送，包括 **Claude Code**、**OpenCode**、**Aider** 等。

## 前置条件

1. DesktopXPet 已启动
2. `~/.xpet/config.json` 已生成（首次启动自动创建）

## 通用接入脚本

项目提供两个通用脚本，封装了 HTTP 调用：

### Bash 版（Linux / macOS / Git Bash / WSL）

```bash
# 用法
./tools/xpet-notify.sh <tool> <status> <summary>

# 示例
./tools/xpet-notify.sh claude-code working "Generating code..."
./tools/xpet-notify.sh opencode completed "Refactoring done"
./tools/xpet-notify.sh aider error "API rate limited"
```

### PowerShell 版（Windows）

```powershell
# 用法
.\tools\xpet-notify.ps1 -Tool <tool> -Status <status> -Summary "<summary>"

# 示例
.\tools\xpet-notify.ps1 -Tool claude-code -Status working -Summary "Generating code..."
.\tools\xpet-notify.ps1 -Tool opencode -Status completed -Summary "Refactoring done"
```

### 参数说明

| 参数 | 取值 | 说明 |
|------|------|------|
| `tool` | 任意字符串 | 工具名称，如 `claude-code`、`opencode`、`aider` |
| `status` | `idle` / `working` / `error` / `completed` | 工作状态 |
| `summary` | 任意文字 | 摘要描述 |

## Claude Code 接入

### 方式 1：使用 hooks 配置

将 [tools/claude-code-hooks.json](../tools/claude-code-hooks.json) 的内容添加到 Claude Code 的配置中：

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

### 方式 2：手动 curl

```bash
TOKEN=$(cat ~/.xpet/config.json | grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"token"[[:space:]]*:[[:space:]]*"//;s/"$//')

curl -X POST http://127.0.0.1:9527/api/status \
  -H "Content-Type: application/json" \
  -H "x-pet-token: $TOKEN" \
  -d '{"tool":"claude-code","status":"working","summary":"正在重构认证模块"}'
```

## OpenCode 接入

使用提供的 hook 脚本：

```bash
# 复制脚本到 ~/.xpet/
cp tools/opencode-hook.sh ~/.xpet/
cp tools/xpet-notify.sh ~/.xpet/

# 在 OpenCode 配置中添加 hooks
```

OpenCode 配置示例：

```json
{
  "hooks": {
    "on_message_start": "bash ~/.xpet/opencode-hook.sh working",
    "on_message_end": "bash ~/.xpet/opencode-hook.sh completed",
    "on_error": "bash ~/.xpet/opencode-hook.sh error"
  }
}
```

## Aider 接入

Aider 没有原生 hook 机制，可以通过 shell wrapper 实现：

```bash
#!/usr/bin/env bash
# ~/.local/bin/aider-xpet.sh
~/.xpet/xpet-notify.sh aider working "Aider: starting session..."
aider "$@"
~/.xpet/xpet-notify.sh aider completed "Aider: session ended"
```

```bash
chmod +x ~/.local/bin/aider-xpet.sh
alias aider='aider-xpet.sh'
```

## 任意 CLI 工具接入

任何能执行 HTTP 请求或 shell 命令的工具都可以接入：

### Python 示例

```python
import requests
import json
import os

config = json.load(open(os.path.expanduser('~/.xpet/config.json')))

def notify_xpet(status, summary, tool='my-tool'):
    requests.post(
        f'http://127.0.0.1:{config["port"]}/api/status',
        json={'tool': tool, 'status': status, 'summary': summary},
        headers={'x-pet-token': config['token']},
        timeout=3
    )
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
```

## 已支持的图标映射

以下工具名会自动匹配图标：

| 工具名 | 图标 |
|--------|------|
| `claude-code` / `claude` | 🧠 |
| `cursor` | 📝 |
| `trae` | 🚀 |
| `vscode` | 💙 |
| `windsurf` | 🏄 |
| `opencode` | ⚡ |
| `copilot` | 🤖 |
| `chatgpt` | 💬 |
| `gemini` | 💎 |
| `aider` | 🤝 |
| `continue` | ▶️ |
| `cline` | 📐 |
| `roo` | 🦘 |
| 其他 | 🔧 |

如果工具名包含上述关键词（不区分大小写），也会自动匹配。
