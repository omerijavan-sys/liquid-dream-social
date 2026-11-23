import { forwardRef, useEffect, useState } from "react";
import { Flame, Music2 } from "lucide-react";
import QRCode from "qrcode";
import { glow, rgb } from "../shared/ui";
import { inviteLink } from "../referrals/referral";
import AvatarRing from "./AvatarRing";
import { type Aesthetics, FONTS, THEMES } from "./aesthetics";

export interface VibeProfile { name: string; username: string | null; avatarDataUrl: string | null; bio: string | null; streak: number; code: string }

/** The screenshot-ready card. Fixed 340x560 so exports look identical on every phone. */
const VibeCard = forwardRef<HTMLDivElement, { p: VibeProfile; a: Aesthetics }>(({ p, a }, ref) => {
  const [qr, setQr] = useState<string>("");
  useEffect(() => { void QRCode.toDataURL(inviteLink(p.code), { margin: 1, width: 220, color: { dark: "#09090B", light: "#ffffff" } }).then(setQr).catch(() => setQr("")); }, [p.code]);
  const font = FONTS[a.font].css;
  return (
    <div ref={ref} style={{ width: 340, height: 560, background: THEMES[a.theme].bg, color: "#fff", fontFamily: font, position: "relative", overflow: "hidden", borderRadius: 28 }}>
      <div style={{ position: "absolute", width: 300, height: 300, left: -60, top: -80, borderRadius: "50%", background: `radial-gradient(circle,rgba(${rgb(a.accent)},.55),transparent 70%)` }} />
      <div style={{ position: "absolute", width: 260, height: 260, right: -80, bottom: 60, borderRadius: "50%", background: `radial-gradient(circle,rgba(${rgb(a.accent)},.3),transparent 70%)` }} />
      <div style={{ position: "absolute", inset: 18, borderRadius: 24, background: `rgba(255,255,255,${a.glass_opacity / 100})`, border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: glow(a.accent, 0.25, 40), display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 20px 16px" }}>
        <AvatarRing ring={a.ring} accent={a.accent} size={92}>
          {p.avatarDataUrl ? <img src={p.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700 }}>{p.name[0]?.toUpperCase()}</div>}
        </AvatarRing>
        <p style={{ marginTop: 12, fontSize: 22, fontWeight: 800, textShadow: glow(a.accent, 0.8, 14) }}>{p.name}</p>
        {p.username && <p style={{ fontSize: 13, opacity: 0.65 }}>@{p.username}</p>}
        {p.streak > 0 && <span style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.12)", color: a.accent, fontSize: 12, fontWeight: 700, boxShadow: glow(a.accent, 0.5, 10) }}><Flame size={13} />{p.streak}-day streak</span>}
        {p.bio && <p style={{ marginTop: 12, textAlign: "center", fontSize: 14, lineHeight: 1.35, opacity: 0.9, maxHeight: 76, overflow: "hidden" }}>{p.bio}</p>}
        {a.status_text && <p style={{ marginTop: 10, fontSize: 12, padding: "5px 12px", borderRadius: 999, background: `rgba(${rgb(a.accent)},.18)`, color: a.accent }}>{a.status_text}</p>}
        {a.pinned_title && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 14, background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.1)", maxWidth: "100%" }}>
            <Music2 size={16} color={a.accent} /><div style={{ minWidth: 0 }}><p style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{a.pinned_title}</p>{a.pinned_artist && <p style={{ fontSize: 10, opacity: 0.6 }}>{a.pinned_artist}</p>}</div>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.1)" }}>
          {qr && <img src={qr} alt="Invite QR" style={{ width: 84, height: 84, borderRadius: 8, background: "#fff" }} />}
          <div><p style={{ fontSize: 13, fontWeight: 800 }}>Join me on Primegram</p><p style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>Scan or visit<br />primegramx.co.ke/invite/{p.code}</p></div>
        </div>
        <p style={{ marginTop: 10, fontSize: 9, letterSpacing: 2, opacity: 0.45, textTransform: "uppercase" }}>Primegram Extreme · primegramx.co.ke</p>
      </div>
    </div>
  );
});
VibeCard.displayName = "VibeCard";
export default VibeCard;
