import { create } from 'zustand'
import type { PetState, AggregatedStatus } from '@shared/types'

interface AppState {
  // 宠物状态
  petState: PetState
  setPetState: (state: PetState) => void

  // 监控数据
  monitorStatus: AggregatedStatus | null
  setMonitorStatus: (status: AggregatedStatus) => void

  // 当前皮肤
  currentSkin: string
  setCurrentSkin: (skin: string) => void

  // 状态摘要
  summary: string
  setSummary: (summary: string) => void

  // 气泡可见性
  showBubble: boolean
  setShowBubble: (show: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  petState: 'idle',
  setPetState: (state) => set({ petState: state }),

  monitorStatus: null,
  setMonitorStatus: (status) => set({ monitorStatus: status }),

  currentSkin: 'default-cat',
  setCurrentSkin: (skin) => set({ currentSkin: skin }),

  summary: 'DesktopXPet 待机中',
  setSummary: (summary) => set({ summary }),

  showBubble: true,
  setShowBubble: (show) => set({ showBubble: show })
}))
