import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3000/api"),
  MORLOB_DEPLOYMENT_MODE: z.enum(["saas", "self_hosted"]).default("self_hosted"),
  MORLOB_APP_DOMAIN: z.string().default("morlob.com"),
  MORLOB_API_DOMAIN: z.string().default("api.morlob.com"),
  API_KEY_PREFIX: z.string().min(2).default("mlb"),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .default("https://uwsqokoloqyfckixfmhb.supabase.co"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_SECRET_KEY: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  DATABASE_URL: z.string().default(""),
  SUPABASE_DB_URL: z.string().default(""),
  MORLOB_STORAGE_BUCKET: z.string().default("morlob-files"),
  MORLOB_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5_242_880),
  MCP_SERVER_NAME: z.string().default("morlob"),
  MCP_ENDPOINT: z.string().default("/api/mcp"),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SES_CONFIGURATION_SET: z.string().optional(),
  AWS_SES_INBOUND_BUCKET: z.string().optional(),
  AWS_SES_INBOUND_TOPIC_ARN: z.string().optional(),
  AWS_SES_FROM_DOMAIN: z.string().optional(),
  MORLOB_EMBEDDINGS_PROVIDER: z
    .enum(["none", "openai", "custom"])
    .default("none"),
  MORLOB_EMBEDDINGS_MODEL: z.string().optional(),
  MORLOB_EMBEDDINGS_API_KEY: z.string().optional()
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  MORLOB_DEPLOYMENT_MODE: process.env.MORLOB_DEPLOYMENT_MODE,
  MORLOB_APP_DOMAIN: process.env.MORLOB_APP_DOMAIN,
  MORLOB_API_DOMAIN: process.env.MORLOB_API_DOMAIN,
  API_KEY_PREFIX: process.env.API_KEY_PREFIX,
  API_RATE_LIMIT_PER_MINUTE: process.env.API_RATE_LIMIT_PER_MINUTE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
  MORLOB_STORAGE_BUCKET: process.env.MORLOB_STORAGE_BUCKET,
  MORLOB_MAX_UPLOAD_BYTES: process.env.MORLOB_MAX_UPLOAD_BYTES,
  MCP_SERVER_NAME: process.env.MCP_SERVER_NAME,
  MCP_ENDPOINT: process.env.MCP_ENDPOINT,
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_SES_CONFIGURATION_SET: process.env.AWS_SES_CONFIGURATION_SET,
  AWS_SES_INBOUND_BUCKET: process.env.AWS_SES_INBOUND_BUCKET,
  AWS_SES_INBOUND_TOPIC_ARN: process.env.AWS_SES_INBOUND_TOPIC_ARN,
  AWS_SES_FROM_DOMAIN: process.env.AWS_SES_FROM_DOMAIN,
  MORLOB_EMBEDDINGS_PROVIDER: process.env.MORLOB_EMBEDDINGS_PROVIDER,
  MORLOB_EMBEDDINGS_MODEL: process.env.MORLOB_EMBEDDINGS_MODEL,
  MORLOB_EMBEDDINGS_API_KEY: process.env.MORLOB_EMBEDDINGS_API_KEY
});

export const supabasePublishableKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseSecretKey =
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

export const databaseUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;

export function requireEnv(value: string, name: string) {
  if (!value) {
    throw new Error(`${name} is required for this operation.`);
  }

  return value;
}
