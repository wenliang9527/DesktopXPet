import fs from 'fs'
import { createLogger } from './logger'

const log = createLogger('fs-utils')

/**
 * 确保目录存在（带重试，应对 Windows 上杀毒软件/文件锁定的临时 EPERM）
 * 异步实现，避免 busy wait 阻塞主进程
 */
export async function ensureDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      return
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code === 'EPERM' || code === 'EACCES') {
        if (attempt < 2) {
          // 异步等待 100ms，不阻塞主进程
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue
        }
      }
      log.warn(`Failed to create directory ${dir} after ${attempt + 1} attempts:`, err)
      return
    }
  }
}
