from PIL import Image, ImageDraw, ImageFont

# slug, titulo, subtitulo, cor_topo, cor_baixo
NICHES = [
    ("auto",        "AUTO",        "Carros & Motos",       (229,57,53),  (123,20,20)),
    ("fit",         "FIT",         "Fitness & Suplementos",(67,160,71),  (20,70,30)),
    ("tech",        "TECH",        "Eletronicos & Games",  (30,136,229), (10,40,110)),
    ("casa",        "CASA",        "Cozinha & Decoracao",  (251,140,0),  (200,60,0)),
    ("moda-beleza", "MODA",        "Moda & Beleza",        (236,64,122), (140,20,80)),
    ("imperdiveis", "IMPERDIVEIS", "Super descontos",      (255,107,0),  (229,18,91)),
]

W = H = 512
BROWN, BROWN_DARK, EAR_IN, NOSE = (176,122,79),(150,100,62),(201,143,102),(90,58,38)

def font(sz):
    try: return ImageFont.load_default(size=sz)
    except TypeError: return ImageFont.load_default()

def draw_capi(d, cx, top_y):
    # orelhas
    for ex in (cx-62, cx+62):
        d.ellipse([ex-26, top_y, ex+26, top_y+54], fill=BROWN)
        d.ellipse([ex-13, top_y+14, ex+13, top_y+46], fill=EAR_IN)
    # cabeca
    d.ellipse([cx-104, top_y+24, cx+104, top_y+204], fill=BROWN)
    # olhos
    for ox in (cx-46, cx+46):
        d.ellipse([ox-15, top_y+82, ox+15, top_y+112], fill=NOSE)
        d.ellipse([ox-4, top_y+87, ox+6, top_y+97], fill="white")
    # focinho
    d.ellipse([cx-66, top_y+128, cx+66, top_y+204], fill=BROWN_DARK)
    for nx in (cx-26, cx+26):
        d.ellipse([nx-9, top_y+148, nx+9, top_y+166], fill=NOSE)
    d.arc([cx-30, top_y+160, cx+30, top_y+196], start=20, end=160, fill=NOSE, width=5)

def centered(d, text, y, f, fill):
    b = d.textbbox((0,0), text, font=f)
    d.text((W/2-(b[2]-b[0])/2-b[0], y), text, font=f, fill=fill)

for slug, titulo, sub, top, bot in NICHES:
    img = Image.new("RGB", (W,H), top)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y/(H-1)
        d.line([(0,y),(W,y)], fill=(int(top[0]+(bot[0]-top[0])*t),
                                    int(top[1]+(bot[1]-top[1])*t),
                                    int(top[2]+(bot[2]-top[2])*t)))
    # badge branco com capivara
    d.rounded_rectangle([136,54,376,290], radius=48, fill="white")
    draw_capi(d, 256, 78)
    # textos
    centered(d, titulo, 318, font(64 if len(titulo)<=8 else 40), "white")
    centered(d, sub, 396, font(30), (255,255,255))
    centered(d, "PROMOLINKS", 446, font(26), (255,255,255))
    img.save(f"/work/n8n-files/grupo-{slug}.png", "PNG", optimize=True)
    print(f"OK grupo-{slug}.png")
