import { dashContext } from "@/lib/dashboard/context";
import { termsOf } from "@/lib/pricing/engine";
import SwitchTool from "@/components/dash/SwitchTool";

export const dynamic = "force-dynamic";

export default async function Switch() {
  const c = (await dashContext())!;
  const terms = termsOf(c.sf);
  return (
    <>
      <div className="dash-head">
        <div><h1>Switch from Stay22</h1><p>See what your hotel traffic earns here, from your own Stay22 numbers. Takes a minute.</p></div>
      </div>
      <SwitchTool share={terms.hotelShare} sharePct={Math.round(terms.hotelShare * 100)} signedIn={!c.demo} />
    </>
  );
}
