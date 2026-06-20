# 优化方向与新功能建议

本文档基于对 DesktopXPet 当前代码库的全面审查，整理出可进一步优化的方向和值得添加的新功能。按优先级和实施难度分类，供后续开发参考。

---

## 一、性能优化方向

### 1.1 渲染层优化（中优先级）

**现状**：`PetCanvas.tsx` 已做了 gradient 缓存、粒子系统去 shadowBlur、DPR 缓存等优化，但仍有提升空间。

**可优化点**：

- **离屏 Canvas 缓存光晕/阴影层** — 当前 `drawStateGlow` 和 `drawShadow` 每帧都执行 `ctx.beginPath` + `ctx.arc` + `ctx.fill`。由于光晕和阴影只在 `state` 切换时变化，可以预渲染到离屏 canvas，运行时直接 `drawImage`，减少每帧的路径构建和填充开销。
- **粒子系统对象池** — `ParticleSystem` 在 happy 状态下会频繁创建/销毁粒子对象。可引入对象池复用粒子实例，减少 GC 压力。
- ✅ **requestAnimationFrame 帧率限制** — 已实现。idle=15fps、sleeping=10fps、失焦=5fps,显著降低 CPU 占用。
- **Canvas willReadFrequently** — `handleClick` 中调用 `getImageData` 做像素检测，可在 `getContext('2d', { willReadFrequently: true })` 中提示浏览器优化读取性能。

### 1.2 监控层优化（低优先级）

**现状**：已实现状态变化检测，idle 时不再重复广播。

**可优化点**：

- **插件轮询错峰** — 当前所有插件同时启动定时器，可能在同一时刻集中 fetch。可在 `startAll` 时为每个插件添加随机初始延迟（0 ~ pollInterval），避免请求尖峰。
- **pushCache 过期清理** — `pushCache` 只在 `aggregateAll` 时检查过期，但从不主动删除过期条目。长时间运行后 Map 可能累积过期 key。可在 `emitUpdate` 中顺带清理。
- **System 插件 CPU 采样优化** — `getCpuUsage` 首次调用会 `await setTimeout(1000)` 阻塞 1 秒，导致首次 `fetchPluginStatus` 较慢。可改为首次返回 0%，下次轮询时再计算差值。

### 1.3 内存优化（低优先级）

- **Dashboard history 无限增长** — `history` 已限制为 `slice(-12)`，但 `connectedTools` Map 会随时间累积所有出现过的工具，即使工具已离线。可添加 TTL 机制，超过 N 分钟未更新的工具从 Map 中移除。
- **notifiedCompletedKeys 清理** — 已实现 30 秒窗口清理，但清理逻辑在每次 `emitUpdate` 中遍历整个 Set，O(n) 复杂度。工具数量少时无影响，但可优化为惰性清理。

---

## 二、代码质量优化

### 2.1 类型安全（中优先级）

**现状**：preload 中大量使用 `any` 类型，丢失了类型保护。

**可优化点**：

- ✅ **preload API 类型化** — 已完成。`DesktopXPetAPI` 接口已定义并与实际暴露的 API 强绑定,所有 IPC 回调使用 `IpcRendererEvent` 类型,`env.d.ts` 中为 `window.desktopXPet` 添加了类型声明。
- **IPC 参数类型化** — `ipcMain.handle` 的参数目前是隐式 `any`。可定义请求/响应类型对，在 handler 中强制类型检查。
- **Settings 类型补全** — `Settings.tsx` 中的 `SettingsData` 是局部定义，与 `shared/types.ts` 的 `AppSettings` 不一致（缺少 `skin`、`monitor.plugins` 等字段）。应统一使用 `AppSettings`。

### 2.2 错误处理（中优先级）

- **IPC handler 缺少 try-catch** — `setupIPC` 中大部分 handler 直接调用 `container.get(...)`，如果容器未初始化会抛异常。应在关键 handler 中包裹 try-catch 并返回错误响应。
- ✅ **SkinLoader 缺少 manifest 校验** — 已完成。使用 zod schema 在加载时校验 `frameSize`、`animations` 等必要字段,畸形 manifest 会被跳过并记录警告。
- **音效播放失败静默** — preload 中 `audio.play().catch(() => {})` 完全吞掉错误，用户无法感知音效是否正常。可记录到日志。

### 2.3 架构改进（低优先级）

