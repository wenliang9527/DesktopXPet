"""
DesktopXPet - Chibi Character Sprite Sheet Generator
日系 Chibi 风格桌面宠物精灵图生成器
内部绘制 96x96 (48*2)，输出 128x128 — 高清细腻像素风
"""

from PIL import Image, ImageDraw
import os, json

# ============================================================
# 配置：内部 96x96 绘制 → 128x128 输出
# ============================================================
DRAW_SIZE = 48          # 逻辑绘制坐标基于 48x48
SCALE = 2               # 坐标放大倍数
FRAME_SIZE = DRAW_SIZE * SCALE  # 实际像素 96x96
SCALE_OUT = 128         # 输出精灵图帧尺寸
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "resources", "skins", "chibi-girl")

# ============================================================
# Color Palette — 柔和日系配色
# ============================================================
C = {
    'bg':           (0, 0, 0, 0),
    'outline':      (70, 50, 60, 255),
    'hair':         (180, 130, 200, 255),
    'hair_dark':    (150, 100, 170, 255),
    'hair_light':   (210, 170, 230, 255),
    'skin':         (255, 225, 200, 255),
    'skin_shadow':  (240, 200, 175, 255),
    'eye_white':    (255, 255, 255, 255),
    'eye_iris':     (80, 150, 220, 255),
    'eye_iris_dk':  (50, 110, 180, 255),
    'eye_pupil':    (30, 30, 50, 255),
    'eye_shine1':   (255, 255, 255, 255),
    'eye_shine2':   (200, 230, 255, 255),
    'blush':        (255, 170, 160, 100),
    'mouth':        (220, 120, 110, 255),
    'dress':        (255, 200, 210, 255),
    'dress_dark':   (240, 170, 185, 255),
    'dress_light':  (255, 225, 235, 255),
    'ribbon':       (255, 130, 140, 255),
    'ribbon_dark':  (220, 100, 110, 255),
    'shoe':         (100, 80, 70, 255),
    'sock':         (255, 255, 255, 255),
    'sparkle':      (255, 255, 150, 255),
    'sparkle2':     (255, 200, 230, 255),
    'zzz':          (160, 180, 240, 200),
    'sweat':        (130, 200, 255, 255),
    'book':         (180, 140, 100, 255),
    'book_page':    (255, 250, 240, 255),
    'star':         (255, 230, 80, 255),
    'heart':        (255, 100, 120, 255),
    'note':         (255, 180, 200, 255),
}


# ============================================================
# 缩放绘制包装器 — 所有坐标自动 ×SCALE
# 绘制代码仍基于 48x48 逻辑坐标，实际画到 96x96 画布
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
        # xy 可能是 [(x1,y1), (x2,y2), ...] 元组列表
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
    """创建 96x96 RGBA 画布，返回 (Image, ScaledDraw)"""
    img = Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), C['bg'])
    return img, ScaledDraw(ImageDraw.Draw(img))


def px(d, x, y, c):
    """绘制 SCALE×SCALE 的像素块"""
    d.point((x, y), fill=c)


def rect(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)


# ============================================================
# 角色部件绘制（坐标基于 48x48 逻辑空间）
# ============================================================

def draw_hair_back(d, oy=0):
    h, hd = C['hair'], C['hair_dark']
    d.rounded_rectangle([12, 10+oy, 17, 30+oy], radius=2, fill=h)
    d.rounded_rectangle([30, 10+oy, 35, 30+oy], radius=2, fill=h)
    rect(d, 12, 20+oy, 2, 8, hd)
    rect(d, 34, 20+oy, 2, 8, hd)


