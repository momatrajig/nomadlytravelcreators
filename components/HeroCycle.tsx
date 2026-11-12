"use client";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { photoSet, photoSrc } from "@/lib/media/photo";

/** The one moving thing on the home page: the places behind the storefront, crossfading slowly. Stops for reduced motion and in background tabs. */
export default function HeroCycle({ slides }: { slides: Array<{ url: string; place: string }> }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!document.hidden) setI((k) => (k + 1) % slides.length); }, 7000);
    return () => clearInterval(t);
  }, [slides.length]);
  return (
    <div className="hero-media" aria-hidden="true">
      {slides.map((s, k) => (
        <img key={s.url} src={photoSrc(s.url, 1600)} srcSet={photoSet(s.url)} sizes="100vw" alt="" className={k === i ? "on" : ""} fetchPriority={k === 0 ? "high" : "low"} loading={k === 0 ? "eager" : "lazy"} />
      ))}
      {/* each place name fades with its own photo, so the caption never names the wrong city mid crossfade */}
      {slides.map((s, k) => <span key={s.place} className={`hero-place${k === i ? " on" : ""}`}><MapPin size={13} aria-hidden="true" />{s.place}</span>)}
    </div>
  );
}
