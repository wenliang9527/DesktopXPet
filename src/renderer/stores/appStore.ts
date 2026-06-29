import { create } from 'zustand'
import type { PetState, AggregatedStatus, MonitorStatus, PetNurtureState, PetDisplayState } from '@shared/types'
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

  // 窗口级悬停（鼠标进入宠物窗口即触发，用于展开详情面板）
  isWindowHovered: boolean
  setWindowHovered: (hovering: boolean) => void

  // 宠物自定义名称
  petName: string
  setPetName: (name: string) => void
  persistPetName: (name: string) => Promise<void>

  // 养成系统状态
  nurtureState: PetNurtureState | null
  setNurtureState: (state: PetNurtureState) => void

  // 主进程侧计算的显示状态(权威决策)
  displayState: PetDisplayState | null
  setDisplayState: (state: PetDisplayState | null) => void

  // 已解锁状态列表
  unlockedStates: string[]
  setUnlockedStates: (states: string[]) => void

  // 互动反馈消息
  interactionMessage: string
  setInteractionMessage: (message: string) => void
  clearInteractionMessage: () => void
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
    set((state) => {
      // monitor 推送的 idle 不应覆盖用户闲置触发的 sleeping(避免宠物被误唤醒)
      // working/error/happy 等高优先级状态可以覆盖 sleeping
      const shouldKeepSleeping = state.petState === 'sleeping' && data.petState === 'idle'
      return {
        tools: data.tools || [],
        summary: data.summary || '',
        petState: shouldKeepSleeping ? 'sleeping' : data.petState,
      }
    }),

  currentSkin: DEFAULT_SKIN,
  setCurrentSkin: (skin) => set({ currentSkin: skin }),

  showBubble: true,
  setShowBubble: (show) => set({ showBubble: show }),

  isHovering: false,
  setHovering: (hovering) => set({ isHovering: hovering }),

  isWindowHovered: false,
  setWindowHovered: (hovering) => set({ isWindowHovered: hovering }),

  petName: 'DesktopXPet',
  setPetName: (name: string) => set({ petName: name }),
  persistPetName: async (name: string) => {
    try {
      if (window.desktopXPet?.setPetName) {
        await window.desktopXPet.setPetName(name)
      }
    } catch (err) {
      console.warn('Failed to save pet name:', err)
    }
  },

  nurtureState: null,
  setNurtureState: (state) => set({ nurtureState: state }),

  displayState: null,
  setDisplayState: (state) => set({ displayState: state }),

  unlockedStates: [],
  setUnlockedStates: (states) => set({ unlockedStates: states }),

  interactionMessage: '',
  setInteractionMessage: (message: string) => set({ interactionMessage: message }),
  clearInteractionMessage: () => set({ interactionMessage: '' }),
}))

/**
 * 显式初始化 appStore 副作用:
 *   - 加载宠物名称
 *   - 注册跨窗口宠物名称变更监听(仅注册一次)
 *   - 从设置加载气泡可见性
 *
 * 必须在渲染进程启动后由入口(如 App.tsx)调用一次,避免在模块导入时执行副作用
 * 导致测试隔离困难、模块加载顺序敏感等问题。
 */
let petNameListenerRegistered = false
export async function initAppStore(): Promise<void> {
  // 加载宠物名称
  try {
    const name = await loadPetName()
    useAppStore.setState({ petName: name })
  } catch (err) {
    console.warn('Failed to load pet name during initAppStore:', err)
  }

  // 监听其他窗口的名称变更(只注册一次)
  if (!petNameListenerRegistered && window.desktopXPet?.onPetNameChanged) {
    petNameListenerRegistered = true
    window.desktopXPet.onPetNameChanged((name: string) => {
      useAppStore.setState({ petName: name })
    })
  }

  // 从设置加载气泡可见性
  try {
    if (window.desktopXPet?.getSettings) {
      const settings = await window.desktopXPet.getSettings()
      if (settings?.behavior?.showBubble !== undefined) {
        useAppStore.setState({ showBubble: settings.behavior.showBubble })
      }
    }
  } catch (err) {
    console.warn('Failed to load showBubble from settings:', err)
  }
}
