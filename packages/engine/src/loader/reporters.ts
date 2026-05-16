import type { Reporter } from "../sdk/types.js";
import { errorMessage } from "../util/error-message.js";
import type { ReporterPlugin } from "./config.js";

export type LoadedReporter = {
  reporter: Reporter;
  package: string;
  options: Record<string, unknown>;
};

/**
 * Reporter packages export `default` as either a `Reporter` or a function
 * `(options) => Reporter`. The function form lets a single package ship a
 * parameterised reporter without separate entry points.
 */
type ReporterModule = {
  default?: Reporter | ((options: Record<string, unknown>) => Reporter);
};

export async function loadReporterPlugins(
  plugins: ReporterPlugin[] | undefined,
): Promise<LoadedReporter[]> {
  if (!plugins || plugins.length === 0) return [];

  const loaded: LoadedReporter[] = [];
  const seenNames = new Set<string>();
  for (const plugin of plugins) {
    let mod: ReporterModule;
    try {
      mod = (await import(plugin.package)) as ReporterModule;
    } catch (err) {
      throw new Error(`failed to load reporter '${plugin.package}': ${errorMessage(err)}`);
    }
    const exported = mod.default;
    if (exported === undefined) {
      throw new Error(`reporter '${plugin.package}' has no default export`);
    }

    const options = plugin.options ?? {};
    const reporter = typeof exported === "function" ? exported(options) : exported;
    if (!reporter || typeof reporter.name !== "string" || reporter.name.length === 0) {
      throw new Error(`reporter '${plugin.package}' must export a Reporter with a non-empty name`);
    }
    if (typeof reporter.render !== "function") {
      throw new Error(`reporter '${plugin.package}' must export a render(ctx) function`);
    }
    if (seenNames.has(reporter.name)) {
      throw new Error(
        `reporter name '${reporter.name}' is registered by more than one plugin — names must be unique`,
      );
    }
    seenNames.add(reporter.name);
    loaded.push({ reporter, package: plugin.package, options });
  }
  return loaded;
}
