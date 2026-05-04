import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { ID_RE, SEMVER_RE } from "./catalog.js";
import { dirExists, fileExists } from "./io.js";
import { isString } from "./typeguards.js";

export const OVERLAYS_FILE = "agentry.overlays.toml";
export const OVERLAY_MANIFEST_FILE = "agentry.overlay.toml";

export interface OverlayManifest {
  id: string;
  version: string;
  description: string;
}

export interface ParsedOverlay {
  registrationId: string;
  rootDir: string;
  manifest: OverlayManifest;
}

export interface MalformedOverlay {
  registrationId?: string;
  rootDir?: string;
  errors: string[];
}

export interface OverlaysLoadResult {
  overlays: ParsedOverlay[];
  malformed: MalformedOverlay[];
}

export function overlaysFilePath(repoRoot: string): string {
  return resolve(repoRoot, OVERLAYS_FILE);
}

export function loadOverlays(repoRoot: string): OverlaysLoadResult {
  const overlays: ParsedOverlay[] = [];
  const malformed: MalformedOverlay[] = [];

  const filePath = overlaysFilePath(repoRoot);
  if (!existsSync(filePath)) {
    return { overlays, malformed };
  }

  let raw: Record<string, unknown>;
  try {
    raw = parseToml(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch (err) {
    malformed.push({
      errors: [`failed to parse ${OVERLAYS_FILE}: ${(err as Error).message}`],
    });
    return { overlays, malformed };
  }

  const registrations = raw.overlay;
  if (registrations === undefined) {
    return { overlays, malformed };
  }
  if (!Array.isArray(registrations)) {
    malformed.push({ errors: [`[[overlay]] must be an array of tables`] });
    return { overlays, malformed };
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    if (!reg || typeof reg !== "object" || Array.isArray(reg)) {
      malformed.push({ errors: [`overlay[${i}] must be a table`] });
      continue;
    }
    const result = parseRegistration(
      reg as Record<string, unknown>,
      i,
      repoRoot,
      seenIds,
    );
    if ("manifest" in result) overlays.push(result);
    else malformed.push(result);
  }

  return { overlays, malformed };
}

function parseRegistration(
  reg: Record<string, unknown>,
  index: number,
  repoRoot: string,
  seenIds: Set<string>,
): ParsedOverlay | MalformedOverlay {
  const errors: string[] = [];
  const prefix = `overlay[${index}]`;

  const idRaw = reg.id;
  let registrationId: string | undefined;
  if (!isString(idRaw) || !ID_RE.test(idRaw)) {
    errors.push(
      `${prefix}.id must match /^[a-z][a-z0-9-]*$/ (got ${JSON.stringify(idRaw)})`,
    );
  } else if (seenIds.has(idRaw)) {
    errors.push(`${prefix}.id "${idRaw}" duplicates a prior registration`);
    registrationId = idRaw;
  } else {
    registrationId = idRaw;
    seenIds.add(idRaw);
  }

  const pathRaw = reg.path;
  let rootDir: string | undefined;
  if (!isString(pathRaw) || pathRaw === "") {
    errors.push(`${prefix}.path must be a non-empty string`);
  } else {
    const resolved = isAbsolute(pathRaw) ? pathRaw : resolve(repoRoot, pathRaw);
    if (dirExists(resolved)) rootDir = resolved;
    else if (fileExists(resolved))
      errors.push(`${prefix}.path is not a directory: ${pathRaw}`);
    else errors.push(`${prefix}.path does not exist: ${pathRaw}`);
  }

  if (errors.length > 0 || !registrationId || !rootDir) {
    return {
      ...(registrationId ? { registrationId } : {}),
      ...(rootDir ? { rootDir } : {}),
      errors,
    };
  }

  return parseManifest(registrationId, rootDir);
}

function parseManifest(
  registrationId: string,
  rootDir: string,
): ParsedOverlay | MalformedOverlay {
  const manifestPath = resolve(rootDir, OVERLAY_MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    return {
      registrationId,
      rootDir,
      errors: [`${OVERLAY_MANIFEST_FILE} not found in overlay root`],
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = parseToml(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch (err) {
    return {
      registrationId,
      rootDir,
      errors: [
        `failed to parse ${OVERLAY_MANIFEST_FILE}: ${(err as Error).message}`,
      ],
    };
  }

  const errors: string[] = [];

  const id = raw.id;
  if (!isString(id) || !ID_RE.test(id)) {
    errors.push(
      `manifest.id must match /^[a-z][a-z0-9-]*$/ (got ${JSON.stringify(id)})`,
    );
  } else if (id !== registrationId) {
    errors.push(
      `manifest.id "${id}" does not match registration id "${registrationId}"`,
    );
  }

  const version = raw.version;
  if (!isString(version) || !SEMVER_RE.test(version)) {
    errors.push(
      `manifest.version must be valid semver (got ${JSON.stringify(version)})`,
    );
  }

  const description = raw.description;
  if (!isString(description)) {
    errors.push(`manifest.description must be a string`);
  }

  if (errors.length > 0) {
    return { registrationId, rootDir, errors };
  }

  return {
    registrationId,
    rootDir,
    manifest: {
      id: id as string,
      version: version as string,
      description: description as string,
    },
  };
}
