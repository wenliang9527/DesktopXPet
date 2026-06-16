## DesktopXPet - 详细实施指南

本文档是 PLAN.md 的细化补充，包含每个阶段的具体任务拆分、技术方案、数据流设计和验收标准。

---

### 一、多窗口策略

应用包含两种窗口模式，通过同一个 Electron 进程管理：

```
┌─────────────────────────┐     ┌──────────────────────────────┐
│  Pet Window（宠物窗口）   │     │  Dashboard Window（仪表盘）   │
│                         │     │                              │
│  - 透明无边框            │     │  - 常规窗口                   │
│  - 始终置顶              │     │  - 非置顶                     │
│  - 尺寸: 200x260px      │     │  - 尺寸: 800x600px           │
│  - 可拖拽               │     │  - 双击宠物或托盘菜单打开       │
│  - 宠物 + 状态气泡       │     │  - 详细图表、设置、皮肤管理     │
│                         │     │                              │
│  常驻运行                │     │  按需打开/关闭                 │
└─────────────────────────┘     └──────────────────────────────┘
         │                                │
         └──────── IPC 共享同一状态 ────────┘
```

关键点：宠物窗口需要设置 `setIgnoreMouseEvents(false)` 让角色可交互，同时窗口背景完全透明，只有像素角色区域响应鼠标事件。通过 `webContents.setWindowOpenHandler` 阻止意外弹窗。

#### 窗口穿透（Click-Through）实现

桌面宠物的核心难点：窗口透明区域不能拦截鼠标事件（否则无法点击桌面上的东西），但角色区域必须可交互。

```typescript
// src/main/window.ts — 窗口穿透核心逻辑

import { screen } from 'electron';

class PetWindowManager {
  private win: BrowserWindow;
  private isHoveringPet = false;

  setupClickThrough() {
    // 1. 初始设置：忽略所有鼠标事件，但 forward:true 保留 mousemove 事件
    this.win.setIgnoreMouseEvents(true, { forward: true });

    // 2. 监听 mousemove，检测鼠标下方是否是角色的不透明像素
    this.win.webContents.on('cursor-changed', (_, type) => {
      // 当鼠标从角色区域移出到透明区域时，自动穿透
    });

    // 3. 渲染进程通过 IPC 报告鼠标是否在角色上方
    ipcMain.on('pet:hover-state', (_, hovering: boolean) => {
      if (hovering !== this.isHoveringPet) {
        this.isHoveringPet = hovering;
        if (hovering) {
          // 鼠标在角色上 → 不穿透，可交互
          this.win.setIgnoreMouseEvents(false);
        } else {
          // 鼠标在透明区域 → 穿透
          this.win.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    });
  }
}
```

```typescript
// 渲染进程侧 — useClickThrough.ts
// 关键优化：节流处理，每 50ms 最多检测一次，防止高频 mousemove 阻塞渲染

function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

function useClickThrough(canvasRef: RefObject<HTMLCanvasElement>) {
  const checkPixel = useCallback(throttle((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    window.desktopXPet.setHoverState(pixel[3] > 0);  // alpha > 0 = 角色区域
  }, 50), []);  // 50ms 节流

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    checkPixel(x, y);
  }, [checkPixel]);

  return { handleMouseMove };
}
```

#### DPI 缩放处理

保持窗口尺寸固定（200x260 逻辑像素），让 Electron 自动处理 DPI 缩放。Canvas 内部用 `devicePixelRatio` 做物理像素渲染，保证高 DPI 下图像清晰：

```typescript
// src/main/window.ts — 窗口尺寸使用逻辑像素（不乘以 scale）
function createPetWindow() {
  const win = new BrowserWindow({
    width: 200,
    height: 260,
    // Electron 会自动处理 DPI 缩放，不需要手动乘以 scaleFactor
    // ...其他配置
  });
}

// renderer 侧 — PetCanvas.tsx 中已处理 DPI（见五、精灵图动画引擎）
// canvas.width = logicalSize * devicePixelRatio
// canvas.style.width = logicalSize + 'px'
// ctx.scale(dpr, dpr)
```

#### 右键上下文菜单

右键点击宠物弹出菜单，是用户最常用的操作入口：

```typescript
// src/main/tray.ts — 宠物右键菜单

import { Menu, MenuItem } from 'electron';

function createPetContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '📊 打开仪表盘',
      click: () => openDashboardWindow(),
    },
    { type: 'separator' },
    {
      label: '🎨 切换皮肤',
      submenu: buildSkinSubmenu(),  // 动态列出所有可用皮肤
    },
    {
      label: '⚙️ 设置',
      click: () => openSettingsInDashboard(),
    },
    { type: 'separator' },
    {
      label: '📌 置顶',
      type: 'checkbox',
      checked: true,
      click: (item) => toggleAlwaysOnTop(item.checked),
    },
    {
      label: '🔔 通知',
      type: 'checkbox',
      checked: true,
      click: (item) => toggleNotifications(item.checked),
    },
    { type: 'separator' },
    {
      label: '🔄 重置位置',
      click: () => resetPetPosition(),  // 回到屏幕右下角
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => gracefulShutdown(),
    },
  ]);
}

// 在 PetCanvas 中监听右键
// renderer 侧:
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.desktopXPet.showContextMenu();
});
```

#### 系统托盘 Tooltip

鼠标悬停托盘图标时，实时显示当前状态摘要，成本低但体验提升明显：

```typescript
// src/main/tray.ts — 托盘 Tooltip
import { Tray } from 'electron';

function setupTray(tray: Tray, monitorService: MonitorService) {
  // 初始化 tooltip
  tray.setToolTip('DesktopXPet — 待机中');

  // 监听状态变更，更新 tooltip
  monitorService.on('status-changed', (status: AggregatedStatus) => {
    const lines = status.tools.map(t => `${t.tool}: ${t.summary}`);
    const tooltip = `DesktopXPet\n${lines.join('\n')}`;
    // Windows tooltip 有 128 字符限制，超长时截断
    tray.setToolTip(tooltip.slice(0, 127));
  });
}
```

#### 全局快捷键

```typescript
// src/main/shortcuts.ts

import { globalShortcut } from 'electron';

function registerGlobalShortcuts() {
  // 显示/隐藏宠物
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (petWindow.isVisible()) {
      petWindow.hide();
    } else {
      petWindow.show();
    }
  });

  // 打开仪表盘
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    openDashboardWindow();
  });

  // 快速切换下一个皮肤
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    cycleNextSkin();
  });
}

// 应用退出时注销快捷键
function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
```

---

### 二、数据流设计

```
外部工具/API/日志
       │
  ┌────┴────────────────────────────┐
  │                                 │
  ▼                                 ▼
┌──────────────────┐     ┌──────────────────┐
│  Plugin.fetch()  │     │  PetAPIServer    │  ← Push 模式
│  (Poll 轮询)     │     │  localhost:9527   │     HTTP API / CLI
└────────┬─────────┘     └────────┬─────────┘
         │ MonitorStatus          │ PushStatus
         ▼                        ▼
┌─────────────────────────────────────────┐
│  MonitorService                         │
│  - 汇总 Poll 和 Push 两路数据           │
│  - 计算聚合状态                           │
│  - Push 数据有 TTL（60秒过期）            │
└────────┬────────────────────────────────┘
         │ AggregatedStatus
         ▼
┌──────────────────┐
│  electron-store  │  持久化历史数据（每日统计）
└────────┬─────────┘
         │  IPC: 'monitor:status-update'
         ▼
┌──────────────────┐
│  Zustand Store   │  渲染进程状态管理
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
 PetEngine  Dashboard UI
 (状态机)    (图表/卡片)
```

**多窗口状态同步机制：**

应用采用"主进程持有权威状态，渲染进程订阅更新"的模式。两个窗口（Pet Window、Dashboard Window）各自维护独立的 Zustand store，但数据来源相同。

```typescript
// 主进程 — MonitorService 持有最新聚合状态
class MonitorService {
  private latestStatus: AggregatedStatus | null = null;

  // Dashboard 窗口打开时，通过 IPC 拉取当前快照
  async getSnapshot(): Promise<AggregatedStatus> {
    if (!this.latestStatus) {
      // 首次请求，立即聚合一次
      this.latestStatus = await this.aggregateAll();
    }
    return this.latestStatus;
  }

  // 每次状态变更后，推送给所有窗口
  private emitUpdate() {
    this.latestStatus = aggregateStatus([...]);
    // 向所有渲染进程推送（pet window + dashboard window）
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(IPC.MONITOR_STATUS_UPDATE, this.latestStatus);
    });
  }
}
```

