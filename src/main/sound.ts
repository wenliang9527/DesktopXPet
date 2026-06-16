import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import log from 'electron-log/main'

let soundEnabled = true
const soundPaths: Map<string, string> = new Map()

export function initSound(): void {
  const soundDir = join(app.getAppPath(), 'resources', 'sounds')
  const sounds = ['click.wav', 'complete.wav', 'error.wav']

  for (const name of sounds) {
    const p = join(soundDir, name)
    if (fs.existsSync(p)) {
      soundPaths.set(name, p)
    } else {
      log.warn(`Sound file not found: ${p}`)
    }
  }

  log.info(`Sound system initialized: ${soundPaths.size} sounds loaded`)
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

export function isSoundEnabled(): boolean {
  return soundEnabled
}

export function getSoundPath(name: string): string | undefined {
  if (!soundEnabled) return undefined
  return soundPaths.get(name)
}
