import { useCallback } from 'react'

function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let lastCall = 0
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - lastCall >= ms) {
      lastCall = now
      fn(...args)
    }
  }) as T
}

/**
 * 窗口穿透 hook — 检测鼠标下方像素是否透明
 * 节流处理，每 50ms 最多检测一次
 */
export function useClickThrough(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const checkPixel = useCallback(
    throttle((x: number, y: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const pixel = ctx.getImageData(x, y, 1, 1).data
      // alpha > 0 = 角色区域，通知主进程
      window.desktopXPet.setHoverState(pixel[3] > 0)
    }, 50),
    []
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      checkPixel(x, y)
    },
    [checkPixel]
  )

  const handleMouseLeave = useCallback(() => {
    window.desktopXPet.setHoverState(false)
  }, [])

  return { handleMouseMove, handleMouseLeave }
}
