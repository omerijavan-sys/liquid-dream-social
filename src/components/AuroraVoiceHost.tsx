import { lazy, Suspense, useEffect, useState } from "react";
import AuroraWake from "./AuroraWake";

const SiriAssistant = lazy(() => import("./SiriAssistant"));

/** App-wide home of Aurora's hands-free voice mode: opens from the chat's Voice mode button or the "Hey Aurora" wake phrase. */
const AuroraVoiceHost = () => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const on = () => { setLoaded(true); setOpen(true); };
    window.addEventListener("aurora:voice", on);
    return () => window.removeEventListener("aurora:voice", on);
  }, []);
  return (
    <>
      <AuroraWake />
      {loaded && (
        <Suspense fallback={null}>
          <SiriAssistant open={open} onClose={() => setOpen(false)} onOpenTextChat={() => window.dispatchEvent(new Event("prime:openOrb"))} />
        </Suspense>
      )}
    </>
  );
};
export default AuroraVoiceHost;
