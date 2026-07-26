import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(workerRoot, "..");
const outputDirectory = resolve(workerRoot, "dist", "kidmath");
const assets = [
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "sw.js",
  "manifest.webmanifest",
  "icon.svg",
];

await rm(resolve(workerRoot, "dist"), { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  assets.map((asset) =>
    cp(resolve(projectRoot, asset), resolve(outputDirectory, asset))
  )
);

console.log(`Prepared ${assets.length} assets in ${outputDirectory}`);