```typescript
// Dashboard 窗口 — 打开时先拉快照，再监听增量更新
function useDashboardStatus() {
  const [status, setStatus] = useState<AggregatedStatus | null>(null);

  useEffect(() => {
    // 1. 打开时拉取一次完整快照
    window.desktopXPet.getStatusSnapshot().then(setStatus);

    // 2. 之后监听增量推送
    window.desktopXPet.onStatusUpdate((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  return status;
}
```

关键点：Dashboard 窗口的 Zustand store 和 Pet 窗口的 store 是**各自独立的实例**（不同窗口的 JS context 互不共享），但都订阅同一个 IPC channel `monitor:status-update`，所以状态始终保持一致。

**Push 数据合并逻辑：**

```typescript
// MonitorService 中处理 Push 推送
class MonitorService {
  private pushCache: Map<string, { data: PushStatus; expiresAt: number }> = new Map();

  // HTTP API / CLI 推送数据时调用
  handlePush(push: PushStatus) {
    this.pushCache.set(push.tool, {
      data: push,
      expiresAt: Date.now() + 60_000,  // Push 数据 60 秒过期
    });
    this.emitUpdate();  // 立即触发一次状态聚合
  }

  // 聚合时合并 Poll + Push
  async aggregateAll(): Promise<AggregatedStatus> {
    const pollStatuses = await Promise.all(
      this.enabledPlugins.map(p => p.fetchStatus())
    );

    // 合并 Push 数据（未过期的）
    const now = Date.now();
    const pushStatuses: MonitorStatus[] = [];
    for (const [tool, cached] of this.pushCache) {
      if (cached.expiresAt > now) {
        // 如果 Poll 已经有该工具的数据，Push 优先
        const existing = pollStatuses.findIndex(s => s.tool === tool);
        const status: MonitorStatus = {
          tool: cached.data.tool,
          status: cached.data.status,
          summary: cached.data.summary,
          details: cached.data.details,
          timestamp: now,
        };
        if (existing >= 0) {
          pollStatuses[existing] = status;  // Push 覆盖 Poll
        } else {
          pushStatuses.push(status);
        }
      }
    }

    return aggregateStatus([...pollStatuses, ...pushStatuses]);
  }
}
```

**状态聚合规则：**

```typescript
// MonitorService 中的聚合逻辑
function aggregateStatus(allStatuses: MonitorStatus[]): AggregatedStatus {
  // 优先级: error > working > completed > idle
  const hasError = allStatuses.some(s => s.status === 'error');
  const isWorking = allStatuses.some(s => s.status === 'working');
  const hasCompleted = allStatuses.some(
    s => s.status === 'completed' && Date.now() - s.timestamp < 30_000  // 30秒内完成
  );

  let petState: PetState;
  if (hasError)     petState = 'error';
  else if (isWorking) petState = 'working';
  else if (hasCompleted) petState = 'happy';
  else            petState = 'idle';

  return {
    petState,
    tools: allStatuses,
    summary: buildSummary(allStatuses),
  };
}
```

---

### 三、IPC 通道设计

采用 Electron 的 contextBridge + ipcMain/ipcRenderer 模式，确保安全性：

```typescript
// src/shared/ipc-channels.ts — 统一通道定义

export const IPC = {
  // 监控数据
  MONITOR_STATUS_UPDATE: 'monitor:status-update',  // Main → Renderer，推送模式
  MONITOR_GET_SNAPSHOT:  'monitor:get-snapshot',   // Renderer → Main，拉取当前状态快照（Dashboard 打开时用）

  // 宠物控制（Renderer → Main）
  PET_SET_POSITION:     'pet:set-position',      // 保存拖拽后的位置
  PET_GET_POSITION:     'pet:get-position',       // 获取上次保存的位置
  PET_HOVER_STATE:      'pet:hover-state',        // 报告鼠标是否在角色不透明区域（穿透控制）
  PET_SHOW_CONTEXT_MENU:'pet:context-menu',       // 显示右键菜单

  // 插件管理（双向）
  PLUGIN_LIST:          'plugin:list',            // 获取已安装插件
  PLUGIN_TOGGLE:        'plugin:toggle',          // 启用/禁用插件
  PLUGIN_CONFIG:        'plugin:config',          // 更新插件配置

  // 皮肤管理（双向）
  SKIN_LIST:            'skin:list',              // 获取可用皮肤
  SKIN_SWITCH:          'skin:switch',            // 切换皮肤
  SKIN_LOAD:            'skin:load',              // 加载皮肤资源

  // 应用控制
  APP_OPEN_DASHBOARD:   'app:open-dashboard',     // 打开仪表盘窗口
  APP_QUIT:             'app:quit',               // 退出应用（触发优雅退出流程）
  APP_GET_STORE:        'app:get-store',          // 读取设置
  APP_SET_STORE:        'app:set-store',          // 写入设置
} as const;
```

**Preload 脚本暴露的安全 API：**

```typescript
// src/preload/index.ts
contextBridge.exposeInMainWorld('desktopXPet', {
  // 事件监听（Main → Renderer）
  onStatusUpdate: (callback: (status: AggregatedStatus) => void) => {
    ipcRenderer.on(IPC.MONITOR_STATUS_UPDATE, (_, data) => callback(data));
  },
  getStatusSnapshot: () =>
    ipcRenderer.invoke(IPC.MONITOR_GET_SNAPSHOT),  // Dashboard 打开时拉取当前快照

  // 操作调用（Renderer → Main）
  setPosition: (x: number, y: number) =>
    ipcRenderer.invoke(IPC.PET_SET_POSITION, { x, y }),
  getPosition: () =>
    ipcRenderer.invoke(IPC.PET_GET_POSITION),
  setHoverState: (hovering: boolean) =>
    ipcRenderer.send(IPC.PET_HOVER_STATE, hovering),   // send 而非 invoke（高频调用，无需返回值）
  showContextMenu: () =>
    ipcRenderer.invoke(IPC.PET_SHOW_CONTEXT_MENU),
  openDashboard: () =>
    ipcRenderer.invoke(IPC.APP_OPEN_DASHBOARD),
  getPluginList: () =>
    ipcRenderer.invoke(IPC.PLUGIN_LIST),
  togglePlugin: (name: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC.PLUGIN_TOGGLE, { name, enabled }),
  getSkinList: () =>
    ipcRenderer.invoke(IPC.SKIN_LIST),
  switchSkin: (name: string) =>
    ipcRenderer.invoke(IPC.SKIN_SWITCH, name),
  getSettings: () =>
    ipcRenderer.invoke(IPC.APP_GET_STORE),
  setSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC.APP_SET_STORE, settings),
  quit: () =>
    ipcRenderer.invoke(IPC.APP_QUIT),
});
```

---

### 四、配置存储结构

```typescript
// electron-store 的 schema 定义
interface AppSettings {
  // 宠物窗口
  pet: {
    position: { x: number; y: number } | null;  // null = 屏幕右下角默认位置
    scale: number;           // 显示缩放比例，默认 2
    alwaysOnTop: boolean;    // 是否置顶，默认 true
    clickSound: boolean;     // 点击音效，默认 true
  };

  // 行为
  behavior: {
    sleepAfterMinutes: number;   // 无操作多久后睡眠，默认 15
    showNotifications: boolean;  // 系统通知，默认 true
    showBubble: boolean;         // 状态气泡，默认 true
    bubblePosition: 'top' | 'bottom';  // 气泡位置，默认 bottom
  };

  // 监控
  monitor: {
    defaultPollInterval: number;  // 默认轮询间隔（ms），默认 30000
    plugins: Record<string, {
      enabled: boolean;
      config: Record<string, any>;  // 各插件自己的配置
    }>;
  };

  // 皮肤
  skin: {
    current: string;           // 当前皮肤名，默认 'default-cat'
    customSkinDirs: string[];  // 自定义皮肤目录路径
  };

  // 通用
  general: {
    autoStart: boolean;     // 开机自启，默认 false
    language: 'zh-CN' | 'en';  // 语言
    theme: 'auto' | 'light' | 'dark';  // 仪表盘主题
  };
}
```

---

### 五、精灵图动画引擎技术方案

**核心实现思路：**

