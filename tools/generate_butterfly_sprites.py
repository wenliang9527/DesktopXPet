"""
DesktopXPet - Butterfly Swordsman Sprite Sheet Generator (HD)
Based on anime reference: dark-haired swordswoman with white haori, katana, and butterfly motifs.
Internal 64x64 (32×2) → output 128x128 with nearest-neighbor scaling.
"""

from PIL import Image, ImageDraw
import os, json

# ============================================================
# Config
# ============================================================
DRAW_SIZE = 32
SCALE = 2
FRAME_SIZE = DRAW_SIZE * SCALE  # Actual canvas: 64x64
OUTPUT_SIZE = 128
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "resources", "skins", "butterfly-swordsman")

# ============================================================
# Color Palette
# ============================================================
C = {
    't':          (0, 0, 0, 0),               # transparent
    'outline':    (20, 15, 35, 255),           # dark outline (slightly cooler)
    'hair':       (25, 22, 50, 255),           # dark blue-black hair
    'hair_hi':    (140, 80, 200, 255),         # VIVID purple highlight
    'hair_hi2':   (110, 60, 170, 255),         # second purple tone
    'hair_hi3':   (170, 120, 220, 255),        # light lavender streak
    'hair_bun':   (35, 30, 62, 255),           # bun slightly lighter
    'skin':       (255, 238, 228, 255),        # fairer / whiter skin
    'skin_sh':    (245, 222, 210, 255),        # skin shadow (subtle, still fair)
    'lip':        (225, 140, 155, 255),        # rosy pink lips
    'eye_w':      (255, 255, 255, 255),        # eye white
    'eye_p':      (155, 85, 225, 255),         # VIVID gem-purple iris
    'eye_p2':     (120, 55, 195, 255),         # deeper purple gradient
    'eye_pup':    (30, 18, 55, 255),           # eye pupil (darker)
    'eye_shine':  (255, 255, 255, 255),        # eye highlight
    'eye_shine2': (220, 200, 255, 200),        # secondary highlight (lavender)
    'eye_liner':  (90, 55, 140, 255),          # purple eyeliner / shadow
    'haori':      (255, 253, 252, 255),        # pure white haori
    'haori_sh':   (228, 225, 222, 255),        # haori shadow
    'haori_trim': (40, 35, 50, 255),           # haori dark trim
    'kimono':     (30, 26, 40, 255),           # black inner garment
    'kimono_col': (248, 245, 242, 255),        # white collar
    'belt':       (200, 195, 188, 255),        # belt / obi
    'belt_buck':  (170, 165, 158, 255),        # belt buckle
    'katana_blade': (215, 225, 240, 255),      # blade silver (brighter)
    'katana_edge':  (248, 252, 255, 255),      # blade edge highlight
    'katana_handle': (60, 75, 140, 255),       # handle wrap (vivid blue)
    'katana_guard': (220, 55, 65, 255),        # VIVID red tsuba guard
    'katana_wrap_r': (200, 50, 60, 255),       # vivid red handle diamond
    'katana_sheen': (180, 200, 255, 150),      # blade sheen glow
    'butterfly':  (255, 252, 255, 230),        # white butterfly (brighter)
    'butterfly2': (200, 170, 240, 220),        # vivid lavender butterfly
    'ribbon':     (230, 215, 245, 190),        # flowing ribbon
    'ribbon_pk':  (245, 195, 220, 170),        # pink ribbon
    'sparkle':    (255, 255, 150, 255),        # sparkle (brighter)
    'blush':      (245, 175, 180, 110),        # cheek blush
    'zzz':        (170, 145, 220, 210),        # sleep Z (more vivid)
    'sweat':      (140, 200, 250, 255),        # sweat drop
    'boot':       (40, 35, 48, 255),           # dark boots
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
    img = Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), C['t'])
    return img, ScaledDraw(ImageDraw.Draw(img))


def rect(d, x, y, w, h, color):
    d.rectangle([x, y, x+w-1, y+h-1], fill=color)


