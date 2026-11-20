"""Build the small, local Paulina reference previews used by the portable guide."""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[2]
avatar = root / "avatars/paulina"
dest = root / "test/dealer/paulina/fotomall-v1/kallbilder"
dest.mkdir(parents=True, exist_ok=True)
for code in ("01", "03", "05b", "08", "09"):
    matches = list(avatar.glob(code + "_*.png"))
    if len(matches) != 1:
        raise ValueError(f"Expected one original for {code}, found {len(matches)}")
    with Image.open(matches[0]) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        image.thumbnail((600, 600), Image.Resampling.LANCZOS)
        image.save(dest / (code + ".webp"), "WEBP", quality=87, method=6)
