import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

// 暴露安全的 IPC API 给渲染进程
contextBridge.exposeInMainWorld('desktopXPet', {
  // 事件监听（Main → Renderer）
  onStatusUpdate: (callback: (status: any) => void) => {
    ipcRenderer.on(IPC.MONITOR_STATUS_UPDATE, (_, data) => callback(data))
  },
  getStatusSnapshot: () => ipcRenderer.invoke(IPC.MONITOR_GET_SNAPSHOT),

  // 操作调用（Renderer → Main）
  setPosition: (x: number, y: number) => ipcRenderer.invoke(IPC.PET_SET_POSITION, { x, y }),
  getPosition: () => ipcRenderer.invoke(IPC.PET_GET_POSITION),
  setHoverState: (hovering: boolean) => ipcRenderer.send(IPC.PET_HOVER_STATE, hovering),
  showContextMenu: () => ipcRenderer.invoke(IPC.PET_SHOW_CONTEXT_MENU),
  openDashboard: () => ipcRenderer.invoke(IPC.APP_OPEN_DASHBOARD),

  // 插件管理
  getPluginList: () => ipcRenderer.invoke(IPC.PLUGIN_LIST),
  togglePlugin: (name: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC.PLUGIN_TOGGLE, { name, enabled }),

  // 皮肤管理
  getSkinList: () => ipcRenderer.invoke(IPC.SKIN_LIST),
  switchSkin: (name: string) => ipcRenderer.invoke(IPC.SKIN_SWITCH, name),
  readSkinImage: (imagePath: string) => ipcRenderer.invoke(IPC.SKIN_READ_IMAGE, imagePath),
  onSkinChanged: (callback: (skinName: string) => void) => {
    ipcRenderer.on('skin:changed', (_, skinName: string) => callback(skinName))
  },

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC.APP_GET_STORE),
  setSettings: (settings: any) => ipcRenderer.invoke(IPC.APP_SET_STORE, settings),

  // 退出
  quit: () => ipcRenderer.invoke(IPC.APP_QUIT)
})

// 类型声明
export interface DesktopXPetAPI {
  onStatusUpdate: (callback: (status: any) => void) => void
  getStatusSnapshot: () => Promise<any>
  setPosition: (x: number, y: number) => Promise<void>
  getPosition: () => Promise<{ x: number; y: number } | null>
  setHoverState: (hovering: boolean) => void
  showContextMenu: () => Promise<void>
  openDashboard: () => Promise<void>
  getPluginList: () => Promise<any[]>
  togglePlugin: (name: string, enabled: boolean) => Promise<void>
  getSkinList: () => Promise<any[]>
  switchSkin: (name: string) => Promise<void>
  readSkinImage: (imagePath: string) => Promise<string | null>
  onSkinChanged: (callback: (skinName: string) => void) => void
  getSettings: () => Promise<any>
  setSettings: (settings: any) => Promise<void>
  quit: () => Promise<void>
}