- **IPC 通道集中管理** — `ipc-channels.ts` 定义了常量，但 `skin:changed`、`pet-name:changed`、`sound:play-file` 等通道名是字符串字面量散落在代码中。应统一到 `IPC` 常量。
- **容器依赖注入改进** — `container.get` 返回 `T | undefined`，但调用方多用 `?.` 链式调用，错误时静默失败。可在开发模式下对未注册的依赖抛出明确错误。
- **插件配置持久化** — `PluginRegistry.togglePlugin` 只更新内存中的 config，不持久化到 store。重启后插件状态会丢失。

---

## 三、新功能建议

### 3.1 用户交互类（高价值）

#### 3.1.1 皮肤拖拽安装

**描述**：用户将 `.xpet` 皮肤包文件拖拽到宠物窗口上即可自动安装。

**实现思路**：
- 在 `PetCanvas` 或外层容器监听 `dragover` / `drop` 事件
- 主进程添加 IPC handler 解压 `.xpet`（本质是 zip）到 `resources/skins/` 或用户自定义目录
- 安装后触发 `skinLoader.scan()` 并广播 `skin:changed`
- UI 显示安装成功/失败的 toast 提示

**价值**：当前皮肤安装需要手动复制文件夹或修改目录配置，门槛较高。拖拽安装能大幅降低皮肤分发门槛。

**状态**：✅ 已完成。实现细节:
- `App.tsx` 监听 dragover/drop 事件,过滤 `.xpet` 文件
- `skin-installer.ts` 使用 adm-zip 解压,含 zip slip 防护、文件数/大小限制、manifest zod 校验
- preload 暴露 `installSkinPackage` 和 `getPathForFile`(webUtils, sandbox 兼容)
- 安装后自动 rescan 并广播 `skins:rescanned`

#### 3.1.2 提示音自定义 + 切换

**描述**：允许用户在设置中选择不同主题的提示音包（如"8-bit"、"柔和钢琴"、"无声"）。

**实现思路**：
- 扩展 `sound.ts`，支持从 `resources/sounds/<theme>/` 加载
- 设置中添加音效主题下拉选择器
- 提供音量调节滑块（当前固定 0.5）
- 支持用户自定义音效目录（类似自定义皮肤目录）

**价值**：当前只有一套固定音效，无法满足个性化需求。

#### 3.1.3 宠物互动增强

**描述**：增加更多用户与宠物的互动方式。

**可添加的互动**：
- **抚摸** — 鼠标在宠物身上停留 2 秒触发"被抚摸"动画（happy 状态 + 心形粒子）
- **喂食** — 右键菜单添加"喂食"选项，宠物播放吃东西动画
- **说话气泡** — 随机显示鼓励语句（"加油！"、"休息一下吧"），在 working 状态超过 30 分钟时提示休息
- **多宠物** — 支持同时显示多只宠物，各自独立状态

**价值**：增强情感连接，让宠物不只是状态指示器。

### 3.2 监控扩展类（中价值）

#### 3.2.1 更多内置插件

**可添加的插件**：

| 插件 | 数据源 | 状态映射 |
|------|--------|---------|
| Git 监控 | `git status` / `git log` | 有未提交变更 → working，合并冲突 → error |
| Docker 监控 | `docker ps` | 容器运行中 → working，容器停止 → error |
| 构建任务监控 | 监听 `localhost:port` webhook | 构建中 → working，成功 → completed，失败 → error |
| 日志监控 | tail 日志文件 | 检测 ERROR 关键字 → error |
| ✅ 番茄钟 | 内置计时器 | 专注中 → working，休息 → idle（已实现为独立组件,非插件） |

**实现思路**：按 `MonitorPlugin` 接口实现，注册到 `PluginRegistry` 即可。

#### 3.2.2 状态历史持久化

**描述**：将 Dashboard 的状态时间线持久化到本地，支持查看历史一天/一周的工作状态分布。

**实现思路**：
- 主进程定时（每分钟）将 `AggregatedStatus` 快照写入 electron-store 或 SQLite
- Dashboard 添加"历史"标签页，用图表展示工作/空闲/错误时长占比
- 支持导出 CSV 报告

**价值**：帮助用户回顾工作模式，量化"AI 辅助编码时长"。

#### 3.2.3 跨设备同步（远期）

**描述**：多台电脑的宠物状态可互相可见，团队共享工作状态。

