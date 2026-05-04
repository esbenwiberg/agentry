import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

export function isInteractive(): boolean {
  return Boolean(stdin.isTTY) && Boolean(stdout.isTTY);
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
