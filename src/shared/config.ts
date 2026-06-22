/**
 * 统一配置中心
 * 所有硬编码常量集中于此，避免散落在 constants.ts 各处
 */

export const Config = {
  app: {
    name: 'DesktopXPet',
    version: '1.0.0',
  },
  window: {
    pet: { width: 220, height: 280 },
    dashboard: { width: 800, height: 600 },
  },
  render: {
    petRenderSize: 192,
  },
  api: {
    port: 9527,
    pushTtl: 300000,
  },
  monitoring: {
    defaultPollInterval: 10000,
    shutdownTimeout: 5000,
  },
} as const

export type ConfigType = typeof Config
