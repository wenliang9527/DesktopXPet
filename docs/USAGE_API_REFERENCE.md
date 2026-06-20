# HTTP API 参考

DesktopXPet 内嵌一个 HTTP API 服务器，监听 `127.0.0.1:9527`（端口可自动递增），用于接收外部工具的状态推送。

## 认证

所有 `/api/status` 请求需要携带 `x-pet-token` 请求头。

Token 在首次启动时自动生成（32 字符 hex），保存在 `~/.xpet/config.json`：

```json
{
  "token": "a1b2c3d4e5f6...",
  "port": 9527
}
```

## 端点

### GET /api/health

健康检查，无需认证。

**响应**：

```json
{
  "ok": true,
  "version": "1.0.0"
}
```

**示例**：

```bash
curl http://127.0.0.1:9527/api/health
```

### POST /api/status

推送工具状态，需要 token 认证。

**请求头**：

```
Content-Type: application/json
x-pet-token: YOUR_TOKEN
```

**请求体**：

```json
{
  "tool": "claude-code",
  "status": "working",
  "summary": "正在重构认证模块",
  "details": {
    "file": "auth.ts",
    "line": 42
  }
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tool` | string | 是 | 工具名称，用于区分不同工具 |
| `status` | string | 是 | 状态：`idle` / `working` / `error` / `completed` |
| `summary` | string | 是 | 摘要文字，显示在气泡和仪表盘 |
| `details` | object | 否 | 详细信息键值对，显示在仪表盘卡片 |

**响应**：

```json
{
  "ok": true
}
```

**错误响应**：

| HTTP 状态码 | 原因 |
|-------------|------|
| 400 | JSON 解析失败 |
| 401 | Token 缺失或错误 |
| 413 | 请求体超过 10KB 限制 |

**示例**：

```bash
TOKEN=$(cat ~/.xpet/config.json | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -X POST http://127.0.0.1:9527/api/status \
  -H "Content-Type: application/json" \
  -H "x-pet-token: $TOKEN" \
  -d '{
    "tool": "claude-code",
    "status": "working",
    "summary": "Generating code..."
  }'
```

## 状态说明

| status | 含义 | 宠物表现 |
|--------|------|----------|
| `idle` | 空闲 | 宠物回到 idle 状态（如果无其他工具 working） |
| `working` | 工作中 | 宠物显示 working 动画 |
| `error` | 出错 | 宠物显示 error 动画 + 系统通知 |
| `completed` | 完成 | 宠物显示 happy 动画 30 秒 + 系统通知 |

## Push 数据有效期

推送的数据有 **60 秒 TTL**：

- 推送后 60 秒内，该工具状态参与聚合
- 60 秒后未收到新推送，该工具从聚合中移除
- 如果同一 `tool` 名多次推送，新数据覆盖旧数据

## 多工具聚合规则

多个工具同时推送时，宠物状态按优先级决定：

```
error (最高) > working > completed (30s 内) > idle (最低)
```

摘要文字构建规则：

1. 有 working 工具 → 显示 working 工具列表
2. 有 error 工具 → 显示 error 工具数量
3. 有 completed 工具（30s 内）→ 显示完成的工具名
4. 否则 → "DesktopXPet 待机中"

## 端口冲突处理

如果 9527 端口被占用，服务器自动尝试 9528、9529...

实际监听端口写入 `~/.xpet/config.json` 的 `port` 字段，CLI 工具和 IDE 扩展自动读取。

## 请求体大小限制

单次请求体最大 **10KB**，超过返回 413。

## 超时

- 请求处理超时：3 秒（IPC 层面）
- CLI 脚本请求超时：3 秒（curl/Invoke-RestMethod）
