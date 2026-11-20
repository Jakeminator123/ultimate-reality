const base = "/prov-ankare/v1";
const poses = document.querySelectorAll('input[name="pose"]');
const angle = document.getElementById("vinkel");
const degrees = document.getElementById("grader");
const image = document.getElementById("bild");
const message = document.getElementById("fel");

for (let value = 3; value <= 357; value += 3) {
  degrees.add(new Option(`${value}°`, String(value)));
}

function selectView(pose, value, writeAddress) {
  for (const radio of poses) radio.checked = radio.value === pose;
  angle.value = degrees.value = String(value);
  angle.setAttribute("aria-valuetext", `${value} grader`);
  const frame = String(value / 3).padStart(3, "0");
  const src = `${base}/bild/${pose}-${frame}.png`;
  image.alt = pose === "a1" ? `Paulina i vila i A1, kamera ${value} grader` :
    `Paulina vid kortskon i A2.3, kamera ${value} grader`;
  if (image.getAttribute("src") !== src) {
    message.hidden = true;
    image.src = src;
  }
  if (writeAddress) {
    const state = new URLSearchParams({ pose, vinkel: String(value) });
    window.history.replaceState(null, "", `${base}?${state}`);
  }
}

function fromAddress() {
  const query = new URLSearchParams(location.search);
  const candidate = Number(query.get("vinkel"));
  const valid = Number.isInteger(candidate) && candidate >= 0 && candidate <= 357 && candidate % 3 === 0;
  selectView(query.get("pose") === "a1" ? "a1" : "a23", valid ? candidate : 0, false);
}

function update(event) {
  const pose = document.querySelector('input[name="pose"]:checked').value;
  const value = Number(event.target === degrees ? degrees.value : angle.value);
  selectView(pose, value, true);
}

angle.addEventListener("input", update);
degrees.addEventListener("change", update);
for (const radio of poses) radio.addEventListener("change", update);
image.addEventListener("load", () => { message.hidden = true; });
image.addEventListener("error", () => { message.hidden = false; });
window.addEventListener("popstate", fromAddress);
fromAddress();
if (image.complete && image.naturalWidth === 0) message.hidden = false;
