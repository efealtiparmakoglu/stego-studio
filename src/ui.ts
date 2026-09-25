/* DOM layer: image load (file picker), capacity gauge, embed/extract
 * forms with key field, analysis heatmap. Canvas reads/writes pixels. */

import {
  analyze,
  capacity,
  embed,
  extract,
  lsbRowRatios,
  type Capacity,
} from "./core.ts";

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

let pixels: Uint8Array | null = null;
let width = 0;
let height = 0;

function readImage(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = $("canvas") as HTMLCanvasElement;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      pixels = new Uint8Array(data.data);
      width = canvas.width;
      height = canvas.height;
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => reject(new Error("not an image"));
    img.src = url;
  });
}

function updateCapacity(): void {
  if (!pixels) return;
  const cap: Capacity = capacity(width, height);
  const messageLength = new TextEncoder().encode(
    ($("message") as HTMLTextAreaElement).value,
  ).length;
  const used = 8 + messageLength; // header + payload
  const percent = Math.min(100, Math.round((used / cap.maxMessageBytes) * 100));
  const gauge = $("gauge-fill") as HTMLElement;
  gauge.style.width = `${Math.min(percent, 100)}%`;
  gauge.style.background = percent > 90 ? "#c62828" : percent > 60 ? "#b98900" : "#2e7d32";
  $("gauge-text").textContent =
    `${used} / ${cap.maxMessageBytes} bytes (${percent}%) — image ${width}×${height}`;
}

function downloadPng(): void {
  if (!pixels) return;
  const canvas = $("canvas") as HTMLCanvasElement;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "stego.png";
    link.click();
  }, "image/png");
}

async function doEmbed(): Promise<void> {
  if (!pixels) return;
  const message = ($("message") as HTMLTextAreaElement).value;
  const key = ($("key") as HTMLInputElement).value;
  try {
    embed(pixels, message, key);
    downloadPng();
    $("embed-status").textContent = "embedded — stego.png downloading";
  } catch (error) {
    $("embed-status").textContent = String(error);
  }
  paintAnalysis();
}

function doExtract(): void {
  if (!pixels) return;
  const key = ($("key") as HTMLInputElement).value;
  const result = extract(pixels, key);
  const output = $("extract-output") as HTMLElement;
  if (result === null) {
    output.textContent = "no payload found (magic marker missing)";
  } else {
    output.textContent = result.message;
  }
}

function paintAnalysis(): void {
  if (!pixels) return;
  const stats = analyze(pixels);
  const ratios = lsbRowRatios(pixels, width, height);
  const heat = $("heatmap") as HTMLElement;
  heat.innerHTML = "";
  for (const ratio of ratios) {
    const rowEl = document.createElement("div");
    rowEl.style.height = "4px";
    const blue = Math.round(ratio * 100);
    rowEl.style.background = `rgb(${255 - blue}, ${255 - blue}, 255)`;
    heat.appendChild(rowEl);
  }
  $("analysis").textContent =
    `LSB ones: ${stats.lsbOnes}/${stats.lsbTotal} (${(100 - stats.uniformityDeviation).toFixed(1)}% ones) · ` +
    `deviation from 50/50: ${stats.uniformityDeviation.toFixed(2)}%`;
}

function setup(): void {
  $("file").addEventListener("change", async () => {
    const file = ($("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    await readImage(file);
    updateCapacity();
    paintAnalysis();
  });
  $("message")?.addEventListener("input", updateCapacity);
  $("embed")?.addEventListener("click", doEmbed);
  $("extract")?.addEventListener("click", doExtract);
}

setup();
