import { useState } from "react";
import { Check, ChevronDown, Layers3, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { SavedAccount } from "@/contexts/AuthContext";

type AccountManagementProps = {
  user: User | null;
  savedAccounts: SavedAccount[];
  switchAccount: (userId: string) => Promise<void>;
  onManageProfiles: () => void;
  onSwitched: (label: string) => void;
  onSwitchError: (error: unknown) => void;
};

const profileName = (account: SavedAccount) => account.label.split("@")[0].trim() || account.label;

/** Compact account switcher shown next to linked accounts in Settings. */
const AccountManagement = ({
  user,
  savedAccounts,
  switchAccount,
  onManageProfiles,
  onSwitched,
  onSwitchError,
}: AccountManagementProps) => {
  const [selectedId, setSelectedId] = useState(user?.id ?? savedAccounts[0]?.userId ?? "");
  const profiles = savedAccounts.some(account => account.userId === user?.id) || !user
    ? savedAccounts
    : [{ userId: user.id, label: user.email || user.phone || "Current account", session: {} as SavedAccount["session"] }, ...savedAccounts];
  const selected = profiles.find(account => account.userId === selectedId) ?? profiles[0];
  const canSwitch = Boolean(selected && selected.userId !== user?.id);

  const handleSwitch = async () => {
    if (!selected || !canSwitch) return;
    try {
      await switchAccount(selected.userId);
      onSwitched(selected.label);
    } catch (error) {
      onSwitchError(error);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-red-300/15 bg-black/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_20px_rgba(255,0,51,.08)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
      <div className="relative flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-300/20 bg-red-500/10 text-red-200 shadow-[0_0_12px_rgba(255,0,51,.18)]">
          <Layers3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-100/90">Switch Account</p>
          <p className="mt-0.5 text-[10px] text-white/45">Manage profiles and jump between your spaces.</p>
        </div>
        {selected && <span className="mt-1 flex items-center gap-1 text-[9px] text-emerald-300"><Check className="h-3 w-3" /> Active</span>}
      </div>

      <div className="relative mt-3">
        <label htmlFor="primegram-profile-selector" className="mb-1.5 block text-[9px] font-medium uppercase tracking-[0.12em] text-white/45">Profile</label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-200/80" />
          <select
            id="primegram-profile-selector"
            value={selected?.userId ?? ""}
            onChange={event => setSelectedId(event.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-white/10 bg-white/[0.07] pl-8 pr-8 text-[11px] text-white outline-none transition hover:border-red-300/30 focus:border-red-300/50 focus:ring-1 focus:ring-red-300/20"
          >
            {!profiles.length && <option value="">No saved profiles</option>}
            {profiles.map(account => (
              <option key={account.userId} value={account.userId} className="bg-slate-950 text-white">
                @{profileName(account)}{account.userId === user?.id ? " · current" : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" />
        </div>
      </div>

      <div className="relative mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={handleSwitch} disabled={!canSwitch} className="rounded-lg bg-gradient-to-r from-red-500/90 to-rose-600/90 px-2 py-2 text-[10px] font-semibold text-white shadow-[0_0_14px_rgba(255,0,51,.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">Switch profile</button>
        <button type="button" onClick={onManageProfiles} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[10px] font-medium text-white/75 transition hover:border-cyan-200/30 hover:bg-white/[0.09] hover:text-white">Manage Profiles</button>
      </div>
    </div>
  );
};

export default AccountManagement;
