import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadReporterPlugins } from "../src/loader/reporters.js";

/**
 * We can't directly require dynamic test modules from disk through the
 * package-resolution machinery without setting up a fixture package, so
 * these tests focus on the validation surface (missing default export,
 * duplicate names, error messages).
 *
 * End-to-end loading is covered by exercising a real reporter plugin from
 * examples/reporter-csv/ in a separate test below.
 */

describe("loadReporterPlugins — validation", () => {
  test("returns empty array when no plugins configured", async () => {
    expect(await loadReporterPlugins(undefined)).toEqual([]);
    expect(await loadReporterPlugins([])).toEqual([]);
  });

  test("rejects a package that fails to import", async () => {
    await expect(
      loadReporterPlugins([{ package: "@example/definitely-not-installed-xyz123" }]),
    ).rejects.toThrow(/failed to load reporter/);
  });
});

describe("loadReporterPlugins — real plugin from a temp file:// URL", () => {
  let tmp: string;
  let pkgDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-rep-"));
    pkgDir = join(tmp, "node_modules", "@x", "good");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: "@x/good", version: "1.0.0", type: "module", main: "./index.js" }),
    );
    writeFileSync(
      join(pkgDir, "index.js"),
      [
        "export default {",
        "  name: 'good',",
        "  describe: 'a tiny test reporter',",
        "  render(ctx) { return 'OK ' + JSON.stringify(ctx.options); },",
        "};",
      ].join("\n"),
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("loads a default-exported Reporter and threads options through", async () => {
    // Import via the file:// URL the package's main entry resolves to. We
    // bypass node_modules walk by passing the absolute index.js path.
    const indexPath = `file://${join(pkgDir, "index.js")}`;
    const loaded = await loadReporterPlugins([{ package: indexPath, options: { foo: 1 } }]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.reporter.name).toBe("good");
    expect(loaded[0]?.reporter.describe).toBe("a tiny test reporter");
    expect(loaded[0]?.options).toEqual({ foo: 1 });
    const out = await loaded[0]?.reporter.render({ cwd: tmp, report: {}, options: { foo: 1 } });
    expect(out).toBe('OK {"foo":1}');
  });

  test("supports a factory default export: (options) => Reporter", async () => {
    writeFileSync(
      join(pkgDir, "index.js"),
      [
        "export default (options) => ({",
        "  name: 'factory',",
        "  render() { return 'opt=' + options.tag; },",
        "});",
      ].join("\n"),
    );
    const indexPath = `file://${join(pkgDir, "index.js")}`;
    const loaded = await loadReporterPlugins([{ package: indexPath, options: { tag: "bar" } }]);
    const out = await loaded[0]?.reporter.render({ cwd: tmp, report: {}, options: { tag: "bar" } });
    expect(out).toBe("opt=bar");
  });

  test("rejects a package with no default export", async () => {
    writeFileSync(
      join(pkgDir, "index.js"),
      "export const notDefault = { name: 'x', render: () => '' };\n",
    );
    const indexPath = `file://${join(pkgDir, "index.js")}`;
    await expect(loadReporterPlugins([{ package: indexPath }])).rejects.toThrow(
      /no default export/,
    );
  });

  test("rejects a Reporter missing the name field", async () => {
    writeFileSync(join(pkgDir, "index.js"), "export default { render() { return ''; } };\n");
    const indexPath = `file://${join(pkgDir, "index.js")}`;
    await expect(loadReporterPlugins([{ package: indexPath }])).rejects.toThrow(/non-empty name/);
  });

  test("rejects duplicate reporter names across plugins", async () => {
    const otherDir = join(tmp, "node_modules", "@x", "dup");
    mkdirSync(otherDir, { recursive: true });
    writeFileSync(
      join(otherDir, "index.js"),
      "export default { name: 'good', render() { return ''; } };\n",
    );
    const a = `file://${join(pkgDir, "index.js")}`;
    const b = `file://${join(otherDir, "index.js")}`;
    await expect(loadReporterPlugins([{ package: a }, { package: b }])).rejects.toThrow(
      /names must be unique/,
    );
  });
});
