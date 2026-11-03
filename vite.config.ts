import {prepareDemandOcrAssets} from "./build/demand-ocr-assets.mjs";
import vinext from "vinext";
import {sourceSyncSnapshot} from "./build/source-sync-plugin";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";
import { configuration } from "./scripts/local/database.mjs";
import { localTestPlugin } from "./scripts/local/server.mjs";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({command}) => {
  prepareDemandOcrAssets();
  configuration(); // Fail closed before loading any Cloudflare runtime.
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      fs: { deny: ["**/.env*", "**/.git/**", "**/.local-data/**", "**/backups/**", "**/handoff/**", "**/.sites-runtime/**", "**/*.pdf"] },
      host: "127.0.0.1",
      allowedHosts: ["localhost", "127.0.0.1", "terminal.local"],
      watch: {
        ignored: ["**/handoff/**", "**/backups/**", "**/.local-data/**", "**/.sites-runtime/**", "**/.wrangler/**"],
        ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
      },
    },
    plugins: [
      sourceSyncSnapshot(),
      ...(command === 'serve' ? [localTestPlugin()] : []),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        // Records are served only by localTestPlugin's persistent Miniflare DB.
        // No DB binding is exposed to the Site API while developing locally.
        config: command === 'build' ? localBindingConfig : { ...localBindingConfig, d1_databases: [], r2_buckets: [] },
      }),
    ],
  };
});
