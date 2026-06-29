import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  AggregatedStatus,
  AppSettings,
  SkinManifest,
  PetNurtureState,
  UnlockConfig,
  StateTransitionConfig,
  NurtureBroadcast,
  InteractType,
} from '../shared/types'

// 皮肤列表项（getSkinList 返回）
export interface SkinListItem {
  name: string
  dirName: string
  path: string
  manifest: SkinManifest
}

// 插件信息（getPluginList 返回）
export interface PluginInfo {
  name: string
  icon: string
  enabled: boolean
  config: Record<string, unknown>
}

// 暴露安全的 IPC API 给渲染进程
contextBridge.exposeInMainWorld('desktopXPet', {
  // 事件监听（Main → Renderer）— 返回清理函数避免监听器泄漏
  onStatusUpdate: (callback: (status: AggregatedStatus) => void) => {
    const handler = (_: IpcRendererEvent, data: AggregatedStatus) => callback(data)
    ipcRenderer.on(IPC.MONITOR_STATUS_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC.MONITOR_STATUS_UPDATE, handler)
  },
  getStatusSnapshot: () =>
    ipcRenderer.invoke(IPC.MONITOR_GET_SNAPSHOT) as Promise<AggregatedStatus>,

  // 操作调用（Renderer → Main）
  setPosition: (x: number, y: number) => ipcRenderer.invoke(IPC.PET_SET_POSITION, { x, y }),
  getPosition: () =>
    ipcRenderer.invoke(IPC.PET_GET_POSITION) as Promise<{ x: number; y: number } | null>,
  setHoverState: (hovering: boolean) => ipcRenderer.send(IPC.PET_HOVER_STATE, hovering),
  showContextMenu: () => ipcRenderer.invoke(IPC.PET_SHOW_CONTEXT_MENU),
  openDashboard: () => ipcRenderer.invoke(IPC.APP_OPEN_DASHBOARD),

  // 插件管理
  getPluginList: () => ipcRenderer.invoke(IPC.PLUGIN_LIST) as Promise<PluginInfo[]>,
  togglePlugin: (name: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC.PLUGIN_TOGGLE, { name, enabled }),

  // GitHub 凭据管理（token 不经过渲染进程明文传输）
  setGithubCredentials: (credentials: { token?: string; username?: string }) =>
    ipcRenderer.invoke(IPC.GITHUB_SET_CREDENTIALS, credentials),
  getGithubCredentials: () =>
    ipcRenderer.invoke(IPC.GITHUB_GET_CREDENTIALS) as Promise<{ username: string; hasToken: boolean }>,

  // 皮肤管理
  getSkinList: () => ipcRenderer.invoke(IPC.SKIN_LIST) as Promise<SkinListItem[]>,
  switchSkin: (name: string) => ipcRenderer.invoke(IPC.SKIN_SWITCH, name),
  readSkinImage: (imagePath: string) =>
    ipcRenderer.invoke(IPC.SKIN_READ_IMAGE, imagePath) as Promise<string | null>,
  rescanSkins: () => ipcRenderer.invoke(IPC.SKIN_RESCAN),
  openSkinDir: () => ipcRenderer.invoke(IPC.SKIN_OPEN_USER_DIR),
  installSkinPackage: (filePath: string) =>
    ipcRenderer.invoke(IPC.SKIN_INSTALL_PACKAGE, filePath) as Promise<{
      success: boolean
      skinName?: string
      error?: string
    }>,
  // 自定义皮肤源目录管理（用户可在设置中添加/移除额外皮肤源目录）
  addSkinDir: (dir: string) => ipcRenderer.invoke(IPC.SKIN_ADD_DIR, dir),
  removeSkinDir: (dir: string) => ipcRenderer.invoke(IPC.SKIN_REMOVE_DIR, dir),
  listSkinDirs: () => ipcRenderer.invoke(IPC.SKIN_LIST_DIRS),
  onSkinChanged: (callback: (skinName: string) => void) => {
    const handler = (_: IpcRendererEvent, skinName: string) => callback(skinName)
    ipcRenderer.on(IPC.SKIN_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.SKIN_CHANGED, handler)
  },
  // 皮肤列表变更（rescan 后广播）— 通知 SkinSelector 等组件重新加载
  onSkinsChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.SKINS_RESCANNED, handler)
    return () => ipcRenderer.removeListener(IPC.SKINS_RESCANNED, handler)
  },
  // 皮肤列表变更(等级提升解锁新皮肤时广播)— 通知 SkinSelector 重新拉取已解锁皮肤
  onSkinListChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.SKIN_LIST_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.SKIN_LIST_CHANGED, handler)
  },

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC.APP_GET_STORE) as Promise<Partial<AppSettings>>,
  // settings 为扁平的 electron-store 点路径 key 到值的映射,如 { 'pet.scale': 1.5, 'behavior.showBubble': true }
  setSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.APP_SET_STORE, settings),

  // 宠物名称
  getPetName: () => ipcRenderer.invoke(IPC.APP_GET_PET_NAME) as Promise<string>,
  setPetName: (name: string) => ipcRenderer.invoke(IPC.APP_SET_PET_NAME, name),
  onPetNameChanged: (callback: (name: string) => void) => {
    const handler = (_: IpcRendererEvent, name: string) => callback(name)
    ipcRenderer.on(IPC.PET_NAME_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.PET_NAME_CHANGED, handler)
  },

  // 退出
  quit: () => ipcRenderer.invoke(IPC.APP_QUIT),

  // 音效
  playSound: (name: string) => ipcRenderer.send(IPC.SOUND_PLAY, name),
  reloadSound: () => ipcRenderer.invoke(IPC.SOUND_RELOAD),
  openSoundDir: () => ipcRenderer.invoke(IPC.SOUND_OPEN_USER_DIR),

  // 养成系统
  getNurtureState: () => ipcRenderer.invoke(IPC.NURTURE_GET_STATE) as Promise<PetNurtureState>,
  nurtureInteract: (type: string) =>
    ipcRenderer.invoke(IPC.NURTURE_INTERACT, { type }) as Promise<PetNurtureState>,
  nurturePomodoroComplete: () => ipcRenderer.invoke(IPC.NURTURE_POMODORO_COMPLETE),
  getPomodoroCount: () => ipcRenderer.invoke(IPC.POMODORO_GET_COUNT) as Promise<number>,
  resetPomodoroCount: () => ipcRenderer.invoke(IPC.POMODORO_RESET) as Promise<void>,
  onNurtureUpdate: (callback: (state: PetNurtureState) => void) => {
    const handler = (_: IpcRendererEvent, data: PetNurtureState) => callback(data)
    ipcRenderer.on(IPC.NURTURE_STATE_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC.NURTURE_STATE_UPDATE, handler)
  },

  // 养成系统 - 皮肤状态联动(主进程广播 NurtureBroadcast: nurtureState + unlockedStates + displayState)
  onNurtureDisplayState: (callback: (data: NurtureBroadcast) => void) => {
    const handler = (_: IpcRendererEvent, data: NurtureBroadcast) => callback(data)
    ipcRenderer.on(IPC.NURTURE_DISPLAY_STATE, handler)
    return () => ipcRenderer.removeListener(IPC.NURTURE_DISPLAY_STATE, handler)
  },
  // 养成系统 - 互动反馈(主进程推送消息字符串,如"吃饱了~",由 StatusBubble 显示气泡)
  onNurtureInteractFeedback: (callback: (message: string) => void) => {
    const handler = (_: IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on(IPC.NURTURE_INTERACT_FEEDBACK, handler)
    return () => ipcRenderer.removeListener(IPC.NURTURE_INTERACT_FEEDBACK, handler)
  },
  // 养成系统 - 互动类型触发(主进程明确通知 interact 类型,如 'feed'/'stroke',
  // 用于驱动动画。比从 satiety 变化量推断更可靠,不受 clamp 影响)
  onNurtureInteractTrigger: (callback: (type: InteractType) => void) => {
    const handler = (_: IpcRendererEvent, type: InteractType) => callback(type)
    ipcRenderer.on(IPC.NURTURE_INTERACT_TRIGGER, handler)
    return () => ipcRenderer.removeListener(IPC.NURTURE_INTERACT_TRIGGER, handler)
  },
  getUnlockConfig: () =>
    ipcRenderer.invoke(IPC.NURTURE_UNLOCK_CONFIG_GET) as Promise<UnlockConfig>,
  setUnlockConfig: (config: UnlockConfig) =>
    ipcRenderer.invoke(IPC.NURTURE_UNLOCK_CONFIG_SET, config),
  getStateTransitionConfig: () =>
    ipcRenderer.invoke(IPC.NURTURE_STATE_TRANSITION_GET) as Promise<StateTransitionConfig>,
  setStateTransitionConfig: (config: StateTransitionConfig) =>
    ipcRenderer.invoke(IPC.NURTURE_STATE_TRANSITION_SET, config),

  // 工具函数(sandbox 模式下 File.path 不可用,需用 webUtils)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
})

