from PIL import Image, ImageDraw, ImageFont

W = H = 512
img = Image.new("RGB", (W, H), "#FF6B00")
d = ImageDraw.Draw(img)

# Vertical gradient: orange -> magenta
top = (255, 107, 0)
bot = (229, 18, 91)
for y in range(H):
    t = y / (H - 1)
    d.line([(0, y), (W, y)], fill=(
        int(top[0] + (bot[0]-top[0])*t),
        int(top[1] + (bot[1]-top[1])*t),
        int(top[2] + (bot[2]-top[2])*t)))

# White rounded badge
bx0, by0, bx1, by1 = 116, 70, 396, 320
d.rounded_rectangle([bx0, by0, bx1, by1], radius=50, fill="white")

# ---- Capybara mascot (flat style) ----
BROWN      = (176, 122, 79)    # head/body
BROWN_DARK = (150, 100, 62)    # muzzle
EAR_IN     = (201, 143, 102)
NOSE       = (90, 58, 38)

cx = (bx0 + bx1) / 2   # 256
# Ears
for ex in (cx - 62, cx + 62):
    d.ellipse([ex-26, 96, ex+26, 150], fill=BROWN)
    d.ellipse([ex-13, 110, ex+13, 142], fill=EAR_IN)

# Head (big rounded)
d.ellipse([cx-104, 120, cx+104, 300], fill=BROWN)

# Eyes (with highlight)
for ox in (cx - 46, cx + 46):
    d.ellipse([ox-15, 178, ox+15, 208], fill=NOSE)
    d.ellipse([ox-4, 183, ox+6, 193], fill="white")

# Muzzle
d.ellipse([cx-66, 224, cx+66, 300], fill=BROWN_DARK)
# Nostrils
for nx in (cx - 26, cx + 26):
    d.ellipse([nx-9, 244, nx+9, 262], fill=NOSE)
# Smile
d.arc([cx-30, 256, cx+30, 292], start=20, end=160, fill=NOSE, width=5)

# Small magenta price tag with % (brand meaning) at badge corner
tg = [(300, 92), (356, 92), (372, 120), (332, 150), (300, 130)]
d.polygon(tg, fill=(229, 18, 91))
d.ellipse([309, 100, 319, 110], fill="white")

def font(sz):
    try:
        return ImageFont.load_default(size=sz)
    except TypeError:
        return ImageFont.load_default()

def centered(text, y, f, fill):
    b = d.textbbox((0, 0), text, font=f)
    d.text((W/2 - (b[2]-b[0])/2 - b[0], y), text, font=f, fill=fill)

centered("PROMOLINKS", 350, font(68), "white")
centered("ofertas & descontos", 424, font(32), (255, 255, 255))

img.save("/work/logo_ml_capi.png", "PNG", optimize=True)
print("OK salvo /work/logo_ml_capi.png")
