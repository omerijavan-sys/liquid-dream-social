import { Capacitor, registerPlugin } from "@capacitor/core";

export interface GalleryItem { uri: string; type: "image" | "video"; name: string; mime: string; date: number; size: number; thumb: string }
interface GalleryPlugin {
  ensurePermission(): Promise<{ granted: boolean }>;
  list(o: { type: "all" | "image" | "video"; limit: number; offset: number }): Promise<{ items: GalleryItem[] }>;
  copy(o: { uri: string; name: string }): Promise<{ path: string; size: number }>;
}
export const Gallery = registerPlugin<GalleryPlugin>("Gallery");
export const galleryAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("Gallery");

/** Turn a chosen gallery item into a normal File the existing upload code can use. */
export async function galleryItemToFile(it: GalleryItem): Promise<File> {
  const { path } = await Gallery.copy({ uri: it.uri, name: it.name || (it.type === "video" ? "video.mp4" : "photo.jpg") });
  const res = await fetch(Capacitor.convertFileSrc(path));
  const blob = await res.blob();
  return new File([blob], it.name || (it.type === "video" ? "video.mp4" : "photo.jpg"), { type: it.mime || blob.type, lastModified: it.date * 1000 });
}
