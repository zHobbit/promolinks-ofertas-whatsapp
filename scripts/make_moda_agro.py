from PIL import Image, ImageDraw
from collections import Counter

# amostra as cores dominantes (excluindo branco) do icones.png pra casar a paleta
src = Image.open("/work/n8n-files/icones.png").convert("RGB").resize((200,120))
cnt = Counter()
for p in src.getdata():
    if sum(p) < 720 and max(p)-min(p) > 12:  # ignora branco/cinza
        cnt[(p[0]//20*20, p[1]//20*20, p[2]//20*20)] += 1
print("cores top:", cnt.most_common(6))

NAVY=(28,48,80); ORANGE=(232,132,60); TEAL=(45,165,150); GREEN=(74,150,80); WHITE=(255,255,255)
OUT=512
def base():
    img=Image.new("RGB",(OUT,OUT),WHITE); d=ImageDraw.Draw(img)
    d.ellipse([46,46,466,466], outline=NAVY, width=16)   # anel
    return img,d

# MODA — cabide
img,d=base()
d.polygon([(256,196),(180,290),(332,290)], outline=NAVY, width=0, fill=(252,234,214))
d.line([(180,290),(332,290)], fill=NAVY, width=15)
d.line([(256,196),(180,290)], fill=NAVY, width=15)
d.line([(256,196),(332,290)], fill=NAVY, width=15)
# gancho
d.arc([240,150,288,200], start=110, end=360, fill=NAVY, width=13)
d.line([(256,150),(256,196)], fill=NAVY, width=13)
img.save("/work/n8n-files/grupo-moda.png","PNG",optimize=True); print("moda ok")

# AGRO — broto
img,d=base()
# vaso/solo
d.pieslice([196,300,316,400], start=180, end=360, fill=(232,132,60))
d.line([(256,300),(256,210)], fill=GREEN, width=14)   # caule
# folhas
d.ellipse([196,212,262,268], fill=TEAL, outline=NAVY, width=8)   # folha esq
d.ellipse([252,188,322,250], fill=TEAL, outline=NAVY, width=8)   # folha dir
img.save("/work/n8n-files/grupo-agro.png","PNG",optimize=True); print("agro ok")
