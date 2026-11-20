"""Build the illustrated Paulina method guide.

Run from any directory with a Python installation containing ReportLab and
Pillow. The default edition reads only the wooden reference illustrations
tracked in Git. Pass --local on the lab computer for the photographic edition.
"""

import argparse
import io
import math
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

import reportlab
from PIL import Image, ImageOps
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
MANNEQUINS = ROOT / "studio/public/fotomall/docka"
AVATAR = ROOT / "avatars/paulina"
DEAL = AVATAR / "giv-plats-4"
STUDIO = "http://127.0.0.1:4317/giv-plats-4/"
REPO = "https://github.com/Jakeminator123/ultimate-reality/blob/main/"
LINKS = {
    "deal": STUDIO + "v4?kamera=120&ruta=73&vinkel=0&utsnitt=hander",
    "film": STUDIO + "filmrorelse?ruta=0",
    "gaze": STUDIO + "blick?riktning=vanster",
    "face": STUDIO + "minspel",
    "sam": "http://127.0.0.1:7860",
    "method": REPO + "information/PAULINA_METOD.md",
    "pictures": REPO + "information/PAULINAS_STILLBILDER.md",
    "cameras": REPO + "studio/app/giv-plats-4/orbit-cameras.mjs",
    "trial": REPO + "information/ANKARPROV_V1.md",
    "sith": "https://ait.ethz.ch/sith",
    "humannerf": "https://grail.cs.washington.edu/projects/humannerf/",
    "mhr": "https://github.com/facebookresearch/MHR",
    "sam_source": "https://github.com/facebookresearch/sam-3d-body",
}

W, H = A4
MARGIN = 39
INNER = W - 2 * MARGIN
PAPER = "#F5F2E9"
WHITE = "#FFFEF7"
INK = "#172F2C"
PINE = "#173B36"
DEEP = "#0C302B"
GREEN = "#237160"
SAGE = "#D9E5DB"
MUTE = "#52675D"
RULE = "#AABAB0"
YELLOW = "#FFE358"


def register_fonts():
    directory = Path(reportlab.__file__).resolve().parent / "fonts"
    pdfmetrics.registerFont(TTFont("Vera", directory / "Vera.ttf"))
    pdfmetrics.registerFont(TTFont("VeraBold", directory / "VeraBd.ttf"))


