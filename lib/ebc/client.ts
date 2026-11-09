/**
 * eBooking Center reseller API client.
 *
 * Follows /docs/ebc-integration-spec.md: one cached OAuth token for the union of scopes,
 * Bearer on every call, RFC 7807 errors, exponential backoff with jitter on 429 and 5xx only,
 * rate limit headers surfaced, and a fixture backed mock when EBC_MODE=mock so the whole
 * product runs locally without credentials.
 *
 * Server only. Never import from a client component.
 */
import type {
  AvailabilityResponse, BookRequest, BookResponse, Credit, HotelDetails, HotelImage, Offer, Problem, Reservation, SearchRequest, SearchResponse,
} from "./types";
import { mockTransport } from "./mock";

export class EbcError extends Error {
  constructor(public readonly problem: Problem, public readonly retryAfterMs?: number) {
    super(`${problem.status} ${problem.title}${problem.detail ? `: ${problem.detail}` : ""}`);
    this.name = "EbcError";
  }
  get code(): string | undefined {
    // IRIX puts machine codes such as AVAILABILITY_TOKEN_EXPIRED in title or detail
    const m = /\b([A-Z]{3,}(?:_[A-Z]+)+)\b/.exec(`${this.problem.title} ${this.problem.detail ?? ""}`);
    return m?.[1];
  }
}

export interface EbcConfig {
  mode: "live" | "mock";
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  leaderNationalityId: number;
  defaultNationalityIso?: string;
  sellingChannel: "B2B" | "B2C";
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): EbcConfig {
  const mode = env.EBC_MODE === "live" ? "live" : "mock";
  if (mode === "live") {
    for (const k of ["EBC_CLIENT_ID", "EBC_CLIENT_SECRET"]) {
      if (!env[k]) throw new Error(`${k} is required when EBC_MODE=live`);
    }
  }
  return {
    mode,
    baseUrl: (env.EBC_BASE_URL ?? "https://www.ebookingcenter.com/tbs/reseller").replace(/\/$/, ""),
    clientId: env.EBC_CLIENT_ID ?? "",
    clientSecret: env.EBC_CLIENT_SECRET ?? "",
    scopes: env.EBC_SCOPES ?? "read:hotels-search write:hotels-book read:mapping read:reservations write:reservations read:reservations-documents write:reservations-webhooks read:resellerCredit",
    // 0 means: resolve from the mapping API by ISO code (EBC_DEFAULT_NATIONALITY_ISO, default US) on first use
    leaderNationalityId: Number(env.EBC_LEADER_NATIONALITY_ID ?? 0),
    defaultNationalityIso: (env.EBC_DEFAULT_NATIONALITY_ISO ?? "US").toUpperCase(),
    sellingChannel: env.EBC_SELLING_CHANNEL === "B2B" ? "B2B" : "B2C",
  };
}

interface Token { access: string; expiresAt: number }

export interface RateLimitInfo { limit?: number; remaining?: number; resetAt?: number }

