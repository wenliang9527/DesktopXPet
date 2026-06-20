"""
DesktopXPet - Butterfly Swordsman HD Sprite Sheet Generator
High-detail version: 64x64 internal resolution -> 128x128 output (2x scale).
Based on Shinobu Kocho reference: dark-haired swordswoman, white haori, katana, butterfly motifs.
"""

from PIL import Image, ImageDraw
import os, json

FRAME_SIZE = 64
SCALE = 2
OUTPUT_SIZE = FRAME_SIZE * SCALE
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "resources", "skins", "butterfly-swordsman-hd")

C = {
    't':           (0,0,0,0),
    'outline':     (22,16,38,255),
    'hair':        (28,22,52,255),
    'hair_hi':     (145,85,205,255),
    'hair_hi2':    (115,65,175,255),
    'hair_hi3':    (175,125,225,255),
    'hair_hi4':    (200,160,240,255),
    'hair_bun':    (35,30,60,255),
    'skin':        (255,240,230,255),
    'skin_sh':     (245,225,212,255),
    'skin_sh2':    (235,210,198,255),
    'lip':         (228,145,160,255),
    'lip_hi':      (240,175,185,255),
    'eye_w':       (255,255,255,255),
    'eye_p':       (160,90,230,255),
    'eye_p2':      (125,60,200,255),
    'eye_p3':      (100,45,170,255),
    'eye_pup':     (28,16,50,255),
    'eye_shine':   (255,255,255,255),
    'eye_shine2':  (225,205,255,200),
    'eye_liner':   (85,50,135,255),
    'eye_lash':    (60,35,100,255),
    'haori':       (255,254,253,255),
    'haori_sh':    (230,228,224,255),
    'haori_sh2':   (210,208,204,255),
    'haori_trim':  (42,36,52,255),
    'haori_pat':   (240,220,245,100),
    'kimono':      (30,26,42,255),
    'kimono_sh':   (45,40,58,255),
    'kimono_col':  (250,248,245,255),
    'belt':        (205,200,192,255),
    'belt_sh':     (180,175,168,255),
    'belt_buck':   (175,170,162,255),
    'blade':       (220,228,242,255),
    'blade_edge':  (250,254,255,255),
    'blade_mid':   (200,210,230,255),
    'blade_sheen': (185,205,255,140),
    'handle':      (55,70,135,255),
    'handle_sh':   (40,55,110,255),
    'guard':       (225,58,68,255),
    'guard_sh':    (195,45,55,255),
    'wrap_r':      (205,52,62,255),
    'wrap_b':      (70,85,155,255),
    'scabbard':    (35,30,48,255),
    'scab_gold':   (220,200,150,255),
    'butterfly':   (255,253,255,235),
    'butterfly2':  (205,175,245,225),
    'butterfly3':  (255,205,225,210),
    'butterfly_sh':(180,160,210,150),
    'ribbon':      (235,220,248,195),
    'ribbon2':     (248,200,225,175),
    'sparkle':     (255,255,155,255),
    'sparkle2':    (200,255,255,200),
    'blush':       (248,180,185,100),
    'zzz':         (175,150,225,215),
    'sweat':       (145,205,252,255),
    'boot':        (38,33,46,255),
    'boot_sh':     (52,48,62,255),
    'speed':       (185,180,205,130),
    'slash_trail': (225,215,255,150),
    'slash_trail2':(200,195,240,100),
}

def new_frame():
    return Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), C['t'])

def rect(d, x, y, w, h, color):
    d.rectangle([x, y, x+w-1, y+h-1], fill=color)

def px(d, x, y, color):
    d.point((x, y), fill=color)