class Page:
    """PDF drawing coordinates are expressed from the top of an A4 page."""

    def __init__(self, pdf, local):
        self.pdf = pdf
        self.local = local
        self.images = {}

    def box(self, x, top, width, height, fill, stroke=None, line_width=1):
        self.pdf.setFillColor(colors.HexColor(fill))
        if stroke:
            self.pdf.setStrokeColor(colors.HexColor(stroke))
            self.pdf.setLineWidth(line_width)
        self.pdf.rect(x, H - top - height, width, height, fill=1, stroke=bool(stroke))

    def line(self, x1, top1, x2, top2, color=RULE, width=0.75):
        self.pdf.setLineWidth(width)
        self.pdf.setStrokeColor(colors.HexColor(color))
        self.pdf.line(x1, H - top1, x2, H - top2)

    def circle(self, x, top, radius, fill=None, stroke=None, width=1):
        if fill:
            self.pdf.setFillColor(colors.HexColor(fill))
        if stroke:
            self.pdf.setLineWidth(width)
            self.pdf.setStrokeColor(colors.HexColor(stroke))
        self.pdf.circle(x, H - top, radius, stroke=bool(stroke), fill=bool(fill))

    def text(self, x, top, value, size=11, bold=False, color=INK, align="left"):
        self.pdf.setFont("VeraBold" if bold else "Vera", size)
        self.pdf.setFillColor(colors.HexColor(color))
        draw = {"left": self.pdf.drawString, "right": self.pdf.drawRightString,
                "center": self.pdf.drawCentredString}[align]
        draw(x, H - top - size * 0.79, value)

    def paragraph(self, x, top, value, width, size=11, leading=None, color=INK, bold=False):
        font = "VeraBold" if bold else "Vera"
        leading = leading or size * 1.48
        for section in value.split("\n"):
            line = ""
            for word in section.split():
                next_line = (line + " " + word).strip()
                if line and pdfmetrics.stringWidth(next_line, font, size) > width:
                    self.text(x, top, line, size, bold, color)
                    top += leading
                    line = word
                else:
                    line = next_line
            if line:
                self.text(x, top, line, size, bold, color)
                top += leading
        return top

    def link(self, x, top, label, key, size=10, color=GREEN):
        width = pdfmetrics.stringWidth(label, "VeraBold", size)
        self.text(x, top, label, size, True, color)
        self.line(x, top + size + 2, x + width, top + size + 2, color, 0.65)
        self.pdf.linkURL(LINKS[key], (x - 2, H - top - size - 5,
                                     x + width + 2, H - top + 3), relative=0)

    def bookmark(self, title, number):
        key = f"kapitel-{number}"
        self.pdf.bookmarkPage(key)
        self.pdf.addOutlineEntry(title, key)

    def frame(self, number, section, title, intro):
        self.bookmark(title, number)
        self.box(0, 0, W, H, PAPER)
        self.text(MARGIN, 31, "ULTIMATE REALITY", 9, True, GREEN)
        self.text(W - MARGIN, 31, section.upper(), 8.7, True, MUTE, "right")
        self.line(MARGIN, 52, W - MARGIN, 52)
        self.text(MARGIN, 74, title, 32, True)
        self.paragraph(MARGIN, 129, intro, INNER - 6, 12.25, 18, MUTE)

    def footer(self, number, dark=False):
        color = "#AAC2B8" if dark else MUTE
        self.line(MARGIN, H - 45, W - MARGIN, H - 45, color, 0.5)
        edition = "Lokal bildutgåva" if self.local else "Illustrerad metodutgåva"
        self.text(MARGIN, H - 31, f"Paulina från foto till rörelse  /  {edition}", 8, color=color)
        self.text(W - MARGIN, H - 31, f"{number} / 8", 8, True, color, "right")
        self.pdf.showPage()

    def image(self, path, x, top, width, height, *, fill=False, region=None, backdrop=SAGE):
        """Crop explicitly, re-encode visible RGB only and discard image metadata."""
        path = Path(path)
        key = (path, width, height, fill, region)
        if key not in self.images:
            with Image.open(path) as source:
                original = ImageOps.exif_transpose(source).convert("RGBA")
                if region:
                    left, upper, right, lower = region
                    original = original.crop((round(original.width * left), round(original.height * upper),
                                              round(original.width * right), round(original.height * lower)))
                if original.getextrema()[3][0] < 255:
                    matte = Image.new("RGBA", original.size, backdrop)
                    matte.alpha_composite(original)
                    original = matte
                original = original.convert("RGB")
                target = (round(width * 3), round(height * 3))
                if fill:
                    original = ImageOps.fit(original, target, Image.Resampling.LANCZOS)
                else:
                    original.thumbnail(target, Image.Resampling.LANCZOS)
                stream = io.BytesIO()
                original.save(stream, "JPEG", quality=90, optimize=True, subsampling=0)
                self.images[key] = (ImageReader(io.BytesIO(stream.getvalue())), original.size)
        reader, (iw, ih) = self.images[key]
        scale = min(width / iw, height / ih)
        aw, ah = iw * scale, ih * scale
        self.box(x, top, width, height, backdrop)
        self.pdf.drawImage(reader, x + (width - aw) / 2, H - top - (height + ah) / 2, aw, ah)

    def mannequin(self, name, x, top, width, height, **kwargs):
        self.image(MANNEQUINS / f"{name}.webp", x, top, width, height, **kwargs)

    def note(self, x, top, width, title, value, height, *, dark=False):
        self.box(x, top, width, height, PINE if dark else SAGE)
        self.text(x + 16, top + 16, title, 13, True, WHITE if dark else PINE)
        return self.paragraph(x + 16, top + 41, value, width - 32, 10.6, 15.1,
                              WHITE if dark else INK)


def camera_ring(page, x, top, radius, *, color, accent, label=False):
    """Place one mark for each viewing angle. Zero is the front of the table."""
    for i in range(120):
        angle = math.radians(i * 3)
        major = i % 10 == 0
        mark = accent if i in (0, 23) else color
        inner = radius - (9 if major else 4.5)
        page.line(x + inner * math.sin(angle), top + inner * math.cos(angle),
                  x + radius * math.sin(angle), top + radius * math.cos(angle),
                  mark, 1.7 if major or i == 23 else 0.85)
    page.circle(x, top, radius - 13, stroke=color, width=0.48)
    if label:
        page.text(x, top + radius + 8, "0°  /  FRONT", 8, True, color, "center")
        page.text(x, top - radius - 15, "180°", 8, True, color, "center")


def metric(page, x, top, number, label, width, *, dark=False):
    page.line(x, top, x + width, top, "#76988B" if dark else RULE, 0.75)
    page.text(x, top + 12, number, 27, True, YELLOW if dark else GREEN)
    page.paragraph(x, top + 50, label, width, 10, 14, WHITE if dark else INK)


