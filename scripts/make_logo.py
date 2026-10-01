from PIL import Image, ImageDraw, ImageFont

W = H = 512
img = Image.new("RGB", (W, H), "#FF6B00")
d = ImageDraw.Draw(img)

# Vertical gradient: orange -> magenta
top = (255, 107, 0)      # #FF6B00
bot = (229, 18, 91)      # #E5125B
for y in range(H):
    t = y / (H - 1)
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# White rounded badge in the center-upper area
bx0, by0, bx1, by1 = 126, 96, 386, 300
d.rounded_rectangle([bx0, by0, bx1, by1], radius=46, fill="white")

# Big "%" inside badge
def font(sz):
    try:
        return ImageFont.load_default(size=sz)
    except TypeError:
        return ImageFont.load_default()

pct_font = font(150)
txt = "%"
tb = d.textbbox((0, 0), txt, font=pct_font)
tw, th = tb[2] - tb[0], tb[3] - tb[1]
cx = (bx0 + bx1) / 2
cy = (by0 + by1) / 2
d.text((cx - tw / 2 - tb[0], cy - th / 2 - tb[1]), txt, font=pct_font, fill="#E5125B")

# Brand text
brand_font = font(72)
sub_font = font(34)

def centered(text, y, f, fill):
    b = d.textbbox((0, 0), text, font=f)
    w = b[2] - b[0]
    d.text((W / 2 - w / 2 - b[0], y), text, font=f, fill=fill)

centered("PROMOLINKS", 336, brand_font, "white")
centered("ofertas & descontos", 416, sub_font, (255, 255, 255))

img.save("/work/logo_ml.png", "PNG", optimize=True)
print("OK salvo /work/logo_ml.png")
