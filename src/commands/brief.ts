import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { emitBrief } from "../scan/brief.js";
import { findLatestBundle } from "../scan/writer.js";

export interface BriefCliOptions {
  cwd: string;
  scanDir?: string;
}

export async function runBriefCommand(
  options: BriefCliOptions,
): Promise<number> {
  let bundleDir: string;
  if (options.scanDir) {
    bundleDir = isAbsolute(options.scanDir)
      ? options.scanDir
      : resolve(options.cwd, options.scanDir);
    if (!existsSync(bundleDir)) {
      console.error(`agentry brief: scan bundle not found at ${bundleDir}`);
      return 1;
    }
  } else {
    const latest = await findLatestBundle(options.cwd);
    if (!latest) {
      console.error(
        `agentry brief: no scan bundle found under ${options.cwd}/.agentry/scan/.\nRun 'agentry scan' first.`,
      );
      return 1;
    }
    bundleDir = latest;
  }

  try {
    const { briefPath } = await emitBrief(bundleDir);
    const rel = relative(options.cwd, briefPath) || briefPath;
    console.log(`agentry brief — ${rel}`);
    console.log("");
    console.log(
      "Hand the file above to your agent. The brief tells it how to read the bundle and what to produce.",
    );
    return 0;
  } catch (err) {
    console.error(`agentry brief: ${(err as Error).message}`);
    return 1;
  }
}
