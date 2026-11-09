"use client";
import { openSheet } from "@/lib/flow/engine";
export default function GalleryOpener({ images, name }: { images: string[]; name: string }) {
  const open = () => openSheet({ title: name, images, alts: images.map((_, i) => `${name}, photo ${i + 1}`), body: `<h3>${name}</h3>` });
  const show = images.slice(0, 4);
  return (
    <div className="gallery" style={{ position: "relative" }}>
      {show.map((src, i) => <button key={src} type="button" onClick={open} aria-label={`Open photo ${i + 1} of ${images.length}`}><img src={src} alt="" loading={i ? "lazy" : "eager"} /></button>)}
      <button type="button" onClick={open} className="btn" style={{ position: "absolute", right: 12, bottom: 12, minHeight: 36, padding: "6px 12px", fontSize: 13 }}>All {images.length} photos</button>
    </div>
  );
}
