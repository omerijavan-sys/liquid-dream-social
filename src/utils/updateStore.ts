import { useSyncExternalStore } from "react";

/** web = a newer web build exists (reload fixes it); native = this installed app is too old for the site (needs the new app). */
export type AppUpdate = { kind: "web" | "native"; url?: string } | null;
let current: AppUpdate = null;
const subs = new Set<() => void>();
export const setAppUpdate = (u: AppUpdate) => { current = u; subs.forEach((s) => s()); };
export const useAppUpdate = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => current);
/** Asks the update popup to open (used by the Settings Upgrade button). */
export const openUpdatePrompt = () => window.dispatchEvent(new Event("prime:open-update"));
