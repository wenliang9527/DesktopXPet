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
  SKIN_CHANGED: 'skin:changed',
  SKINS_RESCANNED: 'skins:rescanned',
  // 皮肤列表变更(等级提升解锁新皮肤时广播,主→渲染单向)
  SKIN_LIST_CHANGED: 'skin:list-changed',
  // 自定义皮肤目录管理（用户可在设置中添加/移除额外皮肤源目录）
  SKIN_ADD_DIR: 'skin:add-dir',
  SKIN_REMOVE_DIR: 'skin:remove-dir',
  SKIN_LIST_DIRS: 'skin:list-dirs',

  // 音效管理
  SOUND_PLAY: 'sound:play',
  SOUND_PLAY_FILE: 'sound:play-file',
  SOUND_RELOAD: 'sound:reload',
  SOUND_OPEN_USER_DIR: 'sound:open-user-dir',

  // 养成系统
  NURTURE_GET_STATE: 'nurture:get-state',
  NURTURE_INTERACT: 'nurture:interact',
  NURTURE_STATE_UPDATE: 'nurture:state-update',
  NURTURE_POMODORO_COMPLETE: 'nurture:pomodoro-complete',
  POMODORO_GET_COUNT: 'pomodoro:get-count',
  POMODORO_RESET: 'pomodoro:reset',
  NURTURE_DISPLAY_STATE: 'nurture:display-state', // Main → Renderer:显示状态决策结果
  NURTURE_INTERACT_FEEDBACK: 'nurture:interact-feedback', // Main → Renderer:互动反馈(如饱食度已满)
  NURTURE_INTERACT_TRIGGER: 'nurture:interact-trigger', // Main → Renderer:互动类型触发(feed/stroke),用于明确驱动动画
  NURTURE_UNLOCK_CONFIG_GET: 'nurture:unlock-config:get',
  NURTURE_UNLOCK_CONFIG_SET: 'nurture:unlock-config:set',
  NURTURE_STATE_TRANSITION_GET: 'nurture:state-transition:get',
  NURTURE_STATE_TRANSITION_SET: 'nurture:state-transition:set',

  // 安全凭据管理
  GITHUB_SET_CREDENTIALS: 'github:set-credentials',
  GITHUB_GET_CREDENTIALS: 'github:get-credentials',

  // 应用控制
  APP_OPEN_DASHBOARD: 'app:open-dashboard',
  APP_QUIT: 'app:quit',
  APP_GET_STORE: 'app:get-store',
  APP_SET_STORE: 'app:set-store',
  APP_SET_PET_NAME: 'app:set-pet-name',
  APP_GET_PET_NAME: 'app:get-pet-name',
  PET_NAME_CHANGED: 'pet-name:changed',
} as const
