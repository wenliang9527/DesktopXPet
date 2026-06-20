"""
DesktopXPet - Butterfly Swordsman Sprite Sheet Generator (Optimized v2)
Shinobu Kocho inspired: dark-haired swordswoman with white haori, katana, and butterfly motifs.
32x32 internal resolution -> 64x64 output with nearest-neighbor scaling.

Key improvements over v1:
- Working animation: dynamic sword slashes, chasing butterflies, speed lines
- All states have clearly distinct body poses (not just eye changes)
- Better use of the 32x32 canvas space
"""

from PIL import Image, ImageDraw
import os, json

# ============================================================
# Config
# ============================================================
FRAME_SIZE = 32
SCALE = 2
OUTPUT_SIZE = FRAME_SIZE * SCALE
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "resources", "skins", "butterfly-swordsman")

# ============================================================
# Color Palette — Shinobu Kocho inspired
# ============================================================
C = {
    't':           (0, 0, 0, 0),
    'outline':     (25, 18, 40, 255),
    'hair':        (30, 25, 55, 255),
    'hair_hi':     (140, 80, 200, 255),
    'hair_hi2':    (110, 60, 170, 255),
    'hair_hi3':    (170, 120, 220, 255),
    'hair_bun':    (38, 32, 65, 255),
    'skin':        (255, 238, 228, 255),
    'skin_sh':     (242, 218, 205, 255),
    'lip':         (225, 140, 155, 255),
    'eye_w':       (255, 255, 255, 255),
    'eye_p':       (155, 85, 225, 255),
    'eye_p2':      (120, 55, 195, 255),
    'eye_pup':     (30, 18, 55, 255),
    'eye_shine':   (255, 255, 255, 255),
    'eye_shine2':  (220, 200, 255, 200),
    'eye_liner':   (90, 55, 140, 255),
    'haori':       (255, 253, 252, 255),
    'haori_sh':    (225, 222, 218, 255),
    'haori_trim':  (45, 38, 55, 255),
    'kimono':      (32, 28, 45, 255),
    'kimono_col':  (248, 245, 242, 255),
    'belt':        (200, 195, 188, 255),
    'belt_buck':   (170, 165, 158, 255),
    'blade':       (215, 225, 240, 255),
    'blade_edge':  (248, 252, 255, 255),
    'blade_sheen': (180, 200, 255, 150),
    'handle':      (60, 75, 140, 255),
    'guard':       (220, 55, 65, 255),
    'wrap_r':      (200, 50, 60, 255),
    'butterfly':   (255, 252, 255, 230),
    'butterfly2':  (200, 170, 240, 220),
    'butterfly3':  (255, 200, 220, 200),
    'ribbon':      (230, 215, 245, 190),
    'sparkle':     (255, 255, 150, 255),
    'blush':       (245, 175, 180, 110),
    'zzz':         (170, 145, 220, 210),
    'sweat':       (140, 200, 250, 255),
    'boot':        (40, 35, 48, 255),
    'speed':       (180, 175, 200, 140),
    'slash_trail': (220, 210, 255, 160),
}


def new_frame():
    return Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), C['t'])


def rect(d, x, y, w, h, color):
    d.rectangle([x, y, x+w-1, y+h-1], fill=color)


def px(d, x, y, color):
    d.point((x, y), fill=color)


def line(d, x1, y1, x2, y2, color, width=1):
    d.line([(x1, y1), (x2, y2)], fill=color, width=width)


# ============================================================
# Hair Bun
# ============================================================
def draw_hair_bun(d, bx=16, by=3, oy=0):
    ol = C['outline']
    bun = C['hair_bun']
    hi = C['hair_hi']
    hi2 = C['hair_hi2']
    hi3 = C['hair_hi3']
    d.ellipse([bx-5, by+oy, bx+5, by+7+oy], fill=bun, outline=ol)
    px(d, bx-2, by+2+oy, hi)
    px(d, bx+1, by+3+oy, hi2)
    px(d, bx+3, by+2+oy, hi)
    px(d, bx-1, by+4+oy, hi3)
    px(d, bx+2, by+4+oy, hi2)
    # Butterfly hairpin
    bp = C['butterfly']
    px(d, bx-7, by+1+oy, bp)
    px(d, bx-7, by+2+oy, bp)
    px(d, bx-7, by+3+oy, bp)
    px(d, bx-6, by+oy, bp)
    px(d, bx-6, by+4+oy, bp)
    px(d, bx-5, by+1+oy, bp)
    px(d, bx-5, by+3+oy, bp)
    px(d, bx-6, by+2+oy, C['eye_p'])


