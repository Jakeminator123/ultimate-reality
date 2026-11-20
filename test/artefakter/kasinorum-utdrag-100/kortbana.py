"""One curved 89 mm card, sampled by arc length in the shoe's local Y/Z plane."""
import json
from pathlib import Path
import numpy as np

here = Path(__file__).resolve().parent
cfg = json.loads((here.parents[2] / "studio/lib/card-shoe.json").read_text())
if cfg["yawDegrees"] != -100:
    raise ValueError("This take requires the 100 degree shoe layout.")
pitch, yaw = np.deg2rad([cfg["feedAngleDegrees"], cfg["yawDegrees"]])
mouth, height, thickness = cfg["mouthZ"], cfg["cardTopY"], cfg["cardThickness"]
depth = 2 * (height - thickness) / np.tan(pitch)
z = np.linspace(-.04, .25, 12001)
dy = z - mouth
guide = np.where(dy <= 0, height - dy * np.tan(pitch),
                 thickness + (height - thickness) * np.maximum(0, 1-dy/depth)**2)
outward = np.array([np.sin(yaw), 0, np.cos(yaw)])
across = np.array([np.cos(yaw), 0, -np.sin(yaw)])
up = np.array([0, 1, 0])
center = np.array([cfg["shoeCenterXZ"][0], 0, cfg["shoeCenterXZ"][1]])
world = lambda x, y, z: center + across*x + up*y + outward*z

def abscissa(y):
    s = np.r_[0, np.cumsum(np.hypot(np.diff(y), np.diff(z)))]
    return s - np.interp(mouth, z, s)

start = np.interp(cfg["initialLeadZ"],z,abscissa(guide))
frames = []
for index, advance in enumerate(np.linspace(0,.108,9)):
    tail = start + advance - cfg["cardLength"]
    # Keep the rear edge above the stock until it is outside the outlet,
    # including straight interpolation between consecutive saved shapes.
    flat = np.clip((tail-.012)/.010, 0, 1)
    flat = flat**2 * (3-2*flat)
    y = thickness + (guide-thickness)*(1-flat)
    s = abscissa(y)
    cz = np.interp(tail+np.linspace(0,cfg["cardLength"],65), s, z)
    cy = np.interp(cz, z, y)
    if abs(np.sum(np.hypot(np.diff(cz),np.diff(cy)))-cfg["cardLength"]) > .00001:
        raise ValueError("Card length changed.")
    touches = {}
    for digit, x, setback in [("index",.008,.014),("middle",-.010,.018)]:
        zp = np.interp(start+advance-setback,s,z)
        yp = np.interp(zp,z,y)
        slope = np.interp(zp,z,np.gradient(y,z))
        normal = up - outward*slope
        touches[digit] = {"pad_xyz_m":world(x,yp,zp).round(8).tolist(),
                          "surface_normal":(normal/np.linalg.norm(normal)).round(8).tolist()}
    frames.append({"frame":index+1,"travel_mm":round(advance*1000,2),
                   "card_curve_zy_m":np.column_stack((cz,cy)).round(8).tolist(),"contacts":touches})
assert min(cz) > mouth and max(cy)-thickness < 1e-7
report = {"take":"kasinorum-utdrag-100","units":"metres","shoe":cfg,
          "outward_xyz":outward.round(8).tolist(),"mouth_xyz_m":world(0,height,mouth).round(8).tolist(),
          "frames":frames}
(here/"bana.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
