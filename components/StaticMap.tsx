"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The hotel on a calm, modern street map (OpenFreeMap vector tiles: no key, free for commercial use) with a pin in
 * the creator's colour. The map library loads after the page has painted. Map credits are required by
 * the OpenStreetMap licence; they sit behind a small "i" like on the big booking sites instead of across the map.
 * Without WebGL the reader gets a plain link to the full map.
 */
export default function HotelMap({ lat, lng, name, labels, color = "#14161a" }: { lat: number; lng: number; name: string; labels?: [string, string]; color?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "failed">("idle");
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    const start = async () => {
      try {
        const ml = (await import("maplibre-gl")).default;
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled) return;
        const m = new ml.Map({
          container: el, style: "https://tiles.openfreemap.org/styles/positron", center: [lng, lat], zoom: 13.4,
          attributionControl: false, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false,
        });
        m.addControl(new ml.AttributionControl({ compact: true }), "bottom-right");
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        m.touchZoomRotate.disableRotation();
        const pin = document.createElement("div");
        pin.className = "map-pin";
        pin.style.setProperty("--pin", color);
        pin.setAttribute("aria-label", name);
        new ml.Marker({ element: pin, anchor: "bottom" }).setLngLat([lng, lat]).addTo(m);
        setState("ready");
        m.on("load", () => el.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
        m.on("error", () => setState((s) => (s === "ready" ? s : "failed")));
        map = m;
      } catch (e) { console.warn("map", e); setState("failed"); }
    };
    // after the page has painted: the map is its own download, so it never holds up the page
    const go = () => { void start(); };
    const timer = document.readyState === "complete" ? window.setTimeout(go, 50) : null;
    if (!timer) window.addEventListener("load", go, { once: true });
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); window.removeEventListener("load", go); map?.remove(); };
  }, [lat, lng, name, color]);
  const full = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  return (
    <figure className="map">
      <div ref={box} className={`map-canvas ${state}`} role="img" aria-label={labels?.[0] ?? `Map of ${name}`}>
        {state === "failed" && <a className="map-fallback" href={full} target="_blank" rel="noreferrer">{labels?.[1] ?? "Open the full map"}</a>}
      </div>
      <figcaption><a href={full} target="_blank" rel="noreferrer">{labels?.[1] ?? "Open the full map"} ↗</a></figcaption>
    </figure>
  );
}
