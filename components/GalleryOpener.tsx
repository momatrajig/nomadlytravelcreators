"use client";
import { openSheet } from "@/lib/flow/engine";
export default function GalleryOpener({ images, name }: { images: string[]; name: string }) {
  const open = () => openSheet({ title: name, images, alts: images.map((_, i) => `${name}, photo ${i + 1}`), body: `<h3>${name}</h3>` });
  const show = images.slice(0, 4);
  return (
    <div className="gallery">
      {show.map((src, i) => <button key={src} type="button" onClick={open} aria-label={`Open photo ${i + 1} of ${images.length}`}><img src={src} alt="" loading={i ? "lazy" : "eager"} /></button>)}
    </div>
  );
}