def px(d, x, y, color):
    d.point((x, y), fill=color)


# ============================================================
# Character Drawing
# ============================================================

def draw_hair_bun(d, oy=0):
    """Hair bun at top with butterfly hairpin — bigger and more prominent."""
    ol = C['outline']
    hr = C['hair']
    hi = C['hair_hi']
    hi2 = C['hair_hi2']
    hi3 = C['hair_hi3']
    bun = C['hair_bun']

    # Bun (larger ellipse, 9x7 instead of 7x6)
    d.ellipse([11, 0+oy, 21, 7+oy], fill=bun, outline=ol)
    # Rich purple highlights on bun — multiple streaks
    px(d, 14, 2+oy, hi)
    px(d, 15, 3+oy, hi2)
    px(d, 17, 2+oy, hi)
    px(d, 18, 3+oy, hi3)
    px(d, 19, 4+oy, hi2)
    px(d, 13, 4+oy, hi3)
    # Hair texture lines on bun
    px(d, 16, 1+oy, hi)
    px(d, 20, 5+oy, hi2)

    # Butterfly hairpin on left side of bun — BIGGER
    bp = C['butterfly']
    # Left wing
    px(d, 9, 1+oy, bp)
    px(d, 9, 2+oy, bp)
    px(d, 9, 3+oy, bp)
    px(d, 10, 0+oy, bp)
    px(d, 10, 4+oy, bp)
    # Right wing
    px(d, 11, 1+oy, bp)
    px(d, 11, 3+oy, bp)
    # Body center — vivid purple
    px(d, 10, 2+oy, C['eye_p'])
    px(d, 11, 2+oy, C['eye_p'])


