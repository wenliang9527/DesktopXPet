#!/usr/bin/env bash
# DesktopXPet CLI 接入脚本
# 用于 Claude Code / OpenCode / 任意 CLI 工具推送状态到桌面宠物
#
# 用法:
#   xpet-notify.sh <tool> <status> <summary>
#
# 参数:
#   tool    - 工具名称 (如 claude-code, opencode, aider)
#   status  - 状态 (idle/working/error/completed)
#   summary - 摘要文字
#
# 示例:
#   xpet-notify.sh claude-code working "Generating code..."
#   xpet-notify.sh opencode completed "Refactoring done"
#   xpet-notify.sh aider error "API rate limited"

CONFIG_FILE="$HOME/.xpet/config.json"

# 读取配置
if [ ! -f "$CONFIG_FILE" ]; then
  echo "DesktopXPet config not found at $CONFIG_FILE" >&2
  exit 1
fi

TOKEN=$(cat "$CONFIG_FILE" | grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"token"[[:space:]]*:[[:space:]]*"//;s/"$//')
PORT=$(cat "$CONFIG_FILE" | grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*:[[:space:]]*//')

if [ -z "$TOKEN" ]; then
  echo "DesktopXPet token not found in config" >&2
  exit 1
fi

PORT=${PORT:-9527}

TOOL="${1:-cli-tool}"
STATUS="${2:-idle}"
SUMMARY="${3:-No description}"

# 发送推送
curl -s -X POST "http://127.0.0.1:${PORT}/api/status" \
  -H "Content-Type: application/json" \
  -H "x-pet-token: ${TOKEN}" \
  -d "{\"tool\":\"${TOOL}\",\"status\":\"${STATUS}\",\"summary\":\"${SUMMARY}\"}" \
  --max-time 3 \
  > /dev/null 2>&1

exit 0
