"""Jämför samma grepp vid tre tidpunkter från de två kalibrerade kamerorna."""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

folder = Path(__file__).resolve().parent
centres = {4: (991,439), 1: (765,427)}
matte = "#18201d"
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 23)
small = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 18)
details = Image.new("RGB", (1200, 783), matte)
compare = Image.new("RGB", (1440, 880), matte)
detail_text, cmp_text = ImageDraw.Draw(details), ImageDraw.Draw(compare)
for col, frame in enumerate([1,17,33]):
    detail_text.text((col * 400 + 12, 6), f"Ruta {frame} / 33", fill="white", font=font)
results = []
for view, seat in enumerate([4,1]):
    cx, cy = centres[seat]
    crops = {}
    for col, light in enumerate(["utan","mjukt"]):
        label = "Utan handljus" if light == "utan" else "Mjukt handljus"
        y = 39 + (2 * view + col) * 184
        for fcol, frame in enumerate([1,17,33]):
            im = Image.open(folder / f"stol-{seat}-ruta{frame}-{light}.png").convert("RGB")
            assert im.size == (1600,900)
            crop = im.crop((cx-160, cy-60, cx+160, cy+60))
            details.paste(crop.resize((394,148),Image.Resampling.LANCZOS), (fcol*400+3,y+31))
            detail_text.text((fcol*400+10,y+2),f"Stol {seat} · {label}",fill="white",font=small)
            if frame == 17:
                compare.paste(im.resize((718,404),Image.Resampling.LANCZOS),(col*720,view*440+35))
                cmp_text.text((col*720+10,view*440+1),f"Stol {seat} · Ruta 17 · {label}",fill="white",font=font)
                crops[light] = np.asarray(im,dtype=float)
    # The two felt centres are projections of the same world points in the two seats.
    regions = {
        "Hud nära handleden": {4:(935,419,18,12),1:(733,418,14,9)}[seat],
        "Hud nära kontaktfingret": {4:(976,457,6,5),1:(767,434,6,5)}[seat],
        "Hand och kort": (cx-48,cy-30,96,60),
        "Filt närmast under greppet": {4:(985,482,28,16),1:(816,454,28,16)}[seat],
        "Filt vid mittfält": {4:(780,533,40,24),1:(892,511,40,24)}[seat],
        "Filt framför andra bordshalvan": {4:(456,572,40,24),1:(898,624,40,24)}[seat],
        "Bakvägg": (220,150,100,45),
    }
    for name,(x,y,w,h) in regions.items():
        off, on = (crops[m][y:y+h,x:x+w,:]/255 for m in ["utan","mjukt"])
        luminances = []
        for data in [off,on]:
            linear = np.where(data <= .04045,data/12.92,((data+.055)/1.055)**2.4)
            luminances.append(float((linear @ [.2126,.7152,.0722]).mean()))
        old,new = luminances
        results.append(dict(stol=seat,ruta=17,omrade=name,xywh=[x,y,w,h],utan=old,mjukt=new,skillnad_pct=round(100*(new/old-1),3)))
details.save(folder / "grepp.jpg",quality=94,subsampling=0)
compare.save(folder / "jamforelse.jpg",quality=94,subsampling=0)
(folder / "ljusmatning.json").write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
for r in results:
    print(r["stol"],r["omrade"],r["skillnad_pct"],"%")
