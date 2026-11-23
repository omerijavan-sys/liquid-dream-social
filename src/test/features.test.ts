import { describe, it, expect } from "vitest";
import { rgb } from "@/features/shared/ui";
import { inviteLink, storeRef, readRef, clearRef } from "@/features/referrals/referral";
import { DEFAULTS, THEMES } from "@/features/vibe/aesthetics";

describe("growth features helpers", () => {
  it("converts hex accents and rejects junk", () => {
    expect(rgb("#ff0000")).toBe("255,0,0");
    expect(rgb("not-a-color")).toBe("167,139,250"); // falls back to the default violet
  });
  it("builds invite links and normalises stored codes", () => {
    expect(inviteLink("ABC12345")).toBe("https://primegramx.co.ke/invite/ABC12345");
    storeRef(" abc12345 "); expect(readRef()).toBe("ABC12345"); clearRef(); expect(readRef()).toBeNull();
  });
  it("gold theme is locked behind the referral perk, defaults are not", () => {
    expect(THEMES.obsidian_gold.locked).toBe("obsidian_gold_theme");
    expect(THEMES[DEFAULTS.theme].locked).toBeUndefined();
  });
});