# ============================================================
# Head
# ============================================================
def draw_head(d, cx=16, cy=10, oy=0, eyes='open', look_dir=0, tilt=0):
    ol = C['outline']
    sk = C['skin']
    sks = C['skin_sh']
    hr = C['hair']
    hi = C['hair_hi']
    hi2 = C['hair_hi2']
    hi3 = C['hair_hi3']
    liner = C['eye_liner']

    d.rounded_rectangle([cx-6, cy-5+oy+tilt, cx+6, cy+5+oy], radius=2, fill=sk, outline=ol)
    rect(d, cx-6, cy-6+oy+tilt, 12, 3, hr)
    rect(d, cx-5, cy-7+oy+tilt, 10, 1, hr)
    rect(d, cx-7, cy-5+oy+tilt, 2, 7, hr)
    rect(d, cx-8, cy-3+oy+tilt, 1, 8, hr)
    rect(d, cx-9, cy-1+oy+tilt, 1, 5, hr)
    rect(d, cx+5, cy-5+oy+tilt, 2, 7, hr)
    rect(d, cx+7, cy-3+oy+tilt, 1, 8, hr)
    rect(d, cx+8, cy-1+oy+tilt, 1, 5, hr)
    px(d, cx-6, cy-4+oy+tilt, hi)
    px(d, cx-4, cy-6+oy+tilt, hi2)
    px(d, cx+3, cy-6+oy+tilt, hi)
    px(d, cx+5, cy-4+oy+tilt, hi3)
    px(d, cx-8, cy+oy+tilt, hi)
    px(d, cx+7, cy+oy+tilt, hi2)
    px(d, cx-9, cy+2+oy+tilt, hi3)
    px(d, cx+8, cy+2+oy+tilt, hi)

    lx = cx - 4 + look_dir
    rx = cx + 2 + look_dir
    ey = cy - 1 + oy + tilt

    if eyes == 'open':
        for ex in [lx, rx]:
            d.line([(ex-1, ey-1), (ex+3, ey-1)], fill=liner)
            rect(d, ex-1, ey, 5, 3, C['eye_w'])
            px(d, ex-2, ey+1, C['eye_w'])
            px(d, ex+4, ey+1, C['eye_w'])
            rect(d, ex, ey, 3, 3, C['eye_p'])
            rect(d, ex, ey+1, 3, 2, C['eye_p2'])
            px(d, ex+1, ey+1, C['eye_pup'])
            px(d, ex+2, ey, C['eye_shine'])
            px(d, ex, ey+2, C['eye_shine2'])
    elif eyes == 'half':
        for ex in [lx, rx]:
            d.line([(ex-1, ey), (ex+3, ey)], fill=liner)
            rect(d, ex-1, ey+1, 5, 2, C['eye_w'])
            rect(d, ex, ey+1, 3, 1, C['eye_p'])
            px(d, ex+2, ey+1, C['eye_shine'])
    elif eyes == 'closed':
        for ex in [lx, rx]:
            d.line([(ex-1, ey+1), (ex+3, ey+1)], fill=liner)
            d.line([(ex-1, ey+2), (ex+3, ey+2)], fill=ol)
    elif eyes == 'closed_up':
        for ex in [lx, rx]:
            d.line([(ex-1, ey+2), (ex+1, ey), (ex+3, ey+2)], fill=liner)
    elif eyes == 'wide':
        for ex in [lx, rx]:
            d.line([(ex-1, ey-2), (ex+4, ey-2)], fill=liner)
            rect(d, ex-1, ey-1, 5, 4, C['eye_w'])
            rect(d, ex, ey, 4, 3, C['eye_p'])
            px(d, ex+1, ey+1, C['eye_pup'])
            px(d, ex+3, ey-1, C['eye_shine'])
            px(d, ex, ey+2, C['eye_shine2'])
    elif eyes == 'blink':
        for ex in [lx, rx]:
            d.line([(ex-1, ey+1), (ex+3, ey+1)], fill=liner)
    elif eyes == 'determined':
        for ex in [lx, rx]:
            if ex == lx:
                d.line([(ex-1, ey-2), (ex+3, ey-1)], fill=liner)
            else:
                d.line([(ex-1, ey-1), (ex+3, ey-2)], fill=liner)
            d.line([(ex-1, ey), (ex+3, ey)], fill=liner)
            rect(d, ex-1, ey+1, 5, 2, C['eye_w'])
            rect(d, ex, ey+1, 3, 1, C['eye_p'])
            px(d, ex+2, ey+1, C['eye_shine'])

    px(d, cx, cy+2+oy+tilt, sks)
    my = cy + 3 + oy + tilt
    if eyes in ('open', 'half', 'blink'):
        px(d, cx-1, my, C['lip']); px(d, cx, my, C['lip'])
    elif eyes == 'closed_up':
        d.line([(cx-2, my), (cx, my+1), (cx+2, my)], fill=C['lip'])
    elif eyes == 'wide':
        d.ellipse([cx-2, my, cx+2, my+2], fill=C['lip'], outline=ol)
    elif eyes == 'determined':
        d.line([(cx-2, my+1), (cx, my), (cx+2, my+1)], fill=C['lip'])

    rect(d, cx-5, cy+2+oy+tilt, 2, 1, C['blush'])
    rect(d, cx+3, cy+2+oy+tilt, 2, 1, C['blush'])