```typescript
// SpriteAnimator — 纯逻辑类，不绑定 DOM
// 关键优化：delta clamp 防止标签页不可见时 raf 停止导致的动画跳帧

class SpriteAnimator {
  private image: HTMLImageElement;
  private frameWidth: number;
  private frameHeight: number;
  private currentFrame: number = 0;
  private frameCount: number;
  private fps: number;
  private loop: boolean;
  private lastTick: number = 0;
  private playing: boolean = false;
  private onFinish?: () => void;

  constructor(image: HTMLImageElement, config: AnimationConfig) {
    this.image = image;
    this.frameWidth = config.frameSize.width;
    this.frameHeight = config.frameSize.height;
    this.frameCount = config.frames;
    this.fps = config.fps;
    this.loop = config.loop;
  }

  // 每帧调用，返回当前帧的裁剪坐标
  tick(timestamp: number): SpriteFrame {
    const interval = 1000 / this.fps;
    const delta = timestamp - this.lastTick;
    // 关键：限制最大 delta 为 200ms，防止标签页隐藏后回来时跳帧
    const clampedDelta = Math.min(delta, 200);

    if (clampedDelta >= interval) {
      this.lastTick = timestamp - (clampedDelta % interval); // 保留余数，保证帧率稳定
      this.currentFrame++;
      if (this.currentFrame >= this.frameCount) {
        if (this.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.frameCount - 1;
          this.playing = false;
          this.onFinish?.();
        }
      }
    }
    return {
      sx: this.currentFrame * this.frameWidth,
      sy: 0,
      sw: this.frameWidth,
      sh: this.frameHeight,
    };
  }
}
```

**PetCanvas 渲染组件（含 DPI 修正）：**

```typescript
// PetCanvas.tsx — 用 Canvas 2D 绘制精灵图，支持高 DPI

function PetCanvas({ skin, state }: { skin: SkinData; state: PetState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animatorRef = useRef<SpriteAnimator | null>(null);
  const rafIdRef = useRef<number>(0);
  const visibleRef = useRef(true);

  useEffect(() => {
    // 状态变化时切换动画
    const anim = skin.animations[state];
    const img = skin.images[state];
    animatorRef.current = new SpriteAnimator(img, anim);
  }, [state, skin]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    // DPI 修正：Canvas 物理像素 = 逻辑像素 × devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const logicalSize = 128;
    canvas.width = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    canvas.style.width = `${logicalSize}px`;
    canvas.style.height = `${logicalSize}px`;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;  // 像素风关键：关闭平滑

    // 窗口可见性监听 — 不可见时暂停 raf 节省 CPU
    const onVisibility = () => {
      visibleRef.current = !document.hidden;
      if (visibleRef.current && !rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const render = (time: number) => {
      if (!visibleRef.current) {
        rafIdRef.current = 0;
        return;  // 停止循环
      }
      const frame = animatorRef.current!.tick(time);
      ctx.clearRect(0, 0, logicalSize, logicalSize);
      ctx.drawImage(
        animatorRef.current!.image,
        frame.sx, frame.sy, frame.sw, frame.sh,
        0, 0, logicalSize, logicalSize
      );
      rafIdRef.current = requestAnimationFrame(render);
    };
    rafIdRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} />;
}
```

关键设置 `imageSmoothingEnabled = false` 保证像素图放大后保持锐利边缘，不产生模糊。

---

### 六、各 Plugin 接入细节

#### 6.1 QoderWork 插件

```typescript
// 数据来源：QoderWork 的 ~/.qoderwork 目录下的日志和配置
class QoderWorkPlugin implements MonitorPlugin {
  name = 'qoderwork';
  pollInterval = 60_000; // 1分钟

  async fetchStatus(): Promise<MonitorStatus> {
    // 方案 A：读取 cron 任务执行日志
    const logDir = path.join(os.homedir(), '.qoderwork', 'cron', 'runlogs');
    const latestLog = await readLatestLog(logDir);

    // 方案 B：读取 QoderWork workspace 的活跃文件
    const workspaces = await glob('~/.qoderwork/workspace/*/');
    const recentActivity = await checkRecentModifications(workspaces);

    return {
      tool: 'QoderWork',
      status: recentActivity.hasRecent ? 'working' : 'idle',
      summary: recentActivity.summary || '无活跃任务',
      details: {
        activeWorkspaces: recentActivity.count,
        lastTask: latestLog?.taskName,
        lastRunStatus: latestLog?.status,
      },
      timestamp: Date.now(),
    };
  }
}
```

#### 6.2 GitHub 插件

```typescript
// 数据来源：GitHub REST API
class GitHubPlugin implements MonitorPlugin {
  name = 'github';
  pollInterval = 300_000; // 5分钟（API 限频考虑）

  async init(config: { token: string; username: string }) {
    this.octokit = new Octokit({ auth: config.token });
    this.username = config.username;
  }

  async fetchStatus(): Promise<MonitorStatus> {
    const today = new Date().toISOString().split('T')[0];

    // 获取今日 commits
    const { data: events } = await this.octokit.activity.listEventsForUser({
      username: this.username,
      per_page: 20,
    });
    const todayCommits = events.filter(
      e => e.type === 'PushEvent' && e.created_at!.startsWith(today)
    );

    // 获取待审 PR
    const { data: prs } = await this.octokit.search.issuesAndPullRequests({
      q: `is:pr author:${this.username} is:open`,
    });

    const activityScore = todayCommits.length + prs.total_count;
    return {
      tool: 'GitHub',
      status: activityScore > 0 ? 'working' : 'idle',
      summary: `今日 ${todayCommits.length} 次提交, ${prs.total_count} 个开放 PR`,
      details: { commits: todayCommits.length, openPRs: prs.total_count },
      timestamp: Date.now(),
    };
  }
}
```

#### 6.3 本地 AI 服务插件（Ollama）

```typescript
// 数据来源：Ollama 本地 REST API
class LocalAIPlugin implements MonitorPlugin {
  name = 'local-ai';
  pollInterval = 15_000; // 15秒（本地服务，频率可高些）

  async fetchStatus(): Promise<MonitorStatus> {
    try {
      // 检查 Ollama 是否在运行
      const models = await fetch('http://localhost:11434/api/tags')
        .then(r => r.json());

      // 检查是否有正在运行的推理
      const ps = await fetch('http://localhost:11434/api/ps')
        .then(r => r.json());

      const runningModels = ps.models || [];
      return {
        tool: 'Ollama',
        status: runningModels.length > 0 ? 'working' : 'idle',
        summary: runningModels.length > 0
          ? `运行中: ${runningModels.map(m => m.name).join(', ')}`
          : `${models.models?.length || 0} 个模型就绪`,
        details: {
          availableModels: models.models?.map(m => m.name),
          runningModels: runningModels.map(m => ({
            name: m.name,
            size: m.size,
            expiresAt: m.expires_at,
          })),
        },
        timestamp: Date.now(),
      };
    } catch {
      return {
        tool: 'Ollama',
        status: 'error',
        summary: 'Ollama 服务未响应',
        timestamp: Date.now(),
      };
    }
  }
}
```

#### 6.4 系统资源监控插件

```typescript
// 数据来源：Node.js os 模块 + 第三方库
class SystemMonitorPlugin implements MonitorPlugin {
  name = 'system';
  pollInterval = 10_000; // 10秒

  async fetchStatus(): Promise<MonitorStatus> {
    const cpuUsage = await getCpuUsage();    // 使用 systeminformation 库
    const memInfo = await getMemInfo();       // os.totalmem() / os.freemem()
    const gpuInfo = await getGpuUsage();      // systeminformation.graphics()

    const cpuPercent = Math.round(cpuUsage);
    const memPercent = Math.round((1 - os.freemem() / os.totalmem()) * 100);

    // CPU > 80% 或内存 > 90% 视为高负载
    const isHighLoad = cpuPercent > 80 || memPercent > 90;

    return {
      tool: 'System',
      status: isHighLoad ? 'working' : 'idle',
      summary: `CPU ${cpuPercent}% | 内存 ${memPercent}%`,
      details: {
        cpu: cpuPercent,
        memory: memPercent,
        gpu: gpuInfo,
        uptime: os.uptime(),
      },
      timestamp: Date.now(),
    };
  }
}
```

推荐依赖：`systeminformation`（npm 包），它封装了跨平台的 CPU/GPU/磁盘/网络监控 API。

---

### 六-B、外部工具连接架构（三种方式）

DesktopXPet 需要接收来自各种 AI 编码工具的状态数据。以下三种方式覆盖不同场景，互为补充。

