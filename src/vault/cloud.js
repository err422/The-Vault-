/**
 * Lovable Cloud data layer for The Vault (replaces the Firebase Realtime Database).
 * Browser-only: imported by the WebOS boot module after hydration.
 */
import { supabase } from "@/integrations/supabase/client";
import { signInWithUsername, requestPasswordReset } from "@/lib/vault-auth.functions";

export { supabase };

const ms = (value) => (value ? new Date(value).getTime() : null);
const iso = (value) => (value === null || value === undefined || value === "" ? null : new Date(Number(value) || value).toISOString());

/* ---------- Auth ---------- */

export function toVaultUser(user) {
  if (!user) return null;
  return {
    uid: user.id,
    id: user.id,
    email: user.email || null,
    displayName: user.user_metadata?.username || null,
    emailVerified: !!user.email_confirmed_at,
  };
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      throw new Error("Confirm your email first — check your inbox for the link.");
    }
    throw new Error("Incorrect email or password. Moved from the old Vault? Use “Set a new password” below.");
  }
  return data;
}

export async function signInUsername(username, password) {
  const result = await signInWithUsername({ data: { username, password } });
  if (!result.ok) {
    throw new Error(result.error + (result.error.startsWith("Incorrect") ? " Moved from the old Vault? Use “Set a new password” below." : ""));
  }
  const { error } = await supabase.auth.setSession({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  });
  if (error) throw new Error("Could not start your session. Please try again.");
}

export async function sendPasswordReset(identifier) {
  const result = await requestPasswordReset({
    data: { identifier, redirectTo: window.location.origin + "/reset-password" },
  });
  if (!result.ok) throw new Error(result.error);
}

/* ---------- Profiles ---------- */

export async function getProfile(uid) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, email, favorites, playtime, webos, created_at")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isUsernameAvailable(username) {
  const { data, error } = await supabase.rpc("is_username_available", { _username: username });
  if (error) throw error;
  return data === true;
}

export async function updateUsername(uid, username) {
  const { error } = await supabase.from("profiles").update({ username }).eq("id", uid);
  if (error) {
    if (error.code === "23505") throw new Error("Username already taken");
    throw new Error("Could not change username. Please try again.");
  }
}

export async function updateProfileFields(uid, fields) {
  const { error } = await supabase.from("profiles").update(fields).eq("id", uid);
  if (error) throw error;
}

export async function getIsAdmin(uid) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (error) throw error;
  return data === true;
}

/* ---------- WebOS preferences ---------- */

export async function getWebosPrefs(uid) {
  const { data, error } = await supabase.from("profiles").select("webos").eq("id", uid).maybeSingle();
  if (error) throw error;
  return (data && data.webos) || {};
}

export async function mergeWebosPrefs(patch) {
  const { data, error } = await supabase.rpc("merge_webos_prefs", { _patch: patch });
  if (error) throw error;
  return data;
}

/* ---------- Memberships ---------- */

function membershipFromRow(row) {
  if (!row) return null;
  return {
    plan: row.plan,
    active: row.active === true,
    grantedAt: ms(row.granted_at),
    expiresAt: ms(row.expires_at),
    updatedAt: ms(row.updated_at),
    updatedBy: row.updated_by || null,
    updatedByUsername: row.updated_by_username || null,
  };
}

export async function getMembership(uid) {
  const { data, error } = await supabase.from("memberships").select("*").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return membershipFromRow(data);
}

export function watchMembership(uid, onChange) {
  const channel = supabase
    .channel("membership-" + uid + "-" + Math.random().toString(36).slice(2))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "memberships", filter: "user_id=eq." + uid },
      () => {
        getMembership(uid).then(onChange).catch((e) => console.warn("[VaultAds] membership refresh failed", e));
      },
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function setMembership(uid, membership) {
  const { error } = await supabase.from("memberships").upsert({
    user_id: uid,
    plan: membership.plan || "vault_plus",
    active: membership.active === true,
    granted_at: iso(membership.grantedAt),
    expires_at: iso(membership.expiresAt),
    updated_at: new Date().toISOString(),
    updated_by: membership.updatedBy || null,
    updated_by_username: membership.updatedByUsername || null,
  });
  if (error) throw error;
}

export async function listAccountsForAdmin() {
  const pageSize = 1000;
  const profiles = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email")
      .order("username")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    profiles.push(...data);
    if (data.length < pageSize) break;
  }
  const memberships = new Map();
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("memberships").select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    data.forEach((row) => memberships.set(row.user_id, membershipFromRow(row)));
    if (data.length < pageSize) break;
  }
  return profiles.map((p) => ({
    uid: p.id,
    username: p.username,
    email: p.email || "",
    membership: memberships.get(p.id) || {},
  }));
}

/* ---------- Site stats ---------- */

export async function recordVisit() {
  const { data, error } = await supabase.rpc("record_visit");
  if (error) throw error;
  return Number(data);
}

/* ---------- VaultNet chat & presence ---------- */

function chatFromRow(row) {
  return {
    id: row.id,
    uid: row.user_id,
    clientId: row.client_id,
    username: row.username,
    text: row.text,
    timestamp: ms(row.created_at) || Date.now(),
  };
}

export async function fetchRecentChat(limit = 40) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.reverse().map(chatFromRow);
}

export async function sendChatMessage(message) {
  const { error } = await supabase.from("chat_messages").insert({
    id: message.id,
    user_id: message.uid,
    client_id: message.clientId || "",
    username: message.username,
    text: message.text,
  });
  if (error) throw error;
}

export function subscribeChat(onMessage) {
  const channel = supabase
    .channel("vaultnet-chat-" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
      if (payload.new) onMessage(chatFromRow(payload.new));
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Shared presence room. Each tab tracks one entry keyed by its clientId.
 * onSync receives an array of tracked peer payloads.
 */
export function joinPresence(clientId, onSync, onStatus) {
  const channel = supabase.channel("vaultnet-presence", { config: { presence: { key: clientId } } });
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const peers = [];
    Object.values(state).forEach((entries) => {
      (entries || []).forEach((entry) => peers.push(entry));
    });
    onSync(peers);
  });
  channel.subscribe((status) => onStatus && onStatus(status));
  return {
    track: (payload) => channel.track(payload),
    leave: () => {
      try { channel.untrack(); } catch (_) { /* ignore */ }
      supabase.removeChannel(channel);
    },
  };
}
