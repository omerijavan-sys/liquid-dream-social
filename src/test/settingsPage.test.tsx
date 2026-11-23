import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const chain = (data: unknown): any => new Proxy(() => null, { get: (_t, k) => (k === "then" ? (res: (v: unknown) => void) => res({ data, error: null }) : () => chain(data)), apply: () => chain(data) });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => chain(null), rpc: () => chain(null), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {}, auth: { getSession: async () => ({ data: { session: null } }) }, storage: { from: () => ({}) } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me", email: "a@b.co", user_metadata: {} }, savedAccounts: [], switchAccount: vi.fn(), removeSavedAccount: vi.fn(), saveCurrentAccount: vi.fn(), signOut: vi.fn() }) }));
vi.mock("@/hooks/useRole", () => ({ useRoles: () => ({ isAdmin: false }) }));

import SettingsPage from "@/pages/SettingsPage";

describe("settings main screen", () => {
  it("shows grouped rows, filters with search, and keeps sign out", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search settings"), { target: { value: "wallet" } });
    expect(screen.getByText("Wallet")).toBeInTheDocument();
    expect(screen.queryByText("Privacy")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search settings"), { target: { value: "zzzz" } });
    expect(screen.getByText(/No settings match/)).toBeInTheDocument();
  });
});