# ============================================================
# Hair Bun — HD version with more detail
# ============================================================
def draw_hair_bun(d, bx=32, by=4, oy=0):
    ol = C['outline']; bun = C['hair_bun']
    hi = C['hair_hi']; hi2 = C['hair_hi2']; hi3 = C['hair_hi3']; hi4 = C['hair_hi4']
    # Bun shape (larger, more detailed)
    d.ellipse([bx-10, by+oy, bx+10, by+14+oy], fill=bun, outline=ol)
    d.ellipse([bx-8, by+2+oy, bx+8, by+12+oy], fill=bun)
    # Hair texture streaks
    for i in range(-6, 7, 2):
        px(d, bx+i, by+4+oy, hi)
        px(d, bx+i+1, by+6+oy, hi2)
    for i in range(-4, 5, 3):
        px(d, bx+i, by+8+oy, hi3)
        px(d, bx+i+1, by+10+oy, hi4)
    px(d, bx-3, by+3+oy, hi); px(d, bx+4, by+3+oy, hi2)
    px(d, bx+6, by+5+oy, hi); px(d, bx-5, by+7+oy, hi3)

    # Butterfly hairpin — larger and more detailed
    bp = C['butterfly']; bps = C['butterfly_sh']
    # Left wing (4x4)
    rect(d, bx-15, by+1+oy, 2, 4, bp)
    rect(d, bx-14, by+oy, 1, 6, bp)
    rect(d, bx-13, by+2+oy, 1, 2, bp)
    px(d, bx-15, by+3+oy, bps)
    # Right wing
    rect(d, bx-11, by+1+oy, 2, 4, bp)
    rect(d, bx-11, by+oy, 1, 6, bp)
    px(d, bx-11, by+3+oy, bps)
    # Body
    rect(d, bx-12, by+1+oy, 1, 4, C['eye_p'])
    # Antennae
    px(d, bx-13, by-1+oy, bp); px(d, bx-11, by-1+oy, bp)


