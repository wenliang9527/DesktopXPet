import { useCallback, useRef, useState } from 'react'

/**
 * 拖拽 hook — mousedown 记录偏移 → mousemove 更新窗口位置 → mouseup 保存位置
 */
export function useDraggable() {
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // 只响应左键
    if (e.button !== 0) return

    setIsDragging(true)
    dragOffset.current = {
      x: e.screenX,
      y: e.screenY
    }

    const onMouseMove = async (moveEvent: MouseEvent): Promise<void> => {
      const dx = moveEvent.screenX - dragOffset.current.x
      const dy = moveEvent.screenY - dragOffset.current.y

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        // 获取当前窗口位置并更新
        const pos = await window.desktopXPet.getPosition()
        if (pos) {
          const newX = pos.x + dx
          const newY = pos.y + dy
          window.desktopXPet.setPosition(newX, newY)
          dragOffset.current = {
            x: moveEvent.screenX,
            y: moveEvent.screenY
          }
        }
      }
    }

    const onMouseUp = (): void => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return { isDragging, onMouseDown }
}