# ============================================================
# Body
# ============================================================
def draw_body(d, cx=16, cy=17, oy=0, lean=0):
    ol = C['outline']
    l = lean
    d.rounded_rectangle([cx-4+l, cy+oy, cx+4+l, cy+10+oy], radius=1, fill=C['kimono'], outline=ol)
    d.line([(cx-2+l, cy+oy), (cx+l, cy+2+oy)], fill=C['kimono_col'])
    d.line([(cx+2+l, cy+oy), (cx+l, cy+2+oy)], fill=C['kimono_col'])
    rect(d, cx-4+l, cy+5+oy, 9, 2, C['belt'])
    rect(d, cx-1+l, cy+5+oy, 2, 2, C['belt_buck'])
    d.rounded_rectangle([cx-8+l, cy+oy, cx-3+l, cy+11+oy], radius=1, fill=C['haori'], outline=ol)
    rect(d, cx-8+l, cy+oy, 1, 11, C['haori_sh'])
    d.rounded_rectangle([cx+3+l, cy+oy, cx+8+l, cy+11+oy], radius=1, fill=C['haori'], outline=ol)
    rect(d, cx+7+l, cy+oy, 1, 11, C['haori_sh'])
    rect(d, cx-8+l, cy+10+oy, 5, 1, C['haori_trim'])
    rect(d, cx+3+l, cy+10+oy, 5, 1, C['haori_trim'])
    px(d, cx-7+l, cy+7+oy, C['butterfly2'])
    px(d, cx-6+l, cy+6+oy, C['butterfly2'])
    px(d, cx-6+l, cy+8+oy, C['butterfly2'])


