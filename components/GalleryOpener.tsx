"use client";
import { openGallery } from "@/lib/flow/gallery";
import { photoSet, photoSrc, type Photo } from "@/lib/media/photo";

/** Hotel page mosaic: one large photo and up to four beside it. Any photo opens the full screen viewer at that photo. */
export default function GalleryOpener({ photos, name }: { photos: Photo[]; name: string }) {
  if (!photos.length) return null;
  const open = (start: number) => openGallery({ title: name, photos, start });
  const show = photos.slice(0, 5);
  return (
    <div className={`mosaic n${show.length}`}>
      {show.map((p, i) => (
        <button key={p.url} type="button" onClick={() => open(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}>
          <img src={photoSrc(p.url, i ? 960 : 1920, p.w)} srcSet={photoSet(p.url, p.w)} sizes={i ? "(max-width: 760px) 50vw, 25vw" : "(max-width: 760px) 100vw, 60vw"} alt={i ? "" : name} loading={i ? "lazy" : "eager"} fetchPriority={i ? "auto" : "high"} />
        </button>
      ))}
      <button type="button" className="mosaic-all" onClick={() => open(0)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
        All {photos.length} photos
      </button>
    </div>
  );
}
