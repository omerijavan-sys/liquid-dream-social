import QRCode from "qrcode";
import { FONTS, THEMES, type Aesthetics } from "../vibe/aesthetics";
import { rgb } from "./ui";

/**
 * Draws share cards straight onto a <canvas>. Capturing the DOM (SVG foreignObject) is what fails in some Android
 * WebViews, so the images we hand to people are drawn directly instead. 340x560 design units at 2x.
 */
const W = 340, H = 560, S = 2;

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((res) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});
const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};
const blob = (c: CanvasRenderingContext2D, cx: number, cy: number, r: number, rgbStr: string, a: number) => {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${rgbStr},${a})`); g.addColorStop(0.7, `rgba(${rgbStr},0)`);
  c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
};
const wrap = (c: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) => {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, "…");
  return lines;
};
const fit = (c: CanvasRenderingContext2D, text: string, maxW: number) => {
  if (c.measureText(text).width <= maxW) return text;
  let t = text; while (t.length > 1 && c.measureText(t + "…").width > maxW) t = t.slice(0, -1); return t + "…";
};
const pill = (c: CanvasRenderingContext2D, text: string, cx: number, y: number, h: number, fill: string, color: string, stroke?: string) => {
  const w = c.measureText(text).width + 22; rr(c, cx - w / 2, y, w, h, h / 2); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  c.fillStyle = color; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, cx, y + h / 2 + 0.5);
};
const themeBg = (c: CanvasRenderingContext2D, key: keyof typeof THEMES) => {
  const stops: Record<string, [string, number][]> = {
    obsidian: [["#09090B", 0]], midnight: [["#0b1020", 0], ["#111a3a", 1]], sunset: [["#1a0b14", 0], ["#3a1226", 0.6], ["#4a1d12", 1]], obsidian_gold: [["#0c0a05", 0], ["#1c1608", 0.55], ["#2a1f08", 1]],
  };
  const st = stops[key] ?? stops.obsidian;
  if (st.length === 1) { c.fillStyle = st[0][0]; } else { const g = c.createLinearGradient(W * 0.3, 0, W * 0.7, H); st.forEach(([col, p]) => g.addColorStop(p, col)); c.fillStyle = g; }
  c.fillRect(0, 0, W, H);
};
const newCanvas = () => {
  const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
  const c = cv.getContext("2d"); if (!c) throw new Error("canvas not supported");
  c.scale(S, S); return { cv, c };
};
const done = (cv: HTMLCanvasElement) => cv.toDataURL("image/png");

export interface VibeData { name: string; username: string | null; avatarDataUrl: string | null; bio: string | null; streak: number; code: string }

export const drawVibeCard = async (p: VibeData, a: Aesthetics, link: string): Promise<string> => {
  const { cv, c } = newCanvas();
  const font = FONTS[a.font].css; const acc = rgb(a.accent);
  c.save(); rr(c, 0, 0, W, H, 28); c.clip();
  themeBg(c, a.theme);
  blob(c, 90, 70, 150, acc, 0.55); blob(c, 270, 410, 130, acc, 0.3);
  rr(c, 18, 18, W - 36, H - 36, 24); c.fillStyle = `rgba(255,255,255,${a.glass_opacity / 100})`; c.fill(); c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 1; c.stroke();

  const cx = W / 2; let y = 44;
  // avatar
  const [avatar, qrImg] = await Promise.all([p.avatarDataUrl ? loadImg(p.avatarDataUrl) : Promise.resolve(null), QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: "#09090B", light: "#ffffff" } }).then(loadImg).catch(() => null)]);
  const R = 46;
  c.beginPath(); c.arc(cx, y + R, R + 5, 0, Math.PI * 2); c.strokeStyle = a.ring === "none" ? "rgba(255,255,255,.25)" : a.accent; c.lineWidth = a.ring === "none" ? 1.5 : 3; c.stroke();
  c.save(); c.beginPath(); c.arc(cx, y + R, R, 0, Math.PI * 2); c.clip();
  if (avatar) { const s = Math.max(R * 2 / avatar.width, R * 2 / avatar.height); const w = avatar.width * s, h = avatar.height * s; c.drawImage(avatar, cx - w / 2, y + R - h / 2, w, h); }
  else { c.fillStyle = a.accent; c.fillRect(cx - R, y, R * 2, R * 2); c.fillStyle = "#09090B"; c.font = `800 38px ${font}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText((p.name[0] || "P").toUpperCase(), cx, y + R + 2); }
  c.restore();
  y += R * 2 + 24;

  c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillStyle = "#fff";
  c.font = `800 22px ${font}`; c.shadowColor = a.accent; c.shadowBlur = 12; c.fillText(fit(c, p.name, 270), cx, y); c.shadowBlur = 0; y += 20;
  if (p.username) { c.font = `400 13px ${font}`; c.fillStyle = "rgba(255,255,255,.65)"; c.fillText("@" + p.username, cx, y); y += 10; }
  if (p.streak > 0) { y += 6; c.font = `700 12px ${font}`; pill(c, `🔥 ${p.streak}-day streak`, cx, y, 24, "rgba(0,0,0,.4)", "#fbbf24", "rgba(255,255,255,.12)"); y += 24; }
  if (p.bio) { y += 22; c.font = `400 14px ${font}`; c.fillStyle = "rgba(255,255,255,.9)"; c.textAlign = "center"; for (const l of wrap(c, p.bio, 250, 3)) { c.fillText(l, cx, y); y += 19; } y -= 4; }
  if (a.status_text) { y += 14; c.font = `400 12px ${font}`; pill(c, fit(c, a.status_text, 240), cx, y, 26, `rgba(${acc},.18)`, a.accent); y += 26; }
  if (a.pinned_title) {
    y += 12; const bw = 250, bh = 44; rr(c, cx - bw / 2, y, bw, bh, 14); c.fillStyle = "rgba(0,0,0,.35)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.1)"; c.stroke();
    c.textAlign = "left"; c.fillStyle = "#fff"; c.font = `700 12px ${font}`; c.fillText("♪ " + fit(c, a.pinned_title, bw - 28), cx - bw / 2 + 14, y + 19);
    if (a.pinned_artist) { c.font = `400 10px ${font}`; c.fillStyle = "rgba(255,255,255,.6)"; c.fillText(fit(c, a.pinned_artist, bw - 28), cx - bw / 2 + 14, y + 34); }
  }

  // footer: QR + invite text
  const fy = H - 18 - 20 - 14 - 104, fx = 30, fw = W - 60;
  rr(c, fx, fy, fw, 104, 16); c.fillStyle = "rgba(0,0,0,.4)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.1)"; c.stroke();
  if (qrImg) { rr(c, fx + 10, fy + 10, 84, 84, 8); c.fillStyle = "#fff"; c.fill(); c.drawImage(qrImg, fx + 10, fy + 10, 84, 84); }
  c.textAlign = "left"; c.fillStyle = "#fff"; c.font = `800 13px ${font}`; c.fillText("Join me on Primegram", fx + 106, fy + 36);
  c.font = `400 10px ${font}`; c.fillStyle = "rgba(255,255,255,.6)"; c.fillText("Scan or visit", fx + 106, fy + 54); c.fillText(fit(c, link.replace("https://", ""), fw - 118), fx + 106, fy + 68);
  c.textAlign = "center"; c.font = `400 9px ${font}`; c.fillStyle = "rgba(255,255,255,.45)"; c.fillText("PRIMEGRAM EXTREME · PRIMEGRAMX.CO.KE", cx, H - 28);
  c.restore();
  return done(cv);
};

