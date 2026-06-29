/**
 * IPC 工具函数
 * 提供超时处理和统一返回结构
 */

export type IPCResult<T> = { success: true; data: T } | { success: false; error: string }

/**
 * 为异步函数添加超时保护
 * @param fn 异步函数
 * @param timeoutMs 超时毫秒数，默认 5000
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = 5000
): Promise<IPCResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('IPC timeout')), timeoutMs)
  })

  try {
    const data = await Promise.race([fn(), timeout])
    return { success: true, data }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error }
  } finally {
    // fn() 提前完成时清除定时器，避免泄漏挂起的定时器
    if (timer) clearTimeout(timer)
  }
}
