import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

/** Android hardware back: close overlays first, then go to the previous screen, and only exit from the home screen. */
const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener("backButton", () => {
      // 1. custom overlays (music hub, in-app browser) answer to this event
      const ev = new CustomEvent("prime:back", { detail: { handled: false } });
      window.dispatchEvent(ev);
      if (ev.detail.handled) return;
      // 2. open dialogs/sheets (Radix) close on Escape
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        return;
      }
      // 3. previous screen, otherwise home, otherwise leave the app
      if (location.pathname !== "/" && location.pathname !== "/auth" && location.pathname !== "/welcome") {
        if (window.history.length > 1) navigate(-1); else navigate("/", { replace: true });
        return;
      }
      void CapApp.minimizeApp();
    });
    return () => { void h.then(x => x.remove()); };
  }, [navigate, location.pathname]);
  return null;
};
export default BackButtonHandler;