// 音效播放 — 主进程返回 data URL(或文件路径)后在渲染进程播放
// sandbox 模式下 file:/// 协议被禁止,使用 data URL 播放
ipcRenderer.on(IPC.SOUND_PLAY_FILE, (_, dataOrPath: string) => {
  try {
    const src = dataOrPath.startsWith('data:') ? dataOrPath : `file:///${dataOrPath.replace(/\\/g, '/')}`
    const audio = new Audio(src)
    audio.volume = 0.5
    audio.play().catch(() => {})
  } catch {
    // 静默忽略
  }
})

// 类型声明 — 渲染进程通过 window.desktopXPet 访问的 API 类型
export interface DesktopXPetAPI {
  // 事件监听（返回清理函数）
  onStatusUpdate: (callback: (status: AggregatedStatus) => void) => () => void
  onSkinChanged: (callback: (skinName: string) => void) => () => void
  onSkinsChanged: (callback: () => void) => () => void
  onSkinListChanged: (callback: () => void) => () => void
  onPetNameChanged: (callback: (name: string) => void) => () => void

  // 状态快照
  getStatusSnapshot: () => Promise<AggregatedStatus>

  // 宠物窗口控制
  setPosition: (x: number, y: number) => Promise<void>
  getPosition: () => Promise<{ x: number; y: number } | null>
  setHoverState: (hovering: boolean) => void
  showContextMenu: () => Promise<void>
  openDashboard: () => Promise<void>

