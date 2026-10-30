# Makes every Flowlytix icon from the ONE official logo, brand/flowlytix-logo.png (1024 px, see-through background).
# Never draw or generate a new logo: only resize, crop or pad this file.
#   python3 tools/brand-icons.py <out-folder> [favicon|app]
#   favicon: favicon-32.png, favicon-48.png, favicon-192.png (see-through, for browser tabs)
#   app:     apple-touch-icon.png (180), money-192.png, money-512.png, money-maskable-512.png (white, for home screens)
import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
logo = Image.open(os.path.join(here, "..", "brand", "flowlytix-logo.png")).convert("RGBA")
logo = logo.crop(logo.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox())  # trim the empty edges

def square(size, width_share, bg):
    # the logo centred on a square, its width = width_share of the square (the face is navy, so app icons use white)
    w = round(size * width_share); h = round(logo.height * w / logo.width)
    out = Image.new("RGBA", (size, size), bg)
    out.alpha_composite(logo.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return out

out_dir, kind = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "app")
os.makedirs(out_dir, exist_ok=True)
CLEAR, WHITE = (0, 0, 0, 0), (255, 255, 255, 255)
if kind == "favicon":
    for n in (32, 48, 192): square(n, 1.0, CLEAR).save(os.path.join(out_dir, f"favicon-{n}.png"))
else:
    square(180, .86, WHITE).convert("RGB").save(os.path.join(out_dir, "apple-touch-icon.png"))
    for n in (192, 512): square(n, .86, WHITE).convert("RGB").save(os.path.join(out_dir, f"money-{n}.png"))
    square(512, .72, WHITE).convert("RGB").save(os.path.join(out_dir, "money-maskable-512.png"))  # Android crops to a circle
