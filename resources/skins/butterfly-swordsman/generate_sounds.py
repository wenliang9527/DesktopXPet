"""
生成蝴蝶剑士皮肤的武侠风音效 WAV 文件
- click.wav:    剑气轻响 (金属碰撞短音)
- complete.wav: 收剑归鞘 (金属摩擦+归鞘声)
- error.wav:    刀剑相击 (激烈金属碰撞)
"""
import wave
import struct
import math
import os

SAMPLE_RATE = 44100
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sounds')


def write_wav(filename: str, samples: list[int], channels: int = 1):
    """写入 16-bit PCM WAV 文件"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, filename)
    with wave.open(path, 'w') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(SAMPLE_RATE)
        for s in samples:
            w.writeframes(struct.pack('<h', max(-32768, min(32767, s))))
    print(f"  Written: {path} ({len(samples)} samples, {len(samples)/SAMPLE_RATE:.3f}s)")


def generate_click():
    """剑气轻响：高频金属碰撞，短促清脆"""
    n = int(SAMPLE_RATE * 0.3)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # 快速指数衰减
        env = math.exp(-t * 15)
        # 金属碰撞：高频正弦叠加 + 少量噪声
        val = (math.sin(2 * math.pi * 2400 * t) * 0.35 +
               math.sin(2 * math.pi * 3600 * t) * 0.2 +
               math.sin(2 * math.pi * 1800 * t) * 0.15 +
               (math.sin(2 * math.pi * 5200 * t) * 0.08)) * env
        samples.append(int(val * 32767))
    write_wav('click.wav', samples)


def generate_complete():
    """收剑归鞘：金属摩擦滑音 + 低频归鞘声"""
    # 阶段1：金属摩擦滑音 (0-0.3s)，高频下行
    n1 = int(SAMPLE_RATE * 0.3)
    phase1 = []
    for i in range(n1):
        t = i / SAMPLE_RATE
        progress = i / n1
        # 频率从 3000Hz 下滑到 800Hz
        freq = 3000 - 2200 * progress
        env = 1.0 - progress * 0.6  # 逐渐减弱
        val = (math.sin(2 * math.pi * freq * t) * 0.3 +
               math.sin(2 * math.pi * freq * 1.5 * t) * 0.1) * env
        phase1.append(int(val * 32767))

    # 短暂间隔
    gap = [0] * int(SAMPLE_RATE * 0.05)

    # 阶段2：归鞘低频冲击 (0.2s)
    n2 = int(SAMPLE_RATE * 0.2)
    phase2 = []
    for i in range(n2):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 12)
        val = (math.sin(2 * math.pi * 200 * t) * 0.4 +
               math.sin(2 * math.pi * 400 * t) * 0.15 +
               math.sin(2 * math.pi * 150 * t) * 0.1) * env
        phase2.append(int(val * 32767))

    samples = phase1 + gap + phase2
    write_wav('complete.wav', samples)


def generate_error():
    """刀剑相击：激烈金属碰撞，双击"""
    def metal_clash(duration: float, volume: float = 0.5):
        n = int(SAMPLE_RATE * duration)
        samples = []
        for i in range(n):
            t = i / SAMPLE_RATE
            env = math.exp(-t * 10)
            # 刀剑碰撞：多个不和谐高频 + 低频冲击
            val = (math.sin(2 * math.pi * 1200 * t) * 0.3 +
                   math.sin(2 * math.pi * 2800 * t) * 0.2 +
                   math.sin(2 * math.pi * 4400 * t) * 0.1 +
                   math.sin(2 * math.pi * 180 * t) * 0.2 +
                   math.sin(2 * math.pi * 600 * t) * 0.15) * env * volume
            samples.append(int(val * 32767))
        return samples

    # 第一次碰撞
    clash1 = metal_clash(0.25, 0.5)
    # 短暂间隔
    gap = [0] * int(SAMPLE_RATE * 0.08)
    # 第二次碰撞（更重）
    clash2 = metal_clash(0.35, 0.6)

    samples = clash1 + gap + clash2
    write_wav('error.wav', samples)


if __name__ == '__main__':
    print("Generating butterfly-swordsman skin sound effects...")
    generate_click()
    generate_complete()
    generate_error()
    print("Done!")
