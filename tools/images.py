"""
tools/images.py — turns the photos in /images-src into web-ready files.

Run from the project folder:   python tools/images.py
Needs: Python 3.10+, Pillow 11.3+ (for AVIF):  pip install pillow
Also needs Node.js, only to read site/config.js.

For every photo listed in config.photos it writes, into site/assets/img/:
  name.<hash>-<width>.avif / .webp   several widths for responsive srcset
  name.<hash>-<width>.jpg            two widths, for very old browsers
  hero.<hash>-p-<width>.*            a tall crop of the hero for phones
and then:
  site/assets/img/manifest.js        sizes + tiny blurred placeholders (read by render.js)
  site/assets/img/og.<hash>.jpg      1200x630 link-preview image (LINE, Facebook)
  site/assets/img/grain.png          the paper texture
  site/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable.png

Why the <hash> in file names? Netlify tells browsers to cache images for a
year (see netlify.toml). When a photo changes, its hash changes, so its file
name changes and browsers download the new one instead of the cached one.
"""

import base64
import hashlib
import io
import json
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, features

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "images-src"
SITE = ROOT / "site"
OUT = SITE / "assets" / "img"

WIDTHS = [400, 640, 960, 1280, 1600, 1920]   # landscape/normal photos
HERO_WIDTHS = [960, 1440, 1920, 2560]        # big screens
PORTRAIT_WIDTHS = [480, 720, 960, 1200]      # hero crop for phones
JPEG_WIDTHS = [640, 1280]                    # fallback only
PORTRAIT_RATIO = 9 / 16                      # width / height of the phone hero crop

AVIF_QUALITY, WEBP_QUALITY, JPEG_QUALITY = 52, 74, 80


def load_config():
    """Run config.js inside Node and get it back as JSON (config.js is JavaScript, not JSON)."""
    js = (
        "const vm=require('vm'),fs=require('fs');const ctx={window:{}};"
        f"vm.runInNewContext(fs.readFileSync({json.dumps(str(SITE / 'config.js'))},'utf8'),ctx);"
        "process.stdout.write(JSON.stringify(ctx.window.SHOP_CONFIG));"
    )
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        sys.exit("Could not read site/config.js:\n" + out.stderr)
    return json.loads(out.stdout)


def grade(im):
    """A gentle, consistent color grade so photos from different cameras look like one set:
    slightly warmer, slightly less saturated, blacks lifted a touch (a soft 'film' look)."""
    im = ImageEnhance.Color(im).enhance(0.9)
    lift, scale = 10, 0.95  # black point 10, white point ~252
    r_lut = [min(255, round(lift + v * scale * 1.025)) for v in range(256)]
    g_lut = [min(255, round(lift + v * scale)) for v in range(256)]
    b_lut = [min(255, round(lift * 0.7 + v * scale * 0.965)) for v in range(256)]
    return im.point(r_lut + g_lut + b_lut)


def crop_to_ratio(im, ratio, focus):
    """Crop to width/height = ratio, keeping the focus point (fx, fy in 0..1) in view."""
    w, h = im.size
    if w / h > ratio:
        nw = round(h * ratio)
        x = min(max(round(w * focus[0] - nw / 2), 0), w - nw)
        return im.crop((x, 0, x + nw, h))
    nh = round(w / ratio)
    y = min(max(round(h * focus[1] - nh / 2), 0), h - nh)
    return im.crop((0, y, w, y + nh))


def parse_focus(text):
    try:
        x, y = (float(p.strip().rstrip("%")) / 100 for p in (text or "50% 50%").split())
        return x, y
    except ValueError:
        return 0.5, 0.5


def save_set(im, stem, widths, jpeg_widths):
    """Save one image at several widths in AVIF, WebP (and JPEG). Returns widths written."""
    written = []
    for w in widths:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        small = im.resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=2))
        small.save(OUT / f"{stem}-{w}.avif", quality=AVIF_QUALITY, speed=6)
        small.save(OUT / f"{stem}-{w}.webp", quality=WEBP_QUALITY, method=5)
        if w in jpeg_widths:
            small.save(OUT / f"{stem}-{w}.jpg", quality=JPEG_QUALITY, optimize=True, progressive=True)
        written.append(w)
    if not written:  # source smaller than every width: keep it at its own size
        written = save_set(im, stem, [im.width], [im.width])
    if not any(w in jpeg_widths for w in written):  # always have at least one JPEG
        w = written[-1]
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(
            OUT / f"{stem}-{w}.jpg", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return written


def lqip(im):
    """Tiny 24px-wide blurred preview, inlined as a data: URI (shown while the real photo loads)."""
    small = im.resize((24, max(1, round(24 * im.height / im.width))), Image.LANCZOS)
    small = small.filter(ImageFilter.GaussianBlur(1.2))
    buf = io.BytesIO()
    small.save(buf, "WEBP", quality=40)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def file_hash(path, extra=""):
    h = hashlib.sha1(path.read_bytes())
    h.update(extra.encode())
    return h.hexdigest()[:8]


def find_source(name):
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".avif"):
        p = SRC / f"{name}{ext}"
        if p.exists():
            return p
    return None


