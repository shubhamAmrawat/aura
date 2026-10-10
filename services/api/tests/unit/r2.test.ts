import { describe, expect, it } from "vitest";

process.env.R2_PUBLIC_URL = "https://cdn.aurora-walls.com";
const { keyFromPublicUrl } = await import("../../src/integrations/r2");

describe("keyFromPublicUrl", () => {
  it("maps our CDN and the legacy r2.dev address to object keys", () => {
    expect(keyFromPublicUrl("https://cdn.aurora-walls.com/wallpapers/a/b.png")).toBe("wallpapers/a/b.png");
    expect(keyFromPublicUrl("https://pub-7a9b0809a66e45e99632a890f4327988.r2.dev/avatars/u/x.jpeg")).toBe("avatars/u/x.jpeg");
  });

  it("rejects anything else", () => {
    expect(keyFromPublicUrl("https://pub-0000000000000000000000000000000.r2.dev/wallpapers/a.png")).toBeNull();
    expect(keyFromPublicUrl("https://lh3.googleusercontent.com/a/x")).toBeNull();
    expect(keyFromPublicUrl("http://cdn.aurora-walls.com/wallpapers/a.png")).toBeNull();
    expect(keyFromPublicUrl("https://cdn.aurora-walls.com/")).toBeNull();
    expect(keyFromPublicUrl("not a url")).toBeNull();
    expect(keyFromPublicUrl(null)).toBeNull();
  });
});