# ============================================================
# Legs
# ============================================================
def draw_legs(d, cx=16, cy=27, oy=0, stance=0):
    ol = C['outline']; skin = C['skin']; boot = C['boot']
    if stance == 4:
        rect(d, cx-4, cy+2+oy, 8, 2, skin)
        rect(d, cx-5, cy+4+oy, 4, 2, boot)
        d.rounded_rectangle([cx-5, cy+4+oy, cx-2, cy+5+oy], radius=1, fill=boot, outline=ol)
        rect(d, cx+1, cy+4+oy, 4, 2, boot)
        d.rounded_rectangle([cx+1, cy+4+oy, cx+4, cy+5+oy], radius=1, fill=boot, outline=ol)
    elif stance == 1:
        rect(d, cx-5, cy+oy, 3, 3, skin)
        rect(d, cx+2, cy+oy, 3, 3, skin)
        rect(d, cx-6, cy+3+oy, 4, 2, boot)
        d.rounded_rectangle([cx-6, cy+3+oy, cx-3, cy+4+oy], radius=1, fill=boot, outline=ol)
        rect(d, cx+2, cy+3+oy, 4, 2, boot)
        d.rounded_rectangle([cx+2, cy+3+oy, cx+5, cy+4+oy], radius=1, fill=boot, outline=ol)
    elif stance == 3:
        rect(d, cx-6, cy+oy, 3, 3, skin)
        rect(d, cx+3, cy-1+oy, 3, 3, skin)
        rect(d, cx-7, cy+3+oy, 4, 2, boot)
        d.rounded_rectangle([cx-7, cy+3+oy, cx-4, cy+4+oy], radius=1, fill=boot, outline=ol)
        rect(d, cx+3, cy+2+oy, 4, 2, boot)
        d.rounded_rectangle([cx+3, cy+2+oy, cx+6, cy+3+oy], radius=1, fill=boot, outline=ol)
    else:
        rect(d, cx-3, cy+oy, 3, 3, skin)
        rect(d, cx+1, cy+oy, 3, 3, skin)
        rect(d, cx-4, cy+3+oy, 4, 2, boot)
        d.rounded_rectangle([cx-4, cy+3+oy, cx-1, cy+4+oy], radius=1, fill=boot, outline=ol)
        rect(d, cx+1, cy+3+oy, 4, 2, boot)
        d.rounded_rectangle([cx+1, cy+3+oy, cx+4, cy+4+oy], radius=1, fill=boot, outline=ol)


# ============================================================
# Katana Poses
# ============================================================
def draw_katana_rest(d, ox=0, oy=0):
    px(d, 9+ox, 25+oy, C['handle']); px(d, 10+ox, 24+oy, C['handle'])
    px(d, 10+ox, 25+oy, C['wrap_r']); px(d, 11+ox, 23+oy, C['handle'])
    px(d, 11+ox, 24+oy, C['wrap_r'])
    px(d, 11+ox, 22+oy, C['guard']); px(d, 12+ox, 22+oy, C['guard'])
    px(d, 12+ox, 21+oy, C['guard'])
    for i in range(9):
        bx = 12+i+ox; by = 21-i+oy
        if 0 <= bx < 32 and 0 <= by < 32:
            px(d, bx, by, C['blade'])
            if i % 2 == 0: px(d, bx, by-1, C['blade_edge'])
            if i % 3 == 0: px(d, bx+1, by, C['blade_sheen'])

def draw_katana_slash_h(d, ox=0, oy=0):
    px(d, 4+ox, 14+oy, C['handle']); px(d, 5+ox, 14+oy, C['wrap_r'])
    px(d, 6+ox, 14+oy, C['handle'])
    px(d, 7+ox, 13+oy, C['guard']); px(d, 7+ox, 14+oy, C['guard'])
    px(d, 7+ox, 15+oy, C['guard'])
    for i in range(14):
        bx = 8+i+ox
        if bx < 32:
            px(d, bx, 14+oy, C['blade'])
            if i % 2 == 0: px(d, bx, 13+oy, C['blade_edge'])
            if i % 3 == 1: px(d, bx, 15+oy, C['blade_sheen'])

def draw_katana_slash_up(d, ox=0, oy=0):
    px(d, 22+ox, 24+oy, C['handle']); px(d, 22+ox, 23+oy, C['wrap_r'])
    px(d, 23+ox, 23+oy, C['handle'])
    px(d, 22+ox, 22+oy, C['guard']); px(d, 23+ox, 22+oy, C['guard'])
    px(d, 21+ox, 22+oy, C['guard'])
    for i in range(12):
        bx = 20-i+ox; by = 21-i+oy
        if 0 <= bx < 32 and 0 <= by < 32:
            px(d, bx, by, C['blade'])
            if i % 2 == 0: px(d, bx-1, by, C['blade_edge'])
            if i % 3 == 0: px(d, bx, by-1, C['blade_sheen'])

