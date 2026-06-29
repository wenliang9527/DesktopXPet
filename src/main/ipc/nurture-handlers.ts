import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import {
  UNLOCK_CONFIG_DEFAULT,
  STATE_TRANSITION_DEFAULT,
} from '../../shared/constants'
import type { InteractType, UnlockConfig, StateTransitionConfig } from '../../shared/types'
import { storeGet, storeSet } from '../store'
import { container } from '../container'

/**
 * 注册养成系统相关 IPC 处理器
 */
export function registerNurtureHandlers(): void {
  ipcMain.handle(IPC.NURTURE_GET_STATE, async () => {
    return container.get('nurtureService')?.getState()
  })

  ipcMain.handle(IPC.NURTURE_INTERACT, async (_, { type }: { type: string }) => {
    return container.get('nurtureService')?.interact(type as InteractType)
  })

  ipcMain.handle(IPC.NURTURE_POMODORO_COMPLETE, async () => {
    // 番茄钟完成计数统一由 NurtureService 管理（growth.pomodorosCompleted）
    container.get('nurtureService')?.onPomodoroCompleted()
  })

  ipcMain.handle(IPC.POMODORO_GET_COUNT, async () => {
    const state = container.get('nurtureService')?.getState()
    return state?.growth.pomodorosCompleted ?? 0
  })

  ipcMain.handle(IPC.POMODORO_RESET, async () => {
    container.get('nurtureService')?.resetPomodoroCount()
  })

  // 解锁配置读写
  ipcMain.handle(IPC.NURTURE_UNLOCK_CONFIG_GET, async (): Promise<UnlockConfig> => {
    return storeGet('nurture.unlockConfig') ?? { ...UNLOCK_CONFIG_DEFAULT }
  })

  ipcMain.handle(
    IPC.NURTURE_UNLOCK_CONFIG_SET,
    async (_, config: UnlockConfig): Promise<void> => {
      storeSet('nurture.unlockConfig', config)
      // 实时更新到 NurtureService(无需重启即生效)
      container.get('nurtureService')?.setUnlockConfig(config)
    }
  )

  // 状态切换冷却配置读写
  ipcMain.handle(
    IPC.NURTURE_STATE_TRANSITION_GET,
    async (): Promise<StateTransitionConfig> => {
      return storeGet('nurture.stateTransition') ?? { ...STATE_TRANSITION_DEFAULT }
    }
  )

  ipcMain.handle(
    IPC.NURTURE_STATE_TRANSITION_SET,
    async (_, config: StateTransitionConfig): Promise<void> => {
      storeSet('nurture.stateTransition', config)
      // 实时更新到 NurtureService(无需重启即生效)
      container.get('nurtureService')?.setStateTransitionConfig(config)
    }
  )
}
