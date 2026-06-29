import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

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
 * 窗口穿透 hook — 在 document 级别监听 mousemove
 *
 * 窗口穿透模式下（setIgnoreMouseEvents(true, { forward: true })），
 * canvas DOM 元素收不到 mousemove 事件，但 document 能收到。
 * 因此在 document 上监听，计算鼠标相对于 canvas 的坐标，检测像素 alpha。
 *
 * 节流 150ms，同步 hover 状态到 appStore 供 StatusDetailPopup 使用
 *
 * 性能优化：
 * - 缓存 canvas 2D context（避免每次 getContext 重建）
 * - 缓存 bounding rect，仅在 scroll/resize 时刷新（避免每次 mousemove 触发布局回流）
 */
export function useClickThrough(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const lastHoverState = useRef(false)

  useEffect(() => {
    // 缓存的 context 和 rect，避免每次 mousemove 都重新获取
    let cachedCtx: CanvasRenderingContext2D | null = null
    let cachedRect: DOMRect | null = null

    const refreshCache = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      cachedCtx = canvas.getContext('2d', { willReadFrequently: true })
      cachedRect = canvas.getBoundingClientRect()
    }

    const checkPixel = throttle((clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas || !cachedCtx || !cachedRect) return

      const x = Math.floor(clientX - cachedRect.left)
      const y = Math.floor(clientY - cachedRect.top)

      // 鼠标在 canvas 范围外
      if (x < 0 || y < 0 || x >= cachedRect.width || y >= cachedRect.height) {
        if (lastHoverState.current) {
          lastHoverState.current = false
          useAppStore.getState().setHovering(false)
        }
        return
      }

      let isOnPet = false
      try {
        // getImageData 使用设备像素坐标，需要乘以 DPR
        const dpr = window.devicePixelRatio || 1
        const pixel = cachedCtx.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data
        isOnPet = pixel[3] > 0
      } catch {
        // canvas 未就绪，忽略
        return
      }

      if (isOnPet !== lastHoverState.current) {
        lastHoverState.current = isOnPet
        useAppStore.getState().setHovering(isOnPet)
      }
    }, 150)

    const handleMouseMove = (e: MouseEvent) => {
      checkPixel(e.clientX, e.clientY)
    }

    // 初始化缓存，并在 scroll/resize 时刷新（避免每次 mousemove 调用 getBoundingClientRect）
    refreshCache()
    window.addEventListener('scroll', refreshCache, true)
    window.addEventListener('resize', refreshCache)

    // 在 document 上监听，穿透模式下也能收到事件
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', refreshCache, true)
      window.removeEventListener('resize', refreshCache)
    }
  }, [canvasRef])
}