def cover(p):
    p.bookmark("Paulina från foto till rörelse", 1)
    p.box(0, 0, W, H, DEEP)
    p.text(MARGIN, 36, "ULTIMATE REALITY", 11, True, YELLOW)
    p.text(W - MARGIN, 37, "DEALERSTUDION  /  GIV V4", 9, True, WHITE, "right")
    p.line(MARGIN, 60, W - MARGIN, 60, "#6A8B7C")
    p.text(MARGIN, 86, "Paulina", 57, True, WHITE)
    p.text(MARGIN, 158, "från foto till rörelse", 37, True, WHITE)
    p.paragraph(MARGIN, 221, "En sittande blackjackdealer med ett styrbart skelett. "
                "Pausa mitt i given, byt vinkel och följ samma kort hela vägen till plats 4.",
                480, 13, 19, "#D9E7DE")
    left, top, width, height = MARGIN, 295, 299, 307
    if p.local:
        p.image(AVATAR / "03_sittande_bakgrund.png", left, top, width, height, fill=True)
        caption = "Original 03  /  sittande frontfoto"
    else:
        p.mannequin("sittande-bord", left, top, width, height, fill=True,
                    region=(0.02, 0, 0.98, 0.92))
        caption = "Sittande arbetsställning  /  schematisk träfigur"
    p.box(345, top, W - MARGIN - 345, height, PINE)
    camera_ring(p, 451, 429, 85, color="#B2C9BB", accent=YELLOW)
    p.text(451, 407, "120", 36, True, YELLOW, "center")
    p.text(451, 454, "KAMERALÄGEN", 8.8, True, WHITE, "center")
    p.paragraph(361, 540, "Ett varv i steg om 3°. Alla vyer använder samma tid i given.",
                180, 10.4, 14, WHITE)
    p.text(MARGIN, 613, caption, 8.6, color="#CCE0D2")
    for x, n, caption in [(MARGIN, "2", "tillförda originalfoton"),
                          (215, "127", "leder i den sittande riggen"),
                          (390, "155", "bildrutor i den rättade given")]:
        metric(p, x, 680, n, caption, 155, dark=True)
    p.footer(1, dark=True)


def photos(p):
    p.frame(2, "Bildurval", "Börja med två foton",
            "Ståfronten visar kroppens proportioner. Sittfronten förankrar ansiktet, "
            "handtatueringarna och placeringen vid bordet.")
    gap, w = 11, (INNER - 11) / 2
    for i, (kind, original) in enumerate([("staende-front", "01_staende_bakgrund.png"),
                                           ("sittande-bord", "03_sittande_bakgrund.png")]):
        x = MARGIN + i * (w + gap)
        if p.local:
            p.image(AVATAR / original, x, 185, w, 174, backdrop="#EEEDF0")
            label = "Original 01 · stående" if i == 0 else "Original 03 · sittande"
        else:
            p.mannequin(kind, x, 185, w, 174, backdrop="#DBE6DF")
            label = ("Stående" if i == 0 else "Sittande") + " · schematisk fotomall"
        p.text(x, 368, label, 9, True, MUTE)
    metric(p, MARGIN, 404, "2 + 14", "Två original och fjorton genererade filer i den numrerade serien.", 154)
    metric(p, 219, 404, "11 + 1", "Elva grundvyer och en extra rörelsebild i den valda utgåvan.", 154)
    metric(p, 399, 404, "1–14", "Original som kan väljas i ett nytt bildutkast i dagens studio.", 154)
    p.line(MARGIN, 520, W - MARGIN, 520)
    p.text(MARGIN, 540, "Vad de tolv bilderna visar", 17, True)
    p.paragraph(MARGIN, 573, "Tre ståvyer, tre sittvyer och tre porträtt. Därutöver kommer "
                "båda handryggarna i samma bild, vänsterhandens kortdrag och "
                "högerhandens kortvändning. Åtta filer återanvändes och fyra tillkom. "
                "Nya vyer uppskattar ytor som originalfotona döljer.", INNER, 11.5, 16)
    p.note(MARGIN, 652, INNER, "Hur stor var avvikelsen i sittbild 3?",
           "Den valda profilens silhuett är 1 316 bildrader hög. Fronten är 1 340. "
           "Skillnaden är −1,79 %. Första profilen gav −3,88 %. Måttet gäller "
           "silhuettens höjd i bilden och säger inget om likheten i exempelvis ansiktet.", 100)
    p.link(MARGIN, 771, "Bildkällor, revisioner och mätning", "pictures")
    p.footer(2)