def draw_head(d, oy=0, eyes='open', mouth='normal', look_dir=0):
    """Draw character head with bigger eyes, longer hair, purple eyeshadow."""
    ol = C['outline']
    sk = C['skin']
    sks = C['skin_sh']
    hr = C['hair']
    hi = C['hair_hi']
    hi2 = C['hair_hi2']
    hi3 = C['hair_hi3']
    liner = C['eye_liner']

    # Face shape
    d.rounded_rectangle([10, 5+oy, 22, 15+oy], radius=2, fill=sk, outline=ol)

    # === HAIR — longer, wider, more flowing ===
    # Top hair (covers forehead)
    rect(d, 10, 4+oy, 12, 3, hr)
    rect(d, 11, 3+oy, 10, 1, hr)  # slight peak

    # Left side — wide, flowing bangs
    rect(d, 9, 5+oy, 2, 6, hr)
    rect(d, 8, 6+oy, 1, 7, hr)
    rect(d, 7, 8+oy, 1, 8, hr)   # long strand reaching past face
    rect(d, 8, 13+oy, 1, 3, hr)   # even longer wisp
    # Curve at the end
    px(d, 7, 16+oy, hr)

    # Right side — matching flowing bangs
    rect(d, 21, 5+oy, 2, 6, hr)
    rect(d, 23, 6+oy, 1, 7, hr)
    rect(d, 24, 8+oy, 1, 8, hr)
    rect(d, 23, 13+oy, 1, 3, hr)
    px(d, 24, 16+oy, hr)

    # Rich purple streaks throughout bangs
    px(d, 10, 6+oy, hi)
    px(d, 11, 5+oy, hi2)
    px(d, 13, 4+oy, hi)
    px(d, 18, 4+oy, hi3)
    px(d, 21, 5+oy, hi)
    px(d, 22, 6+oy, hi2)
    # Side hair purple highlights
    px(d, 8, 9+oy, hi)
    px(d, 8, 12+oy, hi3)
    px(d, 7, 11+oy, hi2)
    px(d, 23, 9+oy, hi)
    px(d, 23, 12+oy, hi3)
    px(d, 24, 11+oy, hi2)
    # Extra streaks on top
    px(d, 15, 4+oy, hi3)
    px(d, 16, 5+oy, hi)

    # === EYES — bigger, almond-shaped, with eyeshadow ===
    lx = 12 + look_dir
    rx = 18 + look_dir

    if eyes == 'open':
        # --- Left eye (4x3 almond) with purple eyeshadow ---
        # Eyeliner / shadow above eye
        d.line([(lx-1, 8+oy), (lx+3, 8+oy)], fill=liner, width=1)
        px(d, lx-1, 9+oy, liner)  # wing tip left
        # Eye white (almond: wider in middle)
        rect(d, lx-1, 9+oy, 5, 3, C['eye_w'])
        px(d, lx-2, 10+oy, C['eye_w'])  # left almond taper
        px(d, lx+4, 10+oy, C['eye_w'])  # right almond taper
        # Iris gradient (two purple tones)
        rect(d, lx, 9+oy, 3, 3, C['eye_p'])
        rect(d, lx, 10+oy, 3, 2, C['eye_p2'])  # darker lower
        # Pupil
        px(d, lx+1, 10+oy, C['eye_pup'])
        # Highlights — TWO shine points
        px(d, lx+2, 9+oy, C['eye_shine'])
        px(d, lx, 11+oy, C['eye_shine2'])  # lavender secondary

        # --- Right eye (mirror) ---
        d.line([(rx-1, 8+oy), (rx+3, 8+oy)], fill=liner, width=1)
        px(d, rx+3, 9+oy, liner)
        rect(d, rx-1, 9+oy, 5, 3, C['eye_w'])
        px(d, rx-2, 10+oy, C['eye_w'])
        px(d, rx+4, 10+oy, C['eye_w'])
        rect(d, rx, 9+oy, 3, 3, C['eye_p'])
        rect(d, rx, 10+oy, 3, 2, C['eye_p2'])
        px(d, rx+1, 10+oy, C['eye_pup'])
        px(d, rx+2, 9+oy, C['eye_shine'])
        px(d, rx, 11+oy, C['eye_shine2'])

    elif eyes == 'half':
        # Half-closed with eyeliner
        d.line([(lx-1, 9+oy), (lx+3, 9+oy)], fill=liner, width=1)
        rect(d, lx-1, 10+oy, 5, 2, C['eye_w'])
        rect(d, lx, 10+oy, 3, 1, C['eye_p'])
        px(d, lx+2, 10+oy, C['eye_shine'])
        d.line([(rx-1, 9+oy), (rx+3, 9+oy)], fill=liner, width=1)
        rect(d, rx-1, 10+oy, 5, 2, C['eye_w'])
        rect(d, rx, 10+oy, 3, 1, C['eye_p'])
        px(d, rx+2, 10+oy, C['eye_shine'])

    elif eyes == 'closed':
        # Closed with eyeliner weight
        d.line([(lx-1, 11+oy), (lx+3, 11+oy)], fill=liner, width=1)
        d.line([(lx-1, 12+oy), (lx+3, 12+oy)], fill=ol, width=1)
        d.line([(rx-1, 11+oy), (rx+3, 11+oy)], fill=liner, width=1)
        d.line([(rx-1, 12+oy), (rx+3, 12+oy)], fill=ol, width=1)

    elif eyes == 'closed_up':
        # Happy ^_^ eyes with eyeliner accent
        d.line([(lx-1, 12+oy), (lx+1, 10+oy), (lx+3, 12+oy)], fill=liner, width=1)
        d.line([(rx-1, 12+oy), (rx+1, 10+oy), (rx+3, 12+oy)], fill=liner, width=1)

    elif eyes == 'wide':
        # Wide surprised — even bigger eyes
        d.line([(lx-1, 7+oy), (lx+4, 7+oy)], fill=liner, width=1)
        rect(d, lx-1, 8+oy, 5, 4, C['eye_w'])
        rect(d, lx, 9+oy, 4, 3, C['eye_p'])
        px(d, lx+1, 10+oy, C['eye_pup'])
        px(d, lx+3, 8+oy, C['eye_shine'])
        px(d, lx, 11+oy, C['eye_shine2'])
        d.line([(rx-1, 7+oy), (rx+4, 7+oy)], fill=liner, width=1)
        rect(d, rx-1, 8+oy, 5, 4, C['eye_w'])
        rect(d, rx, 9+oy, 4, 3, C['eye_p'])
        px(d, rx+1, 10+oy, C['eye_pup'])
        px(d, rx+3, 8+oy, C['eye_shine'])
        px(d, rx, 11+oy, C['eye_shine2'])

    elif eyes == 'blink':
        d.line([(lx-1, 11+oy), (lx+3, 11+oy)], fill=liner, width=1)
        d.line([(rx-1, 11+oy), (rx+3, 11+oy)], fill=liner, width=1)

    # Nose (subtle)
    px(d, 16, 12+oy, sks)

    # Mouth
    if mouth == 'normal':
        px(d, 15, 13+oy, C['lip'])
        px(d, 16, 13+oy, C['lip'])
    elif mouth == 'smile':
        d.line([(14, 13+oy), (16, 14+oy), (18, 13+oy)], fill=C['lip'], width=1)
    elif mouth == 'open':
        d.ellipse([14, 13+oy, 18, 15+oy], fill=C['lip'], outline=ol)
    elif mouth == 'w':
        d.line([(13, 13+oy), (15, 14+oy), (16, 13+oy), (17, 14+oy), (19, 13+oy)], fill=C['lip'])

    # Blush (slightly wider for fairer skin)
    rect(d, 11, 12+oy, 2, 1, C['blush'])
    rect(d, 19, 12+oy, 2, 1, C['blush'])


