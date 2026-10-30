# Makes every Flowlytix icon from the ONE official logo, brand/flowlytix-logo.png (1024 px, see-through background).
# Never draw or generate a new logo: only resize, crop or pad this file.
#   python3 tools/brand-icons.py <out-folder> [favicon|app]
#   favicon: favicon-32.png, favicon-48.png, favicon-192.png (rounded Mid Navy square, for browser tabs)
#   app:     apple-touch-icon.png (180), money-192.png, money-512.png, money-maskable-512.png (Mid Navy, for home screens)
# Background: dark or white, whichever suits (owner). Dark shows the white sparkle; Mid Navy #1A2D5A keeps the navy face visible
# (on the darker #0D1B3E the face disappears).
import sys, os
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__))
logo = Image.open(os.path.join(here, "..", "brand", "flowlytix-logo.png")).convert("RGBA")
logo = logo.crop(logo.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox())  # trim the empty edges

def square(size, width_share, bg, radius=0):
    # the logo centred on a square, its width = width_share of the square; radius > 0 = rounded corners, see-through outside
    w = round(size * width_share); h = round(logo.height * w / logo.width)
    out = Image.new("RGBA", (size, size), bg)
    if radius:
        mask = Image.new("L", (size, size), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
        out.putalpha(mask)
    out.alpha_composite(logo.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return out

out_dir, kind = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "app")
os.makedirs(out_dir, exist_ok=True)
BG = (26, 45, 90, 255)  # Mid Navy #1A2D5A
if kind == "favicon":
    for n in (32, 48, 192): square(n, .9, BG, round(n * .22)).save(os.path.join(out_dir, f"favicon-{n}.png"))
else:
    square(180, .86, BG).convert("RGB").save(os.path.join(out_dir, "apple-touch-icon.png"))
    for n in (192, 512): square(n, .86, BG).convert("RGB").save(os.path.join(out_dir, f"money-{n}.png"))
    square(512, .72, BG).convert("RGB").save(os.path.join(out_dir, "money-maskable-512.png"))  # Android crops to a circle
