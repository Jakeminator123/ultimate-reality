import { errorResponse, requireLocal } from "../../../../lib/storage";
import { panoramaRooms } from "../../../../lib/panorama-rooms";

const room = panoramaRooms.find(item => item.id === "gothic-manor")!;
const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Blackjacksekvens i 3D</title>
<style>
:root{color-scheme:light;font:16px/1.4 system-ui,sans-serif;color:#223630}*{box-sizing:border-box}
body{margin:0}h2{font-size:1.23rem;margin:0 0 .55rem}canvas{display:block;width:min(100%,108.44vh);aspect-ratio:16/9;height:auto;background:#282f2c;border-radius:.6rem}
section{display:grid;gap:.55rem;padding:.75rem 0}fieldset{border:0;padding:0;margin:0;display:grid;gap:.55rem}
.row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}button,select,input{font:inherit;accent-color:#16634e}
button,select,input[type=number]{border:1px solid #bdc8c2;border-radius:.4rem;padding:.3rem .6rem;background:white;color:inherit}
button{cursor:pointer}button:disabled{cursor:wait}input[type=number]{width:5rem}
input[type=range]{flex:1;min-width:8rem}#play{background:#215b49;color:white}#status:empty{display:none}
</style>
<script type="importmap">{"imports":{"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script>
</head><body><h2 id="name"></h2><canvas id="scene" data-room-eye="${room.eye.join(",")}" aria-label="Blackjackbord och dealer i 3D"></canvas>
<section><div id="status" role="status">Läser sekvensen…</div><fieldset id="player" disabled>
<div class="row"><button id="play" type="button">Spela</button>
<label>Kamera <select id="seat"><option value="4">Stol 4</option><option value="1">Stol 1</option></select></label>
<label><input id="detail" type="checkbox"> Kortdetalj</label>
<output id="cards"></output></div>
<div class="row"><label for="frame">Bildruta</label><input id="frame" type="range" min="0" step="1" value="0">
<input id="number" type="number" aria-label="Gå till bildruta" min="0" step="1" value="0"><output id="last"></output></div>
<div class="row" id="landings" aria-label="Hoppa till landning"></div>
</fieldset></section><script type="module" src="/blackjack-sekvens.mjs"></script></body></html>`;

export function GET(request: Request) {
  try {
    requireLocal(request);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
