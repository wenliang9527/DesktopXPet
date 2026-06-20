// IPC 通道常量定义
export const IPC = {
  // 监控数据
  MONITOR_STATUS_UPDATE: 'monitor:status-update',
  MONITOR_GET_SNAPSHOT: 'monitor:get-snapshot',

  // 宠物控制
  PET_SET_POSITION: 'pet:set-position',
  PET_GET_POSITION: 'pet:get-position',
  PET_HOVER_STATE: 'pet:hover-state',
  PET_SHOW_CONTEXT_MENU: 'pet:context-menu',

  // 插件管理
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_TOGGLE: 'plugin:toggle',

  // 皮肤管理
  SKIN_LIST: 'skin:list',
  SKIN_SWITCH: 'skin:switch',
  SKIN_READ_IMAGE: 'skin:read-image',
  SKIN_RESCAN: 'skin:rescan',
  SKIN_OPEN_USER_DIR: 'skin:open-user-dir',
  SKIN_INSTALL_PACKAGE: 'skin:install-package',

  // 音效管理
  SOUND_PLAY: 'sound:play',
  SOUND_RELOAD: 'sound:reload',
  SOUND_OPEN_USER_DIR: 'sound:open-user-dir',

  // 应用控制
  APP_OPEN_DASHBOARD: 'app:open-dashboard',
  APP_QUIT: 'app:quit',
  APP_GET_STORE: 'app:get-store',
  APP_SET_STORE: 'app:set-store',
  APP_SET_PET_NAME: 'app:set-pet-name',
  APP_GET_PET_NAME: 'app:get-pet-name',
} as const
