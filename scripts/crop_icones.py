from PIL import Image, ImageChops

src = Image.open("/work/n8n-files/icones.png").convert("RGB")
W, H = src.size
CW, CH = W//4, H//3

MAP = {
    (0,0): "ferramentas", (1,0): "imperdiveis", (2,0): "instrumentos", (3,0): "alimentos",
    (0,1): "pet",         (1,1): "bebes",       (2,1): "papelaria",    (3,1): "auto",
    (0,2): "beleza",      (1,2): "fit",         (2,2): "tech",         (3,2): "casa",
}

OUT, TARGET = 512, 470  # canvas e tamanho do icone dentro dele
white = Image.new("RGB", (CW, CH), (255,255,255))

for (col, row), slug in MAP.items():
    cell = src.crop((col*CW, row*CH, col*CW+CW, row*CH+CH))
    # detecta a area do icone (conteudo nao-branco)
    diff = ImageChops.difference(cell, white)
    bbox = diff.getbbox()
    if bbox:
        # pequena folga
        pad = 6
        l = max(0, bbox[0]-pad); t = max(0, bbox[1]-pad)
        r = min(CW, bbox[2]+pad); b = min(CH, bbox[3]+pad)
        icon = cell.crop((l, t, r, b))
    else:
        icon = cell
    # torna quadrado (lado = maior dimensao) com fundo branco, icone centralizado
    side = max(icon.size)
    sq = Image.new("RGB", (side, side), (255,255,255))
    sq.paste(icon, ((side-icon.size[0])//2, (side-icon.size[1])//2))
    # canvas final 512 com icone centralizado
    canvas = Image.new("RGB", (OUT, OUT), (255,255,255))
    ic = sq.resize((TARGET, TARGET), Image.LANCZOS)
    canvas.paste(ic, ((OUT-TARGET)//2, (OUT-TARGET)//2))
    canvas.save(f"/work/n8n-files/grupo-{slug}.png", "PNG", optimize=True)
    print(f"OK grupo-{slug}.png")
