from PIL import Image
import sys
from pathlib import Path


def remove_black_background(input_path: Path, output_path: Path, threshold: int = 30):
    """把图片中的纯黑背景变成透明，保留角色主体。"""
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # 候选背景：接近黑色的不透明像素
    is_candidate = [[False for _ in range(height)] for _ in range(width)]
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            if a > 0 and r < threshold and g < threshold and b < threshold:
                is_candidate[x][y] = True

    # 从四个角做 flood fill，只访问候选背景，标记为真正的背景
    is_background = [[False for _ in range(height)] for _ in range(width)]
    stack = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]

    while stack:
        x, y = stack.pop()
        if x < 0 or x >= width or y < 0 or y >= height:
            continue
        if is_background[x][y]:
            continue
        if not is_candidate[x][y]:
            continue
        is_background[x][y] = True
        stack.extend([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])

    # 应用：真正背景变透明；候选背景中未连通的保留
    for x in range(width):
        for y in range(height):
            if is_background[x][y]:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)

    img.save(output_path)
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    skin_dir = Path(__file__).parent.parent / "resources" / "skins" / "reze"
    for name in ["eat.png", "stroke.png"]:
        input_path = skin_dir / name
        if input_path.exists():
            remove_black_background(input_path, input_path)
        else:
            print(f"Not found: {input_path}")
            sys.exit(1)
