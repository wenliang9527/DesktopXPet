"""
生成 DesktopXPet 的音效 WAV 文件
- click.wav:    清脆点击音 (短促高频)
- complete.wav: 愉悦完成音 (上行双音)
- error.wav:    警告错误音 (下行双音)
"""
import wave
import struct
import math
import os

SAMPLE_RATE = 44100
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


def write_wav(filename: str, samples: list[int], channels: int = 1):
    """写入 16-bit PCM WAV 文件"""
    path = os.path.join(OUTPUT_DIR, filename)
    with wave.open(path, 'w') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(SAMPLE_RATE)
        for s in samples:
            w.writeframes(struct.pack('<h', max(-32768, min(32767, s))))
    print(f"  Written: {path} ({len(samples)} samples, {len(samples)/SAMPLE_RATE:.3f}s)")


def generate_tone(freq: float, duration_ms: float, volume: float = 0.5,
                  fade_in_ms: float = 5, fade_out_ms: float = 30) -> list[int]:
    """生成单一频率的正弦波，带淡入淡出"""
    n = int(SAMPLE_RATE * duration_ms / 1000)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # 包络：淡入 + 淡出
        env = 1.0
        if i < int(SAMPLE_RATE * fade_in_ms / 1000):
            env = i / (SAMPLE_RATE * fade_in_ms / 1000)
        elif i > n - int(SAMPLE_RATE * fade_out_ms / 1000):
            env = (n - i) / (SAMPLE_RATE * fade_out_ms / 1000)
        val = math.sin(2 * math.pi * freq * t) * volume * env
        samples.append(int(val * 32767))
    return samples


def generate_click():
    """清脆点击音：短促的高频脉冲"""
    # 800Hz 主音 + 1200Hz 泛音，共 40ms
    n = int(SAMPLE_RATE * 0.04)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # 指数衰减包络
        env = math.exp(-t * 120)
        val = (math.sin(2 * math.pi * 800 * t) * 0.4 +
               math.sin(2 * math.pi * 1200 * t) * 0.2) * env
        samples.append(int(val * 32767))
    write_wav('click.wav', samples)


def generate_complete():
    """完成音：上行双音阶，愉悦感"""
    # 第一音：C5 (523Hz)，150ms
    tone1 = generate_tone(523, 150, volume=0.45, fade_in_ms=5, fade_out_ms=20)
    # 短暂间隔 20ms 静音
    gap = [0] * int(SAMPLE_RATE * 0.02)
    # 第二音：E5 (659Hz) → G5 (784Hz) 滑音，200ms
    n2 = int(SAMPLE_RATE * 0.20)
    tone2 = []
    for i in range(n2):
        t = i / SAMPLE_RATE
        progress = i / n2
        # 从 659Hz 滑到 784Hz
        freq = 659 + (784 - 659) * progress
        env = 1.0
        if i < int(SAMPLE_RATE * 0.005):
            env = i / (SAMPLE_RATE * 0.005)
        elif i > n2 - int(SAMPLE_RATE * 0.04):
            env = (n2 - i) / (SAMPLE_RATE * 0.04)
        val = math.sin(2 * math.pi * freq * t) * 0.45 * env
        # 加入柔和泛音
        val += math.sin(2 * math.pi * freq * 2 * t) * 0.1 * env
        tone2.append(int(val * 32767))

    samples = tone1 + gap + tone2
    write_wav('complete.wav', samples)


def generate_error():
    """错误音：下行双音，略带紧张感"""
    # 第一音：A4 (440Hz)，120ms
    tone1 = generate_tone(440, 120, volume=0.4, fade_in_ms=3, fade_out_ms=15)
    # 短暂间隔 30ms
    gap = [0] * int(SAMPLE_RATE * 0.03)
    # 第二音：下降音 F4 (349Hz) → D4 (293Hz)，180ms
    n2 = int(SAMPLE_RATE * 0.18)
    tone2 = []
    for i in range(n2):
        t = i / SAMPLE_RATE
        progress = i / n2
        freq = 349 - (349 - 293) * progress
        env = 1.0
        if i < int(SAMPLE_RATE * 0.003):
            env = i / (SAMPLE_RATE * 0.003)
        elif i > n2 - int(SAMPLE_RATE * 0.05):
            env = (n2 - i) / (SAMPLE_RATE * 0.05)
        val = math.sin(2 * math.pi * freq * t) * 0.4 * env
        # 加入方波色彩增加粗糙感
        val += (1 if math.sin(2 * math.pi * freq * t) > 0 else -1) * 0.08 * env
        tone2.append(int(val * 32767))

    samples = tone1 + gap + tone2
    write_wav('error.wav', samples)


if __name__ == '__main__':
    print("Generating DesktopXPet sound effects...")
    generate_click()
    generate_complete()
    generate_error()
    print("Done!")
