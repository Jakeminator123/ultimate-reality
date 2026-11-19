import assert from "node:assert/strict";
import test from "node:test";
import { quote, videoModels } from "../lib/runway-prices.ts";

function cost(id, quality, duration, reference = 0, images = 0, format = "MP4", now = Date.UTC(2026, 10, 19)) {
  const model = videoModels.find((item) => item.id === id);
  const rate = model.rates.find((r) => r.quality === quality);
  return quote(model, rate, duration, reference, images, format, now).credits;
}
test("Kling 4 rundar listpriset innan kampanjen och går över till listpris vid midnatt UTC", () => {
  assert.equal(cost("kling_4", "720p", 5), 64);
  assert.equal(cost("kling_4", "720p", 5, 0, 0, "MP4", Date.UTC(2026, 11, 1)), 79);
  assert.equal(cost("kling_4", "1080p", 5, 10), 170);
  assert.equal(cost("kling_4_flash", "720p", 5, 3), 63);
  assert.equal(cost("kling_4_flash", "720p", 5, 10), 95);
});
test("en källfilm, tidsatta referenser och leveransformat prissätts enligt modellens villkor", () => {
  assert.equal(cost("aleph2", "Som källfilmen", 5, 0, 0, "ProRes MOV"), 165);
  assert.equal(cost("aleph2", "Som källfilmen", 2, 0, 0, "10-bitars SDR"), 96);
  assert.equal(cost("seedance2_5", "4K", 5, 5, 0, "MOV"), 835);
  assert.equal(cost("seedance2_5", "480p", 4), 80);
  assert.equal(cost("gemini_omni_flash_1.2", "720p", 5, 2, 3), 40);
  assert.equal(cost("kling2.5_turbo_pro", "Följer startbilden", 10), 120);
});
