import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { errorMessage } from "../util/error-message.js";

export type ProjectConfig = {
  corpus?: string;
};

export const CONFIG_FILENAME = "repofit.config.json";

export async function loadProjectConfig(cwd: string): Promise<ProjectConfig | null> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, CONFIG_FILENAME), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  try {
    return JSON.parse(raw) as ProjectConfig;
  } catch (err) {
    throw new Error(`failed to parse ${CONFIG_FILENAME}: ${errorMessage(err)}`);
  }
}
