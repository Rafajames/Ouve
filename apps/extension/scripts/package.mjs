// Gera dist/chrome e dist/firefox a partir do build comum, cada um com seu manifesto.
import { cpSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const common = join(root, "dist", "common");
for (const [target, manifest] of [
  ["chrome", "manifest.json"],
  ["firefox", "manifest.firefox.json"]
]) {
  const out = join(root, "dist", target);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(common, out, { recursive: true });
  copyFileSync(join(root, "public", manifest), join(out, "manifest.json"));
  console.info(`Extensão ${target}: ${out}`);
}