def rig(p):
    p.frame(3, "Kropp och material", "Tre sittvyer, en rigg",
            "SAM 3D Body skattar en kropp ur varje vy. Exporten använder frontens nät "
            "och anpassar hållningen med stöd från trekvart och profil.")
    widths, gap = (INNER - 2 * 9) / 3, 9
    files = ["fas-1/v1/sittande/front.png", "fas-1/v1/sittande/trekvart.png",
             "fas-1/v1/granskning/sittprofil-front-v3/profil.png"]
    captions = ["Front · grundyta", "Trekvart · 20 %", "Profil · 80 %"]
    for i, (path, caption) in enumerate(zip(files, captions)):
        x = MARGIN + i * (widths + gap)
        if p.local:
            p.image(AVATAR / path, x, 185, widths, 145, backdrop="#EFEDF0")
        elif i == 1:
            p.box(x, 185, widths, 145, SAGE)
            draw_seated_angles(p, x + widths / 2, 252)
        else:
            p.mannequin(["sittande-front", "", "sittande-profil"][i], x, 185, widths, 145)
        p.text(x, 340, caption, 10.2, True)
    p.paragraph(MARGIN, 363, "Vikterna avser övre rygg, nacke och huvud. " +
                ("Bilderna visar de tre valda sittvyerna." if p.local else
                 "Träfigurer och vinkelritning illustrerar bildernas roller."), INNER, 9.8, 14, MUTE)
    p.text(MARGIN, 383, "Frontens grundnät har 18 439 hörn och 36 874 trianglar.", 9.8, color=MUTE)
    p.text(MARGIN, 412, "Så får ytan Paulinas drag", 17, True)
    if p.local:
        p.image(DEAL / "v3/granskning/mesh-r0-plus36.jpg", MARGIN, 446, 247, 143,
                region=(0, 0.09, 1, 1), backdrop=WHITE, fill=True)
        p.text(MARGIN, 599, "V3 · ruta 0, +36° · fotoyta och trianglar", 8.4, color=MUTE)
    else:
        p.box(MARGIN, 446, 247, 143, PINE)
        draw_mesh(p, 57, 453, 208, 116)
        p.text(MARGIN, 599, "Schematisk yta · trianglar byggs av hörnpunkter", 8.3, color=MUTE)
    p.paragraph(306, 446, "Tre sittvyer, tre porträtt och en bild av handryggarna gav den "
                "första fotofärgen. I V3 passades ansiktet mot 23 punktpar i original 03. "
                "4 259 hörn flyttades mer än 0,1 mm med bevarat djup längs "
                "frontkamerans siktlinje.", 246, 11.1, 16)
    p.note(MARGIN, 643, INNER, "V4-filen i 3D-spelaren",
           "Kropp och hår delar ett skelett med 127 leder. De två animerade "
           "nätobjekten innehåller 65 766 trianglar. Sex texturbilder, kortet, "
           "övrig rekvisita och givens animation ingår i GLB-filen. Spelaren skapar kamerorna.", 104)
    p.link(MARGIN, 771, "Exakt ordning för form, fotoyta, ögon och hår", "method")
    p.footer(3)


def draw_seated_angles(p, x, y):
    p.circle(x, y, 42, stroke="#8BA49A", width=1)
    for angle in (0, 45, 90):
        a = math.radians(angle)
        dx, dy = math.sin(a), math.cos(a)
        strong = angle == 45
        p.line(x, y, x + 42 * dx, y + 42 * dy, GREEN if strong else "#A7BCB0",
               2.5 if strong else 1)
        p.circle(x + 42 * dx, y + 42 * dy, 3, GREEN if strong else "#8BA49A")
    p.circle(x, y, 5.5, INK)
    p.text(x, y - 17, "Trekvart", 9, True, INK, "center")


def draw_mesh(p, x, top, width, height):
    """Procedural geometric sample with no input mesh or anatomical data."""
    rows, cols = 5, 8
    points = []
    for row in range(rows):
        line = []
        for col in range(cols):
            phase = col / (cols - 1) * math.pi
            px = x + col * width / (cols - 1) + 5 * math.sin(row * 0.8)
            py = top + 11 + row * (height - 19) / (rows - 1) - (8.5 + row * 3) * math.sin(phase)
            line.append((px, py))
        points.append(line)
    for row in range(rows):
        for col in range(cols):
            px, py = points[row][col]
            if col + 1 < cols:
                p.line(px, py, *points[row][col + 1], "#92B7A8", 0.7)
            if row + 1 < rows:
                p.line(px, py, *points[row + 1][col], "#92B7A8", 0.7)
                if col + 1 < cols:
                    p.line(px, py, *points[row + 1][col + 1], "#74A18D", 0.55)
            p.circle(px, py, 1.45, YELLOW if (row, col) == (2, 4) else "#D3E2CB")


def arrow(p, x1, y1, x2, y2, color=GREEN, width=1.5):
    angle = math.atan2(y2 - y1, x2 - x1)
    p.line(x1, y1, x2, y2, color, width)
    for direction in (angle + 0.58, angle - 0.58):
        p.line(x2, y2, x2 - 7 * math.cos(direction), y2 - 7 * math.sin(direction), color, width)