export class EbcClient {
  private token: Token | null = null;
  private tokenPromise: Promise<Token> | null = null;
  public lastRateLimit: RateLimitInfo = {};
  /** scopes the account refused at token time (for the health check and the ops log) */
  public droppedScopes: string[] = [];
  private grantedScopes: string | null = null;
  private readonly f: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly cfg: EbcConfig) {
    this.f = cfg.fetch ?? (cfg.mode === "mock" ? mockTransport() : fetch);
    this.now = cfg.now ?? Date.now;
    this.sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  // ---------- auth ----------
  private async getToken(force = false): Promise<string> {
    const skew = 60_000;
    if (!force && this.token && this.token.expiresAt - skew > this.now()) return this.token.access;
    if (!this.tokenPromise) {
      this.tokenPromise = (async () => {
        // Ask for every scope the product uses; when the account is not granted one, the server names it
        // ("Check the `x` scope"), so drop it and ask again rather than fail every call. Dropped scopes are reported.
        let scopes = (this.grantedScopes ?? this.cfg.scopes).split(/\s+/).filter(Boolean);
        let res: Response;
        for (let i = 0; ; i++) {
          const body = new URLSearchParams({ grant_type: "client_credentials", client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, scope: scopes.join(" ") });
          res = await this.f(`${this.cfg.baseUrl}/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
          if (res.ok) break;
          const text = await res.text();
          const bad = /invalid_scope/.test(text) ? /`([a-z]+:[A-Za-z_-]+)`/.exec(text)?.[1] : undefined;
          if (!bad || !scopes.includes(bad) || i > 12) throw new EbcError({ title: "token request failed", status: res.status, detail: text });
          scopes = scopes.filter((x) => x !== bad);
          this.droppedScopes = [...new Set([...this.droppedScopes, bad])];
        }
        this.grantedScopes = scopes.join(" ");
        const j = (await res.json()) as { access_token: string; expires_in: number };
        const t = { access: j.access_token, expiresAt: this.now() + Math.max(60, j.expires_in) * 1000 };
        this.token = t;
        return t;
      })().finally(() => { this.tokenPromise = null; });
    }
    return (await this.tokenPromise).access;
  }

  // ---------- transport ----------
  private async request<T>(method: string, path: string, opts: { body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {}, attempt = 0, refreshed = false): Promise<T> {
    const url = new URL(`${this.cfg.baseUrl}/api${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const token = await this.getToken();
    const res = await this.f(url, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: "application/hal+json, application/json", ...(opts.body ? { "content-type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    this.readRateLimit(res);
    if (res.status === 401 && !refreshed) { await this.getToken(true); return this.request<T>(method, path, opts, attempt, true); }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after")) * 1000;
      const base = Math.min(16_000, 1000 * 2 ** attempt);
      const jitter = base * (Math.random() * 0.5 - 0.25);
      await this.sleep(retryAfter > 0 ? retryAfter : base + jitter);
      return this.request<T>(method, path, opts, attempt + 1, refreshed);
    }
    if (!res.ok) {
      let problem: Problem = { title: res.statusText || "request failed", status: res.status };
      try { problem = { ...problem, ...(await res.json()) }; } catch { /* non JSON body */ }
      throw new EbcError(problem);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private readRateLimit(res: Response) {
    const g = (k: string) => { const v = res.headers.get(k); return v == null ? undefined : Number(v); };
    const limit = g("x-ratelimit-limit"), remaining = g("x-ratelimit-remaining"), reset = g("x-ratelimit-reset");
    if (limit !== undefined || remaining !== undefined) this.lastRateLimit = { limit, remaining, resetAt: reset ? reset * 1000 : undefined };
  }

  // ---------- mapping ----------
  hotelDetails(id: number) { return this.request<HotelDetails>("GET", `/mapping/v1/hotels/${id}/details`); }
  hotelImages(id: number) { return this.request<{ _embedded?: { images?: HotelImage[] }; images?: HotelImage[] }>("GET", `/mapping/v1/hotels/${id}/images`).then((r) => r.images ?? r._embedded?.images ?? []); }

  // ---------- nationalities ----------
  /** raw first page, for the health check when the shape differs from the documentation */
  nationalitiesSample() { return this.request<Record<string, unknown>>("GET", "/mapping/v1/nationalities", { query: { page: 1, limit: 500 } }); }
  private nationalities: { at: number; byIso: Map<string, number> } | null = null;
  /** Mapping nationality ID for an ISO code (the leaderNationality search field). Cached 48 hours, as the API guide asks. */
  async nationalityId(iso: string): Promise<number> {
    if (!this.nationalities || this.now() - this.nationalities.at > 48 * 3_600_000) {
      const byIso = new Map<string, number>();
      for (let page = 1, pages = 1; page <= pages && page <= 20; page++) {
        const r = await this.request<{ _page_count?: number; _embedded?: { nationalities?: Array<{ id: number; iso: string }> } }>("GET", "/mapping/v1/nationalities", { query: { page, limit: 500 } });
        pages = r._page_count ?? 1;
        for (const n of r._embedded?.nationalities ?? []) if (n.iso) byIso.set(n.iso.toUpperCase(), n.id);
      }
      this.nationalities = { at: this.now(), byIso };
    }
    const id = this.nationalities.byIso.get(iso.toUpperCase());
    if (!id) throw new EbcError({ title: "unknown nationality", status: 400, detail: `no mapping nationality for ISO ${iso}` });
    return id;
  }

  // ---------- search ----------
  /** Synchronous search by hotel IDs (max 200). leaderNationality: an ID, or leaderIso to resolve one (the reader's country). */
  async searchSync(req: Omit<SearchRequest, "sellingChannel" | "occupancy"> & { occupancy: { rooms: SearchRequest["occupancy"]["rooms"]; leaderNationality?: number; leaderIso?: string } }) {
    if (req.accommodation.length === 0 || req.accommodation.length > 200) throw new RangeError("accommodation must hold 1 to 200 hotel ids");
    let leader = req.occupancy.leaderNationality ?? 0;
    if (!leader && this.cfg.mode === "live") {
      const iso = req.occupancy.leaderIso ?? this.cfg.defaultNationalityIso ?? "US";
      leader = this.cfg.leaderNationalityId && !req.occupancy.leaderIso ? this.cfg.leaderNationalityId : await this.nationalityId(iso).catch(() => this.cfg.leaderNationalityId || this.nationalityId(this.cfg.defaultNationalityIso ?? "US"));
    }
    if (!leader) leader = this.cfg.leaderNationalityId || 158; // simulator ignores it
    const { occupancy, ...rest } = req;
    const body: SearchRequest = {
      language: "en_GB", timeout: 20, availableOnly: true, cancellationDeadline: true,
      ...rest,
      occupancy: { leaderNationality: leader, rooms: occupancy.rooms },
      sellingChannel: this.cfg.sellingChannel,
    };
    return this.request<SearchResponse>("POST", "/hotels/v1/search/sync", { body });
  }
  offer(srk: string, hotelIndex: number, offerIndex: string, resultsToken: string) {
    return this.request<Offer>("GET", `/hotels/v1/search/results/${srk}/hotels/${hotelIndex}/offers/${encodeURIComponent(offerIndex)}`, { query: { token: resultsToken } });
  }
  availability(srk: string, hotelIndex: number, offerIndex: string, resultsToken: string, body: { packageToken: string; roomTokens: string[] }) {
    return this.request<AvailabilityResponse>("POST", `/hotels/v1/search/results/${srk}/hotels/${hotelIndex}/offers/${encodeURIComponent(offerIndex)}/availability`, { query: { token: resultsToken }, body });
  }
  doubleBookingCheck(srk: string, hotelIndex: number, offerIndex: string, resultsToken: string, body: { availabilityToken: string; rooms: Array<{ packageRoomToken: string; travelers: Array<{ firstName: string; lastName: string }> }> }) {
    return this.request<{ hasDoubleBookings: boolean; count: number; reservations?: unknown[] }>("POST", `/hotels/v1/search/results/${srk}/hotels/${hotelIndex}/offers/${encodeURIComponent(offerIndex)}/double-booking-verification`, { query: { token: resultsToken }, body });
  }
  book(srk: string, hotelIndex: number, offerIndex: string, resultsToken: string, body: BookRequest) {
    if (!/^[a-z0-9\-_:.]+$/i.test(body.clientRef)) throw new RangeError("clientRef pattern");
    const leads = body.rooms.flatMap((r) => r.travelers).filter((t) => t.lead).length;
    if (leads !== 1) throw new RangeError("exactly one lead traveler");
    return this.request<BookResponse>("POST", `/hotels/v1/search/results/${srk}/hotels/${hotelIndex}/offers/${encodeURIComponent(offerIndex)}/book`, { query: { token: resultsToken }, body });
  }

  // ---------- reservations ----------
  reservation(id: number) { return this.request<Reservation>("GET", `/reservationsApi/v1/reservations/${id}`); }
  reservationByRef(clientRef: string) { return this.request<Reservation>("GET", `/reservationsApi/v1/reservations/reference/${encodeURIComponent(clientRef)}`); }
  syncStatus(id: number) { return this.request<Reservation>("POST", `/reservationsApi/v1/reservations/${id}/sync-status`); }
  cancel(id: number) { return this.request<Reservation>("DELETE", `/reservationsApi/v1/reservations/${id}`); }
  documents(id: number) { return this.request<{ documents: Array<{ code: string; name: string; documents: Array<{ filename: string; token: string }> }> }>("GET", `/reservationsApi/v1/reservations/${id}/documents`); }
  generateDocument(id: number, token: string) { return this.request<{ name: string; token: string; size: number; md5: string; _links: { download: { href: string } } }>("GET", `/reservationsApi/v1/reservations/${id}/documents/generate`, { query: { token } }); }
  subscribeWebhook(id: number, url: string) { return this.request<{ id: number; url: string; isActive: boolean }>("PUT", `/reservationsApi/v1/reservations/${id}/webhooks`, { body: { url } }); }

  // ---------- credit ----------
  credit() { return this.request<Credit>("GET", "/credit/v1/get"); }
}

const g = globalThis as unknown as { __nomadlyEbc?: EbcClient };
export function ebc(): EbcClient {
  if (!g.__nomadlyEbc) g.__nomadlyEbc = new EbcClient(configFromEnv());
  return g.__nomadlyEbc;
}

/** Earliest standard policy date with a non zero charge; null means free cancellation has no deadline in the data. */
export function cancellationDeadline(policy?: { policies: Array<{ type: string; date?: string; startDate?: string; charge?: { value: number } }> }): { date: string; charge: number } | null {
  if (!policy) return null;
  const items = policy.policies
    .filter((p) => (p.type === "standard" || p.type === "penalty") && (p.charge?.value ?? 0) > 0)
    .map((p) => ({ date: p.date ?? p.startDate ?? "", charge: p.charge!.value }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return items[0] ?? null;
}
