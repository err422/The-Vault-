import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — The Vault" },
      { name: "description", content: "Choose a new password for your Vault account." },
      { property: "og:title", content: "Set a new password — The Vault" },
      { property: "og:description", content: "Choose a new password for your Vault account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

type Status = "checking" | "ready" | "invalid" | "saving" | "done";

function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (isRecovery && session)) setStatus("ready");
    });
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setStatus((current) =>
        current === "checking" ? (isRecovery && data.session ? "ready" : "invalid") : current,
      );
    }, 1500);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setStatus("saving");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }
    setStatus("done");
  }

  return (
    <main className="vault-auth-page">
      <section className="vault-auth-card" aria-labelledby="reset-title">
        <div className="vault-auth-eyebrow">VAULTOS · ACCOUNT RECOVERY</div>
        <h1 id="reset-title" className="vault-auth-title">
          Set a new password
        </h1>

        {status === "checking" && <p className="vault-auth-copy">Checking your reset link…</p>}

        {status === "invalid" && (
          <>
            <p className="vault-auth-copy">
              This link is invalid or has expired. Open The Vault, choose “Set a new password” on the
              sign-in window, and we’ll email you a fresh link.
            </p>
            <Link to="/" className="vault-auth-button">
              Back to The Vault
            </Link>
          </>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={onSubmit} className="vault-auth-form">
            <p className="vault-auth-copy">
              Your profile, settings and desktop stay exactly as they were.
            </p>
            <label className="vault-auth-label" htmlFor="new-password">
              NEW PASSWORD
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="vault-auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <label className="vault-auth-label" htmlFor="confirm-password">
              CONFIRM PASSWORD
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className="vault-auth-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && (
              <p role="alert" className="vault-auth-error">
                {error}
              </p>
            )}
            <button type="submit" className="vault-auth-button" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save password & open my desktop"}
            </button>
          </form>
        )}

        {status === "done" && (
          <>
            <p className="vault-auth-copy">Password saved. You’re signed in.</p>
            <a href="/" className="vault-auth-button">
              Open The Vault
            </a>
          </>
        )}
      </section>
    </main>
  );
}
