import Link from "next/link";
export default function NotFound() {
  return <div className="panel" style={{ marginTop: 18 }}><h1 style={{ fontSize: 24 }}>Nothing here</h1><p className="mute">That page or booking does not exist on this storefront.</p><Link className="btn" href="/">Back to the storefront</Link></div>;
}