def draw_body(d, oy=0, has_katana=True, katana_angle=0):
    """Draw body with haori, kimono, and optional katana."""
    ol = C['outline']
    haori = C['haori']
    haori_sh = C['haori_sh']
    kimono = C['kimono']
    collar = C['kimono_col']
    belt_c = C['belt']

    # Inner kimono (black)
    d.rounded_rectangle([12, 15+oy, 20, 25+oy], radius=1, fill=kimono, outline=ol)

    # White collar V-shape
    d.line([(14, 15+oy), (16, 17+oy)], fill=collar, width=1)
    d.line([(18, 15+oy), (16, 17+oy)], fill=collar, width=1)

    # Belt / obi
    rect(d, 12, 20+oy, 9, 2, belt_c)
    rect(d, 15, 20+oy, 2, 2, C['belt_buck'])

    # Haori (white outer jacket) - left side
    d.rounded_rectangle([8, 15+oy, 13, 26+oy], radius=1, fill=haori, outline=ol)
    rect(d, 8, 15+oy, 1, 11, haori_sh)  # shadow fold

    # Haori - right side
    d.rounded_rectangle([19, 15+oy, 24, 26+oy], radius=1, fill=haori, outline=ol)
    rect(d, 23, 15+oy, 1, 11, haori_sh)  # shadow fold

    # Haori trim (dark edges on sleeves)
    rect(d, 8, 25+oy, 5, 1, C['haori_trim'])
    rect(d, 19, 25+oy, 5, 1, C['haori_trim'])

    # Small butterfly motif on haori
    bp = C['butterfly2']
    px(d, 9, 22+oy, bp)
    px(d, 10, 21+oy, bp)
    px(d, 10, 23+oy, bp)

    if has_katana and katana_angle == 0:
        # Katana held diagonally across body (lower-left to upper-right)
        _draw_katana_diagonal(d, oy)
    elif has_katana and katana_angle == 1:
        # Katana raised / slash pose
        _draw_katana_raised(d, oy)


