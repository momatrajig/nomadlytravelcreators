"use client";
import { useEffect } from "react";
import Link from "next/link";
import { House, RotateCw, TriangleAlert } from "lucide-react";
import { Ico } from "@/components/Icon";

/** Anything that breaks while a page renders lands here, inside the site frame, with a way forward. No payment is taken on a page that failed. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="auth">
      <div className="auth-card" role="alert">
        <span className="auth-ic warn"><Ico of={TriangleAlert} size={24} /></span>
        <h1>Something went wrong</h1>
        <p className="mute">This page did not load. Nothing was charged. Try again, it usually works on the second go.</p>
        <div className="auth-row">
          <button type="button" className="btn btn-brand" onClick={reset}><Ico of={RotateCw} size={17} />Try again</button>
          <Link className="btn" href="/"><Ico of={House} size={17} />Home</Link>
        </div>
        {error.digest && <p className="small mute">Error code {error.digest}, if you contact us.</p>}
      </div>
    </div>
  );
}
