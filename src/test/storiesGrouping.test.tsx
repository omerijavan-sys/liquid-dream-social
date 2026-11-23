import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const now = Date.now();
const rows = [
  { id: "s3", user_id: "bob", media_url: "https://x/b.jpg", created_at: new Date(now - 1000).toISOString() },
  { id: "s2", user_id: "ann", media_url: "https://x/a2.jpg", created_at: new Date(now - 2000).toISOString() },
  { id: "s1", user_id: "ann", media_url: "https://x/a1.jpg", created_at: new Date(now - 9000).toISOString() },
];
const chain = (data: unknown): any => {
  const c: any = new Proxy(() => c, { get: (_t, k) => (k === "then" ? (res: (v: unknown) => void) => res({ data, error: null }) : () => c) });
  return c;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => chain(t === "posts" ? rows : t === "profiles" ? [{ user_id: "ann", display_name: "Ann", avatar_url: null }, { user_id: "bob", display_name: "Bob", avatar_url: null }] : []),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

import StoriesBar from "@/components/StoriesBar";

describe("stories are grouped one circle per person", () => {
  it("shows one bubble for two stories by the same user, with a count, and a segment per story in the viewer", async () => {
    render(<MemoryRouter><StoriesBar /></MemoryRouter>);
    const ann = await screen.findByText("Ann");
    expect(screen.getAllByText("Ann")).toHaveLength(1);       // single circle
    expect(screen.getByLabelText("2 stories")).toBeInTheDocument();
    expect(screen.queryByLabelText("1 stories")).toBeNull();
    fireEvent.click(ann);
    const dialog = await screen.findByRole("dialog", { name: "Story viewer" });
    await waitFor(() => expect(dialog.querySelectorAll(".h-0\\.5.flex-1")).toHaveLength(2)); // 2 progress segments
  });
});