def _draw_katana_diagonal(d, oy):
    """Katana held diagonally — brighter colors, blade sheen."""
    blade = C['katana_blade']
    edge = C['katana_edge']
    handle = C['katana_handle']
    guard = C['katana_guard']
    wrap_r = C['katana_wrap_r']
    sheen = C['katana_sheen']

    # Handle (lower left) — vivid blue with red diamonds
    px(d, 10, 24+oy, handle)
    px(d, 11, 23+oy, handle)
    px(d, 11, 24+oy, wrap_r)
    px(d, 12, 22+oy, handle)
    px(d, 12, 23+oy, wrap_r)  # extra red accent

    # Guard (tsuba) — vivid red, slightly bigger
    px(d, 12, 21+oy, guard)
    px(d, 13, 21+oy, guard)
    px(d, 13, 20+oy, guard)  # thicker guard

    # Blade going up-right with sheen
    for i in range(8):
        bx = 13 + i
        by = 20 - i + oy
        px(d, bx, by, blade)
        if i % 2 == 0:
            px(d, bx, by-1, edge)    # highlight edge
        if i % 3 == 0:
            px(d, bx+1, by, sheen)   # blue sheen glow


def _draw_katana_raised(d, oy):
    """Katana in raised slash pose — brighter with sheen."""
    blade = C['katana_blade']
    edge = C['katana_edge']
    handle = C['katana_handle']
    guard = C['katana_guard']
    sheen = C['katana_sheen']

    # Handle on right side
    px(d, 23, 18+oy, handle)
    px(d, 23, 17+oy, handle)
    px(d, 23, 16+oy, C['katana_wrap_r'])
    px(d, 24, 17+oy, handle)

    # Guard — vivid
    px(d, 23, 15+oy, guard)
    px(d, 22, 15+oy, guard)
    px(d, 24, 15+oy, guard)

    # Blade going up-left with sheen
    for i in range(8):
        bx = 21 - i
        by = 14 - i + oy
        if by >= 0:
            px(d, bx, by, blade)
            if i % 2 == 0:
                px(d, bx-1, by, edge)
            if i % 3 == 0:
                px(d, bx, by-1, sheen)


def draw_legs(d, oy=0):
    """Draw legs and boots."""
    ol = C['outline']
    skin = C['skin']
    boot = C['boot']

    # Left leg
    rect(d, 13, 25+oy, 3, 3, skin)
    rect(d, 12, 28+oy, 4, 2, boot)  # boot
    d.rounded_rectangle([12, 28+oy, 15, 30+oy], radius=1, fill=boot, outline=ol)

    # Right leg
    rect(d, 17, 25+oy, 3, 3, skin)
    rect(d, 17, 28+oy, 4, 2, boot)
    d.rounded_rectangle([17, 28+oy, 20, 30+oy], radius=1, fill=boot, outline=ol)


def draw_butterfly(d, x, y, variant=0):
    """Draw a small decorative butterfly."""
    if variant == 0:
        c = C['butterfly']
    else:
        c = C['butterfly2']
    # Wings (symmetric around center)
    px(d, x-2, y-1, c)
    px(d, x-1, y-1, c)
    px(d, x+1, y-1, c)
    px(d, x+2, y-1, c)
    px(d, x-2, y, c)
    px(d, x-1, y, c)
    px(d, x, y, c)        # body center
    px(d, x+1, y, c)
    px(d, x+2, y, c)
    px(d, x-1, y+1, c)
    px(d, x+1, y+1, c)


def draw_ribbon(d, points, color=None):
    """Draw flowing ribbon through a list of (x,y) points."""
    c = color or C['ribbon']
    for (x, y) in points:
        px(d, x, y, c)


def draw_sparkle(d, x, y, color=None):
    """Small + sparkle."""
    c = color or C['sparkle']
    px(d, x, y-1, c)
    px(d, x-1, y, c)
    px(d, x, y, c)
    px(d, x+1, y, c)
    px(d, x, y+1, c)


def draw_z(d, x, y, color, big=False):
    """Z letter for sleeping."""
    w = 4 if big else 3
    h = 5 if big else 4
    rect(d, x, y, w, 1, color)
    if big:
        px(d, x+3, y+1, color)
        px(d, x+2, y+2, color)
        px(d, x+1, y+3, color)
        px(d, x, y+4, color)
    else:
        px(d, x+2, y+1, color)
        px(d, x+1, y+2, color)
        px(d, x, y+3, color)
    rect(d, x, y+h, w, 1, color)


