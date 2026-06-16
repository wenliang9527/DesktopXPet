"""
DesktopXPet - Pixel Cat Sprite Sheet Generator (HD)
Generates 5 sprite sheets: idle, working, happy, sleeping, error
Internal 64x64 (32×2) → output 128x128 with nearest-neighbor scaling
"""

from PIL import Image, ImageDraw
import os

# ============================================================
# Configuration
# ============================================================
DRAW_SIZE = 32        # Logical drawing coordinates (32x32)
SCALE = 2             # Coordinate scale factor
FRAME_SIZE = DRAW_SIZE * SCALE  # Actual canvas: 64x64
OUTPUT_SIZE = 128     # Output sprite frame size

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "resources", "skins", "default-cat")

# ============================================================
# Color Palette — warm orange tabby cat
# ============================================================
C = {
    'transparent': (0, 0, 0, 0),
    'outline':      (60, 42, 33, 255),       # Dark brown outlines
    'fur':          (245, 180, 100, 255),     # Main orange fur
    'fur_light':    (255, 210, 145, 255),    # Lighter fur / belly
    'fur_dark':     (210, 140, 65, 255),     # Stripe / shadow
    'ear_inner':    (255, 160, 160, 255),    # Pink inner ear
    'eye_white':    (255, 255, 255, 255),
    'eye_pupil':    (50, 50, 50, 255),
    'eye_shine':    (255, 255, 255, 255),
    'nose':         (255, 140, 140, 255),    # Pink nose
    'mouth':        (180, 100, 80, 255),     # Mouth line
    'blush':        (255, 180, 170, 120),    # Cheek blush (semi-transparent)
    'zzz':          (140, 160, 220, 200),    # Sleep Z letters
    'sparkle':      (255, 255, 100, 255),    # Happy sparkle
    'sweat':        (130, 200, 255, 255),    # Error sweat drop
    'laptop':       (100, 110, 130, 255),    # Laptop body
    'laptop_screen':(170, 220, 255, 255),    # Laptop screen glow
    'star':         (255, 230, 80, 255),     # Stars
}


