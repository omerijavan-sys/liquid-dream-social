/**
 * Media stored on the old (locked) backend can't load yet. Rather than show dead images/videos, those items are hidden.
 * Each page load checks whether the old storage answers again; if it does, everything appears back automatically.
 * Items whose links were moved to the new storage are never affected.
 */
const OLD_HOST = "kfvoqwbfgptqrrkyhorj.supabase.co";
const PROBE = `https://${OLD_HOST}/storage/v1/object/public/media/8b4457c1-a6fc-455e-8941-57054b216778/cover_1795463319487.jpg`;

export const isOldMedia = (url?: string | null) => !!url && url.includes(OLD_HOST);

let okState: boolean | null = null;
let probing: Promise<boolean> | null = null;

/** Resolves true when the old storage is reachable again. Re-checked at most once every 5 minutes. */
export function oldMediaWorks(): Promise<boolean> {
  if (probing) return probing;
  probing = new Promise<boolean>((resolve) => {
    const img = new Image();
    const done = (v: boolean) => { okState = v; resolve(v); setTimeout(() => { probing = null; }, 5 * 60_000); };
    const t = setTimeout(() => done(false), 5000);
    img.onload = () => { clearTimeout(t); done(true); };
    img.onerror = () => { clearTimeout(t); done(false); };
    img.src = `${PROBE}?probe=${Date.now()}`;
  });
  return probing;
}
export const oldMediaKnownWorking = () => okState === true;

/** Drops rows whose media can't load. `urlOf` picks the media link(s) from a row. */
export async function dropDeadMedia<T>(rows: T[], urlOf: (r: T) => (string | null | undefined)[]): Promise<T[]> {
  if (!rows.some((r) => urlOf(r).some(isOldMedia))) return rows;
  if (await oldMediaWorks()) return rows;
  return rows.filter((r) => !urlOf(r).some(isOldMedia));
}
