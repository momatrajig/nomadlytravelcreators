"use client";
import { LayoutGrid } from "lucide-react";
import { Ico } from "@/components/Icon";
import { openGallery } from "@/lib/flow/gallery";
import { dict, type Lang } from "@/lib/i18n";
import { photoSet, photoSrc, type Photo } from "@/lib/media/photo";

/** Hotel page mosaic: one large photo and up to four beside it. Any photo opens the full screen viewer at that photo. */
export default function GalleryOpener({ photos, name, lang = "en" }: { photos: Photo[]; name: string; lang?: Lang }) {
  const t = dict(lang);
  if (!photos.length) return null;
  const open = (start: number) => openGallery({ title: name, photos, start });
  const show = photos.slice(0, 5);
  return (
    <div className={`mosaic n${show.length}`}>
      {show.map((p, i) => (
        <button key={p.url} type="button" onClick={() => open(i)} aria-label={t.openPhoto(i + 1, photos.length)}>
          <img src={photoSrc(p.url, i ? 960 : 1920, p.w)} srcSet={photoSet(p.url, p.w)} sizes={i ? "(max-width: 760px) 50vw, 25vw" : "(max-width: 760px) 100vw, 60vw"} alt={i ? "" : name} loading={i ? "lazy" : "eager"} fetchPriority={i ? "auto" : "high"} />
        </button>
      ))}
      <button type="button" className="mosaic-all" onClick={() => open(0)}>
        <Ico of={LayoutGrid} size={16} />
        {t.allPhotos(photos.length)}
      </button>
    </div>
  );
}
