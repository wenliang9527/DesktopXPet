/**
 * 统一日志工具
 * 为每个模块添加 scope 字段，便于定位问题来源
 */
import log from 'electron-log/main'

// 文件日志在某些环境下会出现 EBADF 错误，禁用文件传输避免刷屏
log.transports.file.level = false
log.transports.console.level = 'debug'

/**
 * 创建带 scope 的日志实例
 * @param scope 模块名称，用于日志前缀
 */
export function createLogger(scope: string) {
  return {
    info: (message: string, ...args: unknown[]) => log.info(`[${scope}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => log.warn(`[${scope}] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => log.error(`[${scope}] ${message}`, ...args),
    debug: (message: string, ...args: unknown[]) => log.debug(`[${scope}] ${message}`, ...args),
  }
}

export type Logger = ReturnType<typeof createLogger>