  // 插件管理
  getPluginList: () => Promise<PluginInfo[]>
  togglePlugin: (name: string, enabled: boolean) => Promise<void>

  // GitHub 凭据管理
  setGithubCredentials: (credentials: { token?: string; username?: string }) => Promise<void>
  getGithubCredentials: () => Promise<{ username: string; hasToken: boolean }>

  // 皮肤管理
  getSkinList: () => Promise<SkinListItem[]>
  switchSkin: (name: string) => Promise<void>
  readSkinImage: (imagePath: string) => Promise<string | null>
  rescanSkins: () => Promise<unknown[]>
  openSkinDir: () => Promise<void>
  installSkinPackage: (filePath: string) => Promise<{
    success: boolean
    skinName?: string
    error?: string
  }>
  // 自定义皮肤源目录管理
  addSkinDir: (dir: string) => Promise<boolean>
  removeSkinDir: (dir: string) => Promise<boolean>
  listSkinDirs: () => Promise<string[]>

  // 设置
  getSettings: () => Promise<Partial<AppSettings>>
  // settings 为扁平的 electron-store 点路径 key 到值的映射,如 { 'pet.scale': 1.5, 'behavior.showBubble': true }
  setSettings: (settings: Record<string, unknown>) => Promise<void>

  // 宠物名称
  getPetName: () => Promise<string>
  setPetName: (name: string) => Promise<void>

  // 退出
  quit: () => Promise<void>

  // 音效
  playSound: (name: string) => void
  reloadSound: () => Promise<void>
  openSoundDir: () => Promise<void>

  // 养成系统
  getNurtureState: () => Promise<PetNurtureState>
  nurtureInteract: (type: string) => Promise<PetNurtureState>
  nurturePomodoroComplete: () => Promise<void>
  getPomodoroCount: () => Promise<number>
  resetPomodoroCount: () => Promise<void>
  onNurtureUpdate: (callback: (state: PetNurtureState) => void) => () => void
  onNurtureDisplayState: (callback: (data: NurtureBroadcast) => void) => () => void
  onNurtureInteractFeedback: (callback: (message: string) => void) => () => void
  onNurtureInteractTrigger: (callback: (type: InteractType) => void) => () => void
  getUnlockConfig: () => Promise<UnlockConfig>
  setUnlockConfig: (config: UnlockConfig) => Promise<void>
  getStateTransitionConfig: () => Promise<StateTransitionConfig>
  setStateTransitionConfig: (config: StateTransitionConfig) => Promise<void>

  // 工具函数
  getPathForFile: (file: File) => string
}
