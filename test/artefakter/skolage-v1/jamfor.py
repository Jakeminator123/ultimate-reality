"""Measure actual shoe footprints, embed three synchronized frames per view."""
from pathlib import Path
from io import BytesIO
from base64 import b64decode, b64encode
import json
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
base = here.parent / "kasinorum-utdrag-100"
labels = {"referens":"Utgångsläge", "arbetskant-v4":"10 cm mot arbetskanten", "vanster":"10 cm åt Paulinas vänster"}
frames = [1, 17, 33]
views = {"helbord":"Hela bordet ovanifrån", "topp":"Arbetskanten ovanifrån · närbild",
         "4-bord":"Stol 4", "1-bord":"Stol 1", "4-hand":"Hand · stol 4", "1-hand":"Hand · stol 1"}
read = lambda f: json.loads(f.read_text(encoding="utf8"))


def point_on_segment(point, a, b):
    step = b-a
    return a+step*np.clip(((point-a)@step)/(step@step),0,1)


def nearest(foot, edge):
    pairs = []
    for i, a in enumerate(foot):
        b = foot[(i+1)%len(foot)]
        for c, d in edge:
            pairs.extend([(p, point_on_segment(p,c,d)) for p in [a,b]])
            pairs.extend([(point_on_segment(p,a,b),p) for p in [c,d]])
    return min(pairs, key=lambda pair: np.linalg.norm(pair[0]-pair[1]))


def inside(point, edges):
    x,z = point
    return sum(1 for (a,b),(c,d) in edges if (b>z)!=(d>z) and x < a+(z-b)*(c-a)/(d-b)) % 2 == 1


def measurement(version):
    folder = here / version
    take = read((base if version=="referens" else folder) / "bana.json")
    rigfile = (base/"handkandidat/mhr-arm" if version=="referens" else folder) / "matt-rigg.json"
    skeleton = read(rigfile)["frames"]
    report = read(folder/"matt-kollisioner.json")
    assert len(report["samples"]) == 33 and not report["frames_with_penetration"]
    contour = read(folder/"kontur.json")
    foot = np.asarray(contour["shoe_foot_xz_m"])
    foot = foot[np.argsort(np.arctan2(*(foot-foot.mean(axis=0)).T[::-1]))]
    edges = np.asarray(contour["felt_edges_xz_m"])
    assert all(inside(p,edges) for p in foot)
    rear = [edge for edge in edges if np.max(edge[:,1])<=-.21+1e-6]
    pair = nearest(foot,rear)
    shoulder = np.array([.163,.231,-.369])  # the arm solver's fixed rest shoulder
    reaches = [float(np.linalg.norm(shoulder-f["wrist"])*100) for f in skeleton]
    gaps = [v for f in report["samples"] for v in f["min_skin_gap_above_14mm_contact_patch_mm"].values()]
    assert all(v is not None for v in gaps)
    return dict(center_xz_cm=np.round(np.array(take["shoe"]["shoeCenterXZ"])*100,2).tolist(),
                mouth_xz_cm=np.round(np.array(take["mouth_xyz_m"])[[0,2]]*100,2).tolist(),
                shortest_shoe_to_dealer_edge_cm=round(float(np.linalg.norm(pair[0]-pair[1]))*100,2),
                nearest_xz_m=np.round(pair,7).tolist(), shoulder_reference_to_wrist_cm=np.round(reaches,2).tolist(),
                skin_gap_mm=[min(gaps),max(gaps)], collisions=0, samples=len(report["samples"]))


def data_url(binary):
    return "data:image/webp;base64," + b64encode(binary).decode()


def annotate(binary, stats):
    image = Image.open(BytesIO(binary)).convert("RGB")
    w,h = image.size
    # Orthographic top camera, same extents and target as renderTake.
    points = [((x+.33)/.98*w,(z+.510625)/.55125*h) for x,z in stats["nearest_xz_m"]]
    draw = ImageDraw.Draw(image)
    draw.line(points, fill="#142821", width=8)
    draw.line(points, fill="#f7cf68", width=4)
    for x,y in points: draw.ellipse((x-5,y-5,x+5,y+5), fill="#f7cf68",outline="#142821",width=2)
    mid = np.mean(points,axis=0)
    font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf",23)
    text = f'{stats["shortest_shoe_to_dealer_edge_cm"]:.1f} cm'.replace(".",",")
    x,y = mid+[9,-16]
    box = draw.textbbox((x,y),text,font=font)
    draw.rounded_rectangle((box[0]-5,box[1]-3,box[2]+5,box[3]+3),radius=5,fill="#142821")
    draw.text((x,y),text,font=font,fill="#fff1be")
    buffer = BytesIO()
    image.save(buffer,"WEBP",quality=92)
    return buffer.getvalue()


def main():
    metrics = {key:measurement(key) for key in labels}
    baseline = re.search(r'<script type="application/json" id="take">(.*?)</script>',
                         (base/"utdrag.html").read_text(encoding="utf8"),re.S)
    replay = json.loads(baseline[1])
    proof = read(here/"referens/matt-kollisioner.json")
    assert replay["poseHashes"] == [f["sha256"] for f in proof["hashes"]]
    images = {}
    sheet_rows = {"helbord": (0, 300), "4-bord": (324, 225), "1-bord": (573, 225)}
    sheet = Image.new("RGB",(1200,822),"#20332e")
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf",18)
    draw = ImageDraw.Draw(sheet)
    for col,(k,label) in enumerate(labels.items()):
        images[k]={}
        for f in frames:
            images[k][f]={}
            for view in views:
                raw = (b64decode(replay["pixels"][f-1][view].split(",",1)[1]) if k=="referens" and view!="helbord"
                       else (here/k/"bilder"/f"{f}-{view}.webp").read_bytes())
                if view=="topp": raw=annotate(raw,metrics[k])
                images[k][f][view]=data_url(raw)
                if f==17 and view in sheet_rows:
                    top, height = sheet_rows[view]
                    sheet.paste(Image.open(BytesIO(raw)).resize((400,height),Image.Resampling.LANCZOS),(400*col,top+24))
                    draw.text((400*col+8,top),f"{label} · {views[view]}",fill="white",font=font)
    sheet.save(here/"jamforelse.jpg",quality=90)
    (here/"matt.json").write_text(json.dumps(metrics,indent=2)+"\n",encoding="utf8")
    template = (here/"visare.mall.html").read_text(encoding="utf8")
    html = template.replace("__PROV__",json.dumps(dict(labels=labels,views=views,metrics=metrics,images=images),ensure_ascii=False))
    (here/"skolage.html").write_text(html,encoding="utf8")
    for key,s in metrics.items():
        print(key, s["shortest_shoe_to_dealer_edge_cm"], s["shoulder_reference_to_wrist_cm"][::8], s["skin_gap_mm"])


if __name__=="__main__":
    main()
