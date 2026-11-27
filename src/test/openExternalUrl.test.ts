import { describe, expect, it } from "vitest";
import { toAndroidIntentUrl } from "@/utils/openExternalUrl";

describe("toAndroidIntentUrl", () => {
  it("preserves the OAuth URL including query and fragment for Android's external browser", () => {
    expect(toAndroidIntentUrl("https://accounts.google.com/oauth?client=primegram#consent")).toBe(
      "intent://accounts.google.com/oauth?client=primegram#consent#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end",
    );
  });

  it("rejects non-web URLs", () => {
    expect(() => toAndroidIntentUrl("javascript:alert(1)")).toThrow("Only web links can be opened externally");
  });
});
