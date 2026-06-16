import ElectronStore from 'electron-store'
import { DEFAULT_SETTINGS } from '@shared/constants'

// electron-store ESM default export 兼容处理
const Store = (ElectronStore as any).default || ElectronStore

let store: InstanceType<typeof ElectronStore> | null = null

export function initStore(): NonNullable<InstanceType<typeof ElectronStore>> {
  if (!store) {
    store = new Store({
      name: 'desktopxpet-config',
      defaults: DEFAULT_SETTINGS as any
    })
  }
  return store as NonNullable<InstanceType<typeof ElectronStore>>
}

export function getStore(): NonNullable<InstanceType<typeof ElectronStore>> {
  if (!store) {
    return initStore()
  }
  return store as NonNullable<InstanceType<typeof ElectronStore>>
}
