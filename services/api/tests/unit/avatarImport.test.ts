import { describe, expect, it } from "vitest";
import { isGoogleAvatarUrl } from "../../src/integrations/avatarImport";

describe("isGoogleAvatarUrl", () => {
  it("matches only Google-hosted photos", () => {
    expect(isGoogleAvatarUrl("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(true);
    expect(isGoogleAvatarUrl("https://evil.com/googleusercontent.com")).toBe(false);
    expect(isGoogleAvatarUrl("https://googleusercontent.com.evil.com/x")).toBe(false);
    expect(isGoogleAvatarUrl("not a url")).toBe(false);
    expect(isGoogleAvatarUrl(null)).toBe(false);
  });
});
