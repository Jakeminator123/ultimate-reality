import { EXAMPLE, Frame, mediaUrl } from "./model";

// A studio-owned calibration still. It is generated locally, including the felt and cards.
function tableStudy() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  const felt = ctx.createRadialGradient(675, 260, 24, 620, 290, 875);
  felt.addColorStop(0, "#365d56");
  felt.addColorStop(0.55, "#224740");
  felt.addColorStop(1, "#102922");
  ctx.fillStyle = felt;
  ctx.fillRect(0, 0, 1280, 720);
  let state = 419;
  const rand = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < 43000; i++) {
    ctx.fillStyle = i % 2 ? "rgba(200,229,204,.05)" : "rgba(0,12,5,.07)";
    ctx.fillRect(rand() * 1280, rand() * 720, 1 + rand() * 2, 1);
  }
  ctx.strokeStyle = "#9e9761";
  ctx.globalAlpha = 0.67;
  for (const rad of [592, 602, 625]) {
    ctx.lineWidth = rad === 602 ? 4 : 1.5;
    ctx.beginPath();
    ctx.ellipse(575, -145, rad * 1.46, rad, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const [x, y, rot] of [
    [130, 362, 0.48],
    [390, 446, 0.18],
    [673, 452, -0.09],
    [939, 389, -0.38],
    [1162, 276, -0.6],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-65, -45, 130, 102, 14);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  const card = (
    x: number,
    y: number,
    r: number,
    rank: string,
    suit: string,
    red: boolean,
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r);
    ctx.shadowColor = "rgba(0,12,8,.65)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    const ivory = ctx.createLinearGradient(0, 0, 140, 225);
    ivory.addColorStop(0, "#fffdf3");
    ivory.addColorStop(1, "#ddd8bd");
    ctx.fillStyle = ivory;
    ctx.beginPath();
    ctx.roundRect(-75, -108, 150, 216, 10);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#c3bfa8";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = red ? "#a24439" : "#212e29";
    ctx.font = "bold 36px Georgia";
    ctx.fillText(rank, -63, -68);
    ctx.font = "24px Georgia";
    ctx.fillText(suit, -62, -41);
    ctx.textAlign = "center";
    ctx.font = "90px Georgia";
    ctx.fillText(suit, 0, 30);
    ctx.rotate(Math.PI);
    ctx.textAlign = "left";
    ctx.font = "bold 32px Georgia";
    ctx.fillText(rank, -62, -67);
    ctx.restore();
  };
  card(757, 270, -0.25, "A", "♠", false);
  card(848, 293, 0.12, "K", "♦", true);
  const chip = (x: number, y: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.79);
    ctx.shadowColor = "rgba(0,12,6,.6)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#e4dcc2";
    ctx.lineWidth = 7;
    ctx.setLineDash([12, 13]);
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  };
  for (let i = 0; i < 4; i++) chip(343, 295 - i * 5, "#813d34");
  for (let i = 0; i < 3; i++) chip(397, 278 - i * 5, "#263d46");
  return canvas;
}

export async function renderFrame(frame: Frame): Promise<string> {
  let source: HTMLImageElement | HTMLCanvasElement;
  if (frame.name === EXAMPLE) source = tableStudy();
  else {
    const image = new Image();
    image.src = mediaUrl(frame.name);
    await image.decode();
    source = image;
  }
  const w =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const scale = Math.max(1280 / w, 720 / h) * frame.zoom;
  const cropW = 1280 / scale,
    cropH = 720 / scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#151d19";
  ctx.fillRect(0, 0, 1280, 720);
  ctx.drawImage(
    source,
    (w - cropW) * frame.x,
    (h - cropH) * frame.y,
    cropW,
    cropH,
    0,
    0,
    1280,
    720,
  );
  return canvas.toDataURL("image/jpeg", 0.92);
}
