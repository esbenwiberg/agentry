import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = resolve(HERE, "..");
export const CONTENT_DIR = resolve(PACKAGE_ROOT, "content");
export const CATALOG_DIR = resolve(CONTENT_DIR, "catalog");
