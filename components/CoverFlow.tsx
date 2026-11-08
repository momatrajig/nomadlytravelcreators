"use client";
import { useEffect, useRef } from "react";
import { mount, type FlowHandle, type FlowOptions } from "@/lib/flow/engine";

/** React wrapper over the vanilla engine. Re-mounts when items change; cleans up every listener. */
export default function CoverFlow<T>(props: FlowOptions<T> & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<FlowHandle | null>(null);
  const { className, ...opts } = props;
  const key = JSON.stringify(opts.items.map((it) => (it as { id?: unknown; ebcId?: unknown }).ebcId ?? (it as { id?: unknown }).id ?? it));
  useEffect(() => {
    if (!ref.current) return;
    handle.current = mount(ref.current, opts);
    return () => { handle.current?.destroy(); handle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={ref} className={className} />;
}
