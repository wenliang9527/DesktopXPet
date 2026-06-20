import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 拖拽 hook — mousedown 记录偏移 → mousemove 更新窗口位置 → mouseup 保存位置
 *
 * 性能优化：
 * - mousedown 时一次性获取窗口位置，之后用增量直接计算新位置
 * - mousemove 只调用 setPosition（1 次 IPC），不再每次 getPosition（避免 2 次 IPC）
 * - 用 rAF 合并连续 mousemove，避免 IPC 调用堆积
 * - 组件卸载时清理 rAF 和事件监听器
 */
export function useDraggable() {
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const winPos = useRef({ x: 0, y: 0 })
  const rafPending = useRef(false)
  const rafId = useRef<number | null>(null)
  const pendingPos = useRef({ x: 0, y: 0 })
  const moveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null)
  const upHandlerRef = useRef<((e: MouseEvent) => void) | null>(null)

  // 组件卸载时清理所有资源
  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
      if (moveHandlerRef.current) document.removeEventListener('mousemove', moveHandlerRef.current)
      if (upHandlerRef.current) document.removeEventListener('mouseup', upHandlerRef.current)
    }
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // 只响应左键
    if (e.button !== 0) return

    setIsDragging(true)
    dragOffset.current = {
      x: e.screenX,
      y: e.screenY,
    }

    // 一次性获取窗口初始位置，后续用增量计算（避免每次 mousemove 都 IPC getPosition）
    window.desktopXPet
      .getPosition()
      .then((pos) => {
        if (pos) winPos.current = pos
      })
      .catch(() => {
        // 忽略位置获取失败
      })

    const onMouseMove = (moveEvent: MouseEvent): void => {
      const dx = moveEvent.screenX - dragOffset.current.x
      const dy = moveEvent.screenY - dragOffset.current.y

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        // 计算新位置
        const newX = winPos.current.x + dx
        const newY = winPos.current.y + dy
        pendingPos.current = { x: newX, y: newY }

        // 用 rAF 合并连续 mousemove，避免 IPC 调用堆积
        if (!rafPending.current) {
          rafPending.current = true
          rafId.current = requestAnimationFrame(() => {
            rafPending.current = false
            rafId.current = null
            window.desktopXPet.setPosition(pendingPos.current.x, pendingPos.current.y)
          })
        }
      }
    }

    const onMouseUp = (): void => {
      setIsDragging(false)
      // 清理 rAF
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
        rafPending.current = false
      }
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      moveHandlerRef.current = null
      upHandlerRef.current = null
    }

    moveHandlerRef.current = onMouseMove
    upHandlerRef.current = onMouseUp
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return { isDragging, onMouseDown }
}
