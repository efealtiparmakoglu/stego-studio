import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  capacity,
  embed,
  extract,
  lsbRowRatios,
  xorBytes,
} from "../src/core.ts";

function makePixels(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 200; // R
    pixels[i + 1] = 100; // G
    pixels[i + 2] = 50; // B
    pixels[i + 3] = 255; // A
  }
  return pixels;
}

test("capacity accounts for the header", () => {
  const cap = capacity(100, 100); // 10000 px * 3 = 30000 bits
  assert.equal(cap.totalBits, 30000);
  assert.equal(cap.maxMessageBytes, Math.floor((30000 - 64) / 8));
});

test("embed then extract round-trips the message", () => {
  const pixels = makePixels(100, 100);
  const message = "hidden treasure at dawn";
  embed(pixels, message);
  const result = extract(pixels);
  assert.ok(result);
  assert.equal(result.message, message);
});

test("extract returns null when no payload embedded", () => {
  const pixels = makePixels(50, 50);
  assert.equal(extract(pixels), null);
});

test("wrong key yields garbage, not the message", () => {
  const pixels = makePixels(100, 100);
  embed(pixels, "secret with key", "hunter2");
  const result = extract(pixels, "wrong-key");
  assert.ok(result);
  assert.notEqual(result.message, "secret with key");
  // correct key recovers it
  const pixels2 = makePixels(100, 100);
  embed(pixels2, "secret with key", "hunter2");
  const good = extract(pixels2, "hunter2");
  assert.equal(good?.message, "secret with key");
});

test("empty key is identity XOR", () => {
  const data = new Uint8Array([1, 2, 3]);
  assert.deepEqual([...xorBytes(data, "")], [1, 2, 3]);
});

test("message too long throws with capacity info", () => {
  const pixels = makePixels(10, 10); // 100 px -> ~73 bytes payload
  assert.throws(() => embed(pixels, "x".repeat(500)), /message too long/);
});

test("alpha channel is untouched by embedding", () => {
  const pixels = makePixels(20, 20);
  const alphas: number[] = [];
  for (let i = 3; i < pixels.length; i += 4) alphas.push(pixels[i] as number);
  embed(pixels, "some message to write across the alpha-stable pixels");
  for (let i = 3; i < pixels.length; i += 4) {
    assert.equal(pixels[i], alphas[i / 4 | 0]);
  }
});

test("analysis: flat image deviates, stuffed image evens out", () => {
  const pixels = makePixels(50, 50); // LSBs all zero
  const before = analyze(pixels);
  assert.equal(before.lsbOnes, 0, "makePixels uses even values: LSB 0");
  assert.equal(before.uniformityDeviation, 50, "all-zero LSB plane: 50% off the 50/50 midpoint");
  embed(pixels, "payload payload payload");
  const after = analyze(pixels);
  assert.ok(after.uniformityDeviation < before.uniformityDeviation,
    "embedding must pull the LSB plane toward 50/50");
});

test("lsbRowRatios covers every row", () => {
  const pixels = makePixels(10, 5);
  const ratios = lsbRowRatios(pixels, 10, 5);
  assert.equal(ratios.length, 5);
  for (const ratio of ratios) assert.equal(ratio, 0, "zeroed LSBs");
});