def film(p):
    p.frame(4, "Rörelseöverföring", "Mellan film och 3D",
            "Rörelsen i ett befintligt klipp kan driva Paulinas sittande kropp. "
            "En vald 3D-pose kan också bli startbild för en ny Runway-film.")
    w = (INNER - 10) / 2
    if p.local:
        comparison = DEAL / "filmrorelse/v2/visning/ruta-000.jpg"
        p.image(comparison, MARGIN, 184, w, 135, fill=True, region=(0.157, 0.245, 0.330, 0.620))
        p.image(comparison, MARGIN + w + 10, 184, w, 135, fill=True, region=(0.647, 0.395, 0.822, 0.765))
        p.text(MARGIN, 329, "Kling 4 · rött kort i högerhanden, ruta 0", 8.7, True, MUTE)
        p.text(MARGIN + w + 10, 329, "V4 · överfört grepp, frontkamera 0°, ruta 0", 8.7, True, MUTE)
    else:
        p.box(MARGIN, 184, INNER, 135, PINE)
        p.text(56, 206, "Kling 4", 19, True, WHITE)
        p.text(391, 206, "V4-rigg", 19, True, WHITE)
        p.text(57, 238, "121 rutor vid 24 b/s", 10.2, color=WHITE)
        p.text(391, 238, "127 leder", 10.2, color=WHITE)
        arrow(p, 165, 217, 375, 217, YELLOW, 2)
        arrow(p, 375, 279, 165, 279, "#D8E4DC", 1)
        p.text(270, 252, "start- och slutbild", 9.4, color=WHITE, align="center")
        p.text(MARGIN, 329, "Övre pilen visar rörelseöverföring. Den undre visar vägen till en ny film.",
               8.6, color=MUTE)
    col = 247
    p.text(MARGIN, 376, "Film till sittande rigg", 14.8, True)
    p.paragraph(MARGIN, 407, "Kling-klippets 121 rutor spåras var för sig. "
                "Lednamn, föräldrar och grundmatriser matchar V4 på alla 127 leder. "
                "Den filmade överkroppens startpose förs till V4. Kortet har en egen bana. "
                "Hud, hår och kroppens form kommer från V4.",
                col, 10.6, 15.6)
    p.text(309, 376, "Rigg till ny film", 14.8, True)
    p.paragraph(309, 407, "Välj ruta och kamera, rendera ett startankare och lägg vid behov "
                "till ett slutankare. Skicka den valda revisionen från studion. "
                "Samma pose vid 0° och +70° gav olika grepp i de genererade proven.",
                col, 10.6, 15.6)
    p.note(MARGIN, 536, INNER, "Greppet i filmens första ruta",
           "Vid ruta 0 håller Paulina det röda kortet upprätt i högerhanden. "
           "I ruta 42 är armen utsträckt. Kortet ligger plant i ruta 62 och hon släpper "
           "i ruta 73. Rörelsen och landningen anpassas till V4-bordets filthöjd. "
           "I skon ligger ett annat kort. Dess framsida är helt gul ända ut till kanten.", 115, dark=True)
    p.text(MARGIN, 681, "Dashboarden på labbdatorn", 14, True)
    p.paragraph(MARGIN, 707, "Starta START.bat i sam-3d-body/jakob-start. Välj video med "
                "rutsteg 1. Spara den rika rorelse.json och importera den till V4. I ett "
                "97-rutorsprov återskapades 204 MHR-parametrar per ruta. Det största "
                "avståndet mellan motsvarande leder var 0,00025 mm för de 127 jämförda lederna.",
                INNER, 10.5, 15)
    p.link(MARGIN, 770, "Jämför startgreppet i ruta 0", "film")
    p.link(330, 770, "Öppna SAM-dashboarden", "sam")
    p.footer(4)


def card_diagram(p, x, top, width, height):
    p.box(x, top, width, height, PINE)
    sy = top + height * 0.43
    py = top + height * 0.72
    shoe_x, hand_x, end_x = x + width * 0.14, x + width * 0.48, x + width * 0.82
    p.box(shoe_x - 19, sy - 11, 42, 26, "#39544D", "#B0C5B5")
    arrow(p, shoe_x + 27, sy + 5, hand_x - 17, py - 9, "#C4D4C8")
    arrow(p, hand_x + 19, py, end_x - 22, py, "#C4D4C8")
    p.circle(end_x, py, 22, stroke="#C9D7CB", width=0.8)
    for cx, cy, slope in [(shoe_x, sy, -13), (hand_x, py, 5), (end_x, py, 0)]:
        p.pdf.saveState()
        p.pdf.translate(cx, H - cy)
        p.pdf.rotate(slope)
        p.pdf.setFillColor(colors.HexColor(YELLOW))
        p.pdf.rect(-8.5, -12, 17, 24, stroke=0, fill=1)
        p.pdf.restoreState()
    p.text(shoe_x, top + 13, "KORTSKON", 8.2, True, WHITE, "center")
    p.text(hand_x, top + 13, "HÖGERHANDEN", 8.2, True, WHITE, "center")
    p.text(end_x, top + 13, "PLATS 4", 8.2, True, WHITE, "center")


