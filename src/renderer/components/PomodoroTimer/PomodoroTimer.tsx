import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'

type PomodoroPhase = 'work' | 'break' | 'idle'

interface PomodoroState {
  phase: PomodoroPhase
  remaining: number // 剩余秒数
  running: boolean
}

const DEFAULT_WORK_MINUTES = 25
const DEFAULT_BREAK_MINUTES = 5

/**
 * 番茄钟提醒系统
 * 25 分钟工作 + 5 分钟休息循环
 * 时间到时推送通知 + 播放音效
 */
export default function PomodoroTimer() {
  const [workMinutes, setWorkMinutes] = useState(DEFAULT_WORK_MINUTES)
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES)
  const [state, setState] = useState<PomodoroState>({
    phase: 'idle',
    remaining: DEFAULT_WORK_MINUTES * 60,
    running: false,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 番茄钟完成计数统一由主进程管理（growth.pomodorosCompleted），通过 appStore 订阅
  const nurtureState = useAppStore((s) => s.nurtureState)
  const completedPomodoros = nurtureState?.growth.pomodorosCompleted ?? 0

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  // 防止阶段完成回调重复触发(倒计时到 0 与用户点击跳过可能同时发生)
  const phaseCompleteFiredRef = useRef(false)

  // 格式化时间 mm:ss
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 阶段结束时触发
  const handlePhaseComplete = useCallback(() => {
    // 防止重复触发(倒计时到 0 的 useEffect 与用户点击跳过可能同时触发)
    if (phaseCompleteFiredRef.current) return
    phaseCompleteFiredRef.current = true

    const current = stateRef.current
    if (current.phase === 'work') {
      // 工作结束,进入休息
      const breakSeconds = breakMinutes * 60
      setState((prev) => ({
        ...prev,
        phase: 'break',
        remaining: breakSeconds,
      }))
      // 通知 + 音效
      try {
        new Notification('番茄工作法', { body: '工作完成!休息一下 ☕' })
      } catch {
        // Notification 可能不可用
      }
      window.desktopXPet.playSound('complete')
      window.desktopXPet.nurturePomodoroComplete()
    } else if (current.phase === 'break') {
      // 休息结束,进入工作
      const workSeconds = workMinutes * 60
      setState((prev) => ({
        ...prev,
        phase: 'work',
        remaining: workSeconds,
      }))
      try {
        new Notification('番茄工作法', { body: '休息结束,开始工作 🎯' })
      } catch {
        // ignore
      }
      window.desktopXPet.playSound('click')
    }
  }, [breakMinutes, workMinutes])

  // 倒计时
  useEffect(() => {
    if (!state.running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.remaining <= 1) {
          // 阶段结束,仅置零;由下面的 useEffect 监听 remaining===0 触发回调
          return { ...prev, remaining: 0 }
        }
        return { ...prev, remaining: prev.remaining - 1 }
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state.running])

  // 监听 remaining === 0 触发阶段完成(用 ref 防重复,避免与"跳过"按钮竞态)
  useEffect(() => {
    if (state.remaining === 0 && state.running && state.phase !== 'idle') {
      handlePhaseComplete()
    }
  }, [state.remaining, state.running, state.phase, handlePhaseComplete])

  // remaining 恢复为正值时,重置防重复标记,允许下次阶段完成触发
  useEffect(() => {
    if (state.remaining > 0) {
      phaseCompleteFiredRef.current = false
    }
  }, [state.remaining])

  const handleStart = (): void => {
    if (state.phase === 'idle') {
      setState({
        phase: 'work',
        remaining: workMinutes * 60,
        running: true,
      })
      // 重置主进程中的番茄钟计数
      window.desktopXPet.resetPomodoroCount()
    } else {
      setState((prev) => ({ ...prev, running: true }))
    }
  }

  const handlePause = (): void => {
    setState((prev) => ({ ...prev, running: false }))
  }

  const handleReset = (): void => {
    setState({
      phase: 'idle',
      remaining: workMinutes * 60,
      running: false,
    })
    // 重置主进程中的番茄钟计数
    window.desktopXPet.resetPomodoroCount()
  }

  const handleSkip = (): void => {
    handlePhaseComplete()
  }

  // 时长配置变更时,如果处于 idle,更新 remaining
  const handleWorkMinutesChange = (value: number): void => {
    const v = Math.max(1, Math.min(120, value))
    setWorkMinutes(v)
    if (state.phase === 'idle') {
      setState((prev) => ({ ...prev, remaining: v * 60 }))
    }
  }

  const handleBreakMinutesChange = (value: number): void => {
    const v = Math.max(1, Math.min(60, value))
    setBreakMinutes(v)
  }

  const phaseLabel = state.phase === 'work' ? '工作中' : state.phase === 'break' ? '休息中' : '待机'
  const phaseColor = state.phase === 'work' ? '#f44336' : state.phase === 'break' ? '#4CAF50' : '#9E9E9E'
  const progress = state.phase === 'idle'
    ? 0
    : 1 - state.remaining / ((state.phase === 'work' ? workMinutes : breakMinutes) * 60)

  return (
    <div className="pomodoro-timer">
      <h3 className="section-title">🍅 番茄钟</h3>

      {/* 计时显示 */}
      <div className="pomodoro-display" style={{ borderColor: phaseColor }}>
        <div className="pomodoro-phase" style={{ color: phaseColor }}>
          {phaseLabel}
        </div>
        <div className="pomodoro-time">{formatTime(state.remaining)}</div>
        <div className="pomodoro-count">已完成 {completedPomodoros} 个番茄</div>
        {/* 进度条 */}
        <div className="pomodoro-progress-bar">
          <div
            className="pomodoro-progress-fill"
            style={{ width: `${progress * 100}%`, backgroundColor: phaseColor }}
          />
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="pomodoro-controls">
        {!state.running ? (
          <button className="pomodoro-btn start" onClick={handleStart}>
            {state.phase === 'idle' ? '开始' : '继续'}
          </button>
        ) : (
          <button className="pomodoro-btn pause" onClick={handlePause}>
            暂停
          </button>
        )}
        <button className="pomodoro-btn skip" onClick={handleSkip} disabled={state.phase === 'idle'}>
          跳过
        </button>
        <button className="pomodoro-btn reset" onClick={handleReset}>
          重置
        </button>
      </div>

      {/* 时长配置 */}
      <div className="pomodoro-config">
        <div className="pomodoro-config-row">
          <label>工作时长(分钟)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={workMinutes}
            onChange={(e) => handleWorkMinutesChange(Number(e.target.value))}
            disabled={state.running}
          />
        </div>
        <div className="pomodoro-config-row">
          <label>休息时长(分钟)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={breakMinutes}
            onChange={(e) => handleBreakMinutesChange(Number(e.target.value))}
            disabled={state.running}
          />
        </div>
      </div>
    </div>
  )
}