def draw_head(d, oy=0, eyes='open', mouth='normal', blink=False):
    ol = C['outline']
    sk = C['skin']
    sks = C['skin_shadow']
    d.rounded_rectangle([13, 6+oy, 34, 22+oy], radius=5, fill=sk, outline=ol)
    d.rounded_rectangle([16, 18+oy, 31, 22+oy], radius=3, fill=sks)
    _draw_eyes(d, oy, eyes, blink)
    rect(d, 14, 17+oy, 3, 2, C['blush'])
    rect(d, 30, 17+oy, 3, 2, C['blush'])
    px(d, 23, 17+oy, ol)
    _draw_mouth(d, oy, mouth)


def _draw_eyes(d, oy, style, blink):
    ol = C['outline']
    if blink and style == 'open':
        style = 'blink'

    if style == 'open':
        # 左眼
        d.rounded_rectangle([15, 12+oy, 21, 18+oy], radius=2, fill=C['eye_white'], outline=ol)
        d.rounded_rectangle([16, 13+oy, 20, 17+oy], radius=1, fill=C['eye_iris'])
        d.rounded_rectangle([17, 14+oy, 20, 17+oy], radius=1, fill=C['eye_iris_dk'])
        rect(d, 17, 14+oy, 2, 2, C['eye_pupil'])
        px(d, 16, 13+oy, C['eye_shine1'])
        px(d, 19, 16+oy, C['eye_shine2'])
        # 右眼
        d.rounded_rectangle([26, 12+oy, 32, 18+oy], radius=2, fill=C['eye_white'], outline=ol)
        d.rounded_rectangle([27, 13+oy, 31, 17+oy], radius=1, fill=C['eye_iris'])
        d.rounded_rectangle([27, 14+oy, 30, 17+oy], radius=1, fill=C['eye_iris_dk'])
        rect(d, 28, 14+oy, 2, 2, C['eye_pupil'])
        px(d, 27, 13+oy, C['eye_shine1'])
        px(d, 30, 16+oy, C['eye_shine2'])
        # 睫毛
        rect(d, 14, 11+oy, 2, 1, ol)
        rect(d, 32, 11+oy, 2, 1, ol)

    elif style == 'half':
        rect(d, 15, 14+oy, 7, 3, C['eye_white'])
        d.rounded_rectangle([16, 14+oy, 20, 16+oy], radius=1, fill=C['eye_iris'])
        rect(d, 17, 14+oy, 2, 1, C['eye_pupil'])
        px(d, 16, 14+oy, C['eye_shine1'])
        rect(d, 26, 14+oy, 7, 3, C['eye_white'])
        d.rounded_rectangle([27, 14+oy, 31, 16+oy], radius=1, fill=C['eye_iris'])
        rect(d, 28, 14+oy, 2, 1, C['eye_pupil'])
        px(d, 27, 14+oy, C['eye_shine1'])
        rect(d, 14, 13+oy, 8, 2, C['skin'])
        rect(d, 25, 13+oy, 8, 2, C['skin'])

    elif style == 'closed':
        d.line([(15, 15+oy), (21, 15+oy)], fill=ol)
        d.line([(26, 15+oy), (32, 15+oy)], fill=ol)

    elif style == 'happy':
        d.arc([15, 13+oy, 21, 18+oy], 200, 340, fill=ol)
        d.arc([26, 13+oy, 32, 18+oy], 200, 340, fill=ol)

    elif style == 'wide':
        d.ellipse([14, 11+oy, 22, 19+oy], fill=C['eye_white'], outline=ol)
        d.rounded_rectangle([16, 13+oy, 20, 17+oy], radius=1, fill=C['eye_iris'])
        px(d, 17, 13+oy, C['eye_shine1'])
        d.ellipse([25, 11+oy, 33, 19+oy], fill=C['eye_white'], outline=ol)
        d.rounded_rectangle([27, 13+oy, 31, 17+oy], radius=1, fill=C['eye_iris'])
        px(d, 28, 13+oy, C['eye_shine1'])

    elif style == 'blink':
        rect(d, 15, 15+oy, 7, 1, ol)
        rect(d, 26, 15+oy, 7, 1, ol)