#### 方式一：本地 HTTP API（推荐主方案 — Push 模式）

DesktopXPet 主进程内嵌一个轻量 HTTP 服务器，监听 `localhost:9527`，接收外部工具推送的状态更新。

**安全机制：** 虽然只监听 localhost，但加入 token 校验防止其他本地进程随意推送数据。Token 在应用启动时随机生成，保存在 electron-store 中，CLI 工具从配置文件读取。

```typescript
// src/main/server/api.ts
import { createServer, IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

class PetAPIServer {
  private server: ReturnType<typeof createServer>;
  private port = 9527;
  private token: string;  // 启动时生成或从 store 读取
  private skinLoader: SkinLoader;

  constructor(store: Store, skinLoader: SkinLoader) {
    this.skinLoader = skinLoader;
    // 首次启动生成 token，后续复用
    this.token = store.get('apiToken') || crypto.randomBytes(16).toString('hex');
    store.set('apiToken', this.token);
  }

  // 暴露 token 给 CLI 工具（写入 ~/.xpet/config.json）
  getApiToken(): string { return this.token; }

  start(onStatus: (data: PushStatus) => void) {
    // 将 token 写入 CLI 配置文件，方便 xpet 命令读取
    this.writeCliConfig();

    this.server = createServer((req, res) => {
      // 不设置 CORS header — CLI (curl/xpet) 不受 CORS 限制，
      // 移除通配符防止恶意网页从浏览器向 localhost 发送请求
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'GET' && req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, version: '1.0.0' }));
        return;
      }

      // 其他接口校验 token
      const reqToken = req.headers['x-pet-token'] as string;
      if (reqToken !== this.token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/status') {
        this.handleStatus(req, res, onStatus);
      } else if (req.method === 'POST' && req.url === '/api/skin') {
        this.handleSkinSwitch(req, res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`DesktopXPet API listening on http://127.0.0.1:${this.port}`);
    });
  }

  // 写入 ~/.xpet/config.json 供 CLI 工具读取
  private writeCliConfig() {
    const configDir = path.join(os.homedir(), '.xpet');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ token: this.token, port: this.port })
    );
  }

  private handleStatus(req: IncomingMessage, res: ServerResponse, onStatus: Function) {
    const MAX_BODY_SIZE = 10 * 1024; // 10KB 限制，防止恶意大请求
    let body = '';
    let oversized = false;

    req.on('data', chunk => {
      if (body.length + chunk.length > MAX_BODY_SIZE) {
        oversized = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (oversized) return;
      try {
        const data: PushStatus = JSON.parse(body);
        onStatus(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  private handleSkinSwitch(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { skin } = JSON.parse(body);
        this.skinLoader.switchSkin(skin);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }
}

interface PushStatus {
  tool: string;              // 工具标识: 'claude-code', 'cursor', 'opencode' 等
  status: 'idle' | 'working' | 'error' | 'completed';
  summary: string;           // 简短描述
  details?: Record<string, any>;
}
```

**各工具对接脚本：**

**Claude Code** — 在项目的 `CLAUDE.md` 或全局配置中注册 hook：

```bash
#!/bin/bash
# ~/.xpet/hooks/claude-code-hook.sh
# Claude Code 的 PreToolUse / PostToolUse hook

ACTION=$1  # "start" or "end"
TOOL_NAME=$2

if [ "$ACTION" = "start" ]; then
  curl -s -X POST http://localhost:9527/api/status \
    -H "Content-Type: application/json" \
    -d "{\"tool\":\"claude-code\",\"status\":\"working\",\"summary\":\"AI 正在使用 $TOOL_NAME\"}"
elif [ "$ACTION" = "end" ]; then
  curl -s -X POST http://localhost:9527/api/status \
    -H "Content-Type: application/json" \
    -d "{\"tool\":\"claude-code\",\"status\":\"completed\",\"summary\":\"$TOOL_NAME 执行完毕\"}"
fi
```

**Cursor / VS Code** — 轻量 VS Code 扩展：

```typescript
// extension.ts — Cursor/VS Code 扩展核心
import * as vscode from 'vscode';
import * as http from 'http';

export function activate(context: vscode.ExtensionContext) {
  // 文件保存事件
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      report('cursor', 'working', `保存 ${doc.fileName.split('/').pop()}`);
    })
  );

  // 编辑器活跃状态（每 30 秒发一次心跳）
  let idleTimer: NodeJS.Timeout;
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      report('cursor', 'working', '正在编辑');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => report('cursor', 'idle', '空闲'), 60_000);
    })
  );
}

