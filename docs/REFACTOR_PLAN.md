# DesktopXPet 架构优化计划

> 本文档为 DesktopXPet 项目的分步优化方案，按优先级排序，可按阶段执行。

---

## 0. 执行前检查

| 项目 | 说明 | 状态 |
|------|------|------|
| 备份当前代码 | 建议在新分支上执行优化 | ☐ |
| TypeScript 编译检查 | `npx tsc --noEmit -p tsconfig.node.json` | ☐ |
| 现有测试（如无测试则跳过） | 确认当前代码可运行 | ☐ |

执行方式（任选其一）：

```bash
# 方式一：创建分支
git checkout -b refactor/phase-1
git add . && git commit -m "save state before refactor"

# 方式二：确认可构建
npm run build     # 或 dev 运行确认无错误
```

---

## 第一阶段：基础设施（高价值 / 低风险）

### 1.1 统一配置中心

**目标**：将 `constants.ts`、`store.ts` 中分散的默认值，集中到一个可复用的 `Config` 对象。

**涉及文件**

- [constants.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/shared/constants.ts)
- [store.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/store.ts)
- [index.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/index.ts)（使用处）

**变更要点**

1. 新建 `src/shared/config.ts`，创建 `Config` 对象：

```typescript
export const Config = {
  app: {
    name: 'DesktopXPet',
    version: '1.0.0'
  },
  window: {
    pet: { width: 220, height: 280 },
    dashboard: { width: 800, height: 600 }
  },
  render: {
    petRenderSize: 128
  },
  api: {
    port: 9527,
    pushTtl: 60000
  },
  monitoring: {
    defaultPollInterval: 30000,
    shutdownTimeout: 5000
  }
} as const;

export type ConfigType = typeof Config;
```

2. 在 `constants.ts` 中替换掉硬编码常量，改为导出自 `Config`：

```typescript
import { Config } from './config';

export const APP_NAME = Config.app.name;
export const API_PORT = Config.api.port;
export const PET_WINDOW_WIDTH = Config.window.pet.width;
// ... 其他常量保持兼容
```

3. 在 `src/shared/constants.ts` 的 `DEFAULT_SETTINGS` 中引用 `Config`（替换当前 30_000 等魔数）。

**验收标准**

- `npm run build` 通过
- 所有原 `constants.ts` 的使用点无需改动（保持兼容导出）

---

### 1.2 统一日志工具

**目标**：为每个模块添加 `scope` 字段，便于定位问题来源。

**涉及文件**

- [store.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/store.ts)
- [window.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/window.ts)
- [monitor/index.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/monitor/index.ts)
- [monitor/registry.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/monitor/registry.ts)
- [plugins/system.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/plugins/system.ts)

**变更要点**

1. 新建 `src/main/utils/logger.ts`：