# ============================================================
# Head — HD version
# ============================================================
def draw_head(d, cx=32, cy=18, oy=0, eyes='open', look_dir=0, tilt=0):
    ol = C['outline']; sk = C['skin']; sks = C['skin_sh']; sks2 = C['skin_sh2']
    hr = C['hair']; hi = C['hair_hi']; hi2 = C['hair_hi2']; hi3 = C['hair_hi3']
    liner = C['eye_liner']; lash = C['eye_lash']

    # Face (rounded, wider for HD)
    d.rounded_rectangle([cx-12, cy-10+oy+tilt, cx+12, cy+10+oy], radius=4, fill=sk, outline=ol)
    # Face shading
    rect(d, cx-10, cy+5+oy+tilt, 20, 2, sks)  # jaw shadow

    # Top hair
    rect(d, cx-12, cy-12+oy+tilt, 24, 6, hr)
    rect(d, cx-10, cy-14+oy+tilt, 20, 2, hr)
    rect(d, cx-8, cy-15+oy+tilt, 16, 1, hr)
    # Hair peak
    d.polygon([(cx-2, cy-15+oy+tilt), (cx+1, cy-17+oy+tilt), (cx+4, cy-15+oy+tilt)], fill=hr)

    # Side hair — long flowing strands
    for side in [-1, 1]:
        sx = cx + side * 12
        for ly in range(0, 18):
            width = max(1, 3 - ly // 6)
            for wx in range(width):
                px(d, sx + side*(wx) - (1 if side < 0 else 0), cy-10+ly+oy+tilt, hr)
        # Extra long wisps
        for ly in range(18, 24):
            px(d, sx + side*1, cy-10+ly+oy+tilt, hr)
            if ly > 20:
                px(d, sx + side*2, cy-10+ly+oy+tilt, hr)
    # Purple streaks in side hair
    for side in [-1, 1]:
        sx = cx + side * 12
        px(d, sx, cy-6+oy+tilt, hi); px(d, sx+side, cy-2+oy+tilt, hi2)
        px(d, sx, cy+2+oy+tilt, hi3); px(d, sx+side, cy+6+oy+tilt, hi)
        px(d, sx+side, cy+10+oy+tilt, hi2)

    # Purple streaks in bangs
    for i in range(-8, 9, 3):
        px(d, cx+i, cy-12+oy+tilt, hi if i % 2 == 0 else hi2)
        px(d, cx+i+1, cy-10+oy+tilt, hi3)

    # Eyes
    lx = cx - 7 + look_dir; rx = cx + 3 + look_dir
    ey = cy - 2 + oy + tilt

    if eyes == 'open':
        for ex, flip in [(lx, False), (rx, True)]:
            # Eyeliner / shadow
            d.line([(ex-2, ey-2), (ex+6, ey-2)], fill=liner, width=1)
            if flip:
                px(d, ex+6, ey-1, liner); px(d, ex-2, ey-1, lash)
            else:
                px(d, ex-2, ey-1, liner); px(d, ex+6, ey-1, lash)
            # Eyelashes
            px(d, ex-3, ey-2, lash); px(d, ex+7, ey-2, lash)
            # Eye white (large almond)
            rect(d, ex-2, ey-1, 8, 6, C['eye_w'])
            px(d, ex-3, ey+1, C['eye_w']); px(d, ex-3, ey+2, C['eye_w'])
            px(d, ex+6, ey+1, C['eye_w']); px(d, ex+6, ey+2, C['eye_w'])
            # Iris (gradient)
            rect(d, ex, ey, 5, 5, C['eye_p'])
            rect(d, ex, ey+2, 5, 3, C['eye_p2'])
            rect(d, ex+1, ey+3, 3, 2, C['eye_p3'])
            # Pupil
            rect(d, ex+2, ey+1, 2, 3, C['eye_pup'])
            # Highlights
            rect(d, ex+3, ey, 2, 2, C['eye_shine'])
            px(d, ex, ey+3, C['eye_shine2'])
            px(d, ex+1, ey+4, C['eye_shine2'])
    elif eyes == 'half':
        for ex in [lx, rx]:
            d.line([(ex-2, ey), (ex+6, ey)], fill=liner)
            rect(d, ex-2, ey+1, 8, 3, C['eye_w'])
            rect(d, ex, ey+1, 5, 2, C['eye_p'])
            rect(d, ex+1, ey+1, 3, 1, C['eye_p2'])
            px(d, ex+3, ey+1, C['eye_shine'])
    elif eyes == 'closed':
        for ex in [lx, rx]:
            d.line([(ex-2, ey+2), (ex+6, ey+2)], fill=liner, width=2)
            d.line([(ex-1, ey+3), (ex+5, ey+3)], fill=ol)
    elif eyes == 'closed_up':
        for ex in [lx, rx]:
            d.line([(ex-2, ey+3), (ex+1, ey), (ex+6, ey+3)], fill=liner, width=2)
    elif eyes == 'wide':
        for ex in [lx, rx]:
            d.line([(ex-2, ey-3), (ex+6, ey-3)], fill=liner)
            rect(d, ex-2, ey-2, 8, 8, C['eye_w'])
            rect(d, ex, ey-1, 6, 6, C['eye_p'])
            rect(d, ex+1, ey+1, 4, 4, C['eye_p2'])
            rect(d, ex+2, ey+1, 2, 3, C['eye_pup'])
            rect(d, ex+4, ey-1, 2, 2, C['eye_shine'])
            px(d, ex, ey+4, C['eye_shine2'])
    elif eyes == 'blink':
        for ex in [lx, rx]:
            d.line([(ex-2, ey+2), (ex+6, ey+2)], fill=liner)
    elif eyes == 'determined':
        for ex, flip in [(lx, False), (rx, True)]:
            if flip:
                d.line([(ex-2, ey-2), (ex+6, ey-4)], fill=liner, width=2)
            else:
                d.line([(ex-2, ey-4), (ex+6, ey-2)], fill=liner, width=2)
            d.line([(ex-2, ey), (ex+6, ey)], fill=liner)
            rect(d, ex-2, ey+1, 8, 3, C['eye_w'])
            rect(d, ex, ey+1, 5, 2, C['eye_p'])
            px(d, ex+3, ey+1, C['eye_shine'])

    # Nose
    px(d, cx, cy+4+oy+tilt, sks); px(d, cx+1, cy+4+oy+tilt, sks2)

    # Mouth
    my = cy + 6 + oy + tilt
    if eyes in ('open', 'half', 'blink', 'determined'):
        px(d, cx-2, my, C['lip']); px(d, cx-1, my, C['lip'])
        px(d, cx, my, C['lip']); px(d, cx+1, my, C['lip'])
        px(d, cx, my-1, C['lip_hi'])
    elif eyes == 'closed_up':
        d.line([(cx-3, my), (cx, my+1), (cx+3, my)], fill=C['lip'], width=1)
    elif eyes == 'wide':
        d.ellipse([cx-3, my-1, cx+3, my+2], fill=C['lip'], outline=ol)

    # Blush
    for bx_off in [-9, 7]:
        for by_off in range(2):
            for bxx in range(3):
                px(d, cx+bx_off+bxx, cy+4+by_off+oy+tilt, C['blush'])


# ============================================================
# Body — HD
# ============================================================
def draw_body(d, cx=32, cy=30, oy=0, lean=0):
    ol = C['outline']; l = lean
    # Inner kimono
    d.rounded_rectangle([cx-8+l, cy+oy, cx+8+l, cy+20+oy], radius=2, fill=C['kimono'], outline=ol)
    rect(d, cx-6+l, cy+2+oy, 12, 16, C['kimono_sh'])  # shading
    # White collar
    d.line([(cx-4+l, cy+oy), (cx+l, cy+4+oy)], fill=C['kimono_col'], width=2)
    d.line([(cx+4+l, cy+oy), (cx+l, cy+4+oy)], fill=C['kimono_col'], width=2)
    # Belt
    rect(d, cx-8+l, cy+10+oy, 17, 4, C['belt'])
    rect(d, cx-8+l, cy+12+oy, 17, 2, C['belt_sh'])
    rect(d, cx-2+l, cy+10+oy, 4, 4, C['belt_buck'])

    # Haori left panel
    d.rounded_rectangle([cx-16+l, cy+oy, cx-7+l, cy+22+oy], radius=2, fill=C['haori'], outline=ol)
    rect(d, cx-16+l, cy+oy, 2, 22, C['haori_sh'])
    rect(d, cx-14+l, cy+2+oy, 1, 18, C['haori_sh2'])
    # Haori right panel
    d.rounded_rectangle([cx+7+l, cy+oy, cx+16+l, cy+22+oy], radius=2, fill=C['haori'], outline=ol)
    rect(d, cx+14+l, cy+oy, 2, 22, C['haori_sh'])
    rect(d, cx+13+l, cy+2+oy, 1, 18, C['haori_sh2'])
    # Haori trim
    rect(d, cx-16+l, cy+20+oy, 9, 2, C['haori_trim'])
    rect(d, cx+7+l, cy+20+oy, 9, 2, C['haori_trim'])
    # Butterfly pattern on haori
    bp = C['butterfly2']
    for p in [(cx-14+l, cy+14+oy), (cx+12+l, cy+15+oy)]:
        px(d, p[0], p[1], bp); px(d, p[0]-1, p[1]-1, bp); px(d, p[0]+1, p[1]-1, bp)
        px(d, p[0]-1, p[1]+1, bp); px(d, p[0]+1, p[1]+1, bp)


# ============================================================
# Legs — HD
# ============================================================
def draw_legs(d, cx=32, cy=50, oy=0, stance=0):
    ol = C['outline']; sk = C['skin']; boot = C['boot']; bsh = C['boot_sh']
    if stance == 4:  # kneeling
        rect(d, cx-8, cy+4+oy, 16, 4, sk)
        for bx in [cx-10, cx+2]:
            d.rounded_rectangle([bx, cy+8+oy, bx+8, cy+12+oy], radius=2, fill=boot, outline=ol)
            rect(d, bx+1, cy+9+oy, 6, 2, bsh)
    elif stance == 1:  # wide
        for bx_off in [-10, 4]:
            rect(d, cx+bx_off, cy+oy, 6, 6, sk)
            d.rounded_rectangle([cx+bx_off-1, cy+6+oy, cx+bx_off+7, cy+12+oy], radius=2, fill=boot, outline=ol)
            rect(d, cx+bx_off, cy+7+oy, 6, 3, bsh)
    elif stance == 3:  # running
        rect(d, cx-12, cy+oy, 6, 6, sk)
        rect(d, cx+6, cy-2+oy, 6, 6, sk)
        d.rounded_rectangle([cx-13, cy+6+oy, cx-5, cy+12+oy], radius=2, fill=boot, outline=ol)
        d.rounded_rectangle([cx+5, cy+4+oy, cx+13, cy+10+oy], radius=2, fill=boot, outline=ol)
    else:  # normal
        for bx_off in [-6, 2]:
            rect(d, cx+bx_off, cy+oy, 6, 6, sk)
            d.rounded_rectangle([cx+bx_off-1, cy+6+oy, cx+bx_off+7, cy+12+oy], radius=2, fill=boot, outline=ol)
            rect(d, cx+bx_off, cy+7+oy, 6, 3, bsh)


# ============================================================
# Katana — HD poses
# ============================================================
def _draw_katana_blade(d, points, sheen=True):
    for i, (bx, by) in enumerate(points):
        if 0 <= bx < 64 and 0 <= by < 64:
            px(d, bx, by, C['blade'])
            if i % 2 == 0 and 0 <= by-1 < 64:
                px(d, bx, by-1, C['blade_edge'])
            if sheen and i % 4 == 0 and 0 <= by+1 < 64:
                px(d, bx, by+1, C['blade_sheen'])

def draw_katana_rest(d, ox=0, oy=0):
    # Handle
    for i in range(6):
        px(d, 16+ox+i, 48-i+oy, C['handle'] if i%2==0 else C['wrap_r'])
    # Guard
    rect(d, 21+ox, 42-i+oy, 3, 3, C['guard'])
    # Blade
    pts = [(23+ox+i, 41-i+oy) for i in range(18)]
    _draw_katana_blade(d, pts)

def draw_katana_slash_h(d, ox=0, oy=0):
    # Handle left
    for i in range(6):
        px(d, 6+ox+i, 28+oy, C['handle'] if i%2==0 else C['wrap_r'])
    # Guard
    rect(d, 12+ox, 26+oy, 2, 5, C['guard'])
    # Blade horizontal
    pts = [(14+ox+i, 28+oy) for i in range(28)]
    _draw_katana_blade(d, pts)

def draw_katana_slash_up(d, ox=0, oy=0):
    # Handle bottom-right
    for i in range(6):
        px(d, 44+ox, 46-i+oy, C['handle'] if i%2==0 else C['wrap_r'])
    # Guard
    rect(d, 42+ox, 40+oy, 5, 3, C['guard'])
    # Blade going up-left
    pts = [(41-i+ox, 39-i+oy) for i in range(24)]
    _draw_katana_blade(d, pts)

def draw_katana_raised(d, ox=0, oy=0):
    # Handle right
    for i in range(6):
        px(d, 46+ox, 14+i+oy, C['handle'] if i%2==0 else C['wrap_r'])
    # Guard
    rect(d, 44+ox, 12+oy, 5, 3, C['guard'])
    # Blade going up-left
    pts = [(43-i+ox, 11-(i//2)+oy) for i in range(24)]
    _draw_katana_blade(d, pts)

def draw_katana_low(d, ox=0, oy=0):
    for i in range(6):
        px(d, 14+ox+i, 44+oy, C['handle'] if i%2==0 else C['wrap_r'])
    rect(d, 20+ox, 42+oy, 3, 3, C['guard'])
    pts = [(23+ox+i, 43+(i//6)+oy) for i in range(20)]
    _draw_katana_blade(d, pts)


# ============================================================
# Effects — HD
# ============================================================
def draw_butterfly(d, x, y, variant=0, size=2):
    c = [C['butterfly'], C['butterfly2'], C['butterfly3']][variant % 3]
    cs = C['butterfly_sh']
    if size == 3:
        # Large butterfly
        for dx in range(-6, 7):
            if dx != 0:
                px(d, x+dx, y-2, c)
                px(d, x+dx, y-1, c)
                px(d, x+dx, y, c)
        for dx in [-3,-2,-1,1,2,3]:
            px(d, x+dx, y+1, c)
        rect(d, x-1, y-2, 2, 5, cs)
    elif size == 2:
        for dx in [-4,-3,-2,2,3,4]:
            px(d, x+dx, y-1, c)
            px(d, x+dx, y, c)
        for dx in [-2,-1,1,2]:
            px(d, x+dx, y+1, c)
        px(d, x, y-1, c); px(d, x, y, c); px(d, x, y+1, cs)
    else:
        px(d, x-2, y, c); px(d, x-1, y-1, c); px(d, x, y, c)
        px(d, x+1, y-1, c); px(d, x+2, y, c)

def draw_sparkle(d, x, y, color=None, size=1):
    c = color or C['sparkle']
    px(d, x, y-1, c); px(d, x-1, y, c); px(d, x, y, c)
    px(d, x+1, y, c); px(d, x, y+1, c)
    if size == 2:
        px(d, x, y-2, c); px(d, x-2, y, c); px(d, x+2, y, c); px(d, x, y+2, c)

def draw_speed_lines(d, x, y, count=4, length=8):
    c = C['speed']
    for i in range(count):
        ly = y + i * 3
        for j in range(length):
            if 0 <= x-j < 64 and 0 <= ly < 64:
                px(d, x-j, ly, c)

def draw_slash_trail(d, x1, y1, x2, y2):
    c1 = C['slash_trail']; c2 = C['slash_trail2']
    steps = max(abs(x2-x1), abs(y2-y1), 1)
    for i in range(steps):
        t = i / steps
        curve = int(6 * (0.5 - abs(t - 0.5)))
        x = int(x1 + (x2-x1)*t); y = int(y1 + (y2-y1)*t) - curve
        if 0 <= x < 64 and 0 <= y < 64:
            px(d, x, y, c1)
            for dy in [-1, 1]:
                if 0 <= y+dy < 64: px(d, x, y+dy, c2)

def draw_z(d, x, y, color, big=False):
    w = 7 if big else 5; h = 8 if big else 6
    rect(d, x, y, w, 2, color)
    if big:
        for i in range(h-2): px(d, x+w-1-i, y+2+i, color)
    else:
        for i in range(h-2): px(d, x+w-2-i, y+2+i, color)
    rect(d, x, y+h-1, w, 2, color)

def draw_sweat(d, x, y):
    c = C['sweat']
    px(d, x, y, c); rect(d, x-1, y+1, 3, 3, c)
    px(d, x, y+4, c); px(d, x, y-1, c)


# ============================================================
# IDLE
# ============================================================
def make_idle_frames(count=4):
    frames = []
    for i in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        oy = 0 if i < 2 else 1
        draw_hair_bun(d, oy=oy)
        draw_head(d, oy=oy, eyes='blink' if i==2 else 'open')
        draw_body(d, oy=oy); draw_legs(d, oy=oy, stance=0)
        draw_katana_rest(d, oy=oy)
        bpos = [(54,10),(56,6),(54,8),(52,12)]
        draw_butterfly(d, bpos[i][0], bpos[i][1], i%2, size=2)
        draw_butterfly(d, 8, 14, 0, size=1)  # small bg butterfly
        frames.append(img)
    return frames


# ============================================================
# WORKING — dynamic action
# ============================================================
def make_working_frames(count=6):
    frames = []
    # F0: Ready — lean forward, katana pulled back
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=30, oy=0)
    draw_head(d, cx=30, oy=0, eyes='determined')
    draw_body(d, cx=30, oy=0, lean=2); draw_legs(d, cx=30, oy=0, stance=1)
    draw_katana_low(d, ox=-2, oy=0)
    draw_butterfly(d, 56, 10, 0, 2); draw_butterfly(d, 52, 6, 1, 2)
    draw_butterfly(d, 48, 14, 2, 1)
    frames.append(img)

    # F1: Dashing — speed lines, running
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=26, by=3, oy=-2)
    draw_head(d, cx=26, cy=17, oy=-2, eyes='determined')
    draw_body(d, cx=26, cy=29, oy=-2, lean=4)
    draw_legs(d, cx=26, cy=49, oy=-2, stance=3)
    draw_katana_rest(d, ox=-6, oy=-2)
    draw_speed_lines(d, 10, 18, 4, 8); draw_speed_lines(d, 8, 36, 3, 6)
    draw_butterfly(d, 54, 14, 0, 2); draw_butterfly(d, 50, 8, 1, 1)
    frames.append(img)

    # F2: Horizontal slash — big sweep
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=28, oy=-2)
    draw_head(d, cx=28, cy=18, oy=-2, eyes='determined')
    draw_body(d, cx=28, oy=-2, lean=2); draw_legs(d, cx=28, oy=-2, stance=1)
    draw_katana_slash_h(d, 0, -2)
    draw_slash_trail(d, 18, 12, 58, 32)
    draw_butterfly(d, 56, 4, 0, 2); draw_butterfly(d, 52, 2, 1, 1)
    draw_sparkle(d, 44, 22, size=2); draw_sparkle(d, 36, 26, size=1)
    frames.append(img)

    # F3: Upward slash — butterflies scatter
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=30, by=3, oy=-4)
    draw_head(d, cx=30, cy=17, oy=-4, eyes='determined')
    draw_body(d, cx=30, cy=29, oy=-4, lean=0); draw_legs(d, cx=30, cy=49, oy=-4, stance=1)
    draw_katana_slash_up(d, 0, -4)
    draw_slash_trail(d, 44, 42, 18, 10)
    draw_butterfly(d, 10, 6, 0, 2); draw_butterfly(d, 54, 4, 1, 2)
    draw_butterfly(d, 16, 2, 2, 1); draw_butterfly(d, 46, 2, 0, 1)
    draw_sparkle(d, 28, 14, size=2); draw_sparkle(d, 40, 10, size=1)
    frames.append(img)

    # F4: Chasing — moved right
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, bx=36, by=4, oy=0)
    draw_head(d, cx=36, cy=18, oy=0, eyes='half', look_dir=2)
    draw_body(d, cx=36, oy=0, lean=2); draw_legs(d, cx=36, oy=0, stance=3)
    draw_katana_rest(d, ox=6, oy=0)
    draw_speed_lines(d, 20, 24, 3, 6)
    draw_butterfly(d, 58, 12, 0, 2); draw_butterfly(d, 6, 8, 1, 2)
    frames.append(img)

    # F5: Guard — raised katana, confident
    img = new_frame(); d = ImageDraw.Draw(img)
    draw_hair_bun(d, oy=0); draw_head(d, oy=0, eyes='open')
    draw_body(d, oy=0, lean=0); draw_legs(d, oy=0, stance=1)
    draw_katana_raised(d, -4, 4)
    draw_sparkle(d, 20, 8, size=2); draw_sparkle(d, 30, 6, size=2)
    draw_sparkle(d, 25, 4, size=1)
    draw_butterfly(d, 16, 4, 0, 2); draw_butterfly(d, 52, 14, 1, 2)
    frames.append(img)
    return frames


# ============================================================
# HAPPY
# ============================================================
def make_happy_frames(count=4):
    frames = []
    offsets = [(0, 2), (0, -6), (0, -8), (0, 0)]
    for idx in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        _, oy = offsets[idx]
        if idx == 0:
            draw_hair_bun(d, oy=2); draw_head(d, oy=2, eyes='closed_up')
            draw_body(d, oy=2); draw_legs(d, oy=2, stance=2); draw_katana_low(d, oy=2)
        elif idx == 1:
            draw_hair_bun(d, bx=30, by=1, oy=oy)
            draw_head(d, cx=30, cy=16, oy=oy, eyes='closed_up')
            draw_body(d, cx=30, cy=28, oy=oy); draw_legs(d, cx=30, cy=48, oy=oy, stance=2)
            draw_katana_raised(d, -2, oy-4)
            draw_sparkle(d, 10, 6, size=2); draw_sparkle(d, 52, 10, size=2)
        elif idx == 2:
            draw_hair_bun(d, bx=28, by=0, oy=oy)
            draw_head(d, cx=28, cy=15, oy=oy, eyes='closed_up')
            draw_body(d, cx=28, cy=27, oy=oy); draw_legs(d, cx=28, cy=47, oy=oy, stance=2)
            draw_katana_slash_h(d, -2, oy)
            draw_butterfly(d, 6, 6, 0, 3); draw_butterfly(d, 56, 10, 0, 3)
            draw_butterfly(d, 50, 4, 1, 2); draw_butterfly(d, 30, 0, 1, 2)
            draw_butterfly(d, 12, 16, 2, 2)
            draw_sparkle(d, 8, 2, size=2); draw_sparkle(d, 54, 6, size=2); draw_sparkle(d, 20, 4, size=1)
        else:
            draw_hair_bun(d, oy=0); draw_head(d, oy=0, eyes='closed_up')
            draw_body(d, oy=0); draw_legs(d, oy=0, stance=1); draw_katana_rest(d, oy=0)
            draw_butterfly(d, 12, 12, 0, 2); draw_butterfly(d, 52, 10, 1, 2)
            draw_sparkle(d, 8, 16, size=1)
        frames.append(img)
    return frames


# ============================================================
# SLEEPING
# ============================================================
def make_sleeping_frames(count=2):
    frames = []
    for i in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        draw_hair_bun(d, oy=6); draw_head(d, oy=6, eyes='closed')
        draw_body(d, oy=6); draw_legs(d, oy=6, stance=4); draw_katana_low(d, oy=6)
        zc = C['zzz']
        if i == 0:
            draw_z(d, 48, 14, zc, False); draw_z(d, 54, 6, zc, True)
            draw_butterfly(d, 8, 10, 0, 2); draw_butterfly(d, 28, 6, 0, 1)
        else:
            draw_z(d, 50, 18, zc, False); draw_z(d, 56, 10, zc, True); draw_z(d, 46, 2, zc, False)
            draw_butterfly(d, 10, 6, 1, 2); draw_butterfly(d, 6, 14, 0, 1); draw_butterfly(d, 28, 6, 0, 1)
        frames.append(img)
    return frames


# ============================================================
# ERROR
# ============================================================
def make_error_frames(count=3):
    frames = []
    for i in range(count):
        img = new_frame(); d = ImageDraw.Draw(img)
        if i == 0:
            draw_hair_bun(d, oy=0); draw_head(d, oy=0, eyes='wide')
            draw_body(d, oy=0, lean=-2); draw_legs(d, oy=0, stance=1)
            draw_katana_low(d, -2, 0); draw_sweat(d, 14, 18)
            draw_butterfly(d, 10, 10, 0, 2)
        elif i == 1:
            draw_hair_bun(d, bx=34, oy=0); draw_head(d, cx=34, oy=0, eyes='wide')
            draw_body(d, cx=34, oy=0, lean=-2); draw_legs(d, cx=34, oy=0, stance=1)
            draw_katana_low(d, 4, 0); draw_sweat(d, 16, 20)
            rect(d, 54, 6, 2, 6, C['outline']); px(d, 54, 14, C['outline']); px(d, 55, 14, C['outline'])
            draw_butterfly(d, 6, 6, 1, 2); draw_butterfly(d, 56, 20, 0, 1)
        else:
            draw_hair_bun(d, bx=30, oy=0); draw_head(d, cx=30, oy=0, eyes='wide')
            draw_body(d, cx=30, oy=0, lean=2); draw_legs(d, cx=30, oy=0, stance=1)
            draw_katana_low(d, 0, 0); draw_sweat(d, 12, 22)
            rect(d, 54, 6, 2, 6, C['outline']); px(d, 54, 14, C['outline']); px(d, 55, 14, C['outline'])
            draw_butterfly(d, 8, 10, 0, 2); draw_butterfly(d, 54, 4, 1, 2)
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
        "name": "蝴蝶剑士 HD (Butterfly Swordsman HD)",
        "author": "DesktopXPet",
        "version": "1.0.0",
        "preview": "preview.png",
        "description": "High-detail Shinobu-inspired swordswoman — 64x64 HD pixel art",
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
