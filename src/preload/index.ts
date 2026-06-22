import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { AggregatedStatus, AppSettings, SkinManifest } from '../shared/types'

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
  onSkinChanged: (callback: (skinName: string) => void) => {
    const handler = (_: IpcRendererEvent, skinName: string) => callback(skinName)
    ipcRenderer.on('skin:changed', handler)
    return () => ipcRenderer.removeListener('skin:changed', handler)
  },
  // 皮肤列表变更（rescan 后广播）— 通知 SkinSelector 等组件重新加载
  onSkinsChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('skins:rescanned', handler)
    return () => ipcRenderer.removeListener('skins:rescanned', handler)
  },

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC.APP_GET_STORE) as Promise<Partial<AppSettings>>,
  setSettings: (settings: Partial<Record<string, unknown>>) =>
    ipcRenderer.invoke(IPC.APP_SET_STORE, settings),

  // 宠物名称
  getPetName: () => ipcRenderer.invoke(IPC.APP_GET_PET_NAME) as Promise<string>,
  setPetName: (name: string) => ipcRenderer.invoke(IPC.APP_SET_PET_NAME, name),
  onPetNameChanged: (callback: (name: string) => void) => {
    const handler = (_: IpcRendererEvent, name: string) => callback(name)
    ipcRenderer.on('pet-name:changed', handler)
    return () => ipcRenderer.removeListener('pet-name:changed', handler)
  },

  // 退出
  quit: () => ipcRenderer.invoke(IPC.APP_QUIT),

  // 音效
  playSound: (name: string) => ipcRenderer.send(IPC.SOUND_PLAY, name),
  reloadSound: () => ipcRenderer.invoke(IPC.SOUND_RELOAD),
  openSoundDir: () => ipcRenderer.invoke(IPC.SOUND_OPEN_USER_DIR),

  // 工具函数(sandbox 模式下 File.path 不可用,需用 webUtils)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
})

// 音效播放 — 主进程返回 data URL(或文件路径)后在渲染进程播放
// sandbox 模式下 file:/// 协议被禁止,使用 data URL 播放
ipcRenderer.on('sound:play-file', (_, dataOrPath: string) => {
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

  // 设置
  getSettings: () => Promise<Partial<AppSettings>>
  setSettings: (settings: Partial<Record<string, unknown>>) => Promise<void>

  // 宠物名称
  getPetName: () => Promise<string>
  setPetName: (name: string) => Promise<void>

  // 退出
  quit: () => Promise<void>

  // 音效
  playSound: (name: string) => void
  reloadSound: () => Promise<void>
  openSoundDir: () => Promise<void>

  // 工具函数
  getPathForFile: (file: File) => string
}
