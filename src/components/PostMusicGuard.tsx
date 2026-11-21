import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getMusicState, stopMusic } from "@/services/MusicEngine";

/** Post and clip-preview songs never follow you to another page. */
const PostMusicGuard = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const k = getMusicState().track?.key ?? "";
    if (k.startsWith("post|") || k.startsWith("clip|")) stopMusic();
  }, [pathname]);
  return null;
};
export default PostMusicGuard;
