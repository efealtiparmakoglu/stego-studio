# stego-studio

Educational **LSB steganography**: hide text messages inside the least
significant bits of PNG pixels. Capacity gauge, optional XOR
obfuscation, LSB-plane analysis heatmap. Single-file offline HTML,
zero npm dependencies.

```text
$ npm test          # 9 core tests (Node)
$ npm run build     # -> dist/index.html
```

## How it works

- **Capacity** — every pixel contributes 3 usable bits (RGB; alpha is
  never touched). After the 8-byte header (magic `STG1` + 4-byte
  big-endian payload length), the rest is payload: a 200×100 image
  holds 7 437 bytes.
- **Embed** — each payload byte is written MSB-first into the LSBs of
  consecutive RGB channels.
- **Extract** — reads the same bit stream sequentially, checks the
  magic marker, then reassembles the payload.
- **XOR obfuscation** — an optional key XORs the payload bytes
  (repeating key). Without the key an embedded message extracts as
  garbage — obfuscation, **not** encryption.
- **Analysis** — the LSB-ones ratio per row renders as a heatmap; the
  total deviation from the expected 50/50 split is shown. Natural
  images sit near 50%; a stuffed image is *also* near 50% — the
  educational point being that LSB stego is statistically quiet but
  fragile (one JPEG re-save destroys it).

## Honest limits

This is a teaching tool. LSB stego is detectable (chi-square, RS
analysis) and brittle; XOR is not cryptography. Use it to *learn* the
mechanics, not to protect anything real.

## Development

```console
$ npm test          # round trip, wrong key, alpha integrity, capacity,
                    # analysis, row ratios
$ npm run build
```

## License

MIT — see [LICENSE](LICENSE).