# ============================================================
# ScaledDraw — 所有坐标自动 ×2，绘制代码仍基于 32x32 逻辑
# ============================================================
class ScaledDraw:
    def __init__(self, draw: ImageDraw.ImageDraw, s=SCALE):
        self._d = draw
        self._s = s

    def point(self, xy, fill=None):
        x, y = xy
        self._d.point((x*self._s, y*self._s), fill=fill)

    def rectangle(self, xy, fill=None, outline=None, width=1):
        x0, y0, x1, y1 = xy
        self._d.rectangle(
            [x0*self._s, y0*self._s, x1*self._s + self._s - 1, y1*self._s + self._s - 1],
            fill=fill, outline=outline, width=width*self._s
        )

    def rounded_rectangle(self, xy, radius=0, fill=None, outline=None, width=1):
        x0, y0, x1, y1 = xy
        self._d.rounded_rectangle(
            [x0*self._s, y0*self._s, x1*self._s + self._s - 1, y1*self._s + self._s - 1],
            radius=radius*self._s, fill=fill, outline=outline, width=width*self._s
        )

    def ellipse(self, xy, fill=None, outline=None, width=1):
        x0, y0, x1, y1 = xy
        self._d.ellipse(
            [x0*self._s, y0*self._s, x1*self._s + self._s - 1, y1*self._s + self._s - 1],
            fill=fill, outline=outline, width=width*self._s
        )

    def polygon(self, points, fill=None, outline=None):
        scaled = [(x*self._s + self._s//2, y*self._s + self._s//2) for x, y in points]
        self._d.polygon(scaled, fill=fill, outline=outline)

    def line(self, xy, fill=None, width=1):
        if isinstance(xy[0], (tuple, list)):
            scaled = [(x*self._s + self._s//2, y*self._s + self._s//2) for x, y in xy]
        else:
            scaled = [coord * self._s + self._s//2 for coord in xy]
        self._d.line(scaled, fill=fill, width=width*self._s)

    def arc(self, xy, start, end, fill=None, width=1):
        x0, y0, x1, y1 = xy
        self._d.arc(
            [x0*self._s, y0*self._s, x1*self._s + self._s - 1, y1*self._s + self._s - 1],
            start, end, fill=fill, width=width*self._s
        )


def new_frame():
    """Create a blank 64x64 RGBA frame with ScaledDraw wrapper."""
    img = Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), C['transparent'])
    return img, ScaledDraw(ImageDraw.Draw(img))


def rect(draw, x, y, w, h, color):
    """Draw a filled rectangle (pixel-art friendly)."""
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


def px(draw, x, y, color):
    """Draw a single pixel."""
    draw.point((x, y), fill=color)


# ============================================================
# Cat Drawing Functions
# ============================================================

def draw_ears(draw, offset_y=0):
    """Draw cat ears."""
    ol = C['outline']
    fur = C['fur']
    inner = C['ear_inner']
    oy = offset_y

    # Left ear (triangle)
    draw.polygon([(8, 7+oy), (11, 2+oy), (14, 7+oy)], fill=fur, outline=ol)
    draw.polygon([(10, 7+oy), (11, 4+oy), (13, 7+oy)], fill=inner)

    # Right ear (triangle)
    draw.polygon([(18, 7+oy), (21, 2+oy), (24, 7+oy)], fill=fur, outline=ol)
    draw.polygon([(19, 7+oy), (21, 4+oy), (22, 7+oy)], fill=inner)


def draw_head(draw, offset_y=0, eyes='open', mouth='normal'):
    """Draw cat head with configurable eyes and mouth."""
    ol = C['outline']
    fur = C['fur']
    light = C['fur_light']
    oy = offset_y

    # Head shape (rounded rectangle)
    draw.rounded_rectangle([7, 6+oy, 24, 17+oy], radius=3, fill=fur, outline=ol)

    # Lighter face center
    draw.rounded_rectangle([10, 10+oy, 21, 16+oy], radius=2, fill=light)

    # Stripes on forehead
    rect(draw, 13, 7+oy, 1, 2, C['fur_dark'])
    rect(draw, 16, 6+oy, 1, 2, C['fur_dark'])
    rect(draw, 19, 7+oy, 1, 2, C['fur_dark'])

    # Eyes
    if eyes == 'open':
        # Left eye
        rect(draw, 10, 11+oy, 3, 3, C['eye_white'])
        rect(draw, 11, 11+oy, 2, 2, C['eye_pupil'])
        px(draw, 12, 11+oy, C['eye_shine'])
        # Right eye
        rect(draw, 19, 11+oy, 3, 3, C['eye_white'])
        rect(draw, 20, 11+oy, 2, 2, C['eye_pupil'])
        px(draw, 21, 11+oy, C['eye_shine'])
    elif eyes == 'half':
        # Half-closed eyes (sleepy / focused)
        rect(draw, 10, 12+oy, 3, 2, C['eye_white'])
        rect(draw, 11, 12+oy, 2, 1, C['eye_pupil'])
        rect(draw, 19, 12+oy, 3, 2, C['eye_white'])
        rect(draw, 20, 12+oy, 2, 1, C['eye_pupil'])
    elif eyes == 'closed':
        # Closed eyes (sleeping / happy)
        draw.line([(10, 12+oy), (13, 12+oy)], fill=ol, width=1)
        draw.line([(19, 12+oy), (22, 12+oy)], fill=ol, width=1)
    elif eyes == 'closed_up':
        # Closed happy eyes (curved up like ^_^ )
        draw.line([(10, 13+oy), (11, 12+oy), (13, 13+oy)], fill=ol, width=1)
        draw.line([(19, 13+oy), (20, 12+oy), (22, 13+oy)], fill=ol, width=1)
    elif eyes == 'wide':
        # Wide surprised eyes
        rect(draw, 9, 10+oy, 4, 4, C['eye_white'])
        rect(draw, 10, 11+oy, 3, 3, C['eye_pupil'])
        px(draw, 11, 10+oy, C['eye_shine'])
        rect(draw, 18, 10+oy, 4, 4, C['eye_white'])
        rect(draw, 19, 11+oy, 3, 3, C['eye_pupil'])
        px(draw, 20, 10+oy, C['eye_shine'])
    elif eyes == 'blink':
        # Blinking (thin line)
        rect(draw, 10, 12+oy, 3, 1, C['eye_pupil'])
        rect(draw, 19, 12+oy, 3, 1, C['eye_pupil'])

    # Nose
    draw.polygon([(15, 14+oy), (16, 13+oy), (17, 14+oy)], fill=C['nose'])

    # Mouth
    if mouth == 'normal':
        px(draw, 14, 15+oy, C['mouth'])
        px(draw, 17, 15+oy, C['mouth'])
        draw.line([(14, 15+oy), (16, 16+oy)], fill=C['mouth'])
        draw.line([(17, 15+oy), (16, 16+oy)], fill=C['mouth'])
    elif mouth == 'happy':
        draw.arc([13, 14+oy, 19, 18+oy], 0, 180, fill=C['mouth'])
    elif mouth == 'open':
        draw.ellipse([14, 15+oy, 18, 17+oy], fill=C['mouth'], outline=ol)
    elif mouth == 'w':
        # Cat mouth like w
        draw.line([(13, 15+oy), (15, 16+oy), (16, 15+oy), (17, 16+oy), (19, 15+oy)], fill=C['mouth'])

    # Blush
    rect(draw, 8, 13+oy, 2, 1, C['blush'])
    rect(draw, 22, 13+oy, 2, 1, C['blush'])


def draw_body(draw, offset_y=0, has_laptop=False):
    """Draw cat body."""
    ol = C['outline']
    fur = C['fur']
    light = C['fur_light']
    oy = offset_y

    # Body
    draw.rounded_rectangle([9, 17+oy, 23, 26+oy], radius=3, fill=fur, outline=ol)

    # Belly
    draw.rounded_rectangle([12, 19+oy, 20, 25+oy], radius=2, fill=light)

    # Stripes on body
    rect(draw, 10, 19+oy, 1, 4, C['fur_dark'])
    rect(draw, 21, 19+oy, 1, 4, C['fur_dark'])

    if has_laptop:
        # Laptop in front of cat
        rect(draw, 8, 24+oy, 16, 2, C['laptop'])        # base
        rect(draw, 10, 20+oy, 12, 4, C['laptop'])        # screen back
        rect(draw, 11, 21+oy, 10, 2, C['laptop_screen'])  # screen glow
        # Keyboard dots
        for kx in range(9, 23, 2):
            px(draw, kx, 25+oy, C['outline'])
    else:
        # Paws (front)
        draw.rounded_rectangle([10, 25+oy, 14, 28+oy], radius=1, fill=fur, outline=ol)
        draw.rounded_rectangle([18, 25+oy, 22, 28+oy], radius=1, fill=fur, outline=ol)
        # Paw pads
        rect(draw, 11, 26+oy, 2, 1, C['ear_inner'])
        rect(draw, 19, 26+oy, 2, 1, C['ear_inner'])


def draw_tail(draw, curl=0, offset_y=0):
    """Draw tail with configurable curl. curl: 0=normal, 1=up, 2=down, 3=wag-left, 4=wag-right."""
    fur = C['fur']
    ol = C['outline']
    oy = offset_y

    if curl == 0:
        # Normal tail curving right
        draw.line([(23, 24+oy), (25, 22+oy), (26, 20+oy), (27, 19+oy)], fill=fur, width=2)
        draw.line([(23, 24+oy), (25, 22+oy), (26, 20+oy), (27, 19+oy)], fill=ol, width=1)
        px(draw, 27, 18+oy, C['fur_dark'])
    elif curl == 1:
        # Tail up (happy)
        draw.line([(23, 24+oy), (25, 21+oy), (26, 18+oy), (27, 16+oy), (28, 15+oy)], fill=fur, width=2)
        px(draw, 28, 14+oy, C['fur_dark'])
    elif curl == 2:
        # Tail down
        draw.line([(23, 24+oy), (25, 25+oy), (27, 26+oy)], fill=fur, width=2)
    elif curl == 3:
        # Tail wag left
        draw.line([(23, 24+oy), (25, 22+oy), (26, 21+oy), (25, 19+oy)], fill=fur, width=2)
        px(draw, 25, 18+oy, C['fur_dark'])
    elif curl == 4:
        # Tail wag right
        draw.line([(23, 24+oy), (25, 22+oy), (27, 20+oy), (28, 19+oy)], fill=fur, width=2)
        px(draw, 28, 18+oy, C['fur_dark'])


# ============================================================
# Frame Generators — one function per animation state
# ============================================================

def make_idle_frames(count=4):
    """Idle: gentle breathing, occasional blink, tail sway."""
    frames = []
    for i in range(count):
        img, d = new_frame()

        if i == 0 or i == 1:
            # Normal breathing in
            draw_ears(d, offset_y=0)
            draw_head(d, offset_y=0, eyes='open')
            draw_body(d, offset_y=0)
            draw_tail(d, curl=0)
        elif i == 2:
            # Breathing out (slight shift down)
            draw_ears(d, offset_y=0)
            draw_head(d, offset_y=0, eyes='blink')
            draw_body(d, offset_y=0)
            draw_tail(d, curl=3)
        elif i == 3:
            # Back to normal, tail other direction
            draw_ears(d, offset_y=0)
            draw_head(d, offset_y=0, eyes='open')
            draw_body(d, offset_y=0)
            draw_tail(d, curl=4)

        frames.append(img)
    return frames


def make_working_frames(count=6):
    """Working: typing on laptop, focused expression."""
    frames = []
    for i in range(count):
        img, d = new_frame()

        draw_ears(d, offset_y=0)
        # Focused half-closed eyes
        draw_head(d, offset_y=0, eyes='half', mouth='normal')
        # Body with laptop
        draw_body(d, offset_y=0, has_laptop=True)
        draw_tail(d, curl=0 if i % 2 == 0 else 4)

        # Typing animation — small dots above laptop (keystrokes)
        if i % 2 == 0:
            px(d, 14, 19, C['laptop_screen'])
            px(d, 17, 19, C['laptop_screen'])
        else:
            px(d, 13, 19, C['laptop_screen'])
            px(d, 16, 19, C['laptop_screen'])
            px(d, 19, 19, C['laptop_screen'])

        frames.append(img)
    return frames


def make_happy_frames(count=4):
    """Happy: jumping with sparkles, closed happy eyes."""
    frames = []
    for i in range(count):
        img, d = new_frame()

        if i == 0:
            # Start — crouch
            draw_ears(d, offset_y=1)
            draw_head(d, offset_y=1, eyes='closed_up', mouth='w')
            draw_body(d, offset_y=1)
            draw_tail(d, curl=1, offset_y=1)
        elif i == 1:
            # Jump up
            draw_ears(d, offset_y=-2)
            draw_head(d, offset_y=-2, eyes='closed_up', mouth='happy')
            draw_body(d, offset_y=-2)
            draw_tail(d, curl=1, offset_y=-2)
            # Sparkles
            _draw_sparkle(d, 5, 5)
            _draw_sparkle(d, 26, 8)
        elif i == 2:
            # Peak
            draw_ears(d, offset_y=-3)
            draw_head(d, offset_y=-3, eyes='closed_up', mouth='happy')
            draw_body(d, offset_y=-3)
            draw_tail(d, curl=1, offset_y=-3)
            _draw_sparkle(d, 3, 8)
            _draw_sparkle(d, 27, 5)
            _draw_sparkle(d, 15, 1)
        elif i == 3:
            # Landing
            draw_ears(d, offset_y=0)
            draw_head(d, offset_y=0, eyes='closed_up', mouth='w')
            draw_body(d, offset_y=0)
            draw_tail(d, curl=1)
            _draw_sparkle(d, 6, 7)
            _draw_sparkle(d, 25, 6)

        frames.append(img)
    return frames


def make_sleeping_frames(count=2):
    """Sleeping: curled up with Zzz."""
    frames = []
    for i in range(count):
        img, d = new_frame()

        # Cat is lower / curled
        draw_ears(d, offset_y=2)
        draw_head(d, offset_y=2, eyes='closed', mouth='normal')
        draw_body(d, offset_y=2)
        draw_tail(d, curl=2, offset_y=2)

        # Zzz floating
        zzz_color = C['zzz']
        if i == 0:
            _draw_z(d, 24, 6, zzz_color, size='small')
            _draw_z(d, 27, 3, zzz_color, size='big')
        else:
            _draw_z(d, 25, 8, zzz_color, size='small')
            _draw_z(d, 28, 5, zzz_color, size='big')
            _draw_z(d, 23, 2, zzz_color, size='small')

        frames.append(img)
    return frames


def make_error_frames(count=3):
    """Error: surprised/scared with sweat drop."""
    frames = []
    for i in range(count):
        img, d = new_frame()

        if i == 0:
            draw_ears(d, offset_y=0)
            draw_head(d, offset_y=0, eyes='wide', mouth='open')
            draw_body(d, offset_y=0)
            draw_tail(d, curl=0)
            # Sweat drop
            _draw_sweat(d, 6, 9)
        elif i == 1:
            # Slight shake left
            draw_ears(d, offset_y=0)
            draw_head(d, offset_y=0, eyes='wide', mouth='open')
            draw_body(d, offset_y=0)
            draw_tail(d, curl=3)
            _draw_sweat(d, 6, 10)
            # Exclamation
            rect(d, 28, 4, 1, 3, C['outline'])
            px(d, 28, 8, C['outline'])
        elif i == 2:
            # Slight shake right
            draw_ears(d, offset_y=0)
            draw_head(d, offset_y=0, eyes='wide', mouth='open')
            draw_body(d, offset_y=0)
            draw_tail(d, curl=4)
            _draw_sweat(d, 6, 11)
            rect(d, 28, 4, 1, 3, C['outline'])
            px(d, 28, 8, C['outline'])

        frames.append(img)
    return frames


# ============================================================
# Decorative Helpers
# ============================================================

def _draw_sparkle(d, x, y):
    """Draw a small + shaped sparkle."""
    c = C['sparkle']
    px(d, x, y-1, c)
    px(d, x-1, y, c)
    px(d, x, y, c)
    px(d, x+1, y, c)
    px(d, x, y+1, c)


def _draw_z(d, x, y, color, size='small'):
    """Draw a Z letter for sleeping."""
    if size == 'small':
        draw_z_small(d, x, y, color)
    else:
        draw_z_big(d, x, y, color)


def draw_z_small(d, x, y, color):
    """Small Z: 3x3."""
    rect(d, x, y, 3, 1, color)
    px(d, x+2, y+1, color)
    px(d, x+1, y+2, color)
    px(d, x, y+3, color)
    rect(d, x, y+4, 3, 1, color)


def draw_z_big(d, x, y, color):
    """Big Z: 4x5."""
    rect(d, x, y, 4, 1, color)
    px(d, x+3, y+1, color)
    px(d, x+2, y+2, color)
    px(d, x+1, y+3, color)
    px(d, x, y+4, color)
    rect(d, x, y+5, 4, 1, color)


def _draw_sweat(d, x, y):
    """Draw a sweat drop."""
    c = C['sweat']
    px(d, x, y, c)
    rect(d, x-1, y+1, 3, 2, c)
    px(d, x, y+3, c)


# ============================================================
# Sprite Sheet Assembly
# ============================================================

def assemble_spritesheet(frames, output_path):
    """Combine frames into a horizontal sprite sheet, scaled up."""
    w = OUTPUT_SIZE * len(frames)
    h = OUTPUT_SIZE
    sheet = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    for i, frame in enumerate(frames):
        # 64x64 → 128x128 NEAREST for crisp pixels
        scaled = frame.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.NEAREST)
        sheet.paste(scaled, (i * OUTPUT_SIZE, 0))

    sheet.save(output_path, 'PNG')
    print(f"  Saved: {output_path} ({w}x{h}, {len(frames)} frames)")


# ============================================================
# Main
# ============================================================

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Output directory: {os.path.abspath(OUT_DIR)}")
    print()

    # Generate each sprite sheet
    # configs 同时用于生成 manifest，避免帧数重复定义
    configs = [
        ('idle',     make_idle_frames,     4, 4, True),
        ('working',  make_working_frames,  6, 8, True),
        ('happy',    make_happy_frames,    4, 6, False),
        ('sleeping', make_sleeping_frames, 2, 1, True),
        ('error',    make_error_frames,    3, 4, True),
    ]

    for name, generator, count, *_ in configs:
        print(f"Generating '{name}' sprite sheet ({count} frames)...")
        frames = generator(count)
        path = os.path.join(OUT_DIR, f"{name}.png")
        assemble_spritesheet(frames, path)

    # Generate manifest.json — animations 字段从 configs 动态生成
    manifest = {
        "name": "默认猫咪 (Default Cat)",
        "author": "DesktopXPet",
        "version": "1.0.0",
        "preview": "preview.png",
        "description": "A cute orange tabby cat pixel pet",
        "frameSize": {"width": 128, "height": 128},
        "animations": {
            name: {"frames": count, "fps": fps, "loop": loop}
            for name, _, count, fps, loop in configs
        }
    }

    import json
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {manifest_path}")
    print("\nDone! All sprite sheets generated.")


if __name__ == '__main__':
    main()