def deal(p):
    p.frame(5, "Kortgivning", "När högern tar emot",
            "Vänsterhanden drar fram kortet. Högern väntar vid filten till och med ruta 82, "
            "följer kortet från ruta 83 och släpper i ruta 105.")
    if p.local:
        p.image(DEAL / "v4/granskning/tumme/tummar-original-v3-v4.jpg",
                MARGIN, 188, INNER, 135, region=(0.012, 0.12, 0.978, 0.492),
                fill=False, backdrop="#F9F7EF")
        p.text(MARGIN, 333, "Vänster tumme · original 03, V3 och V4 · frontkamera, ruta 73 i båda 3D-bilderna",
               8.4, color=MUTE)
    else:
        card_diagram(p, MARGIN, 188, INNER, 135)
        p.text(MARGIN, 333, "Schematisk bana · gult kort vid tre tidpunkter i samma giv", 8.8, color=MUTE)
    p.text(MARGIN, 379, "Ruta", 9, True, GREEN)
    p.text(115, 379, "Händelse", 9, True, GREEN)
    p.text(299, 379, "Kontroll i den rättade given", 9, True, GREEN)
    rows = [
        ("73", "Kortet dras ur skon", "Vänstertummen följer handens utsida."),
        ("78", "Högerhanden tar emot", "Pekfingers hud är 0,56 mm från kortytan."),
        ("83", "Högerhanden följer", "Kortet har flyttats 21,95 mm från ruta 78 till 82."),
        ("105", "Högerhanden släpper", "Kortet fortsätter 12,41 cm under fri glidning."),
        ("122", "Kortet når plats 4", "Slutläget hålls genom ruta 154."),
    ]
    for i, (frame, event, control) in enumerate(rows):
        y = 402 + i * 37
        p.line(MARGIN, y - 6, W - MARGIN, y - 6)
        p.text(MARGIN, y + 4, frame, 13.5, True)
        p.text(115, y + 5, event, 10.4, True)
        p.paragraph(299, y + 5, control, 250, 9.8, 13.2)
    p.line(MARGIN, 581, W - MARGIN, 581)
    p.text(MARGIN, 611, "Helt gul framsida", 17, True)
    p.box(MARGIN, 648, 30, 42, YELLOW)
    p.paragraph(85, 647, "Framsidan är gul ända ut till kanten. Allt vitt i skon tillhör kort "
                "som ligger bakom. Givens kort mäter 63 × 89 × 0,4 mm.", 459, 11.3, 16)
    p.paragraph(MARGIN, 711, "Sex rotationsspår för tummarna ändrades från V3 till V4. "
                "Kontrollen genom alla 155 rutor gav noll korsningar mellan tumhud och "
                "egen handyta på båda sidor.", INNER, 10.6, 15.5, MUTE)
    p.link(MARGIN, 771, "Granska tummen i V4 vid ruta 73", "deal")
    p.footer(5)


def cameras(p):
    p.frame(6, "Kameror", "Ett varv runt given",
            "120 virtuella kameralägen följer ett enda förlopp i 3°-steg. "
            "Pausa i ruta 92 och vrid från spelaren till sidan eller bakom Paulina.")
    p.box(MARGIN, 186, 230, 232, PINE)
    camera_ring(p, MARGIN + 115, 302, 79, color="#BBCFBE", accent=YELLOW, label=True)
    p.text(MARGIN + 115, 284, "3°", 25, True, YELLOW, "center")
    p.text(MARGIN + 115, 322, "MELLAN VYER", 8, True, WHITE, "center")
    p.text(297, 192, "Gult kort i givens ruta 92", 15.3, True)
    metric(p, 297, 228, "108 / 120", "helbilder med synligt kort", 242)
    metric(p, 297, 312, "113 / 120", "handnärbilder med synligt kort", 242)
    p.text(MARGIN, 429, "Markeringarna visar lägena 0°, 3°, …, 357°. +69° är närmast filmkamerans exakta +70°.",
           8.5, color=MUTE)
    if p.local:
        p.image(AVATAR / "prov-ankare/v1/kameror/kontaktkarta-120.jpg",
                MARGIN, 469, 215, 168, backdrop="#DDDCD0")
        p.text(MARGIN, 647, "Ankarprovet · kontaktkarta med 120 vyer", 8.2, color=MUTE)
    else:
        p.box(MARGIN, 469, 215, 168, SAGE)
        p.line(56, 600, 236, 600, "#8AA494", 0.8)
        for x, dy, name in [(74, 65, "Front"), (208, 91, "Sida")]:
            p.line(x, 600, x, 600 - dy, "#779486")
            p.box(x - 7, 600 - dy - 6, 14, 12, GREEN)
            p.line(x, 600 - dy, 140, 581, "#81A391", 0.8)
            p.text(x, 608, name, 8.7, True, GREEN, "center")
        p.text(MARGIN, 647, "Schematisk höjd på helbildskameran", 8.7, color=MUTE)
    p.text(282, 474, "Två olika kamerakontroller", 13.8, True)
    p.paragraph(282, 506, "Ankarprovet renderade två stilla poser från alla 120 lägen "
                "och gav 240 bilder. V4 har en animerad giv, helbild och två närbilder "
                "vid varje vinkel. Två filmer har exporterats vid exakt 0° och +70°.",
                264, 10.6, 15.5)
    p.paragraph(282, 603, "Helbildens radie är 1,62 m. Kameran är 1,40 m hög framifrån "
                "och 1,792 m vid minst 70° från fronten.", 264, 10.2, 14.6, MUTE)
    p.paragraph(MARGIN, 664, "I filmprovets ruta 0 syntes minst en pixel av det röda kortet i "
                "109/120 helbilder och 106/120 handnärbilder. Vid 180° skymdes kortet i båda utsnitten.",
                INNER, 9.3, 12.2, INK)
    p.note(MARGIN, 693, INNER, "En pausad ruta går att undersöka från alla håll",
           "Rotera för att hitta en fri siktlinje till kortet. En annan vinkel kan visa "
           "vilket finger som ligger närmast filten. Kamera och utsnitt ändrar bara observationen.", 72)
    p.link(MARGIN, 776, "Kameraformeln och lägena i spelaren", "cameras", 9.1)
    p.footer(6)


