// 全局类型声明
import type { DesktopXPetAPI } from '../preload/index'

declare global {
  interface Window {
    desktopXPet: DesktopXPetAPI
  }
}