def _draw_mouth(d, oy, style):
    m = C['mouth']
    ol = C['outline']
    if style == 'normal':
        px(d, 22, 19+oy, m); px(d, 24, 19+oy, m)
    elif style == 'happy':
        d.arc([20, 18+oy, 27, 23+oy], 0, 180, fill=m)
    elif style == 'open':
        d.ellipse([21, 19+oy, 26, 22+oy], fill=m, outline=ol)
    elif style == 'w':
        d.line([(20, 19+oy), (22, 20+oy), (24, 19+oy), (26, 20+oy), (28, 19+oy)], fill=m)
    elif style == 'cat':
        px(d, 23, 19+oy, m)
        d.line([(21, 19+oy), (23, 20+oy), (25, 19+oy)], fill=m)


def draw_hair_front(d, oy=0):
    h, hl, hd = C['hair'], C['hair_light'], C['hair_dark']
    ol = C['outline']
    d.rounded_rectangle([13, 5+oy, 34, 13+oy], radius=4, fill=h, outline=ol)
    d.rounded_rectangle([14, 8+oy, 19, 14+oy], radius=2, fill=h)
    d.rounded_rectangle([20, 7+oy, 27, 13+oy], radius=2, fill=h)
    d.rounded_rectangle([28, 8+oy, 33, 14+oy], radius=2, fill=h)
    rect(d, 17, 8+oy, 1, 3, hl)
    rect(d, 23, 7+oy, 1, 4, hl)
    rect(d, 30, 8+oy, 1, 3, hl)
    rect(d, 15, 12+oy, 2, 1, hd)
    rect(d, 29, 12+oy, 2, 1, hd)
    _draw_ribbon(d, 30, 5+oy)


def _draw_ribbon(d, x, y):
    r, rd = C['ribbon'], C['ribbon_dark']
    d.polygon([(x, y+2), (x-3, y), (x-3, y+4)], fill=r, outline=C['outline'])
    d.polygon([(x, y+2), (x+3, y), (x+3, y+4)], fill=r, outline=C['outline'])
    rect(d, x-1, y+1, 2, 2, rd)


def draw_body(d, oy=0, arms='down'):
    ol = C['outline']
    dr, drd, drl = C['dress'], C['dress_dark'], C['dress_light']
    rect(d, 21, 22+oy, 5, 2, C['skin'])
    d.rounded_rectangle([16, 23+oy, 31, 33+oy], radius=3, fill=dr, outline=ol)
    rect(d, 18, 28+oy, 1, 4, drd)
    rect(d, 22, 27+oy, 1, 5, drd)
    rect(d, 26, 28+oy, 1, 4, drd)
    rect(d, 20, 25+oy, 2, 1, drl)
    rect(d, 25, 25+oy, 2, 1, drl)
    _draw_small_bow(d, 22, 23+oy)
    _draw_arms(d, oy, arms)


def _draw_small_bow(d, x, y):
    r = C['ribbon']
    px(d, x, y, r); px(d, x+3, y, r)
    rect(d, x+1, y, 2, 1, C['ribbon_dark'])


def _draw_arms(d, oy, style):
    sk = C['skin']
    ol = C['outline']
    if style == 'down':
        d.rounded_rectangle([13, 25+oy, 16, 32+oy], radius=1, fill=sk, outline=ol)
        d.rounded_rectangle([31, 25+oy, 34, 32+oy], radius=1, fill=sk, outline=ol)
    elif style == 'up':
        d.rounded_rectangle([11, 20+oy, 15, 27+oy], radius=1, fill=sk, outline=ol)
        d.rounded_rectangle([32, 20+oy, 36, 27+oy], radius=1, fill=sk, outline=ol)
    elif style == 'wave':
        d.rounded_rectangle([13, 25+oy, 16, 32+oy], radius=1, fill=sk, outline=ol)
        d.rounded_rectangle([32, 18+oy, 36, 26+oy], radius=1, fill=sk, outline=ol)
    elif style == 'hold':
        d.rounded_rectangle([13, 26+oy, 17, 32+oy], radius=1, fill=sk, outline=ol)
        d.rounded_rectangle([30, 26+oy, 34, 32+oy], radius=1, fill=sk, outline=ol)


