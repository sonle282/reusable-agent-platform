// Operational recovery for a lost admin password.
// Rotates BOOTSTRAP_TOKEN, removes the admin and its sessions, and reopens first-run setup.
// Agents, data, knowledge, connections, credentials and conversations are not touched.
// The new token is copied to the clipboard and never printed.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const expectedAccountId = process.env.EXPECTED_CF_ACCOUNT_ID;
if (!expectedAccountId) throw new Error("Set EXPECTED_CF_ACCOUNT_ID to the target Cloudflare account ID.");
if (!process.argv.includes("--confirm")) throw new Error("This removes the admin account and reopens setup. Re-run with --confirm.");

function wrangler(args, input) {
  const result = spawnSync("npx", ["wrangler", ...args], { input, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`wrangler ${args[0]} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

if (!wrangler(["whoami"]).includes(expectedAccountId)) throw new Error(`Wrangler is not authenticated for account ${expectedAccountId}.`);

const token = randomBytes(32).toString("base64url");
const clipboard = process.platform === "win32" ? ["clip"] : process.platform === "darwin" ? ["pbcopy"] : ["xclip", "-selection", "clipboard"];
const copied = spawnSync(clipboard[0], clipboard.slice(1), { input: token });
if (copied.status !== 0) throw new Error("Could not copy the new bootstrap token to the clipboard; nothing was changed.");

wrangler(["secret", "put", "BOOTSTRAP_TOKEN"], token);
console.log("BOOTSTRAP_TOKEN rotated (value copied to clipboard).");

const sql = "DELETE FROM sessions; DELETE FROM login_attempts; DELETE FROM admins; UPDATE settings SET value_json='false', updated_at=datetime('now') WHERE key='setup_complete';";
// With shell: true (Windows), arguments are joined into one command line and need explicit quoting.
wrangler(["d1", "execute", "DB", "--remote", "--yes", "--command", process.platform === "win32" ? `"${sql}"` : sql]);
console.log("Admin removed and setup reopened. Open the Worker URL and complete setup with the clipboard token now.");
