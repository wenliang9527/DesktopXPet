# 启动与基础使用

## 环境要求

- Node.js >= 18
- npm >= 9
- Windows 10/11（当前主要支持平台）

## 安装

```bash
git clone https://github.com/your-username/DesktopXPet.git
cd DesktopXPet
npm install
```

## 启动

### 开发模式（热重载）

```bash
npm run dev
```

启动后：
- 桌面出现一只像素风宠物
- 系统托盘出现图标
- HTTP API 服务监听 `127.0.0.1:9527`
- 配置文件自动生成到 `~/.xpet/config.json`

### 生产模式

```bash
# 仅构建
npm run build

# 构建 + 打包 Windows 安装程序
npm run build:win
```

打包产物在 `dist/` 目录。

## 宠物交互

| 操作 | 功能 |
|------|------|
| **左键点击** | 跳跃动画，心情+3、亲密度+1（3秒冷却） |
| **右键点击** | 弹出菜单（仪表盘 / 切换皮肤 / 设置 / 重置位置 / 退出） |
| **右键菜单 → 喂食** | 吃饭动画，饱食度+20、心情+2、亲密度+1（3秒冷却） |
| **鼠标悬停1.5秒** | 摸头动画，心情+5、亲密度+2（3秒冷却） |
| **双击** | 打开仪表盘 |
| **拖拽** | 移动宠物位置（自动记忆，重启恢复） |
| **鼠标悬停窗口** | 显示多工具状态详情面板 |
| **双击气泡** | 编辑宠物名称 |

## 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+P` | 显示 / 隐藏宠物 |
| `Ctrl+Shift+D` | 打开仪表盘 |
| `Ctrl+Shift+S` | 切换下一个皮肤 |

## 系统托盘

- **左键单击** — 显示 / 隐藏宠物
- **右键点击** — 托盘菜单（显隐 / 仪表盘 / 切换皮肤 / 退出）
- **Tooltip** — 实时显示当前状态摘要

## 宠物状态说明

| 状态 | 触发条件 | 动画 |
|------|----------|------|
| `idle` | 所有工具空闲 | 待机动画 |
| `working` | 任一工具工作中 | 工作动画 |
| `happy` | 有工具刚完成任务（30 秒内） | 庆祝动画 |
| `error` | 任一工具出错 | 出错动画 |
| `sleeping` | 15 分钟无操作 | 睡眠动画 |
| `waking` | 鼠标靠近睡眠中的宠物 | 唤醒动画 → idle |

状态优先级：`error` > `working` > `happy` > `idle`

## 养成系统

宠物拥有四维属性，会随时间和互动变化：

| 属性 | 范围 | 说明 |
|------|------|------|
| 心情 (mood) | 0-100 | 受互动和饱食度影响，低于20时宠物不开心 |
| 饱食度 (satiety) | 0-100 | 随时间下降，低于20时心情加速下降 |
| 精力 (energy) | 0-100 | 工作时消耗，睡眠时恢复 |
| 亲密度 (intimacy) | 0-100 | 通过互动提升，不随时间衰减 |

**互动方式与冷却：**
每种互动有 3 秒冷却时间，防止刷属性。

**等级与经验值：**
- 完成工作任务：+1 XP/分钟
- 完成任务事件：+10 XP
- 完成番茄钟：+15 XP
- 点击互动：+1 XP
- 喂食互动：+3 XP

**离线衰减：**
关闭应用后属性会持续衰减，但最多计算 2 小时（防止长时间不玩后属性暴跌）。

> 更多详情请参阅 [养成系统指南](./USAGE_NURTURE.md)

## 配置文件

首次启动后自动生成 `~/.xpet/config.json`,用于 CLI 工具和 IDE 扩展读取 token 与端口。

**Token 存储机制:**

- 首次启动时自动生成 32 字符 hex token
- 后续启动复用已存储的 token(从 safeStorage 读取),仅在 token 丢失/解密失败时才重新生成
- 加密存储在系统安全存储(Windows DPAPI / electron safeStorage),应用自身读取密文
- 同时以明文写入 `config.json`,供外部工具(CLI / IDE 扩展)读取(因外部工具无法访问 safeStorage)
- 文件权限 `0600`(仅所有者可读写)
  - 注意:Windows NTFS 不完全支持 Unix 权限模型,`0600` 在 Windows 上保护效果有限,建议在个人用户目录下使用
- Linux 上若 libsecret/keyring 不可用,safeStorage 自动回退到明文存储(仅在 electron-store 内部)

**路径优先级(写入与读取均遵循此顺序):**

1. `~/.xpet/config.json`(首选)
2. `~/.desktopxpet/config.json`(备选)
3. 系统临时目录 `desktopxpet-config.json`(兜底)

> Windows 路径:`%USERPROFILE%\.xpet\config.json`

IDE 扩展和 CLI 工具(`xpet-notify.sh` / `xpet-notify.ps1`)启动时自动读取此文件获取 token 和 port,无需手动配置。

```json
{
  "token": "自动生成的 32 字符 hex token",
  "port": 9527
}
```

## 常见问题

### 宠物不显示

- 检查系统托盘是否有图标
- 按 `Ctrl+Shift+P` 切换显隐
- 检查是否被其他窗口遮挡（宠物始终置顶）

### API 端口冲突

- 默认端口 9527,若被占用则依次尝试 9528、9529... 9537(10 个备选端口,共 11 个候选)
- 实际监听端口写入 `config.json`,IDE 扩展和 CLI 工具自动读取
- 应用使用单例锁(`requestSingleInstanceLock`),防止多实例竞争端口;已有实例运行时新启动的实例会自动退出
- 端口绑定采用异步等待机制(`await apiServer.start()`),确保 `config.json` 写入的是实际监听端口,而非默认端口

### IDE 扩展连接失败

如果 IDE 扩展状态栏显示 Error,但 DesktopXPet 已启动:

1. 检查 `~/.xpet/config.json` 是否存在 — 应用启动时若三个路径都写入失败,仅记录日志告警,不阻塞启动,但扩展无法获取 token
2. 检查 config.json 中的 `port` 是否与日志显示的监听端口一致
3. 若不一致,删除 config.json 重启 DesktopXPet(会重新生成)
4. 或在 IDE 设置中手动指定 `desktopxpet-monitor.serverPort` 和 `desktopxpet-monitor.serverToken`

### 音效不播放

音效文件位于 `resources/sounds/`，如果缺失只打日志不影响运行。

### 属性归零

长时间不打开应用会导致属性衰减（最多计算2小时）。打开应用后通过互动即可恢复。

### 番茄钟计数不显示

番茄钟完成数存储在养成系统中，重启应用后会自动恢复。如果显示为0，检查养成系统是否正常初始化。

### 换电脑使用

每台电脑的 DesktopXPet 独立运行，token 各自独立生成。在新电脑上：
1. 安装并启动 DesktopXPet（自动生成新 token + config.json）
2. 安装 IDE 扩展（自动读取本机 config.json）
3. 无需从旧电脑复制任何配置文件

> API 服务器绑定 127.0.0.1，只支持同机通信，不支持跨电脑监控。