def draw_katana_raised(d, ox=0, oy=0):
    px(d, 23+ox, 8+oy, C['handle']); px(d, 23+ox, 9+oy, C['wrap_r'])
    px(d, 24+ox, 9+oy, C['handle'])
    px(d, 22+ox, 7+oy, C['guard']); px(d, 23+ox, 7+oy, C['guard'])
    px(d, 24+ox, 7+oy, C['guard'])
    for i in range(12):
        bx = 21-i+ox; by = 6-(i//2)+oy
        if 0 <= bx < 32 and 0 <= by < 32:
            px(d, bx, by, C['blade'])
            if i % 2 == 0: px(d, bx, by-1, C['blade_edge'])

def draw_katana_low(d, ox=0, oy=0):
    px(d, 8+ox, 22+oy, C['handle']); px(d, 9+ox, 22+oy, C['wrap_r'])
    px(d, 10+ox, 22+oy, C['handle'])
    px(d, 10+ox, 21+oy, C['guard']); px(d, 11+ox, 21+oy, C['guard'])
    for i in range(10):
        bx = 12+i+ox; by = 21+(i//4)+oy
        if 0 <= bx < 32 and 0 <= by < 32:
            px(d, bx, by, C['blade'])
            if i % 2 == 0: px(d, bx, by-1, C['blade_edge'])


# ============================================================
# Effects
# ============================================================
def draw_butterfly(d, x, y, variant=0, size=1):
    c = [C['butterfly'], C['butterfly2'], C['butterfly3']][variant % 3]
    if size == 2:
        for dx in [-3,-2,-1,1,2,3]: px(d, x+dx, y-1, c)
        for dx in [-2,-1,0,1,2]: px(d, x+dx, y, c)
        for dx in [-1,1]: px(d, x+dx, y+1, c)
    else:
        px(d, x-2, y-1, c); px(d, x-1, y-1, c)
        px(d, x+1, y-1, c); px(d, x+2, y-1, c)
        px(d, x-1, y, c); px(d, x, y, c); px(d, x+1, y, c)
        px(d, x, y+1, c)

def draw_sparkle(d, x, y, color=None):
    c = color or C['sparkle']
    px(d, x, y-1, c); px(d, x-1, y, c); px(d, x, y, c)
    px(d, x+1, y, c); px(d, x, y+1, c)

def draw_speed_lines(d, x, y, count=3, length=5):
    c = C['speed']
    for i in range(count):
        ly = y + i * 2
        for j in range(length):
            if 0 <= x-j < 32 and 0 <= ly < 32: px(d, x-j, ly, c)

def draw_slash_trail(d, x1, y1, x2, y2):
    c = C['slash_trail']
    steps = max(abs(x2-x1), abs(y2-y1), 1)
    for i in range(steps):
        t = i / steps
        curve = int(3 * (0.5 - abs(t - 0.5)))
        x = int(x1 + (x2-x1) * t); y = int(y1 + (y2-y1) * t) - curve
        if 0 <= x < 32 and 0 <= y < 32:
            px(d, x, y, c)
            if i % 2 == 0 and 0 <= y+1 < 32: px(d, x, y+1, c)

def draw_z(d, x, y, color, big=False):
    w = 4 if big else 3; h = 5 if big else 4
    rect(d, x, y, w, 1, color)
    if big:
        px(d, x+3, y+1, color); px(d, x+2, y+2, color)
        px(d, x+1, y+3, color); px(d, x, y+4, color)
    else:
        px(d, x+2, y+1, color); px(d, x+1, y+2, color); px(d, x, y+3, color)
    rect(d, x, y+h, w, 1, color)

def draw_sweat(d, x, y):
    c = C['sweat']
    px(d, x, y, c); rect(d, x-1, y+1, 3, 2, c); px(d, x, y+3, c)


# ============================================================
# IDLE — calm standing, gentle breathing, butterfly nearby
# ============================================================
def make_idle_frames(count=4):
    frames = []
    for i in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        oy = 0 if i < 2 else 1
        draw_hair_bun(d, oy=oy)
        draw_head(d, oy=oy, eyes='blink' if i == 2 else 'open')
        draw_body(d, oy=oy)
        draw_legs(d, oy=oy, stance=0)
        draw_katana_rest(d, oy=oy)
        bpos = [(27,6),(28,4),(27,5),(26,7)]
        draw_butterfly(d, bpos[i][0], bpos[i][1], variant=i%2)
        frames.append(img)
    return frames


# ============================================================
# WORKING — dynamic sword slashes, chasing butterflies
# ============================================================
def make_working_frames(count=6):
    frames = []

    # F0: Ready stance — lean forward, katana pulled back
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=15, oy=0)
    draw_head(d, cx=15, oy=0, eyes='determined')
    draw_body(d, cx=15, oy=0, lean=1)
    draw_legs(d, cx=15, oy=0, stance=1)
    draw_katana_low(d, ox=-1, oy=0)
    draw_butterfly(d, 28, 5, 0); draw_butterfly(d, 26, 3, 1)
    frames.append(img)

    # F1: Dashing forward — speed lines, running pose
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=13, by=2, oy=-1)
    draw_head(d, cx=13, cy=9, oy=-1, eyes='determined')
    draw_body(d, cx=13, cy=16, oy=-1, lean=2)
    draw_legs(d, cx=13, cy=26, oy=-1, stance=3)
    draw_katana_rest(d, ox=-3, oy=-1)
    draw_speed_lines(d, 5, 10, 3, 4); draw_speed_lines(d, 4, 18, 2, 3)
    draw_butterfly(d, 27, 7, 0); draw_butterfly(d, 25, 4, 1)
    frames.append(img)

    # F2: Horizontal slash — katana sweeps, slash trail
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=14, oy=-1)
    draw_head(d, cx=14, cy=10, oy=-1, eyes='determined')
    draw_body(d, cx=14, oy=-1, lean=1)
    draw_legs(d, cx=14, oy=-1, stance=1)
    draw_katana_slash_h(d, 0, 0)
    draw_slash_trail(d, 10, 8, 28, 16)
    draw_butterfly(d, 28, 3, 0); draw_butterfly(d, 26, 1, 1)
    draw_sparkle(d, 22, 12)
    frames.append(img)

    # F3: Upward slash — butterflies scatter upward
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=15, by=2, oy=-2)
    draw_head(d, cx=15, cy=9, oy=-2, eyes='determined')
    draw_body(d, cx=15, cy=16, oy=-2, lean=0)
    draw_legs(d, cx=15, cy=26, oy=-2, stance=1)
    draw_katana_slash_up(d, 0, -2)
    draw_slash_trail(d, 22, 22, 10, 6)
    draw_butterfly(d, 5, 3, 0); draw_butterfly(d, 27, 2, 1); draw_butterfly(d, 8, 1, 2)
    draw_sparkle(d, 14, 8); draw_sparkle(d, 20, 6)
    frames.append(img)

    # F4: Chasing — character moved right, pursuing
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=18, by=3, oy=0)
    draw_head(d, cx=18, cy=10, oy=0, eyes='half', look_dir=1)
    draw_body(d, cx=18, oy=0, lean=1)
    draw_legs(d, cx=18, oy=0, stance=3)
    draw_katana_rest(d, ox=3, oy=0)
    draw_speed_lines(d, 10, 12, 2, 3)
    draw_butterfly(d, 29, 6, 0); draw_butterfly(d, 3, 4, 1)
    frames.append(img)

    # F5: Guard pose — katana raised, sparkle on blade
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, oy=0)
    draw_head(d, oy=0, eyes='open')
    draw_body(d, oy=0, lean=0)
    draw_legs(d, oy=0, stance=1)
    draw_katana_raised(d, -2, 2)
    draw_sparkle(d, 10, 4); draw_sparkle(d, 15, 3)
    draw_butterfly(d, 8, 2, 0); draw_butterfly(d, 26, 7, 1)
    frames.append(img)

    return frames


