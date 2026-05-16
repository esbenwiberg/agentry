import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Generate, GenerateOptions } from "../sdk/types.js";

export type LlmTransport = "api" | "cli" | "openai" | "codex";

const DEFAULT_GENERATE_MODEL = "claude-sonnet-4-6";
const DEFAULT_GENERATE_MODEL_OPENAI = "gpt-4o";
const DEFAULT_GENERATE_MODEL_CODEX = "codex-cli-default";
const DEFAULT_MAX_TOKENS = 4096;

export type CreateGeneratorOptions = {
  transport?: LlmTransport;
  defaultModel?: string;
};

export async function createGenerator(opts: CreateGeneratorOptions = {}): Promise<Generate> {
  const transport = await selectTransport(opts.transport);
  const defaultModel =
    opts.defaultModel ??
    (transport === "codex"
      ? DEFAULT_GENERATE_MODEL_CODEX
      : transport === "openai"
        ? DEFAULT_GENERATE_MODEL_OPENAI
        : DEFAULT_GENERATE_MODEL);
  let apiClient: Anthropic | null = null;
  let openaiClient: OpenAI | null = null;

  return async (prompt: string, callOpts: GenerateOptions = {}): Promise<string> => {
    const model = callOpts.model ?? defaultModel;
    const maxTokens = callOpts.maxTokens ?? DEFAULT_MAX_TOKENS;
    if (transport === "api") {
      if (!apiClient) apiClient = new Anthropic();
      return callApi(apiClient, prompt, { model, maxTokens, system: callOpts.system });
    }
    if (transport === "openai") {
      if (!openaiClient) openaiClient = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL });
      return callApiOpenAI(openaiClient, prompt, { model, maxTokens, system: callOpts.system });
    }
    if (transport === "codex") {
      return callCliCodex(prompt, { model, system: callOpts.system });
    }
    return callCli(prompt, { model, system: callOpts.system });
  };
}

async function selectTransport(pref: LlmTransport | undefined): Promise<LlmTransport> {
  if (pref === "api") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("llm transport `api` requested but ANTHROPIC_API_KEY is not set.");
    }
    return "api";
  }
  if (pref === "openai") {
    if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL) {
      throw new Error(
        "llm transport `openai` requested but neither OPENAI_API_KEY nor OPENAI_BASE_URL is set.",
      );
    }
    return "openai";
  }
  if (pref === "cli") {
    if (!(await claudeOnPath())) {
      throw new Error("llm transport `cli` requested but `claude` is not on PATH.");
    }
    return "cli";
  }
  if (pref === "codex") {
    if (!(await codexOnPath())) {
      throw new Error("llm transport `codex` requested but `codex` is not on PATH.");
    }
    return "codex";
  }
  // auto: Anthropic API key → OpenAI API/base URL → claude CLI → codex CLI
  if (process.env.ANTHROPIC_API_KEY) return "api";
  if (process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL) return "openai";
  if (await claudeOnPath()) return "cli";
  if (await codexOnPath()) return "codex";
  throw new Error(
    "No LLM transport available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY (for CI), " +
      "or install the `claude` CLI or `codex` CLI (for local dev).",
  );
}

async function claudeOnPath(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function codexOnPath(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("codex", ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function callApi(
  client: Anthropic,
  prompt: string,
  opts: { model: string; maxTokens: number; system?: string },
): Promise<string> {
  const response = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (text.length === 0) {
    throw new Error(`llm(api): model returned no text (stop_reason=${response.stop_reason})`);
  }
  return text;
}

async function callApiOpenAI(
  client: OpenAI,
  prompt: string,
  opts: { model: string; maxTokens: number; system?: string },
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }
  messages.push({ role: "user", content: prompt });

  const response = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages,
  });

  const text = response.choices[0]?.message.content ?? "";
  if (text.length === 0) {
    const stopReason = response.choices[0]?.finish_reason ?? "?";
    throw new Error(`llm(openai): model returned no text (finish_reason=${stopReason})`);
  }
  return text;
}

async function callCli(prompt: string, opts: { model: string; system?: string }): Promise<string> {
  const args = ["-p", "--output-format", "json", "--model", opts.model];
  const stdin = opts.system ? `${opts.system}\n\n${prompt}` : prompt;
  const stdout = await spawnClaude(stdin, args);
  let envelope: { is_error?: boolean; result?: string; stop_reason?: string };
  try {
    envelope = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`llm(cli): failed to parse claude JSON envelope: ${(err as Error).message}`);
  }
  if (envelope.is_error) {
    throw new Error(`llm(cli): claude reported error: ${envelope.result ?? "(no message)"}`);
  }
  if (typeof envelope.result !== "string" || envelope.result.length === 0) {
    throw new Error(
      `llm(cli): claude returned no result text (stop_reason=${envelope.stop_reason ?? "?"})`,
    );
  }
  return envelope.result;
}

async function callCliCodex(
  prompt: string,
  opts: { model: string; system?: string },
): Promise<string> {
  const stdin = opts.system ? `${opts.system}\n\n${prompt}` : prompt;
  const stdout = await spawnCodex(stdin, opts.model);
  if (stdout.trim().length === 0) {
    throw new Error("llm(codex): codex returned no output");
  }
  return stdout.trim();
}

function spawnClaude(stdin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.trim() || "(no stderr)"}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin?.write(stdin);
    child.stdin?.end();
  });
}

async function spawnCodex(stdin: string, model: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "repofit-codex-"));
  const outputPath = join(tempDir, "last-message.txt");
  try {
    return await new Promise((resolve, reject) => {
      const args = ["--sandbox", "read-only"];
      if (model !== DEFAULT_GENERATE_MODEL_CODEX) args.push("--model", model);
      args.push("exec", "--output-last-message", outputPath, "-");
      const child = spawn("codex", args, { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (err) => reject(err));
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`codex exited ${code}: ${stderr.trim() || "(no stderr)"}`));
          return;
        }
        readFile(outputPath, "utf8")
          .then(resolve)
          .catch(() => resolve(stdout));
      });
      child.stdin?.write(stdin);
      child.stdin?.end();
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
