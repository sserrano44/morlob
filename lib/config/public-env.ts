import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3000/api"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .default("https://uwsqokoloqyfckixfmhb.supabase.co"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default("")
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

export const supabasePublishableKey =
  publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
