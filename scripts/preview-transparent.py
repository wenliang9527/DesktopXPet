from PIL import Image
from pathlib import Path

skin_dir = Path(__file__).parent.parent / "resources" / "skins" / "reze"
# 创建 512x256 棋盘格背景预览图
preview = Image.new("RGBA", (512, 256), (255, 255, 255, 255))
# 画棋盘格
for y in range(0, 256, 32):
    for x in range(0, 512, 32):
        if ((x // 32) + (y // 32)) % 2 == 1:
            for dy in range(32):
                for dx in range(32):
                    preview.putpixel((x + dx, y + dy), (200, 200, 200, 255))

for i, name in enumerate(["eat.png", "stroke.png"]):
    img = Image.open(skin_dir / name).convert("RGBA")
    img = img.resize((192, 192), Image.Resampling.LANCZOS)
    preview.paste(img, (i * 224 + 32, 32), img)

preview.save(skin_dir / "transparency_preview.png")
print("Saved transparency_preview.png")
