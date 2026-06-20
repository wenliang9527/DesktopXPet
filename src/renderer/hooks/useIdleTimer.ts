import { useCallback, useRef } from 'react'

/**
 * 闲置计时器 hook — N 分钟无鼠标交互后触发回调
 */
export function useIdleTimer(timeoutMinutes: number, onIdle: () => void, onActivity: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isIdleRef = useRef(false)

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if (isIdleRef.current) {
      isIdleRef.current = false
      onActivity()
    }

    timerRef.current = setTimeout(
      () => {
        isIdleRef.current = true
        onIdle()
      },
      timeoutMinutes * 60 * 1000
    )
  }, [timeoutMinutes, onIdle, onActivity])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return { resetTimer, stopTimer, isIdle: isIdleRef.current }
}
