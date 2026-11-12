import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Home, Search, PlusSquare, User, Film } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: PlusSquare, label: "Create", path: "/create" },
  { icon: Film, label: "Reels", path: "/reels" },
  { icon: User, label: "Profile", path: "/profile" },
];

const GlassTabBar = ({ goldStyle = false }: { goldStyle?: boolean }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { scrollY } = useScroll();
  const navigate = useNavigate();
  const location = useLocation();

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.path === location.pathname));

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = scrollY.getPrevious() ?? 0;
    setCollapsed(latest > 100 && latest > prev);
  });

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center safe-area-bottom pb-2"
      animate={collapsed ? { y: 20, opacity: 0.8 } : { y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <motion.nav
        className={`flex items-center gap-0.5 px-1 ${goldStyle ? "border border-amber-200/30 bg-[#090b12]/90 shadow-[0_0_26px_rgba(234,179,8,.12)] backdrop-blur-2xl" : "liquid-glass-elevated"}`}
        animate={collapsed ? {
          borderRadius: "2rem", paddingLeft: "0.75rem", paddingRight: "0.75rem",
          paddingTop: "0.5rem", paddingBottom: "0.5rem",
        } : {
          borderRadius: "1.75rem", paddingLeft: "0.75rem", paddingRight: "0.75rem",
          paddingTop: "0.625rem", paddingBottom: "0.625rem",
        }}
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        style={{ width: collapsed ? "auto" : "calc(100% - 1rem)", maxWidth: collapsed ? "320px" : "460px" }}
      >
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = i === activeIndex;
          return (
            <motion.button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              title={tab.label}
              className={`depth-press relative flex min-w-0 flex-1 items-center justify-center rounded-2xl transition-colors ${isActive ? goldStyle ? "text-amber-200" : "text-primary" : "text-muted-foreground"}`}
              animate={collapsed ? { width: 40, height: 40, flex: "0 0 40px" } : { width: "auto", height: 48, flex: "1 1 0%" }}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className={`absolute inset-0 rounded-2xl ${goldStyle ? "border border-amber-200/20 bg-amber-300/[0.08]" : "liquid-glass-subtle"}`}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="w-5 h-5 relative z-10" strokeWidth={isActive ? 2.5 : 1.5} />
            </motion.button>
          );
        })}
      </motion.nav>
    </motion.div>
  );
};

export default GlassTabBar;
