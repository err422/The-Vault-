import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Username sign-in and password-reset requests resolve the account email on the
// server so emails are never exposed to the browser.

function createPublicAuthClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const USERNAME_RE = /^[A-Za-z0-9_-]{3,16}$/;

async function emailForUsername(username: string): Promise<string | null> {
  if (!USERNAME_RE.test(username)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Escape LIKE wildcards; ilike gives the case-insensitive match the unique index enforces.
  const pattern = username.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .ilike("username", pattern)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[vault-auth] username lookup failed", error.message);
    return null;
  }
  return data?.email ?? null;
}

export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = await emailForUsername(data.username);
    if (!email) return { ok: false as const, error: "Incorrect username or password." };
    const client = createPublicAuthClient();
    const { data: result, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !result.session) {
      const msg = error?.message ?? "";
      if (/not confirmed/i.test(msg)) {
        return { ok: false as const, error: "Confirm your email first — check your inbox for the link." };
      }
      return { ok: false as const, error: "Incorrect username or password." };
    }
    return {
      ok: true as const,
      accessToken: result.session.access_token,
      refreshToken: result.session.refresh_token,
    };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ identifier: z.string().trim().min(1).max(254), redirectTo: z.string().url().max(500) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const redirect = new URL(data.redirectTo);
    if (!/^https?:$/.test(redirect.protocol) || redirect.pathname !== "/reset-password") {
      return { ok: false as const, error: "Invalid reset link destination." };
    }
    const email = data.identifier.includes("@")
      ? data.identifier.toLowerCase()
      : await emailForUsername(data.identifier);
    // Always report success so the form never reveals which accounts exist.
    if (!email) return { ok: true as const };
    const client = createPublicAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirect.toString() });
    if (error) {
      console.error("[vault-auth] reset email failed", error.message);
      if (/rate limit|too many/i.test(error.message)) {
        return { ok: false as const, error: "Too many requests. Wait a minute and try again." };
      }
    }
    return { ok: true as const };
  });
