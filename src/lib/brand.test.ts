// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import provenance from "../content/brand-provenance.json";

/**
 * The logo files are DERIVATIVES of the founder's logo (scripts/brand/build-logo.mjs). What this
 * guards: every file the provenance lists exists, the square ones are square (a derivative that
 * was stretched on one axis is the failure the brief names), the icon files are in the format
 * Next's ICO reader accepts (an RGB frame broke the build once), and — on a machine that has the
 * source — the source has not been changed.
 */

const ROOT = path.resolve(__dirname, "../..");
const abs = (f: string) => path.join(ROOT, f);

describe("brand derivatives", () => {
  it("every file the provenance lists exists and is not empty", () => {
    for (const f of provenance.files) {
      expect(existsSync(abs(f)), f).toBe(true);
      expect(readFileSync(abs(f)).length, f).toBeGreaterThan(200);
    }
  });

  it("the mark and the full logo are square at every size — nothing was stretched", async () => {
    for (const f of provenance.files.filter((x) => /valice-press-(mark|logo)-/.test(x) || /icon\.png$/.test(x))) {
      const m = await sharp(abs(f)).metadata();
      expect(m.width, f).toBe(m.height);
    }
  });

  it("the sizes in the file names are the sizes of the files", async () => {
    for (const f of provenance.files) {
      const n = /-(\d+)\.(webp|png)$/.exec(f)?.[1];
      if (!n) continue;
      const m = await sharp(abs(f)).metadata();
      expect(m.width, f).toBe(Number(n));
    }
  });

  it("the Next icon files are RGBA PNGs and favicon.ico holds 16, 32 and 48px RGBA frames", async () => {
    for (const f of ["src/app/icon.png", "src/app/apple-icon.png"]) {
      const m = await sharp(abs(f)).metadata();
      expect(m.channels, f).toBe(4);
    }
    const ico = readFileSync(abs("src/app/favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    const count = ico.readUInt16LE(4);
    expect(count).toBe(3);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const at = 6 + i * 16;
      sizes.push(ico.readUInt8(at));
      const len = ico.readUInt32LE(at + 8);
      const off = ico.readUInt32LE(at + 12);
      const frame = ico.subarray(off, off + len);
      expect(frame.subarray(1, 4).toString("latin1"), `frame ${i} is a PNG`).toBe("PNG");
      // PNG colour type is byte 25 of the file (IHDR): 6 = RGBA. The ICO reader in Next refuses 2 (RGB).
      expect(frame.readUInt8(25), `frame ${i} colour type`).toBe(6);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("the cream ground is the logo's own, so the tile does not recolour the artwork", () => {
    expect(provenance.ground).toBe("rgb(251, 249, 241)");
    const mark = readFileSync(abs("src/components/brand/brand-mark.tsx"), "utf8");
    expect(mark).toContain("bg-[#fbf9f1]"); // 251, 249, 241
  });

  // Only meaningful on the machine that holds the founder's file; CI does not have it.
  const SOURCE = provenance.source;
  it.skipIf(!existsSync(SOURCE))("the founder's source logo is byte-for-byte what the derivatives were cut from", () => {
    const sha = createHash("sha256").update(readFileSync(SOURCE)).digest("hex");
    expect(sha).toBe(provenance.sourceSha256);
  });
});
