#!/usr/bin/env bash
# OpenCode 接入 DesktopXPet 的 hook 脚本
#
# 安装方法:
#   1. 将此脚本复制到 ~/.xpet/opencode-hook.sh
#   2. 在 OpenCode 配置中添加 hook:
#      {
#        "hooks": {
#          "on_message_start": "bash ~/.xpet/opencode-hook.sh working",
#          "on_message_end": "bash ~/.xpet/opencode-hook.sh completed",
#          "on_error": "bash ~/.xpet/opencode-hook.sh error"
#        }
#      }

STATUS="${1:-idle}"
SUMMARY="${2:-OpenCode session}"

# 尝试获取当前文件名
CURRENT_FILE="${3:-unknown}"
if [ "$CURRENT_FILE" != "unknown" ]; then
  SUMMARY="OpenCode: ${CURRENT_FILE}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SCRIPT_DIR/xpet-notify.sh" opencode "$STATUS" "$SUMMARY"
