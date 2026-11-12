import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import vaultCss from "@/vault/vault.css?url";
import { VAULT_MARKUP } from "@/vault/markup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Vault — Web OS for games & websites" },
      {
        name: "description",
        content:
          "The Web Vault: a browser-based desktop with games, websites, a built-in browser, notes, chat and more.",
      },
      { property: "og:title", content: "The Vault — Web OS for games & websites" },
      {
        property: "og:description",
        content: "A browser-based desktop hub for games, websites and tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: vaultCss }],
    scripts: [
      {
        type: "module",
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        "data-cf-beacon": '{"token": "a6105e8c80c44033bd28d773c102434c"}',
      },
    ],
  }),
  component: VaultHome,
});

function VaultHome() {
  useEffect(() => {
    // The WebOS is plain browser code: load it only after hydration.
    import("@/vault/boot.js").then(({ startVault }) => startVault());
  }, []);

  return (
    <div
      id="vault-page"
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: VAULT_MARKUP }}
    />
  );
}
