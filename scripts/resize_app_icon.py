from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "assets" / "images"
targets = {
    "icon.png": 512,
    "splash-icon.png": 512,
    "android-icon-foreground.png": 512,
    "favicon.png": 128,
}

for name, size in targets.items():
    path = root / name
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        resized = rgb.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(path, "PNG", optimize=True, compress_level=9)
        print(f"{name}: {size}x{size}")
