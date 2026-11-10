import { describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import { authHeader } from "@/utils/authFetch";

describe("authHeader", () => {
  it("returns a bearer token when a session exists", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "abc123" } }, error: null });

    await expect(authHeader()).resolves.toBe("Bearer abc123");
  });

  it("throws when the user is signed out", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(authHeader()).rejects.toThrow("Please sign in to continue.");
  });
});
