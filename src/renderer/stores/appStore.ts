import { create } from 'zustand'
import type { PetState, AggregatedStatus, MonitorStatus } from '@shared/types'
import { DEFAULT_SKIN } from '@shared/skins'

interface AppState {
  // 宠物状态
  petState: PetState
  setPetState: (state: PetState) => void

  // 监控数据
  tools: MonitorStatus[]
  summary: string
  setMonitorData: (data: AggregatedStatus) => void

  // 当前皮肤
  currentSkin: string
  setCurrentSkin: (skin: string) => void

  // 气泡可见性
  showBubble: boolean
  setShowBubble: (show: boolean) => void

  // 悬停状态（由 clickThrough 控制，不依赖 DOM mouseEnter）
  isHovering: boolean
  setHovering: (hovering: boolean) => void

  // 宠物自定义名称
  petName: string
  setPetName: (name: string) => void
}

// 从存储加载宠物名称
const loadPetName = async (): Promise<string> => {
  try {
    if (window.desktopXPet?.getPetName) {
      return await window.desktopXPet.getPetName()
    }
  } catch (err) {
    console.warn('Failed to load pet name:', err)
  }
  return 'DesktopXPet'
}

export const useAppStore = create<AppState>((set) => ({
  petState: 'idle',
  setPetState: (state) => set({ petState: state }),

  tools: [],
  summary: 'DesktopXPet 待机中',
  setMonitorData: (data) =>
    set({
      tools: data.tools || [],
      summary: data.summary || '',
      petState: data.petState,
    }),

  currentSkin: DEFAULT_SKIN,
  setCurrentSkin: (skin) => set({ currentSkin: skin }),

  showBubble: true,
  setShowBubble: (show) => set({ showBubble: show }),

  isHovering: false,
  setHovering: (hovering) => set({ isHovering: hovering }),

  petName: 'DesktopXPet',
  setPetName: async (name: string) => {
    try {
      if (window.desktopXPet?.setPetName) {
        await window.desktopXPet.setPetName(name)
      }
      set({ petName: name })
    } catch (err) {
      console.warn('Failed to save pet name:', err)
    }
  },
}))

// 初始化时加载宠物名称
loadPetName().then((name) => {
  useAppStore.setState({ petName: name })
})

// 监听其他窗口的名称变更
if (window.desktopXPet?.onPetNameChanged) {
  window.desktopXPet.onPetNameChanged((name: string) => {
    useAppStore.setState({ petName: name })
  })
}