def make_grain():
    """A 160px tile of soft noise. Tiled behind the page it reads as paper texture."""
    rnd = random.Random(7)
    size = 160
    tile = Image.new("LA", (size, size), (0, 0))
    px = tile.load()
    for y in range(size):
        for x in range(size):
            v = rnd.random()
            if v < 0.5:
                px[x, y] = (30, int(rnd.random() * 18))    # dark speck
            elif v > 0.86:
                px[x, y] = (255, int(rnd.random() * 30))   # light speck
    # 16-colour PNG: noise compresses badly in WebP/AVIF; a small palette PNG is ~8 KB.
    tile.convert("RGBA").quantize(16).save(OUT / "grain.png", optimize=True)


def font_for_icons(size):
    for candidate in (SITE / "assets/fonts/noto-serif-thai-var.woff2", Path("C:/Windows/Fonts/georgiab.ttf"),
                      Path("/System/Library/Fonts/Supplemental/Georgia Bold.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf")):
        try:
            font = ImageFont.truetype(str(candidate), size)
            try:
                font.set_variation_by_axes([620])  # bolder weight on the variable font
            except Exception:
                pass
            return font
        except Exception:
            continue
    return ImageFont.load_default(size)


def make_icon(size, letter, bg, fg, maskable=False):
    """Monogram icon: a letter on a rounded square (full square for 'maskable' Android icons)."""
    scale = 4  # draw big, then shrink: smoother edges
    S = size * scale
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle((0, 0, S, S), fill=bg)
    else:
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=round(S * 0.22), fill=bg)
    font = font_for_icons(round(S * (0.5 if maskable else 0.64)))
    box = d.textbbox((0, 0), letter, font=font)
    x = (S - (box[2] - box[0])) / 2 - box[0]
    y = (S - (box[3] - box[1])) / 2 - box[1]
    d.text((x, y), letter, font=font, fill=fg)
    return im.resize((size, size), Image.LANCZOS)


def main():
    if not features.check("avif"):
        sys.exit("Your Pillow cannot write AVIF. Run:  pip install --upgrade pillow")
    cfg = load_config()
    OUT.mkdir(parents=True, exist_ok=True)

    # Remove previously generated photos (but nothing else) so old hashed files don't pile up.
    for old in OUT.iterdir():
        if old.suffix in (".avif", ".webp", ".jpg"):
            old.unlink()

    manifest = {}
    for name, meta in cfg.get("photos", {}).items():
        src = find_source(name)
        if not src:
            print(f"  ! missing images-src/{name}.jpg (listed in config.photos) — skipped")
            continue
        im = grade(ImageOps.exif_transpose(Image.open(src)).convert("RGB"))
        is_hero = name == cfg.get("hero", {}).get("photo")
        focus = parse_focus(meta.get("focus"))
        h = file_hash(src, f"{AVIF_QUALITY}{WEBP_QUALITY}{meta.get('focus')}")
        stem = f"{name}.{h}"
        widths = save_set(im, stem, sorted(set(WIDTHS + HERO_WIDTHS)) if is_hero else WIDTHS, JPEG_WIDTHS)
        entry = {"file": stem, "w": im.width, "h": im.height, "widths": widths,
                 "jpg": [w for w in widths if (OUT / f"{stem}-{w}.jpg").exists()], "lqip": lqip(im)}
        if is_hero:
            tall = crop_to_ratio(im, PORTRAIT_RATIO, focus)
            pw = save_set(tall, f"{stem}-p", PORTRAIT_WIDTHS, [])
            entry["portrait"] = {"file": f"{stem}-p", "w": tall.width, "h": tall.height, "widths": pw, "lqip": lqip(tall)}
            # Link-preview image: 1200x630, saved as JPEG because some apps don't read WebP/AVIF.
            og = crop_to_ratio(im, 1200 / 630, focus).resize((1200, 630), Image.LANCZOS)
            og_name = f"og.{h}.jpg"
            og.save(OUT / og_name, quality=84, optimize=True, progressive=True)
            manifest["_og"] = {"file": og_name, "w": 1200, "h": 630}
        manifest[name] = entry
        print(f"  ✓ {name}: {im.width}x{im.height} → {len(widths)} widths")

    make_grain()

    # manifest.js is a plain script (not JSON) so the page can load it with a <script> tag.
    (OUT / "manifest.js").write_text(
        "/* Generated by tools/images.py — do not edit by hand. */\n"
        "window.SHOP_IMAGES = " + json.dumps(manifest, indent=1) + ";\n", encoding="utf-8")

    theme = cfg["themes"][cfg["theme"]]
    letter = (cfg["business"].get("monogram") or cfg["business"]["name"]["en"][:1]).upper()[:1]
    bg, fg = theme["dark"], theme["onDark"]
    make_icon(180, letter, bg, fg, maskable=True).convert("RGB").save(SITE / "apple-touch-icon.png", optimize=True)
    make_icon(192, letter, bg, fg).save(SITE / "icon-192.png", optimize=True)
    make_icon(512, letter, bg, fg).save(SITE / "icon-512.png", optimize=True)
    make_icon(512, letter, bg, fg, maskable=True).save(SITE / "icon-maskable.png", optimize=True)
    make_icon(48, letter, bg, fg).save(SITE / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  ✓ favicons, OG image, grain texture, manifest.js")
    print("Next: node tools/bake.mjs")


if __name__ == "__main__":
    main()
