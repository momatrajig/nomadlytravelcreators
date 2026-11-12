/** The creator's cover first, the rest in the supplier's order; a url not in the gallery changes nothing. */
export function leadWith<T extends { url: string }>(images: T[], cover: string | null | undefined): T[] {
  const i = cover ? images.findIndex((x) => x.url === cover) : -1;
  return i > 0 ? [images[i]!, ...images.slice(0, i), ...images.slice(i + 1)] : images;
}