def draw_legs(d, oy=0):
    sk, ol = C['skin'], C['outline']
    so, sh = C['sock'], C['shoe']
    rect(d, 18, 33+oy, 4, 5, sk)
    rect(d, 25, 33+oy, 4, 5, sk)
    rect(d, 18, 36+oy, 4, 2, so)
    rect(d, 25, 36+oy, 4, 2, so)
    d.rounded_rectangle([17, 37+oy, 22, 40+oy], radius=1, fill=sh, outline=ol)
    d.rounded_rectangle([24, 37+oy, 29, 40+oy], radius=1, fill=sh, outline=ol)


# ============================================================
# 装饰效果
# ============================================================

def _sparkle(d, x, y, c=None):
    if c is None: c = C['sparkle']
    px(d, x, y-1, c); px(d, x-1, y, c); px(d, x, y, c)
    px(d, x+1, y, c); px(d, x, y+1, c)


def _heart(d, x, y):
    c = C['heart']
    px(d, x+1, y, c); px(d, x+3, y, c)
    rect(d, x, y+1, 5, 1, c); rect(d, x+1, y+2, 3, 1, c)
    px(d, x+2, y+3, c)


def _note(d, x, y):
    c = C['note']
    px(d, x, y, c); rect(d, x+1, y-3, 1, 4, c)
    rect(d, x+2, y-3, 2, 1, c); px(d, x+3, y-2, c)


def _zzz(d, x, y, size='small'):
    c = C['zzz']
    if size == 'small':
        rect(d, x, y, 3, 1, c); px(d, x+2, y+1, c); px(d, x+1, y+2, c)
        px(d, x, y+3, c); rect(d, x, y+4, 3, 1, c)
    else:
        rect(d, x, y, 4, 1, c); px(d, x+3, y+1, c); px(d, x+2, y+2, c)
        px(d, x+1, y+3, c); px(d, x, y+4, c); rect(d, x, y+5, 4, 1, c)


def _sweat(d, x, y):
    c = C['sweat']
    px(d, x, y, c); rect(d, x-1, y+1, 3, 2, c); px(d, x, y+3, c)


def _book(d, x, y):
    b, bp = C['book'], C['book_page']
    ol = C['outline']
    rect(d, x, y, 10, 7, b); rect(d, x+1, y+1, 8, 5, bp)
    rect(d, x+5, y, 1, 7, ol)


# ============================================================
# 完整角色
# ============================================================

def draw_character(d, oy=0, eyes='open', mouth='normal', arms='down', blink=False, hair=True):
    if hair: draw_hair_back(d, oy)
    draw_head(d, oy, eyes, mouth, blink)
    if hair: draw_hair_front(d, oy)
    draw_body(d, oy, arms)
    draw_legs(d, oy)


# ============================================================
# 各状态动画帧
# ============================================================

def make_idle_frames(count=4):
    frames = []
    for i in range(count):
        img, d = new_frame()
        draw_character(d, oy=0, eyes='open', mouth='normal', blink=(i == 2))
        frames.append(img)
    return frames


def make_working_frames(count=6):
    frames = []
    for i in range(count):
        img, d = new_frame()
        draw_character(d, oy=0, eyes='half', mouth='normal', arms='hold')
        _book(d, 16, 30)
        if i >= 4:
            px(d, 36, 8, C['outline'])
            px(d, 37, 6, C['outline'])
            d.rounded_rectangle([36, 2, 44, 7], radius=2, fill=C['eye_white'], outline=C['outline'])
            px(d, 39, 4, C['outline']); px(d, 41, 4, C['outline']); px(d, 40, 5, C['outline'])
        frames.append(img)
    return frames


