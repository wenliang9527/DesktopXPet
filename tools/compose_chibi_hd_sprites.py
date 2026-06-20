#!/usr/bin/env python3
"""
Compose AI-generated chibi sprite sheets into game-ready HD sprite sheets.
v3 — improved pipeline: better BG removal, edge smoothing, sharpening,
larger frames (192x192), consistent alignment.
"""

import os
import json
import numpy as np
from PIL import Image, ImageFilter

# ─── Config ───────────────────────────────────────────────────────────────────

SRC_DIR = r'C:\Users\46166\.qoderworkcn\workspace\mqfy41rn353kwdi6\vibe_images'
OUT_DIR = r'D:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins\butterfly-swordsman-hd'
os.makedirs(OUT_DIR, exist_ok=True)

FRAME_W = 384
FRAME_H = 384

# (state_name, [source_files], frames_per_source, fps, loop)
STATES = [
    ('idle', [
        'v3-idle-a_1781762488.png',
        'v3-idle-b_1781762506.png',
    ], 6, 6, True),
    ('working', [
        'v3-work-a2_1781763194.png',
        'v3-work-b2_1781763238.png',
    ], 6, 10, True),
    ('happy', [
        'v3-happy-a_1781762571.png',
        'v3-happy-b_1781762625.png',
    ], 6, 8, True),
    ('sleeping', [
        'v3-sleeping-a_1781762644.png',
        'v3-sleeping-b_1781762663.png',
    ], 6, 3, True),
    ('error', [
        'v3-error-a_1781762682.png',
        'v3-error-b_1781762702.png',
    ], 6, 6, True),
]

BG_THRESHOLD = 235  # slightly lower to catch near-white with faint colors


# ─── Background removal ──────────────────────────────────────────────────────

def remove_background(img: Image.Image) -> Image.Image:
    """Remove white/near-white background with edge feathering."""
    img = img.convert('RGBA')
    data = np.array(img, dtype=np.float32)
    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]

    # Compute "whiteness" — how close each pixel is to pure white
    # using distance in RGB space
    dist = np.sqrt((255.0 - r) ** 2 + (255.0 - g) ** 2 + (255.0 - b) ** 2)

    # Fully transparent if very close to white
    # Gradual feathering for pixels that are somewhat white
    alpha = np.clip(dist / 30.0 * 255.0, 0, 255).astype(np.uint8)

    # Hard cutoff: if any channel is below threshold, it's definitely content
    content_mask = (r < BG_THRESHOLD) | (g < BG_THRESHOLD) | (b < BG_THRESHOLD)
    alpha[content_mask] = 255

    out = np.array(img, dtype=np.uint8)
    out[:, :, 3] = np.minimum(out[:, :, 3], alpha)
    return Image.fromarray(out)


def remove_separator_lines(img: Image.Image) -> Image.Image:
    """
    Detect and remove wide separator bands (10-30px) between frames in
    AI-generated sprite sheets. These are near-white/gray vertical strips
    that span most of the image height.
    """
    data = np.array(img)
    rgb = data[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]

    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    # A "background" pixel: all channels > 200 and similar to each other
    is_bg = (r > 195) & (g > 195) & (b > 195) & \
            (np.abs(r - g) < 25) & (np.abs(g - b) < 25)
    bg_count = np.sum(is_bg, axis=0)

    # Columns where >75% of pixels are background
    mostly_bg = bg_count > h * 0.75

    # Clear alpha for any narrow (3-25px) background-only band that is
    # surrounded by non-background content on both sides
    runs = []
    start = None
    for x in range(w):
        if mostly_bg[x] and start is None:
            start = x
        elif not mostly_bg[x] and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, w))

    for (x1, x2) in runs:
        width = x2 - x1
        # Only clear internal separator bands (not image edges)
        if 3 <= width <= 30 and x1 > 10 and x2 < w - 10:
            data[:, x1:x2, 3] = 0

    return Image.fromarray(data)


# ─── Frame extraction ─────────────────────────────────────────────────────────

def find_columns(alpha: np.ndarray, expected: int, min_gap: int = 15) -> list:
    """Find character columns. Falls back to even split."""
    h = alpha.shape[0]
    col_density = np.sum(alpha > 40, axis=0)
    active = col_density > (h * 0.015)

    columns = []
    start = None
    for x in range(len(active)):
        if active[x] and start is None:
            start = x
        elif not active[x] and start is not None:
            if x - start > min_gap:
                columns.append((start, x))
            start = None
    if start is not None and len(active) - start > min_gap:
        columns.append((start, len(active)))

    if len(columns) != expected:
        # Merge columns that are too close together
        if len(columns) > expected:
            merged = []
            i = 0
            while i < len(columns):
                if i + 1 < len(columns) and columns[i + 1][0] - columns[i][1] < 30:
                    merged.append((columns[i][0], columns[i + 1][1]))
                    i += 2
                else:
                    merged.append(columns[i])
                    i += 1
            if len(merged) == expected:
                return merged

        # Fall back to even split
        w = alpha.shape[1] // expected
        return [(i * w, (i + 1) * w) for i in range(expected)]

    return columns