def expression_curve(p, x, top, width, height):
    p.box(x, top, width, height, PINE)
    p.text(x + 13, top + 12, "LEENDETS VIKT", 8, True, WHITE)
    left, right, low, high = x + 21, x + width - 22, top + height - 27, top + 39
    p.line(left, low, right, low, "#86A197", 0.7)
    p.line(left, high, right, high, "#5B8273", 0.5)
    points = [(left, low), (left + (right - left) * 0.4, high),
              (left + (right - left) * 0.6, high), (right, low)]
    for start, end in zip(points, points[1:]):
        p.line(*start, *end, YELLOW, 2)
    for (px, py), label in zip(points, ["0", "1", "1,5", "2,5 s"]):
        p.circle(px, py, 2.5, YELLOW)
        p.text(px, low + 9, label, 7.8, color=WHITE, align="center")


def gaze_graphic(p, x, top, width, height):
    p.box(x, top, width, height, SAGE)
    p.text(x + 13, top + 12, "RIKTNING FRÅN PAULINA", 8, True, GREEN)
    center_x, base = x + width / 2, top + height - 16
    for angle in [-34, -24, 0, 24, 34]:
        a, length = math.radians(angle), 63
        color = "#759A8B" if abs(angle) == 24 else GREEN
        ex, ey = center_x + math.sin(a) * length, base - math.cos(a) * length
        if angle:
            arrow(p, center_x, base, ex, ey, color, 1.35)
        else:
            p.line(center_x, base, center_x, ey, "#A4B8AA", 0.7)
    p.circle(center_x, base, 3, INK)
    p.text(x + 17, top + 74, "Vänster", 8.4, color=INK)
    p.text(x + width - 17, top + 74, "Höger", 8.4, color=INK, align="right")


def face(p):
    p.frame(7, "Ansiktsrörelse", "Minspel och blick",
            "Leendet flyttar ansiktets yta. Blicken styrs av leder i ögon och huvud. "
            "Båda går att inspektera framifrån i studions 3D-spelare.")
    p.text(MARGIN, 188, "Ett snett leende på 2,5 sekunder", 16, True)
    if p.local:
        p.image(DEAL / "v3/granskning/minspel/kameror/vila-grimas-vila.jpg",
                MARGIN, 221, 266, 116, region=(0, 0.035, 1, 0.49), backdrop=WHITE)
        label = "0° · vila, fullt uttryck och återgång till vila"
    else:
        expression_curve(p, MARGIN, 221, 266, 116)
        label = "Morfmålet går från 0 till 1 och tillbaka till 0."
    p.text(MARGIN, 349, label, 8.4, color=MUTE)
    p.paragraph(325, 228, "2 864 hörn flyttas. Höger mungipa höjs 11,2 mm och "
                "vänster bryn 8,4 mm. Fullt uttryck nås vid 1 sekund och hålls till "
                "1,5 sekunder. Start- och slutbilden är identiska.", 226, 11, 16)
    p.line(MARGIN, 382, W - MARGIN, 382)
    p.text(MARGIN, 402, "Åt vilket håll kan hon titta?", 16, True)
    if p.local:
        p.image(DEAL / "blick/v1/granskning/blick-framifran.jpg",
                MARGIN, 437, 266, 111, region=(0.012, 0.604, 0.987, 0.991), backdrop=WHITE)
        label = "Fast frontkamera · hennes höger, mitten och vänster"
    else:
        gaze_graphic(p, MARGIN, 437, 266, 111)
        label = "Schematisk vy ovanifrån · sett från givaren"
    p.text(MARGIN, 560, label, 8.3, color=MUTE)
    p.paragraph(325, 439, "Med huvudet låst roteras ögonen ±24°. Iris flyttas "
                "1,3–1,5 bildpunkter i en frontbild på 1 204 × 604. När huvudet "
                "följer med vrids det ±23° och ögonen ytterligare ±11°. "
                "Valen avser Paulinas egna sidor.", 226, 10.6, 15.3)
    p.note(MARGIN, 610, INNER, "Vad som krävs för fler uttryck",
           "I det lokala MHR-provet formade 72 av 72 uttrycksreglage grundhuden. "
           "Alla berörda hörn kunde kopplas till V4. Bildestimatorn sätter uttryck och "
           "käkrörelse till noll, och grundfilen innehåller 0 av dessa 72 morfmål. "
           "För blinkningar, tal eller en ny grimas behöver önskade former föras över, "
           "exporteras och kontrolleras i rörelse.", 133, dark=True)
    p.link(MARGIN, 771, "Spela och styr leendet", "face")
    p.link(305, 771, "Prova blicken åt hennes vänster", "gaze")
    p.footer(7)


