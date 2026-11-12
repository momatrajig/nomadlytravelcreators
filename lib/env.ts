import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  EBC_MODE: z.enum(["live", "mock"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  PLATFORM_HOST: z.string().default("nomadly.app"),
  DATA_MODE: z.enum(["supabase", "local"]).optional(),
  ALLOW_DEMO_DASHBOARD: z.string().optional(),   // "off" closes the demo dashboard
  DEFAULT_STOREFRONT: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Nomadly <bookings@nomadly.app>"),
  /** support contacts shown on the voucher; digits with country code for WhatsApp, e.g. 9617xxxxxxx */
  SUPPORT_WHATSAPP: z.string().regex(/^\d{8,15}$/).optional(),
  SUPPORT_EMAIL: z.string().email().optional(),
  BOOKING_LINK_SECRET: z.string().min(16).optional(), // signs the booking page cookie; falls back to a server secret
});

export type Env = z.infer<typeof schema> & { DATA_MODE: "supabase" | "local" };
let cached: Env | null = null;
export function env(): Env {
  if (!cached) {
    // accept the names the Vercel Supabase integration writes as well as ours
    const raw = { ...process.env };
    raw.NEXT_PUBLIC_SUPABASE_URL ??= raw.SUPABASE_URL;
    raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= raw.SUPABASE_ANON_KEY;
    raw.SUPABASE_SERVICE_ROLE_KEY ??= raw.SUPABASE_SERVICE_KEY;
    raw.DATABASE_URL ??= raw.POSTGRES_URL_NON_POOLING ?? raw.POSTGRES_URL;
    const e = schema.parse(raw);
    // the database is used the moment its keys exist; nothing else to flip
    cached = { ...e, DATA_MODE: e.DATA_MODE ?? (e.SUPABASE_SERVICE_ROLE_KEY && e.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "local") };
  }
  return cached;
}