def draw_sweat(d, x, y):
    c = C['sweat']
    px(d, x, y, c)
    rect(d, x-1, y+1, 3, 2, c)
    px(d, x, y+3, c)


# ============================================================
# Animation Frame Generators
# ============================================================

def make_idle_frames(count=4):
    frames = []
    for i in range(count):
        img, d = new_frame()

        body_oy = 0 if i < 2 else 1  # subtle breathing

        draw_hair_bun(d, oy=body_oy)

        if i == 2:
            draw_head(d, oy=body_oy, eyes='blink')
        else:
            draw_head(d, oy=body_oy, eyes='open')

        draw_body(d, oy=body_oy, has_katana=True, katana_angle=0)
        draw_legs(d, oy=body_oy)

        # Floating butterfly nearby
        if i == 0:
            draw_butterfly(d, 27, 7, variant=0)
        elif i == 1:
            draw_butterfly(d, 28, 5, variant=0)
        elif i == 2:
            draw_butterfly(d, 27, 6, variant=1)
        elif i == 3:
            draw_butterfly(d, 26, 8, variant=0)

        frames.append(img)
    return frames


def make_working_frames(count=6):
    frames = []
    for i in range(count):
        img, d = new_frame()

        draw_hair_bun(d)
        draw_head(d, eyes='half', mouth='normal', look_dir=0)
        draw_body(d, has_katana=True, katana_angle=0)
        draw_legs(d)

        # Floating particles / energy effect around katana
        if i % 3 == 0:
            draw_sparkle(d, 20, 14, C['butterfly2'])
        elif i % 3 == 1:
            draw_sparkle(d, 18, 12, C['butterfly2'])
            draw_sparkle(d, 22, 15, C['butterfly'])
        elif i % 3 == 2:
            draw_sparkle(d, 16, 10, C['butterfly'])

        # Butterfly orbiting
        bx = [26, 27, 26, 25, 26, 27][i]
        by = [5, 7, 9, 7, 5, 7][i]
        draw_butterfly(d, bx, by, variant=i % 2)

        frames.append(img)
    return frames


def make_happy_frames(count=4):
    frames = []
    for i in range(count):
        img, d = new_frame()

        if i == 0:
            draw_hair_bun(d, oy=0)
            draw_head(d, oy=0, eyes='closed_up', mouth='smile')
            draw_body(d, oy=0, has_katana=True, katana_angle=0)
            draw_legs(d, oy=0)
            draw_butterfly(d, 5, 6, 0)
            draw_butterfly(d, 27, 4, 1)
        elif i == 1:
            # Jump up
            draw_hair_bun(d, oy=-2)
            draw_head(d, oy=-2, eyes='closed_up', mouth='w')
            draw_body(d, oy=-2, has_katana=True, katana_angle=1)
            draw_legs(d, oy=-2)
            draw_butterfly(d, 4, 4, 0)
            draw_butterfly(d, 27, 2, 1)
            draw_butterfly(d, 25, 8, 0)
            draw_sparkle(d, 6, 2, C['sparkle'])
            draw_sparkle(d, 26, 6, C['sparkle'])
        elif i == 2:
            # Peak
            draw_hair_bun(d, oy=-3)
            draw_head(d, oy=-3, eyes='closed_up', mouth='w')
            draw_body(d, oy=-3, has_katana=True, katana_angle=1)
            draw_legs(d, oy=-3)
            draw_butterfly(d, 3, 3, 0)
            draw_butterfly(d, 28, 5, 0)
            draw_butterfly(d, 15, 0, 1)
            draw_sparkle(d, 5, 1, C['sparkle'])
            draw_sparkle(d, 27, 3, C['sparkle'])
            # Flowing ribbons
            draw_ribbon(d, [(6, 16+(-3)), (7, 18+(-3)), (8, 17+(-3)), (9, 19+(-3))], C['ribbon'])
            draw_ribbon(d, [(24, 17+(-3)), (25, 19+(-3)), (26, 18+(-3))], C['ribbon_pk'])
        elif i == 3:
            draw_hair_bun(d, oy=0)
            draw_head(d, oy=0, eyes='closed_up', mouth='smile')
            draw_body(d, oy=0, has_katana=True, katana_angle=0)
            draw_legs(d, oy=0)
            draw_butterfly(d, 6, 5, 0)
            draw_butterfly(d, 26, 7, 1)
            draw_sparkle(d, 4, 8, C['sparkle'])

        frames.append(img)
    return frames


