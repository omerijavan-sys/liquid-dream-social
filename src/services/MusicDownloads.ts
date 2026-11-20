import { useEffect, useState } from "react";
import { findFullStream } from "./FullTrack";

/** Songs saved inside the app only (IndexedDB) so they play without internet. */
const DB = "primegram-music";
const ST = "songs";
export interface DownloadedSong { key: string; id: string; title: string; artist: string; artwork: string | null; artData: string | null; blob: Blob; size: number; savedAt: number }
export type DlItem = { id: string; title: string; artist: string; artwork: string | null };

const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore(ST, { keyPath: "key" }); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const run = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const tx = db.transaction(ST, mode); const rq = f(tx.objectStore(ST));
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    tx.oncomplete = () => db.close();
  });
};

const subs = new Set<() => void>();
const changed = () => subs.forEach(f => f());
export const dlKey = (id: string) => `sp_${id}`;

export const listDownloads = async (): Promise<DownloadedSong[]> => ((await run("readonly", s => s.getAll())) as DownloadedSong[]).sort((a, b) => b.savedAt - a.savedAt);
export const removeDownload = async (key: string) => { await run("readwrite", s => s.delete(key)); urls.delete(key); changed(); };

const urls = new Map<string, string>();
/** A playable local URL for a saved song, or null if it isn't downloaded. */
export async function getDownloadedUrl(key: string): Promise<string | null> {
  if (urls.has(key)) return urls.get(key)!;
  try {
    const rec = (await run("readonly", s => s.get(key))) as DownloadedSong | undefined;
    if (!rec) return null;
    const u = URL.createObjectURL(rec.blob); urls.set(key, u); return u;
  } catch { return null; }
}

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.onerror = () => rej(f.error); f.readAsDataURL(b); });

/** Downloads the full song into the app. "nosource" = no downloadable full version exists for it. */
export async function downloadSong(it: DlItem): Promise<"ok" | "nosource" | "fail"> {
  try {
    const url = await findFullStream(it.title, it.artist);
    if (!url) return "nosource";
    const r = await fetch(url);
    if (!r.ok) return "fail";
    const blob = await r.blob();
    if (blob.size < 100_000) return "fail";
    let artData: string | null = null;
    if (it.artwork) { try { artData = await toDataUrl(await (await fetch(it.artwork)).blob()); } catch { /* artwork is optional */ } }
    const rec: DownloadedSong = { key: dlKey(it.id), id: it.id, title: it.title, artist: it.artist, artwork: it.artwork, artData, blob, size: blob.size, savedAt: Date.now() };
    await run("readwrite", s => s.put(rec));
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
    changed();
    return "ok";
  } catch { return "fail"; }
}

/** Live list of saved songs. */
export function useDownloads() {
  const [list, setList] = useState<DownloadedSong[]>([]);
  useEffect(() => {
    let dead = false;
    const load = () => { void listDownloads().then(l => { if (!dead) setList(l); }).catch(() => undefined); };
    load(); subs.add(load);
    return () => { dead = true; subs.delete(load); };
  }, []);
  return list;
}
