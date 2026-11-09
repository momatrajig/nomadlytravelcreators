import { db } from "@/lib/db";
import { requireStorefront } from "@/lib/tenant";
import { photoThumb } from "@/lib/media/photo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Photo credits" };

/** Every photo with its author and licence, as the Creative Commons licences require. Destination photos are Unsplash. */
export default async function Credits() {
  const sf = await requireStorefront();
  const pins = await db().pinnedHotels(sf.id);
  return (
    <article className="credits">
      <h1>Photo credits</h1>
      <p>Hotel photos are from Wikimedia Commons, used under the licence named beside each one. Destination photos are from Unsplash, under the Unsplash License.</p>
      {pins.filter((p) => p.images.some((i) => i.credit)).map((p) => (
        <section key={p.ebcId}>
          <h2>{p.name}</h2>
          <ul role="list">
            {p.images.map((i) => (
              <li key={i.url}><img src={photoThumb(i.url)} alt="" loading="lazy" /><span>{i.credit}, {i.license}{i.source && <>, <a href={i.source} target="_blank" rel="noreferrer">file page</a></>}</span></li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