def links(p):
    p.frame(8, "Spelare och källor", "Öppna och undersök",
            "Länkarna till studion och SAM öppnas på labbdatorn medan tjänsterna kör. "
            "Metodtexten, verktygen och forskningskällorna finns på webben.")
    p.text(MARGIN, 185, "På labbdatorn", 16, True)
    local = [
        ("Given till plats 4", "deal", "V4 · händer, frontkamera och ruta 73"),
        ("Kling 4 och V4", "film", "Upphållet rött kort i högerhanden · ruta 0"),
        ("Blicken", "gaze", "Ögon och huvud · Paulinas egen vänster"),
        ("Minspelet", "face", "Sneda leendet · 3D-reglage och film"),
        ("SAM-dashboarden", "sam", "Foto till statisk GLB och film till rörelsedata"),
    ]
    for i, (label, key, caption) in enumerate(local):
        y = 224 + 32 * i
        p.line(MARGIN, y - 9, W - MARGIN, y - 9)
        p.link(MARGIN, y, label, key, 10.5)
        p.text(273, y + 1, caption, 9.5, color=MUTE)
    p.line(MARGIN, 376, W - MARGIN, 376)
    p.text(MARGIN, 410, "Metod och tidigare arbeten", 16, True)
    sources = [
        ("Arbetskedjan för Paulina", "method", "Exakta verktyg, ordningsföljd och mätningar."),
        ("SiTH · ETH Zürich", "sith", "Texturerad 3D-person från ett enda foto."),
        ("HumanNeRF · CVPR 2022", "humannerf", "Fria vyer av en rörlig person från en film."),
        ("SAM 3D Body · Meta", "sam_source", "Skattning av en tredimensionell kropp ur en bild."),
        ("MHR · Meta", "mhr", "Skelett, hud och parametrar för ansiktsuttryck."),
    ]
    for i, (label, key, caption) in enumerate(sources):
        y = 449 + 33 * i
        p.line(MARGIN, y - 9, W - MARGIN, y - 9)
        p.link(MARGIN, y, label, key, 10.2)
        p.text(273, y + 1, caption, 9.2, color=MUTE)
    p.line(MARGIN, 606, W - MARGIN, 606)
    p.note(MARGIN, 645, INNER, "Vad den här modellen tillför",
           "Den sittande givaren, kortets bana och kontakten mellan hand och kort går "
           "att mäta på samma bildruta från 120 lägen. Den kombinationen är dokumenterad "
           "för Paulina. Närliggande forskningsarbeten finns, och global särställning är "
           "obelagd. För att bedöma videokvalitet behövs en filmad giv med matchande "
           "ljus, kamera och utsnitt.", 119)
    p.footer(8)


def build(local=False):
    destination = ROOT / ("information/lokalt" if local else "output/pdf") / "paulina-foto-till-rorelse.pdf"
    register_fonts()
    stream = io.BytesIO()
    pdf = canvas.Canvas(stream, pagesize=A4, pageCompression=True, invariant=True,
                        lang="sv-SE")
    edition = "Lokal bildutgåva" if local else "Illustrerad metodutgåva"
    pdf.setTitle(f"Paulina från foto till rörelse | {edition}")
    pdf.setAuthor("Ultimate Reality")
    pdf.setSubject("Fotoreferenser, sittande rigg, kortgivning, kameralägen och ansiktsrörelse")
    pdf.setCreator("Ultimate Reality / tools/paulina_method_pdf.py")
    page = Page(pdf, local)
    for draw in (cover, photos, rig, film, deal, cameras, face, links):
        draw(page)
    pdf.save()
    output = stream.getvalue()
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists() or destination.read_bytes() != output:
        with NamedTemporaryFile(dir=destination.parent, delete=False, suffix=".pdf.tmp") as pending:
            temp = Path(pending.name)
        try:
            temp.write_bytes(output)
            os.replace(temp, destination)
        finally:
            temp.unlink(missing_ok=True)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local", action="store_true",
                        help="Build the photographic lab edition in information/lokalt.")
    print(build(parser.parse_args().local))
