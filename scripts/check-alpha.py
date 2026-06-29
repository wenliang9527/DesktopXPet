from PIL import Image
from pathlib import Path

skin_dir = Path(__file__).parent.parent / "resources" / "skins" / "reze"
for name in ["eat.png", "stroke.png", "idle.png"]:
    img = Image.open(skin_dir / name).convert("RGBA")
    alpha = [p[3] for p in img.getdata()]
    transparent = sum(1 for a in alpha if a < 128)
    total = len(alpha)
    print(f"{name}: {transparent}/{total} pixels transparent ({100*transparent/total:.1f}%)")
