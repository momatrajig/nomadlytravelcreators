"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page's live numbers every `seconds` while the tab is visible, so a click or booking shows without reloading. */
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [on, seconds, router]);
  return (
    <button type="button" className="live-toggle" aria-pressed={on} onClick={() => setOn((v) => !v)}>
      <span className={`live-dot${on ? " on" : ""}`} aria-hidden="true" />{on ? `Live, updates every ${seconds} s` : "Paused"}
    </button>
  );
}
