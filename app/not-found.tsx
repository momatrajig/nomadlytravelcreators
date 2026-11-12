import Link from "next/link";
import { BedDouble, MapPinOff, Ticket } from "lucide-react";
import { Ico } from "@/components/Icon";

export default function NotFound() {
  return (
    <div className="auth">
      <div className="auth-card">
        <span className="auth-ic"><Ico of={MapPinOff} size={24} /></span>
        <h1>This page is not here</h1>
        <p className="mute">The link may be old or mistyped. Your bookings are safe.</p>
        <div className="auth-row">
          <Link className="btn btn-brand" href="/stays"><Ico of={BedDouble} size={17} />Browse hotels</Link>
          <Link className="btn" href="/booking"><Ico of={Ticket} size={17} />Find my booking</Link>
        </div>
      </div>
    </div>
  );
}