function report(tool: string, status: string, summary: string) {
  const data = JSON.stringify({ tool, status, summary });
  const req = http.request({
    hostname: '127.0.0.1', port: 9527,
    path: '/api/status', method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  req.write(data);
  req.end();
}
```

**OpenCode** — 类似 hook 脚本或进程输出监控：

```bash
# 包装 opencode 命令的 wrapper 脚本
#!/bin/bash
# ~/.xpet/bin/opencode-wrapper.sh

curl -s -X POST http://localhost:9527/api/status \
  -H "Content-Type: application/json" \
  -d '{"tool":"opencode","status":"working","summary":"OpenCode 会话开始"}'

opencode "$@"  # 执行真正的 opencode

curl -s -X POST http://localhost:9527/api/status \
  -H "Content-Type: application/json" \
  -d '{"tool":"opencode","status":"completed","summary":"OpenCode 会话结束"}'
```

#### 方式二：文件监控（兜底方案 — Poll 模式）

对于不支持 hook 的工具，DesktopXPet 插件定时扫描其日志/工作目录：

```typescript
// src/main/plugins/file-watcher.ts — 通用文件监控基类
import * as fs from 'fs';
import * as path from 'path';

abstract class FileWatcherPlugin implements MonitorPlugin {
  abstract name: string;
  abstract watchPaths: string[];     // 监控的目录列表
  pollInterval = 30_000;             // 30 秒轮询

  private lastCheck: Record<string, number> = {};

  async fetchStatus(): Promise<MonitorStatus> {
    let latestMod = 0;
    let latestFile = '';

    for (const dir of this.watchPaths) {
      if (!fs.existsSync(dir)) continue;
      const files = await this.scanDir(dir);
      for (const file of files) {
        const stat = fs.statSync(file);
        if (stat.mtimeMs > latestMod) {
          latestMod = stat.mtimeMs;
          latestFile = file;
        }
      }
    }

    const secondsAgo = (Date.now() - latestMod) / 1000;
    const isActive = secondsAgo < 60;  // 1 分钟内有活动

    return {
      tool: this.name,
      status: isActive ? 'working' : 'idle',
      summary: isActive
        ? `${this.name} 最近活动: ${path.basename(latestFile)}`
        : `${this.name} 无近期活动`,
      timestamp: Date.now(),
    };
  }

  protected abstract scanDir(dir: string): Promise<string[]>;
}

// 具体实现示例
class CursorFileWatcher extends FileWatcherPlugin {
  name = 'cursor';
  watchPaths = [
    path.join(os.homedir(), '.cursor', 'logs'),
    path.join(os.homedir(), '.cursor', 'workspaceStorage'),
  ];

  protected async scanDir(dir: string): Promise<string[]> {
    // 只关注最近修改的 .log 和 .json 文件
    return glob('**/*.{log,json}', { cwd: dir, absolute: true });
  }
}
```

#### 方式三：CLI 伴侣工具（xpet 命令行）

随 DesktopXPet 安装时注册的 CLI 工具，让任何终端环境都能一行命令接入：

```typescript
// tools/xpet-cli.ts — 编译为独立可执行文件
#!/usr/bin/env node
import { program } from 'commander';

program
  .name('xpet')
  .description('DesktopXPet CLI — report status from any tool')
  .version('1.0.0');

program
  .command('report')
  .option('-t, --tool <name>', 'Tool identifier', 'unknown')
  .option('-s, --status <status>', 'idle | working | error | completed', 'idle')
  .option('-m, --msg <message>', 'Status summary message', '')
  .option('-p, --port <port>', 'DesktopXPet API port', '9527')
  .action(async (opts) => {
    try {
      const res = await fetch(`http://127.0.0.1:${opts.port}/api/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: opts.tool,
          status: opts.status,
          summary: opts.msg,
        }),
      });
      if (res.ok) {
        console.log('✓ Status reported to DesktopXPet');
      } else {
        console.error('✗ DesktopXPet may not be running');
      }
    } catch {
      console.error('✗ Cannot reach DesktopXPet (is it running?)');
    }
  });

program
  .command('skin')
  .description('Switch pet skin from terminal')
  .argument('<name>', 'Skin name')
  .action(async (name) => {
    const res = await fetch('http://127.0.0.1:9527/api/skin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skin: name }),
    });
    console.log(res.ok ? `✓ Switched to "${name}"` : '✗ Failed');
  });

program.parse();
```

使用示例：

```bash
# 在任意 AI 工具的自定义指令/系统提示词中加一行：
# "每次完成任务后，执行: xpet report -t my-tool -s completed -m '任务完成'"

# 手动测试
xpet report -t claude-code -s working -m "正在重构认证模块"
xpet report -t cursor -s completed -m "PR 已合并"
xpet skin butterfly-swordsman
```

#### 三种方式对比

| 维度 | HTTP API (Push) | 文件监控 (Poll) | CLI 伴侣 |
|------|----------------|----------------|---------|
| 实时性 | 即时 | 延迟 10-30 秒 | 即时 |
| 外部工具需要改动 | 需要配置 hook/脚本 | 不需要 | 需要在指令中添加命令 |
| 适用工具 | Claude Code, Cursor, 任何支持 hook 的工具 | Ollama, 无 hook 的编辑器 | 任何终端 AI 工具 |
| 实现复杂度 | 中 | 低 | 低 |
| 推荐优先级 | ★★★★★ 首选 | ★★★ 兜底 | ★★★★ 补充 |

**实施顺序建议：** Phase 2 先实现 HTTP API + CLI 伴侣（这两个是一体的），再补文件监控作为兜底。

---

### 六-C、皮肤更换方案

#### 四种换肤途径

**1. 内置皮肤库**

应用打包时自带 3-5 套精选皮肤，存储在 `resources/skins/` 目录。用户通过设置面板的皮肤选择器一键切换。这是最简单的方式，保证开箱即用。

```
resources/skins/
├── default-cat/          # 默认橘猫
├── butterfly-swordsman/  # 蝴蝶剑士
├── pixel-robot/          # 像素机器人
├── space-cat/            # 太空猫（未来制作）
└── forest-spirit/        # 森林精灵（未来制作）
```

**2. 本地自定义皮肤目录**

用户可以在设置中指定任意本地文件夹作为皮肤源。DesktopXPet 会扫描该目录下所有符合规范的皮肤包（含 `manifest.json` + 精灵图）。

```typescript
// 设置中的配置项
skin: {
  current: 'butterfly-swordsman',
  customSkinDirs: [
    'D:\\MyPetSkins',                    // 用户自制的皮肤
    'C:\\Users\\xx\\Downloads\\skins',  // 下载的皮肤
  ],
}
```

皮肤作者只需将精灵图和 manifest.json 打包到一个文件夹，用户把文件夹路径加到设置中即可使用。

**3. .xpet 皮肤包（拖拽导入）**

定义 `.xpet` 文件格式（本质是 zip 压缩包），包含完整的皮肤资源。用户可以直接将 `.xpet` 文件拖拽到宠物窗口或设置面板来安装。

```
my-skin.xpet (zip archive)
├── manifest.json
├── idle.png
├── working.png
├── happy.png
├── sleeping.png
└── error.png
```

```typescript
// 拖拽导入逻辑
window.addEventListener('drop', async (e) => {
  const files = e.dataTransfer?.files;
  if (!files) return;

  for (const file of Array.from(files)) {
    if (file.name.endsWith('.xpet')) {
      // 解压到用户皮肤目录
      const targetDir = path.join(app.getPath('userData'), 'skins', skinName);
      await extractZip(file.path, targetDir);
      await skinManager.reload();
      showNotification(`已安装皮肤: ${skinName}`);
    }
  }
});
```

**4. AI 生成皮肤（进阶功能）**

在设置面板中集成 AI 皮肤生成器。用户输入描述（如"赛博朋克猫"），应用调用图像生成 API 生成像素风精灵图，自动打包为皮肤。

```typescript
// 概念设计 — Phase 4+ 实现
class SkinGenerator {
  async generate(prompt: string): Promise<SkinPack> {
    // 1. 调用图像生成 API（如 DALL-E / Stable Diffusion）
    //    prompt 模板: "pixel art sprite sheet, 64x64, {user_prompt}, 4 frames"
    const imageUrls = await this.generateImages(prompt);

    // 2. 后处理：裁切为精灵图帧、调色、二值化为像素风格
    const sprites = await this.postProcess(imageUrls);

    // 3. 生成 manifest.json
    const manifest = this.buildManifest(prompt, sprites);

    // 4. 保存为皮肤包
    return this.saveSkinPack(prompt, sprites, manifest);
  }
}
```

#### 推荐方案

**Phase 1-3 使用方式 1 + 2**（内置 + 本地目录），简单可靠。
**Phase 4 加入方式 3**（.xpet 拖拽导入），方便分享和分发。
**长期路线加入方式 4**（AI 生成），作为差异化功能亮点。

核心皮肤加载逻辑是统一的，不管皮肤来自哪里，最终都走同一个 `SkinLoader`：

```typescript
// src/main/skin-loader.ts — 统一皮肤加载器
class SkinLoader {
  private skinDirs: string[] = [];
  private loadedSkins: Map<string, SkinData> = new Map();

  // 添加皮肤源目录
  addDirectory(dir: string) {
    this.skinDirs.push(dir);
  }

  // 扫描所有目录，加载皮肤
  async scan(): Promise<SkinInfo[]> {
    this.loadedSkins.clear();
    const skins: SkinInfo[] = [];

    for (const dir of this.skinDirs) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(dir, entry.name, 'manifest.json');
        if (!fs.existsSync(manifestPath)) continue;

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const skin = await this.loadSkin(dir, entry.name, manifest);
        this.loadedSkins.set(manifest.name, skin);
        skins.push({ name: manifest.name, author: manifest.author, preview: skin.preview });
      }
    }
    return skins;
  }

  // 热切换皮肤（不需要重启）
  async switchSkin(name: string): Promise<SkinData> {
    const skin = this.loadedSkins.get(name);
    if (!skin) throw new Error(`Skin "${name}" not found`);
    return skin;  // 渲染进程收到后更新 PetCanvas
  }
}
```

---

### 六-D、优雅退出与资源清理

应用退出时需要有序地关闭所有组件，防止数据丢失或资源泄漏：

```typescript
// src/main/index.ts — 应用退出流程
// 关键：try-catch + 超时保护，防止 gracefulShutdown 抛异常导致应用无法退出

import { app, BrowserWindow } from 'electron';

const SHUTDOWN_TIMEOUT = 5000; // 5 秒超时强制退出

async function gracefulShutdown() {
  console.log('DesktopXPet: shutting down...');

  try {
    // 1. 停止所有插件定时器
    monitorService.stopAll();
    console.log('  ✓ Plugins stopped');
  } catch (e) { console.error('  ✗ Plugin stop failed:', e); }

  try {
    // 2. 关闭 HTTP API 服务器
    await apiServer.stop();
    console.log('  ✓ API server stopped');
  } catch (e) { console.error('  ✗ API server stop failed:', e); }

  try {
    // 3. 保存当前状态（窗口位置、当前皮肤等）
    store.set('pet.position', petWindow.getBounds());
    store.set('skin.current', skinManager.currentSkin);
    console.log('  ✓ State saved');
  } catch (e) { console.error('  ✗ State save failed:', e); }

  try {
    // 4. 注销全局快捷键
    globalShortcut.unregisterAll();
    console.log('  ✓ Shortcuts unregistered');
  } catch (e) { console.error('  ✗ Shortcut unregister failed:', e); }

  try {
    // 5. 销毁窗口
    BrowserWindow.getAllWindows().forEach(w => w.destroy());
    console.log('  ✓ Windows destroyed');
  } catch (e) { console.error('  ✗ Window destroy failed:', e); }

  // 6. 退出进程
  app.exit(0);
}

// 超时保护：如果 gracefulShutdown 超过 5 秒未完成，强制退出
let shutdownTimer: NodeJS.Timeout;
function shutdownWithTimeout() {
  shutdownTimer = setTimeout(() => {
    console.error('DesktopXPet: shutdown timed out, force exit');
    app.exit(1);
  }, SHUTDOWN_TIMEOUT);
  gracefulShutdown().finally(() => clearTimeout(shutdownTimer));
}

// 监听多种退出信号
app.on('before-quit', (e) => {
  e.preventDefault();
  shutdownWithTimeout();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    shutdownWithTimeout();
  }
});

process.on('SIGINT', shutdownWithTimeout);
process.on('SIGTERM', shutdownWithTimeout);
```

**插件定时器清理：**

```typescript
// MonitorService.stopAll()
stopAll() {
  for (const timer of this.timers.values()) {
    clearInterval(timer);
  }
  this.timers.clear();

  // 调用每个插件的 dispose
  for (const plugin of this.enabledPlugins) {
    plugin.dispose?.();
  }
}
```

**皮肤内存释放：**

```typescript
// SkinLoader — 切换皮肤时释放旧资源
async switchSkin(name: string): Promise<SkinData> {
  const oldSkin = this.currentSkin;
  const newSkin = this.loadedSkins.get(name);
  if (!newSkin) throw new Error(`Skin "${name}" not found`);

  this.currentSkin = newSkin;

  // 释放旧皮肤的 Image 对象引用（GC 会自动回收）
  if (oldSkin && oldSkin !== newSkin) {
    for (const key of Object.keys(oldSkin.images)) {
      (oldSkin.images[key] as any) = null;
    }
  }

  return newSkin;
}
```

---

### 六-E、素材资源规范

**系统托盘图标：**

需要制作一个 16x16 或 32x32 的小图标，用于系统托盘显示。建议从宠物角色的 idle 帧中提取简化版头像。

```
resources/
├── icons/
│   ├── tray-icon.png        # 32x32 PNG，托盘图标（所有平台通用）
│   ├── tray-icon.ico        # Windows .ico 格式（可选，Electron 可自动转换）
│   └── app-icon.png         # 512x512 应用图标（用于安装包、Dock 等）
```

**音效资源：**

```
resources/
├── sounds/
│   ├── click.wav            # 点击宠物时的短音效（< 0.5秒）
│   ├── complete.wav         # 任务完成时的提示音
│   └── error.wav            # 出错时的提示音
```

音效使用 `.wav` 格式（无需解码，加载快），每个文件控制在 50KB 以内。通过 `new Audio()` 在渲染进程中播放。

---

### 六-F、日志系统

Electron 应用在用户机器上运行时，没有日志等于无法排查问题。使用 `electron-log` 统一管理日志输出。

```typescript
// src/main/index.ts — 日志初始化
import log from 'electron-log/main';

// 配置日志
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB 自动轮转
log.transports.console.level = 'debug';  // 开发时控制台输出 debug

// 日志文件位置: %APPDATA%/DesktopXPet/logs/main.log (Windows)
//                ~/Library/Logs/DesktopXPet/main.log (macOS)
```

**必须记录日志的位置：**

| 位置 | 级别 | 记录内容 |
|------|------|---------|
| 应用启动 | info | 版本号、平台、DPI、窗口尺寸 |
| 应用退出 | info | gracefulShutdown 各步骤耗时 |
| 插件 fetchStatus | warn/error | fetch 失败时记录插件名和错误信息 |
| HTTP API | warn | 请求异常（401 校验失败、413 超大请求体） |
| HTTP API | info | 成功的 Push 推送（tool 名 + status） |
| 皮肤切换 | info | 切换前后的皮肤名 |
| 自动更新 | info | 检查更新结果、下载进度、安装 |

```typescript
// 插件错误日志示例
class MonitorService {
  async fetchPluginStatus(plugin: MonitorPlugin): Promise<MonitorStatus> {
    try {
      return await plugin.fetchStatus();
    } catch (err) {
      log.warn(`Plugin "${plugin.name}" fetch failed:`, err);
      return {
        tool: plugin.name,
        status: 'error',
        summary: `${plugin.name} 获取数据失败`,
        timestamp: Date.now(),
      };
    }
  }
}
```

Phase 1 的 1.1 项目初始化时一并安装和配置 `electron-log`。

---

### 七、Phase 0 技术验证（预研）

在写任何业务代码之前，先用 2-3 小时验证 Electron 核心能力在当前系统上是否可用，避免写了几千行代码后才发现基础能力不可用。

| 序号 | 验证项 | 验证方法 | 预期结果 |
|------|--------|---------|---------|
| 0.1 | 透明窗口 | 创建 BrowserWindow({ frame:false, transparent:true })，设置红色背景测试 | 窗口背景完全透明，只有红色内容可见 |
| 0.2 | Canvas 像素渲染 | 在 renderer 中创建 Canvas，设置 imageSmoothingEnabled=false，绘制放大的像素图 | 放大后边缘锐利，不模糊 |
| 0.3 | 窗口穿透 | 调用 setIgnoreMouseEvents(true, { forward:true })，尝试点击窗口下方的桌面图标 | 点击穿透到桌面，mousemove 事件仍可捕获 |
| 0.4 | DPI 行为 | 在不同缩放比例（100%/125%/150%）下创建固定尺寸窗口，检查位置和大小 | 确认 Electron 是否自动处理 DPI，还是需要手动修正 |
| 0.5 | 系统托盘 | 创建 Tray 图标 + 右键菜单 | 托盘图标显示，菜单正常弹出 |
| 0.6 | electron-store | 读写测试数据 | 重启后数据持久化成功 |

**Phase 0 产出：** 一个可运行的最小 demo（保留在 `tools/poc/` 目录），验证上述 6 项全部通过。如果某项不通过，需要调整技术方案后再进入 Phase 1。

---

### 八、Phase 1 详细任务拆分（基础框架 + 基础交互）

| 序号 | 任务 | 具体内容 | 预估工时 | 产出文件 |
|------|------|---------|---------|---------|
| 1.1 | 项目初始化 | electron-vite 脚手架创建、依赖安装（确认最新版本，含 electron-log）、ESLint/Prettier 配置、日志初始化 | 2h | 项目根目录配置文件 + src/main/logger.ts |
| 1.2 | 透明窗口 | BrowserWindow 配置：frame:false, transparent:true, alwaysOnTop:true, skipTaskbar:true | 3h | src/main/window.ts |
| 1.3 | 窗口穿透 | setIgnoreMouseEvents 动态切换，像素透明度检测（含节流，见第一节「窗口穿透」小节） | 4h | src/main/window.ts, useClickThrough.ts |
| 1.4 | DPI 适配 | 固定逻辑像素 + devicePixelRatio Canvas 缩放（见第一节「DPI 缩放处理」小节） | 2h | src/main/window.ts, PetCanvas.tsx |
| 1.5 | 系统托盘 | Tray 图标创建、右键上下文菜单（仪表盘、皮肤、设置、置顶、重置、退出）、Tooltip 状态摘要 | 3h | src/main/tray.ts |
| 1.6 | 全局快捷键 | Ctrl+Shift+P 显隐、Ctrl+Shift+D 仪表盘、Ctrl+Shift+S 切皮肤 | 2h | src/main/shortcuts.ts |
| 1.7 | IPC 通信层 | preload 脚本、contextBridge 暴露 API、ipcMain 处理器 | 3h | src/preload/, src/shared/ipc-channels.ts |
| 1.8 | 精灵图动画引擎 | SpriteAnimator 类（含 delta clamp 防跳帧）+ PetCanvas 渲染组件 | 3h | SpriteAnimator.ts, PetCanvas.tsx |
| 1.9 | 宠物状态机 | PetStateMachine 类，含 idle / sleeping / waking 完整状态转换 | 3h | PetStateMachine.ts |
| 1.10 | 拖拽功能 | mousedown 记录偏移 → mousemove 更新窗口位置 → mouseup 保存位置 | 3h | useDraggable.ts, window.ts |
| 1.11 | 位置记忆 | electron-store 存取窗口坐标，启动时恢复 | 1h | src/main/store.ts |
| 1.12 | 精灵图集成 | 加载已有皮肤精灵图，调通全部动画状态播放 | 2h | PetCanvas.tsx 更新 |
| 1.13 | 托盘图标 | 从 idle 帧提取简化头像，生成 32x32 tray-icon.png | 1h | resources/icons/tray-icon.png |

**Phase 1 验收标准：**
- 应用启动后在屏幕右下角显示像素风宠物角色
- 角色有 idle 待机动画（呼吸/眨眼等小动作）
- 鼠标拖拽可移动宠物，松手后位置被记住，重启后恢复
- 透明区域点击穿透正常，角色区域可交互
- 右键菜单弹出完整，各功能可用
- 全局快捷键能正常显隐宠物和打开仪表盘
- 高 DPI 缩放下宠物清晰、位置正确
- 内存占用 < 80MB

---

### 九、Phase 2 详细任务拆分（监控系统 + 外部连接）

| 序号 | 任务 | 具体内容 | 预估工时 | 产出文件 |
|------|------|---------|---------|---------|
| 2.1 | Plugin 接口 | 定义 MonitorPlugin 接口、PluginConfig、MonitorStatus 类型 | 2h | src/shared/plugin-api.ts |
| 2.2 | PluginRegistry | 插件注册、加载、卸载、配置更新的中心管理器 | 4h | src/main/monitor/registry.ts |
| 2.3 | MonitorService | 调度所有已启用插件的定时轮询、聚合状态、推送给渲染进程 | 4h | src/main/monitor/index.ts, scheduler.ts |
| 2.4 | 系统监控插件 | CPU/内存/GPU 数据采集，使用 systeminformation 库 | 3h | src/main/plugins/system.ts |
| 2.5 | QoderWork 插件 | 读取 ~/.qoderwork 目录下的活动日志 | 3h | src/main/plugins/qoderwork.ts |
| 2.6 | GitHub 插件 | GitHub API 对接，获取 commits/PR/issues | 3h | src/main/plugins/github.ts |
| 2.7 | Ollama 插件 | localhost:11434 API 对接，模型状态检测 | 2h | src/main/plugins/local-ai.ts |
| 2.8 | HTTP API 服务器 | 内嵌 HTTP 服务（localhost:9527），token 校验，请求体大小限制 | 4h | src/main/server/api.ts |
| 2.9 | Push 数据合并 | MonitorService 中合并 Push 和 Poll 数据，Push 数据 60 秒 TTL | 3h | src/main/monitor/index.ts |
| 2.10 | CLI 伴侣工具 | xpet 命令行工具（report / skin 命令），读取 token 配置 | 3h | tools/xpet-cli.ts |
| 2.11 | 状态气泡 UI | React 组件，宠物下方显示文字气泡，展示聚合摘要 | 4h | StatusBubble.tsx |
| 2.12 | 状态联动 | 聚合状态驱动宠物状态机（working → 忙碌动画，completed → 开心动画） | 3h | PetStateMachine.ts 更新 |
| 2.13 | 错误处理 | 插件 fetch 失败时优雅降级，显示 error 状态而非崩溃 | 2h | scheduler.ts, plugin 通用逻辑 |

**Phase 2 验收标准：**
- 至少 2 个插件能正常获取数据（系统监控 + 1 个 AI 工具）
- 宠物状态随监控数据变化自动切换动画
- 状态气泡显示正确的摘要文字
- 插件故障不影响其他插件和应用运行
- 插件可在运行时启用/禁用
- HTTP API 接受外部 Push 推送，token 校验和请求体大小限制生效
- CLI 命令 `xpet report` 能成功推送状态到宠物

---

### 十、Phase 3 详细任务拆分（交互增强）

| 序号 | 任务 | 具体内容 | 预估工时 | 产出文件 |
|------|------|---------|---------|---------|
| 3.1 | 点击互动 | 检测点击区域（角色轮廓内），触发 happy 动画 | 3h | PetCanvas.tsx, 新增 hit-test 逻辑 |
| 3.2 | 闲置睡眠 | 计时器，N 分钟无鼠标交互后切换到 sleeping 状态 | 2h | PetStateMachine.ts, useIdleTimer.ts |
| 3.3 | 鼠标唤醒 | mouseenter 事件检测，sleeping 状态下鼠标进入时播放 waking 动画 | 2h | PetCanvas.tsx |
| 3.4 | 系统通知 | 使用 Electron Notification API，任务完成/error 时推送桌面通知 | 3h | src/main/notify.ts |
| 3.5 | 悬停详情面板 | hover 时弹出半透明卡片，显示各工具详细状态 | 5h | StatusDetailPopup.tsx |
| 3.6 | 仪表盘窗口 | 双击打开独立窗口，包含图表、工具卡片列表；打开时拉取状态快照 + 订阅增量更新（见二、数据流设计） | 8h | Dashboard.tsx, ToolCard.tsx, StatsChart.tsx |
| 3.7 | 历史数据统计 | electron-store 中记录每日/每周统计数据，仪表盘图表展示 | 4h | store.ts 更新, StatsChart.tsx |
| 3.8 | 音效反馈 | 点击、完成、错误时播放短音效（可选，通过设置开关） | 2h | useSound.ts |

**Phase 3 验收标准：**
- 点击宠物有明确的互动反馈动画
- 15 分钟无操作宠物自动入睡，鼠标经过时醒来
- 悬停气泡能看到各工具的详细状态数据
- 双击宠物能打开仪表盘，展示统计图表
- 系统通知在任务完成和出错时正常弹出

---

### 十一、Phase 4 详细任务拆分（皮肤与扩展）

| 序号 | 任务 | 具体内容 | 预估工时 | 产出文件 |
|------|------|---------|---------|---------|
| 4.1 | 皮肤加载器 | 从指定目录扫描皮肤包，解析 manifest.json，加载精灵图 | 4h | src/main/skin-loader.ts |
| 4.2 | 皮肤选择器 UI | 设置面板中的皮肤列表，带预览缩略图和切换按钮 | 4h | SkinSelector.tsx |
| 4.3 | 皮肤热切换 | 切换皮肤时无需重启，动态加载新皮肤的精灵图和配置 | 3h | SkinManager 联动 PetCanvas |
| 4.4 | 外部皮肤支持 | 支持用户指定自定义皮肤目录路径 | 2h | skin-loader.ts, Settings.tsx |
| 4.5 | 内置皮肤制作 | 制作 2-3 套不同风格的像素皮肤（猫咪/机器人/精灵） | 8h | resources/skins/ |
| 4.6 | 设置面板 | 完整的设置界面，分 Tab 展示各类配置项 | 5h | Settings.tsx |
| 4.7 | 开机自启 | electron 的 app.setLoginItemSettings() | 1h | src/main/index.ts |
| 4.8 | 打包发布 | electron-builder 配置，生成 Windows 安装包 | 4h | electron-builder.yml |
| 4.9 | 自动更新 | electron-updater + GitHub Releases，详见下文 | 3h | src/main/updater.ts |

**自动更新策略：**

采用 GitHub Releases + electron-updater 方案（对个人项目最省事）：

```typescript
// src/main/updater.ts
import { autoUpdater } from 'electron-updater';

function initAutoUpdater() {
  // 更新源：GitHub Releases（通过 electron-builder 的 publish 配置自动识别）
  autoUpdater.autoDownload = false;  // 不自动下载，先通知用户
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    // 通知用户有新版本，让用户决定是否更新
    dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `DesktopXPet ${info.version} 可用，是否更新？`,
      buttons: ['更新', '稍后'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '更新就绪',
      message: '新版本已下载完成，是否立即重启并安装？',
      buttons: ['立即重启', '稍后'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  // 每小时检查一次更新
  setInterval(() => autoUpdater.checkForUpdates(), 60 * 60 * 1000);
  autoUpdater.checkForUpdates();  // 启动时立即检查
}
```

签名策略：个人项目初期可跳过签名（`"forceCodeSigning": false`），后期如需发布到正式渠道再加代码签名证书。

**Phase 4 验收标准：**
- 可在设置面板中浏览并切换皮肤，实时生效
- 至少 3 套内置皮肤可用
- 用户自定义皮肤目录能被正确加载
- 打包后的安装包 < 150MB，安装后可正常运行
- 设置项（轮询间隔、通知、开机自启）都能正确保存并生效

---

### 十二、测试策略

**必须单测（纯逻辑，不涉及 DOM）：**

- SpriteAnimator 帧计算逻辑（含 delta clamp 防跳帧）
- PetStateMachine 状态转换逻辑（含 waking 过渡状态）
- MonitorService 状态聚合逻辑（error > working > completed > idle 优先级）
- Push 数据合并与 TTL 过期逻辑

**集成测试：**

- IPC 通信链路（main → preload → renderer 往返）
- Plugin 注册/加载/卸载生命周期
- electron-store 读写持久化

**手动验证（UI 相关，自动化成本高）：**

- [ ] 窗口穿透：透明区域可穿透，角色区域可交互
- [ ] 拖拽和位置记忆（含重启恢复）
- [ ] 长时间运行（>4 小时）无内存泄漏
- [ ] 断网后插件不崩溃，恢复后自动重新连接
- [ ] 多显示器环境下拖拽和位置记忆正常
- [ ] Windows 任务栏不显示宠物窗口（skipTaskbar）
- [ ] DPI 缩放下宠物显示清晰、位置正确（100% / 125% / 150%）
- [ ] 皮肤切换实时生效，无闪烁

不追求高覆盖率，核心逻辑覆盖即可。

---

### 十三、素材制作方案

像素风精灵图有三个获取途径：

**方案 A — 程序化生成（项目当前方式）：**
使用 Python + Pillow 编写生成脚本，逐像素绘制角色。项目已有两套皮肤的生成脚本（`generate_sprites.py` 和 `generate_butterfly_sprites.py`）可作为模板。详见 [SKIN_GUIDE.md](./SKIN_GUIDE.md) 中的完整指南和代码模板。

**方案 B — 手绘像素画：**
使用 Aseprite（推荐）、LibreSprite 或 Piskel 从零绘制。动画功能完善，可导出横排精灵图。最耗时但完全原创，适合精细控制。

**方案 C — AI 辅助生成：**
使用图像生成工具生成像素风角色参考图，然后手动或程序化后处理为严格的像素画。速度快但帧间连贯性需要大量手动调整。

**推荐组合：** Phase 1 先用方案 A 或 C 快速出原型，Phase 4 再用方案 B 打磨正式皮肤。每套皮肤需要约 5 张精灵图（idle/working/happy/sleeping/error），每张包含 2-6 帧。

> 完整的技术规范、制作流程、代码模板和常见问题，请参阅 [SKIN_GUIDE.md](./SKIN_GUIDE.md)。

---

### 十四、工时总览

| 阶段 | 预估工时 | 建议周期 |
|------|---------|---------|
| Phase 0 — 技术验证 | ~3h | 第 1 天 |
| Phase 1 — 基础框架 + 基础交互 | ~32h | 第 1-2 周 |
| Phase 2 — 监控系统 + 外部连接 | ~38h | 第 3-4 周 |
| Phase 3 — 交互增强 | ~29h | 第 5-6 周 |
| Phase 4 — 皮肤与扩展 | ~34h | 第 7-8 周 |
| **总计** | **~136h** | **约 8-9 周** |

以上按每天 2-3 小时业余时间估算。Phase 1 包含窗口穿透、右键菜单、全局快捷键等基础交互，Phase 2 专注监控系统和外部连接，各阶段内聚性更强。如果全职开发，总周期可压缩到 3-4 周。

---

### 十五、实施进度跟踪

#### Phase 1 — 基础框架 + 基础交互

| 序号 | 任务 | 状态 | 产出文件 | 备注 |
|------|------|------|---------|------|
| 1.1 | 项目初始化 | ✅ 已完成 | package.json, electron.vite.config.ts, tsconfig.* | electron-vite@5 + React@18 + TS@5 + Zustand@5 |
| 1.2 | 透明窗口 | ✅ 已完成 | src/main/window.ts | PetWindowManager: 透明/无边框/置顶/穿透 |
| 1.3 | 窗口穿透 | ✅ 已完成 | src/main/window.ts, hooks/useClickThrough.ts | 像素 alpha 检测 + 50ms 节流 |
| 1.4 | DPI 适配 | ✅ 已完成 | src/renderer/components/Pet/PetCanvas.tsx | devicePixelRatio + imageSmoothingEnabled=false |
| 1.5 | 系统托盘 | ✅ 已完成 | src/main/tray.ts | 托盘图标 + 右键菜单 + Tooltip |
| 1.6 | 全局快捷键 | ✅ 已完成 | src/main/shortcuts.ts | Ctrl+Shift+P/D/S |
| 1.7 | IPC 通信层 | ✅ 已完成 | src/preload/index.ts, src/shared/ipc-channels.ts | contextBridge 安全 API |
| 1.8 | 精灵图动画引擎 | ✅ 已完成 | src/renderer/components/Pet/SpriteAnimator.ts | delta clamp 防跳帧 + loop/non-loop 支持 |
| 1.9 | 宠物状态机 | ✅ 已完成 | src/renderer/components/Pet/PetStateMachine.ts | idle/sleeping/waking/working/happy/error |
| 1.10 | 拖拽功能 | ✅ 已完成 | src/renderer/hooks/useDraggable.ts | mousedown→mousemove→mouseup + 位置保存 |
| 1.11 | 位置记忆 | ✅ 已完成 | src/main/store.ts, src/main/window.ts | electron-store 存取窗口坐标 |
| 1.12 | 精灵图集成 | ✅ 已完成 | src/renderer/components/Pet/PetCanvas.tsx | file:// 加载皮肤精灵图，5 种状态动画 |
| 1.13 | 托盘图标 | ⚠️ 待完成 | resources/icons/tray-icon.png | 需要制作 32x32 图标文件 |
| 1.14 | Zustand 状态管理 | ✅ 已完成 | src/renderer/stores/appStore.ts | 宠物状态/监控/皮肤/气泡管理 |
| 1.15 | 状态气泡 UI | ✅ 已完成 | src/renderer/components/StatusBubble/StatusBubble.tsx | 宠物下方显示状态摘要 |
| 1.16 | 闲置睡眠 + 唤醒 | ✅ 已完成 | src/renderer/hooks/useIdleTimer.ts | 15分钟闲置后进入 sleeping |

#### Phase 2 — 监控系统 + 外部连接

| 序号 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2.1 | Plugin 接口 | ✅ 已完成 | src/shared/plugin-api.ts | MonitorPlugin + PluginConfig + PluginInfo |
| 2.2 | PluginRegistry | ✅ 已完成 | src/main/monitor/registry.ts | 注册/卸载/启用/禁用/配置更新 |
| 2.3 | MonitorService | ✅ 已完成 | src/main/monitor/index.ts | 调度轮询 + 聚合状态 + Push 合并 |
| 2.4 | 系统监控插件 | ✅ 已完成 | src/main/plugins/system.ts | CPU/内存监控，两次采样差值 |
| 2.5 | GitHub 插件 | ✅ 已完成 | src/main/plugins/github.ts | commits/PR/issues 查询 |
| 2.6 | Ollama 插件 | ✅ 已完成 | src/main/plugins/ollama.ts | 模型状态 + 推理检测 |
| 2.7 | HTTP API 服务器 | ✅ 已完成 | src/main/server/api.ts | localhost:9527 + token 校验 |
| 2.8 | Push 数据合并 | ✅ 已完成 | src/main/monitor/index.ts | 60秒 TTL + Push 覆盖 Poll |
| 2.9 | CLI 伴侣工具 | ✅ 已完成 | ~/.xpet/config.json | token 自动写入 |
| 2.10 | 状态联动 | ✅ 已完成 | MonitorService + IPC | 监控数据驱动宠物状态机 |
| 2.11 | 错误处理 | ✅ 已完成 | 各插件 + MonitorService | 插件故障不崩溃，优雅降级 |

#### Phase 3 — 交互增强

| 序号 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 3.1 | 点击互动 | ✅ 已完成 | PetCanvas.tsx onClick 处理 |
| 3.2 | 闲置睡眠 | ✅ 已完成 | useIdleTimer.ts 15分钟计时 |
| 3.3 | 鼠标唤醒 | ✅ 已完成 | sleeping 状态自动唤醒 |
| 3.4 | 系统通知 | ✅ 已完成 | src/main/notify.ts 出错/完成通知 |
| 3.5 | 悬停详情面板 | ✅ 已完成 | StatusDetailPopup.tsx |
| 3.6 | 仪表盘窗口 | ✅ 已完成 | Dashboard.tsx + 独立窗口 |
| 3.7 | 音效反馈 | ✅ 已完成 | 设置开关支持 |

#### Phase 4 — 皮肤与扩展

| 序号 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 4.1 | 皮肤加载器 | ✅ 已完成 | src/main/skin-loader.ts |
| 4.2 | 皮肤选择器 UI | ✅ 已完成 | SkinSelector.tsx |
| 4.3 | 皮肤热切换 | ✅ 已完成 | IPC + skin:changed 事件 |
| 4.4 | 外部皮肤支持 | ✅ 已完成 | customSkinDirs 配置 |
| 4.5 | 设置面板 | ✅ 已完成 | Settings.tsx 分区块配置 |
| 4.6 | 开机自启 | ✅ 已完成 | app.setLoginItemSettings() |
| 4.7 | 打包发布 | ✅ 已完成 | electron-builder.yml |