export interface WrappedData { posts: number; reels: number; drops: number; likes: number; comments: number; followers: number; views: number; top_caption: string | null; top_likes: number | null }

export const drawWrappedCard = async (w: WrappedData, name: string, streak: number, link: string): Promise<string> => {
  const { cv, c } = newCanvas();
  c.save(); rr(c, 0, 0, W, H, 28); c.clip();
  const g = c.createLinearGradient(0, 0, W * 0.6, H); g.addColorStop(0, "#1a0b3b"); g.addColorStop(0.6, "#09090B"); g.addColorStop(1, "#12082a"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  blob(c, 80, 60, 170, "168,85,247", 0.6); blob(c, 270, 440, 150, "236,72,153", 0.4);
  rr(c, 18, 18, W - 36, H - 36, 24); c.fillStyle = "rgba(255,255,255,.07)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 1; c.stroke();
  const F = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"; const x = 36; let y = 58;
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.font = `400 10px ${F}`; c.fillStyle = "rgba(255,255,255,.6)"; c.fillText("MY WEEK ON PRIMEGRAM", x, y);
  y += 34; c.font = `800 26px ${F}`; c.fillStyle = "#fff"; c.fillText(fit(c, name, W - 72), x, y);
  if (streak > 0) { y += 14; c.font = `700 12px ${F}`; const t = `🔥 ${streak}-day streak`; const tw = c.measureText(t).width + 22; pill(c, t, x + tw / 2, y, 24, "rgba(0,0,0,.4)", "#fbbf24", "rgba(255,255,255,.12)"); y += 24; }
  y += 18;
  const bw = (W - 72 - 8) / 2, bh = 64;
  const stat = (sx: number, sy: number, n: number, label: string, col: string) => {
    rr(c, sx, sy, bw, bh, 16); c.fillStyle = "rgba(0,0,0,.35)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.1)"; c.stroke();
    c.textAlign = "center"; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.font = `800 26px ${F}`; c.fillText(n.toLocaleString(), sx + bw / 2, sy + 30); c.shadowBlur = 0;
    c.fillStyle = "rgba(255,255,255,.65)"; c.font = `400 10px ${F}`; c.fillText(label.toUpperCase(), sx + bw / 2, sy + 50);
  };
  stat(x, y, w.likes, "Likes", "#f472b6"); stat(x + bw + 8, y, w.followers, "New fans", "#a78bfa"); y += bh + 8;
  stat(x, y, w.views, "Views", "#38bdf8"); stat(x + bw + 8, y, w.comments, "Comments", "#34d399"); y += bh + 28;
  const made = w.posts + w.reels + w.drops;
  c.textAlign = "left"; c.fillStyle = "rgba(255,255,255,.85)"; c.font = `400 13px ${F}`; c.fillText(made > 0 ? `${made} thing${made === 1 ? "" : "s"} shared this week` : "A quiet week. Time to post!", x, y); y += 14;
  if (w.top_caption && (w.top_likes ?? 0) > 0) {
    const bw2 = W - 72, bh2 = 70; rr(c, x, y, bw2, bh2, 14); c.fillStyle = "rgba(0,0,0,.35)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.1)"; c.stroke();
    c.fillStyle = "rgba(255,255,255,.55)"; c.font = `400 9px ${F}`; c.fillText(`TOP POST · ${w.top_likes} LIKES`, x + 12, y + 20);
    c.fillStyle = "#fff"; c.font = `400 13px ${F}`; wrap(c, w.top_caption, bw2 - 24, 2).forEach((l, i) => c.fillText(l, x + 12, y + 40 + i * 17));
  }
  c.fillStyle = "#fff"; c.font = `800 13px ${F}`; c.fillText("Join me on Primegram", x, H - 56);
  c.fillStyle = "rgba(255,255,255,.6)"; c.font = `400 10px ${F}`; c.fillText(fit(c, link.replace("https://", ""), W - 72), x, H - 40);
  c.restore();
  return done(cv);
};