# ============================================================
# HAPPY — celebration jump
# ============================================================
def make_happy_frames(count=4):
    frames = []
    for idx in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        if idx == 0:
            draw_hair_bun(d, oy=1); draw_head(d, oy=1, eyes='closed_up')
            draw_body(d, oy=1); draw_legs(d, oy=1, stance=2); draw_katana_low(d, oy=1)
            draw_butterfly(d, 5, 7, 0); draw_butterfly(d, 27, 5, 1)
        elif idx == 1:
            draw_hair_bun(d, bx=15, by=1, oy=-3)
            draw_head(d, cx=15, cy=8, oy=-3, eyes='closed_up')
            draw_body(d, cx=15, cy=15, oy=-3); draw_legs(d, cx=15, cy=25, oy=-3, stance=2)
            draw_katana_raised(d, -1, -4)
            draw_sparkle(d, 5, 3); draw_sparkle(d, 26, 5)
            draw_butterfly(d, 4, 5, 0); draw_butterfly(d, 27, 3, 1); draw_butterfly(d, 25, 9, 0)
        elif idx == 2:
            draw_hair_bun(d, bx=14, by=0, oy=-4)
            draw_head(d, cx=14, cy=7, oy=-4, eyes='closed_up')
            draw_body(d, cx=14, cy=14, oy=-4); draw_legs(d, cx=14, cy=24, oy=-4, stance=2)
            draw_katana_slash_h(d, -1, -4)
            draw_butterfly(d, 3, 3, 0); draw_butterfly(d, 28, 5, 0)
            draw_butterfly(d, 25, 2, 1); draw_butterfly(d, 15, 0, 1); draw_butterfly(d, 6, 8, 2)
            draw_sparkle(d, 4, 1); draw_sparkle(d, 27, 3); draw_sparkle(d, 10, 2)
        else:
            draw_hair_bun(d, oy=0); draw_head(d, oy=0, eyes='closed_up')
            draw_body(d, oy=0); draw_legs(d, oy=0, stance=1); draw_katana_rest(d, oy=0)
            draw_butterfly(d, 6, 6, 0); draw_butterfly(d, 26, 5, 1); draw_sparkle(d, 4, 8)
        frames.append(img)
    return frames