**实现思路**：
- 可选启用局域网广播（mDNS）或云端同步
- Dashboard 显示团队所有成员的宠物状态
- 支持给同事的宠物"点赞"互动

### 3.3 皮肤系统增强（中价值）

#### 3.3.1 皮肤预览动画

**描述**：在皮肤选择器中，hover 皮肤时实时播放该皮肤的 idle 动画，而非静态 preview.png。

**实现思路**：
- `SkinSelector` 中为每个皮肤项渲染一个迷你 canvas
- 复用 `SpriteAnimator` 加载并播放 idle.png
- hover 时启动动画，移出时停止

**状态**：✅ 已完成。实现细节:
- 新建 `SkinPreviewCanvas.tsx` 组件,canvas 绘制 idle 动画循环
- `SkinSelector.tsx` 悬停时切换静态预览图 → 动画预览
- 同时添加音效试听按钮(🔊 click / ✅ complete)

#### 3.3.2 皮肤 manifest 扩展

**可添加的字段**：
- `theme` — 主题色，影响状态气泡、光晕颜色（覆盖默认的 `STATE_GLOW_COLORS`）
- `sounds` — 皮肤专属音效包路径
- `scale` — 渲染缩放比例（某些皮肤可能需要更大/更小显示）
- `offset` — 在窗口内的位置偏移（适配非居中角色）
- `authorUrl` — 作者主页，显示在皮肤信息中

#### 3.3.3 皮肤市场（远期）

**描述**：内置皮肤社区，一键下载安装他人分享的皮肤。

**实现思路**：
- GitHub Releases 或独立服务端托管皮肤包
- Dashboard 添加"皮肤市场"标签页
- 支持评分、下载量排序、预览

### 3.4 开发者体验类（低价值）

#### 3.4.1 插件开发脚手架

**描述**：提供 CLI 工具快速生成插件模板。

```bash
npx desktopxet create-plugin my-plugin
```

生成包含 `fetchStatus`、`dispose`、`init` 骨架的 TypeScript 文件 + README。

#### 3.4.2 调试模式增强

**描述**：添加 `--debug` 启动参数，开启以下功能：
- 自动打开 DevTools
- 显示 FPS 计数器
- 显示粒子数量
- 打印所有 IPC 通信日志
- 模拟状态切换面板（手动触发 working/error/happy）

---

## 四、文档与生态

### 4.1 文档补全

- **插件开发指南** — 当前缺少教用户如何编写自定义插件的文档
- **架构文档** — 补充主进程/渲染进程/preload 的职责划分和数据流图
- **贡献指南** — CONTRIBUTING.md，规范 PR 流程、代码风格、提交格式

### 4.2 生态建设

- **皮肤模板仓库** — 提供包含空白精灵图、manifest、生成脚本的模板仓库，用户 clone 后直接开始创作
- **音效包模板** — 提供多套音效主题示例，降低音效创作门槛
- **示例插件集合** — 提供常见场景的插件示例（Git、Docker、构建监控等）

---

## 五、优先级建议

按"投入产出比"排序，建议的实施顺序：

| 优先级 | 项目 | 预期收益 | 状态 |
|--------|------|---------|------|
| P0 | 皮肤拖拽安装 (3.1.1) | 大幅降低皮肤分发门槛 | ✅ 已完成 |
| P0 | 提示音自定义 (3.1.2) | 个性化核心需求 | ☐ 待实现 |
| P1 | preload 类型化 (2.1) | 提升代码健壮性 | ✅ 已完成 |
| P1 | IPC handler 错误处理 (2.2) | 避免静默失败 | ☐ 待实现 |
| P1 | 皮肤预览动画 (3.3.1) | 提升选择体验 | ✅ 已完成 |
| P2 | 渲染帧率限制 (1.1) | 降低 idle 时 CPU | ✅ 已完成 |
| P2 | 状态历史持久化 (3.2.2) | 工作量化回顾 | ☐ 待实现 |
| P2 | Git/Docker 插件 (3.2.1) | 扩展监控场景 | ☐ 待实现 |
| P2 | 番茄钟 (3.2.1) | 生产力工具 | ✅ 已完成(独立组件) |
| P3 | 宠物互动增强 (3.1.3) | 情感连接 | ☐ 待实现 |
| P3 | 插件开发脚手架 (3.4.1) | 开发者生态 | ☐ 待实现 |

---

*本文档随项目演进持续更新，已完成的优化项可标记为 ✅ 并移至底部归档区。*
