/* LSB steganography core: capacity, embed, extract, XOR obfuscation and
 * analysis. Operates on raw RGBA pixel arrays (Uint8ClampedArray-compatible
 * shape: Uint8Array of length width*height*4). Pure logic — no canvas. */

const MAGIC = "STG1"; // 4-byte marker: LSB-encoded payload follows
const HEADER_BYTES = 4 + 4; // magic + 4-byte big-endian payload length

export interface Capacity {
  totalBits: number; // usable LSB bits (RGB channels of every pixel)
  maxMessageBytes: number; // payload bytes after the header overhead
}

export function capacity(width: number, height: number): Capacity {
  const totalBits = width * height * 3; // alpha channel untouched
  return {
    totalBits,
    maxMessageBytes: Math.floor((totalBits - HEADER_BYTES * 8) / 8),
  };
}

/** XOR-obfuscate bytes with a repeating key. Empty key = identity. */
export function xorBytes(data: Uint8Array, key: string): Uint8Array {
  if (key === "") return data;
  const keyBytes = new TextEncoder().encode(key);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ keyBytes[i % keyBytes.length]!;
  }
  return out;
}

/** Embed a UTF-8 message into pixel data. Mutates `pixels` in place.
 * Each byte becomes 8 LSBs across the RGB channels (alpha skipped).
 * Throws when the message doesn't fit. */
export function embed(
  pixels: Uint8Array,
  message: string,
  key: string = "",
): void {
  const payload = xorBytes(new TextEncoder().encode(message), key);
  const cap = capacity(pixels.length / 4, 1); // width-only: height=1
  if (payload.length > cap.maxMessageBytes) {
    throw new Error(
      `message too long: ${payload.length} bytes, capacity ${cap.maxMessageBytes}`,
    );
  }
  const frame = new Uint8Array(HEADER_BYTES + payload.length);
  frame.set(new TextEncoder().encode(MAGIC), 0);
  const length = payload.length;
  frame[4] = (length >>> 24) & 0xff;
  frame[5] = (length >>> 16) & 0xff;
  frame[6] = (length >>> 8) & 0xff;
  frame[7] = length & 0xff;
  frame.set(payload, HEADER_BYTES);

  let bitIndex = 0;
  for (let px = 0; px < pixels.length && bitIndex < frame.length * 8; px += 4) {
    for (let channel = 0; channel < 3; channel++) {
      if (bitIndex >= frame.length * 8) break;
      const byte = frame[bitIndex >> 3] as number;
      const bit = (byte >> (7 - (bitIndex % 8))) & 1;
      pixels[px + channel] = (pixels[px + channel]! & 0xfe) | bit;
      bitIndex++;
    }
  }
}

export interface ExtractResult {
  message: string;
  bytes: number;
}

/** Extract a message previously embedded by `embed`. Reads the pixel
 * stream ONCE sequentially (header then payload — the same order embed
 * wrote). Returns null when the magic marker is missing. */
export function extract(pixels: Uint8Array, key: string = ""): ExtractResult | null {
  const readBit = (bitIndex: number): number => {
    // each pixel contributes 3 bits (RGB); alpha skipped
    const px = Math.floor(bitIndex / 3) * 4;
    const channel = bitIndex % 3;
    return pixels[px + channel]! & 1;
  };
  const readByte = (byteIndex: number): number => {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | readBit(byteIndex * 8 + bit);
    }
    return byte;
  };

  // header: magic + length
  let magic = "";
  for (let b = 0; b < 4; b++) magic += String.fromCharCode(readByte(b));
  if (magic !== MAGIC) return null;
  const length =
    (readByte(4) << 24) | (readByte(5) << 16) | (readByte(6) << 8) | readByte(7);
  if (length <= 0 || length > pixels.length / 4) return null;

  const payload = new Uint8Array(length);
  for (let b = 0; b < length; b++) {
    payload[b] = readByte(8 + b);
  }
  const decoded = xorBytes(payload, key);
  return { message: new TextDecoder().decode(decoded), bytes: length };
}

export interface Analysis {
  /** pixels whose least-significant RGB bit is 1 (uniform 50% expected) */
  lsbOnes: number;
  lsbTotal: number;
  /** chi-square-ish signal: |ones - total/2| as percent of total */
  uniformityDeviation: number;
}

/** Analysis view: how "normal" the LSB plane looks. Natural images sit
 * near 50% ones; a fully-stuffed image is also ~50%, but a freshly
 * zeroed or tiny payload region skews locally. */
export function analyze(pixels: Uint8Array): Analysis {
  let lsbOnes = 0;
  let lsbTotal = 0;
  for (let px = 0; px < pixels.length; px += 4) {
    for (let channel = 0; channel < 3; channel++) {
      lsbTotal++;
      lsbOnes += pixels[px + channel]! & 1;
    }
  }
  const expected = lsbTotal / 2;
  const deviation = lsbTotal === 0 ? 0 : (Math.abs(lsbOnes - expected) / lsbTotal) * 100;
  return { lsbOnes, lsbTotal, uniformityDeviation: deviation };
}

/** Per-row LSB-ones ratio for the analysis heatmap. */
export function lsbRowRatios(pixels: Uint8Array, width: number, height: number): number[] {
  const ratios: number[] = [];
  for (let row = 0; row < height; row++) {
    let ones = 0;
    let total = 0;
    for (let col = 0; col < width; col++) {
      const base = (row * width + col) * 4;
      for (let channel = 0; channel < 3; channel++) {
        total++;
        ones += pixels[base + channel]! & 1;
      }
    }
    ratios.push(total === 0 ? 0 : ones / total);
  }
  return ratios;
}
