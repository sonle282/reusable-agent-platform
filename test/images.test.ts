import { describe, expect, it } from "vitest";
import { ownImageNames, sniffImage } from "../src/worker/images";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

describe("image uploads trust the file's first bytes", () => {
  it("recognises JPG, PNG, GIF and WebP", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
  });

  it("refuses anything else, whatever its name", () => {
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("photos a row links to", () => {
  const name = "0123456789abcdef0123456789abcdef.png";
  it("finds our own photo links in any column", () => {
    const names = ownImageNames({ title: "Offer", image_url: `https://agent.example.com/media/images/${name}`, gallery: [`https://x.test/media/images/${name.replace("0", "f")}`] });
    expect([...names].sort()).toEqual([name, name.replace("0", "f")].sort());
  });
  it("ignores other links and look-alikes", () => {
    expect(ownImageNames({ image_url: "https://cdn.example.com/photo.png", note: "/media/images/not-a-photo.png", other: `/media/images/${name}.html` }).size).toBe(0);
  });
});