# ============================================================
# SLEEPING — seated, peaceful, dream butterflies
# ============================================================
def make_sleeping_frames(count=2):
    frames = []
    for i in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        draw_hair_bun(d, oy=3); draw_head(d, oy=3, eyes='closed')
        draw_body(d, oy=3); draw_legs(d, oy=3, stance=4); draw_katana_low(d, oy=3)
        zc = C['zzz']
        if i == 0:
            draw_z(d, 24, 7, zc, False); draw_z(d, 27, 3, zc, True)
            draw_butterfly(d, 4, 5, 0); draw_butterfly(d, 14, 4, 0)
        else:
            draw_z(d, 25, 9, zc, False); draw_z(d, 28, 5, zc, True); draw_z(d, 23, 1, zc, False)
            draw_butterfly(d, 5, 3, 1); draw_butterfly(d, 3, 7, 0); draw_butterfly(d, 14, 4, 0)
        frames.append(img)
    return frames


# ============================================================
# ERROR — startled
# ============================================================
def make_error_frames(count=3):
    frames = []
    for i in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        if i == 0:
            draw_hair_bun(d, oy=0); draw_head(d, oy=0, eyes='wide')
            draw_body(d, oy=0, lean=-1); draw_legs(d, oy=0, stance=1)
            draw_katana_low(d, -1, 0); draw_sweat(d, 7, 9)
            draw_butterfly(d, 5, 5, 0)
        elif i == 1:
            draw_hair_bun(d, bx=17, oy=0); draw_head(d, cx=17, oy=0, eyes='wide')
            draw_body(d, cx=17, oy=0, lean=-1); draw_legs(d, cx=17, oy=0, stance=1)
            draw_katana_low(d, 2, 0); draw_sweat(d, 8, 10)
            rect(d, 27, 3, 1, 3, C['outline']); px(d, 27, 7, C['outline'])
            draw_butterfly(d, 3, 3, 1); draw_butterfly(d, 28, 10, 0)
        else:
            draw_hair_bun(d, bx=15, oy=0); draw_head(d, cx=15, oy=0, eyes='wide')
            draw_body(d, cx=15, oy=0, lean=1); draw_legs(d, cx=15, oy=0, stance=1)
            draw_katana_low(d, 0, 0); draw_sweat(d, 6, 11)
            rect(d, 27, 3, 1, 3, C['outline']); px(d, 27, 7, C['outline'])
            draw_butterfly(d, 4, 5, 0); draw_butterfly(d, 27, 2, 1)
        frames.append(img)
    return frames


# ============================================================
# Assembly
# ============================================================
def assemble_sheet(frames, path):
    w = OUTPUT_SIZE * len(frames); h = OUTPUT_SIZE
    sheet = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
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

    manifest = {
        "name": "蝴蝶剑士 (Butterfly Swordsman)",
        "author": "DesktopXPet",
        "version": "2.0.0",
        "preview": "preview.png",
        "description": "Shinobu-inspired swordswoman — optimized v2 with dynamic sword action",
        "frameSize": {"width": 64, "height": 64},
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