```typescript
import log from 'electron-log/main';

log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.console.level = 'debug';

export function createLogger(scope: string) {
  return {
    info: (message: string, ...args: unknown[]) =>
      log.info(`[${scope}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      log.warn(`[${scope}] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      log.error(`[${scope}] ${message}`, ...args),
    debug: (message: string, ...args: unknown[]) =>
      log.debug(`[${scope}] ${message}`, ...args)
  };
}
```

2. 逐个替换各模块中 `import log from 'electron-log/main'`：

```typescript
// 替换前
import log from 'electron-log/main';

// 替换后
import { createLogger } from './utils/logger';
const log = createLogger('MonitorService');
```

3. 所有模块替换完毕后，`src/main/index.ts` 中顶层日志配置可删除（由 `logger.ts` 统一管理）。

**验收标准**

- 运行后日志输出包含 `[模块名]` 前缀
- `npm run build` 通过

---

## 第二阶段：架构解耦（中价值 / 中风险）

### 2.1 应用容器（AppContainer）

**目标**：消除 `src/main/index.ts` 中顶层可变变量，统一管理服务实例。

**涉及文件**

- [index.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/index.ts)

**状态**：✅ 已完成。`container.ts` 已实现,所有服务通过 `container.register` / `container.get` 管理。

**变更要点**

1. 新建 `src/main/container.ts`：

```typescript
import type { PetWindowManager } from './window';
import type { PluginRegistry } from './monitor/registry';
import type { MonitorService } from './monitor/index';
import type { PetAPIServer } from './server/api';
import type { SkinLoader } from './skin-loader';

export interface AppServices {
  petWindow: PetWindowManager;
  pluginRegistry: PluginRegistry;
  monitorService: MonitorService;
  apiServer: PetAPIServer;
  skinLoader: SkinLoader;
}

class Container {
  private services: Partial<AppServices> = {};

  register<K extends keyof AppServices>(key: K, service: AppServices[K]): void {
    this.services[key] = service;
  }

  get<K extends keyof AppServices>(key: K): AppServices[K] | undefined {
    return this.services[key];
  }
}

export const container = new Container();
```

2. 在 `bootstrap.ts` 中，每个服务创建后调用 `container.register()`：

```typescript
// 例如创建 PetWindowManager 后：
petWindow = new PetWindowManager();
petWindow.create();
petWindow.setupClickThrough();
container.register('petWindow', petWindow);
```

3. IPC 处理器（例如 `setupIPC` 内部）可通过 `container.get('monitorService')` 获取服务，而不是依赖顶层变量。

**验收标准**

- ✅ 移除 `index.ts` 中顶层 `let petWindow / pluginRegistry / ...` 声明
- ✅ IPC 处理器从 `container` 获取服务
- ✅ `npm run build` 通过

---

### 2.2 shutdown 重构

**目标**：用声明式任务列表替代串行 `try/catch` 块。

**涉及文件**

- [bootstrap.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/bootstrap.ts) 的 `gracefulShutdown()`

**状态**：✅ 已完成。声明式任务列表已实现,并添加了 `savePositionNow()` 同步保存防止位置丢失。

**变更要点**

```typescript
async function gracefulShutdown(): Promise<void> {
  log.info('DesktopXPet: shutting down...');

  const tasks: Array<{ name: string; fn: () => unknown }> = [
    { name: 'Monitor service', fn: () => container.get('monitorService')?.stopAll() },
    { name: 'API server',      fn: () => container.get('apiServer')?.stop() },
    { name: 'Plugins',         fn: () => container.get('pluginRegistry')?.disposeAll() },
    { name: 'Position',        fn: () => container.get('petWindow')?.savePositionNow() },
    { name: 'Shortcuts',       fn: () => unregisterGlobalShortcuts() },
    { name: 'Tray',            fn: () => destroyTray() }
  ];

  for (const task of tasks) {
    try {
      await task.fn();
      log.info(`  ✓ ${task.name} stopped`);
    } catch (e) {
      log.error(`  ✗ ${task.name} stop failed:`, e);
    }
  }

  log.info('DesktopXPet: shutdown complete');
}
```

**验收标准**

- ✅ 关闭时日志格式统一，某一任务失败不阻塞后续
- ✅ `npm run build` 通过

---

## 第三阶段：类型与状态管理（中价值 / 低风险）

### 3.1 皮肤枚举与强类型

**目标**：将 `availableSkins` 改为枚举，避免字符串魔法值。

**涉及文件**

- [index.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/index.ts)
- [App.tsx](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/renderer/App.tsx)
- [appStore.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/renderer/stores/appStore.ts)

**状态**：✅ 已完成。`src/shared/skins.ts` 已导出 `BUILTIN_SKINS` 常量。

**变更要点**

1. 新建 `src/shared/skins.ts`：

```typescript
export const BUILTIN_SKINS = [
  'default-cat',
  'butterfly-swordsman',
  'chibi-girl'
] as const;

export type BuiltinSkinName = typeof BUILTIN_SKINS[number];
export type SkinName = BuiltinSkinName | string;
```

2. 在 `index.ts` 中替换 `availableSkins` 为从 `skins.ts` 导入的 `BUILTIN_SKINS`。

3. 在 `appStore.ts` 中 `currentSkin` 的默认值从 `'default-cat'` 改为使用 `BUILTIN_SKINS[0]`。

**验收标准**

- 皮肤切换逻辑可通过类型检查
- `npm run build` / `npx tsc --noEmit -p tsconfig.web.json` 均通过

---

### 3.2 Zustand store 增强

**目标**：把 `monitorStatus` 实际用起来，并拆分状态便于组件独立订阅。

**涉及文件**

- [appStore.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/renderer/stores/appStore.ts)
- [App.tsx](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/renderer/App.tsx)

**变更要点**

```typescript
interface AppState {
  petState: PetState;
  tools: MonitorStatus[];
  summary: string;
  currentSkin: string;
  showBubble: boolean;

  setPetState: (state: PetState) => void;
  setMonitorData: (data: AggregatedStatus) => void;
  setCurrentSkin: (skin: string) => void;
  setSummary: (summary: string) => void;
  setShowBubble: (show: boolean) => void;

  hasError: boolean;
  isWorking: boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  petState: 'idle',
  tools: [],
  summary: 'DesktopXPet 待机中',
  currentSkin: 'default-cat',
  showBubble: true,

  setPetState: (state) => set({ petState: state }),
  setMonitorData: (data) => set({
    tools: data.tools,
    summary: data.summary,
    petState: data.petState
  }),
  setCurrentSkin: (skin) => set({ currentSkin: skin }),
  setSummary: (summary) => set({ summary }),
  setShowBubble: (show) => set({ showBubble: show }),

  get hasError() {
    return get().tools.some((t) => t.status === 'error');
  },
  get isWorking() {
    return get().tools.some((t) => t.status === 'working');
  }
}));
```

然后在 `App.tsx` 中用 `setMonitorData(data)` 替代分散的 `setPetState` + `setSummary`。

**验收标准**

- Dashboard / StatusBubble 可直接读取 `tools` 而不必监听额外事件
- `npm run build` 通过

---

## 第四阶段：性能与扩展性（低价值 / 中风险）

### 4.1 皮肤缓存

**目标**：避免每次皮肤切换都重新读取 manifest。

**涉及文件**

- [skin-loader.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/skin-loader.ts)（若尚未导出 `getSkinList` 的实现请检查）

**变更要点**

在 `SkinLoader` 内添加缓存：

```typescript
private manifestCache = new Map<string, unknown>();

clearCache(): void {
  this.manifestCache.clear();
}
```

调用 `getSkinList()` 时优先读缓存。

**验收标准**

- 皮肤切换第二次起，日志中不再出现重复的 "read skin image"
- `npm run build` 通过

---

### 4.2 插件动态轮询间隔

**目标**：允许插件根据自身状态调整轮询间隔（例如长时间 idle 可以放缓）。

**涉及文件**

- [types.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/shared/types.ts) 的 `MonitorPlugin` 接口
- [monitor/index.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/monitor/index.ts) 的 `startPlugin`

**变更要点**

```typescript
// types.ts
export interface MonitorPlugin {
  name: string;
  icon: string;
  pollInterval: number;
  minPollInterval?: number;
  maxPollInterval?: number;
  adjustPollInterval?(lastStatus: MonitorStatus): number;
  init?(config: Record<string, unknown>): Promise<void>;
  fetchStatus(): Promise<MonitorStatus>;
  dispose?(): Promise<void>;
}

// monitor/index.ts 的 startPlugin 中使用 plugin.adjustPollInterval?.() 返回的值
```

**验收标准**

- 可选：为 `SystemMonitorPlugin` 实现 `adjustPollInterval` 作为示例
- `npm run build` 通过

---

## 第五阶段：可观测性（低价值 / 低风险）

### 5.1 IPC 超时与统一返回结构

**目标**：防止 IPC handler 挂死，统一成功/失败返回格式。

**涉及文件**

- [ipc-handlers.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/ipc-handlers.ts) 的 `setupIPC`

**状态**：✅ 已完成。`withTimeout` 工具已实现并应用于 `SKIN_READ_IMAGE` 等关键 handler。

**变更要点**

```typescript
type IPCResult<T> = { success: true; data: T } | { success: false; error: string };

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = 5000
): Promise<IPCResult<T>> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('IPC timeout')), timeoutMs)
  );
  try {
    const data = await Promise.race([fn(), timeout]);
    return { success: true, data };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error };
  }
}
```

在 `ipcMain.handle()` 中使用 `withTimeout(...)` 包装执行体。

**验收标准**

- IPC 调用不会无限阻塞
- `npm run build` 通过

---

## 总执行顺序建议

```
阶段 1：统一配置 → 统一日志    （约 1-2 小时）
阶段 2：AppContainer → shutdown 重构   （约 1-2 小时）
阶段 3：皮肤枚举 → Store 增强  （约 1 小时）
阶段 4：皮肤缓存 → 动态轮询    （可选，约 1-2 小时）
阶段 5：IPC 超时               （可选，约 30 分钟）
```

每个阶段完成后，至少执行一次以下命令确认无回归：

```bash
npx tsc --noEmit -p tsconfig.node.json    # main 进程类型检查
npx tsc --noEmit -p tsconfig.web.json     # renderer 类型检查
npm run build                              # 完整构建
```

---

## 参考链接

- 主入口：[index.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/index.ts)
- 监控服务：[monitor/index.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/monitor/index.ts)
- 插件注册：[monitor/registry.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/monitor/registry.ts)
- 系统插件：[plugins/system.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/plugins/system.ts)
- 窗口管理：[window.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/main/window.ts)
- 渲染入口：[App.tsx](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/renderer/App.tsx)
- 状态管理：[appStore.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/renderer/stores/appStore.ts)
- 共享类型：[types.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/shared/types.ts)
- IPC 通道：[ipc-channels.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/shared/ipc-channels.ts)
- 全局常量：[constants.ts](file:///d:/WORK_VSCODE/Vibe-coding/DesktopXPet/src/shared/constants.ts)