def find_row_bounds(alpha: np.ndarray) -> tuple:
    """Find vertical content bounds."""
    rows = np.where(np.sum(alpha > 40, axis=1) > 8)[0]
    if len(rows) == 0:
        return 0, alpha.shape[0]
    return int(rows[0]), int(rows[-1])


def extract_frames(src_path: str, expected_count: int) -> list:
    """Extract individual frames from an AI-generated sprite sheet."""
    img = Image.open(src_path)
    img = remove_background(img)
    img = remove_separator_lines(img)
    data = np.array(img)
    alpha = data[:, :, 3]

    columns = find_columns(alpha, expected_count)
    top, bottom = find_row_bounds(alpha)
    pad = 4
    top = max(0, top - pad)
    bottom = min(img.height, bottom + pad)

    frames = []
    for (x1, x2) in columns:
        # Trim each column's horizontal whitespace
        col_alpha = alpha[top:bottom, x1:x2]
        cols_with_content = np.where(np.sum(col_alpha > 40, axis=0) > 3)[0]
        if len(cols_with_content) > 0:
            cx1 = x1 + int(cols_with_content[0])
            cx2 = x1 + int(cols_with_content[-1]) + 1
        else:
            cx1, cx2 = x1, x2

        frame = img.crop((cx1, top, cx2, bottom))

        # Resize to fill FRAME_W x FRAME_H with minimal padding
        fw, fh = frame.size
        scale = min((FRAME_W - 6) / fw, (FRAME_H - 6) / fh)  # 3px padding each side
        new_w = max(1, int(fw * scale))
        new_h = max(1, int(fh * scale))
        resized = frame.resize((new_w, new_h), Image.LANCZOS)

        # Sharpen
        resized = resized.filter(ImageFilter.UnsharpMask(radius=1.5, percent=80, threshold=3))

        # Bottom-center alignment on canvas
        canvas = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
        offset_x = (FRAME_W - new_w) // 2
        offset_y = FRAME_H - new_h - 2  # 2px bottom margin
        offset_y = max(0, offset_y)
        canvas.paste(resized, (offset_x, offset_y), resized)
        frames.append(canvas)

    return frames


# ─── Composition ──────────────────────────────────────────────────────────────

def compose_sprite_sheet(frames: list, out_path: str):
    """Compose frames into a horizontal sprite sheet."""
    n = len(frames)
    sheet = Image.new('RGBA', (FRAME_W * n, FRAME_H), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_W, 0), frame)
    sheet.save(out_path, 'PNG', optimize=True)
    sz_kb = os.path.getsize(out_path) // 1024
    print(f"  Saved: {out_path}  ({FRAME_W * n}x{FRAME_H}, {n} frames, {sz_kb}KB)")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Composing Chibi HD v3 Sprite Sheets (12 frames, 384x384)")
    print("=" * 60)

    configs = []

    for state_name, src_files, fps_count, fps, loop in STATES:
        all_frames = []
        for src_file in src_files:
            print(f"\n[{state_name}] Processing {src_file}...")
            src_path = os.path.join(SRC_DIR, src_file)
            frames = extract_frames(src_path, fps_count)
            print(f"  Extracted {len(frames)} frames")
            all_frames.extend(frames)

        print(f"  Total: {len(all_frames)} frames")
        out_path = os.path.join(OUT_DIR, f"{state_name}.png")
        compose_sprite_sheet(all_frames, out_path)
        configs.append((state_name, len(all_frames), fps, loop))

    # Preview from first idle frame
    print("\n[preview] Generating preview...")
    idle = Image.open(os.path.join(OUT_DIR, 'idle.png'))
    preview = idle.crop((0, 0, FRAME_W, FRAME_H))
    preview_path = os.path.join(OUT_DIR, 'preview.png')
    preview.save(preview_path, 'PNG', optimize=True)
    print(f"  Saved: {preview_path}")

    # Manifest
    manifest = {
        "name": "蝴蝶剑士 Chibi HD (Butterfly Swordsman Chibi HD)",
        "author": "DesktopXPet",
        "version": "3.0.0",
        "preview": "preview.png",
        "description": "Chibi anime-style Shinobu swordswoman — AI-generated HD sprites v3",
        "frameSize": {"width": FRAME_W, "height": FRAME_H},
        "animations": {
            name: {"frames": count, "fps": f, "loop": lp}
            for name, count, f, lp in configs
        }
    }
    mp = os.path.join(OUT_DIR, 'manifest.json')
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"  Saved: {mp}")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == '__main__':
    main()
