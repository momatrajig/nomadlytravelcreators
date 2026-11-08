import { redirect } from "next/navigation";

export default function Lookup({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  async function find(fd: FormData) {
    "use server";
    const ref = String(fd.get("reference") ?? "").trim(), email = String(fd.get("email") ?? "").trim().toLowerCase();
    redirect(`/booking/${encodeURIComponent(ref)}?email=${encodeURIComponent(email)}`);
  }
  void searchParams;
  return (
    <div className="panel" style={{ marginTop: 18, maxWidth: 520 }}>
      <h1 style={{ fontSize: 26 }}>Your booking</h1>
      <p className="mute" style={{ margin: "6px 0 14px" }}>Enter the reference from your confirmation email and the email you booked with.</p>
      <form action={find} style={{ display: "grid", gap: 12 }}>
        <div className="field"><label htmlFor="r">Reference</label><input id="r" name="reference" placeholder="NMD 231821" required /></div>
        <div className="field"><label htmlFor="e">Email</label><input id="e" name="email" type="email" required /></div>
        <button className="btn btn-brand" type="submit">Find my booking</button>
      </form>
    </div>
  );
}