def make_happy_frames(count=4):
    frames = []
    for i in range(count):
        img, d = new_frame()
        if i == 0:
            draw_character(d, oy=1, eyes='happy', mouth='happy')
        elif i == 1:
            draw_character(d, oy=-2, eyes='happy', mouth='happy', arms='wave')
            _sparkle(d, 8, 8); _sparkle(d, 38, 12, C['sparkle2'])
        elif i == 2:
            draw_character(d, oy=-3, eyes='happy', mouth='happy', arms='up')
            _sparkle(d, 6, 5); _sparkle(d, 40, 8, C['sparkle2'])
            _heart(d, 36, 2); _note(d, 8, 8)
        elif i == 3:
            draw_character(d, oy=0, eyes='happy', mouth='happy', arms='wave')
            _sparkle(d, 10, 10); _sparkle(d, 36, 6, C['sparkle2'])
        frames.append(img)
    return frames


def make_sleeping_frames(count=2):
    frames = []
    for i in range(count):
        img, d = new_frame()
        draw_character(d, oy=3, eyes='closed', mouth='normal')
        if i == 0:
            _zzz(d, 36, 10, 'small'); _zzz(d, 40, 5, 'big')
        else:
            _zzz(d, 37, 12, 'small'); _zzz(d, 41, 7, 'big'); _zzz(d, 34, 3, 'small')
        frames.append(img)
    return frames


def make_error_frames(count=3):
    frames = []
    for i in range(count):
        img, d = new_frame()
        draw_character(d, oy=0, eyes='wide', mouth='open')
        _sweat(d, 11, 10 + i*2)
        if i >= 1:
            rect(d, 40, 4, 2, 5, C['outline'])
            rect(d, 40, 10, 2, 2, C['outline'])
        frames.append(img)
    return frames


# ============================================================
# Assembly & Output
# ============================================================

def assemble_sheet(frames, path):
    w = SCALE_OUT * len(frames)
    h = SCALE_OUT
    sheet = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        # 96x96 → 128x128 NEAREST 保持像素锐利
        scaled = f.resize((SCALE_OUT, SCALE_OUT), Image.NEAREST)
        sheet.paste(scaled, (i * SCALE_OUT, 0))
    sheet.save(path, 'PNG')
    print(f"  ✓ {path} ({w}x{h}, {len(frames)} frames)")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"HD Chibi sprite generator → {os.path.abspath(OUT_DIR)}")
    print(f"  Internal: {FRAME_SIZE}x{FRAME_SIZE} (48×2) → Output: {SCALE_OUT}x{SCALE_OUT}\n")

    configs = [
        ('idle',     make_idle_frames,     4, 4, True),
        ('working',  make_working_frames,  6, 8, True),
        ('happy',    make_happy_frames,    4, 6, False),
        ('sleeping', make_sleeping_frames, 2, 1, True),
        ('error',    make_error_frames,    3, 4, True),
    ]

    for name, gen, count, *_ in configs:
        print(f"Generating '{name}' ({count} frames)...")
        assemble_sheet(gen(count), os.path.join(OUT_DIR, f"{name}.png"))

    manifest = {
        "name": "日系 Chibi (Chibi Girl)",
        "author": "DesktopXPet",
        "version": "1.0.0",
        "preview": "preview.png",
        "description": "A cute Japanese chibi-style character with lavender hair and pink dress",
        "frameSize": {"width": 128, "height": 128},
        "animations": {
            n: {"frames": c, "fps": f, "loop": l}
            for n, _, c, f, l in configs
        }
    }
    mp = os.path.join(OUT_DIR, "manifest.json")
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n  ✓ {mp}")

    preview = make_idle_frames(1)[0].resize((256, 256), Image.NEAREST)
    pp = os.path.join(OUT_DIR, "preview.png")
    preview.save(pp, 'PNG')
    print(f"  ✓ {pp}")
    print("\nDone! HD chibi skin generated.")


if __name__ == '__main__':
    main()
