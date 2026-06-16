import { useAppStore } from '../../stores/appStore'

export default function StatusBubble() {
  const summary = useAppStore((s) => s.summary)
  const showBubble = useAppStore((s) => s.showBubble)

  if (!showBubble) return null

  return <div className="status-bubble">{summary}</div>
}