def make_sleeping_frames(count=2):
    frames = []
    for i in range(count):
        img, d = new_frame()

        draw_hair_bun(d, oy=2)
        draw_head(d, oy=2, eyes='closed', mouth='normal')
        draw_body(d, oy=2, has_katana=True, katana_angle=0)
        draw_legs(d, oy=2)

        # Zzz
        zc = C['zzz']
        if i == 0:
            draw_z(d, 24, 5, zc, big=False)
            draw_z(d, 27, 1, zc, big=True)
        else:
            draw_z(d, 25, 7, zc, big=False)
            draw_z(d, 28, 3, zc, big=True)
            draw_z(d, 23, 0, zc, big=False)

        # Sleeping butterfly resting on head
        draw_butterfly(d, 14, 3, variant=0)

        frames.append(img)
    return frames


def make_error_frames(count=3):
    frames = []
    for i in range(count):
        img, d = new_frame()

        draw_hair_bun(d)
        draw_head(d, eyes='wide', mouth='open')
        draw_body(d, has_katana=True, katana_angle=0)
        draw_legs(d)

        # Sweat drop
        draw_sweat(d, 8, 8)

        if i == 1:
            # Shake + exclamation
            ol = C['outline']
            rect(d, 27, 3, 1, 3, ol)
            px(d, 27, 7, ol)
            # Butterfly flying away startled
            draw_butterfly(d, 4, 4, 1)
            draw_butterfly(d, 28, 10, 0)
        elif i == 2:
            ol = C['outline']
            rect(d, 27, 3, 1, 3, ol)
            px(d, 27, 7, ol)
            draw_butterfly(d, 3, 6, 0)
            draw_butterfly(d, 27, 2, 1)
        else:
            draw_butterfly(d, 5, 5, 0)

        frames.append(img)
    return frames


# ============================================================
# Assembly
# ============================================================

def assemble_sheet(frames, path):
    w = OUTPUT_SIZE * len(frames)
    h = OUTPUT_SIZE
    sheet = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        # 64x64 → 128x128 NEAREST for crisp pixels
        scaled = frame.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.NEAREST)
        sheet.paste(scaled, (i * OUTPUT_SIZE, 0))
    sheet.save(path, 'PNG')
    print(f"  Saved: {path} ({w}x{h}, {len(frames)} frames)")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Output: {os.path.abspath(OUT_DIR)}\n")

    configs = [
        ('idle',     make_idle_frames,     4, 4, True),
        ('working',  make_working_frames,  6, 8, True),
        ('happy',    make_happy_frames,    4, 6, False),
        ('sleeping', make_sleeping_frames, 2, 1, True),
        ('error',    make_error_frames,    3, 4, True),
    ]

    for name, gen, count, *_ in configs:
        print(f"Generating '{name}' ({count} frames)...")
        frames = gen(count)
        assemble_sheet(frames, os.path.join(OUT_DIR, f"{name}.png"))

    # manifest animations 字段从 configs 动态生成，避免重复定义
    manifest = {
        "name": "蝴蝶剑士 (Butterfly Swordsman)",
        "author": "DesktopXPet",
        "version": "1.0.0",
        "preview": "preview.png",
        "description": "A graceful swordswoman with butterfly motifs, inspired by anime art style",
        "frameSize": {"width": 128, "height": 128},
        "animations": {
            name: {"frames": count, "fps": fps, "loop": loop}
            for name, _, count, fps, loop in configs
        }
    }

    mp = os.path.join(OUT_DIR, "manifest.json")
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {mp}")
    print("\nDone!")


if __name__ == '__main__':
    main()
