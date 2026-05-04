import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { spawnSync } from "node:child_process";

export function isInteractive(): boolean {
  return Boolean(stdin.isTTY) && Boolean(stdout.isTTY);
}

export async function chooseConflictAction(
  target: string,
  src: string,
  dest: string,
): Promise<"keep" | "overwrite"> {
  while (true) {
    const ans = await ask(
      `  ${target} differs. [k]eep / [o]verwrite / [d]iff: `,
      "k",
    );
    const c = ans.trim().toLowerCase()[0] ?? "k";
    if (c === "k") return "keep";
    if (c === "o") return "overwrite";
    if (c === "d") {
      spawnSync(
        "git",
        ["--no-pager", "diff", "--no-index", "--color=auto", dest, src],
        { stdio: "inherit" },
      );
      continue;
    }
  }
}

export async function ask(question: string, defaultAnswer?: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const ans = (await rl.question(question)).trim();
    if (ans === "" && defaultAnswer !== undefined) return defaultAnswer;
    return ans;
  } finally {
    rl.close();
  }
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const ans = (await ask(`${question} ${hint} `, defaultYes ? "y" : "n")).toLowerCase();
  return ans.startsWith("y");
}
