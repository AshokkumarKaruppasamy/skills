#!/usr/bin/env node

/**
 * Small process boundary for BoldCreate print-mode evaluations.
 *
 * The CLI's --json protocol is newline-delimited JSON. Keep the raw events as
 * evidence and never treat a non-zero exit as a successful model response.
 */

import { spawn } from "node:child_process";

export function parseBoldCreateEvents(stdout) {
  const events = [];
  const malformedLines = [];
  for (const [index, rawLine] of String(stdout ?? "").split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      malformedLines.push({ line: index + 1, content: rawLine });
    }
  }
  return { events, malformedLines };
}

export function extractAssistantText(events) {
  const chunks = [];
  for (const event of events ?? []) {
    if (!event || typeof event !== "object") continue;
    const type = String(event.type ?? event.event ?? "").toLowerCase();
    if (!/(assistant|message|text|response)/.test(type)) continue;
    const value = event.text ?? event.content ?? event.message?.content
      ?? event.data?.text ?? event.data?.content;
    if (typeof value === "string" && value.trim()) chunks.push(value);
    else if (Array.isArray(value)) {
      for (const part of value) {
        if (typeof part === "string") chunks.push(part);
        else if (typeof part?.text === "string") chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export function runBoldCreate(prompt, options = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Promise.reject(new TypeError("BoldCreate prompt must be a non-empty string"));
  }
  const command = options.command ?? "boldcreate";
  const args = [
    "-p",
    prompt,
    "--mode", "json",
    "--no-session",
    "--yes",
  ];
  if (options.model) args.push("--model", options.model);
  if (options.cwd) args.push("--cwd", options.cwd);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = options.timeoutMs ?? 120_000;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`BoldCreate timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => finish(error));
    child.on("close", (exitCode, signal) => {
      const parsed = parseBoldCreateEvents(stdout);
      const result = {
        exitCode: exitCode ?? 1,
        signal: signal ?? null,
        stdout,
        stderr,
        events: parsed.events,
        malformedLines: parsed.malformedLines,
        answer: extractAssistantText(parsed.events),
        model: options.model ?? process.env.BOLDCREATE_MODEL ?? null,
      };
      if (result.exitCode !== 0) {
        const error = new Error(
          `BoldCreate exited with code ${result.exitCode}${signal ? ` (signal ${signal})` : ""}`,
        );
        error.result = result;
        finish(error);
      } else if (result.malformedLines.length) {
        const error = new Error("BoldCreate emitted malformed JSON event lines");
        error.result = result;
        finish(error);
      } else if (!result.events.length) {
        const error = new Error("BoldCreate emitted no JSON events");
        error.result = result;
        finish(error);
      } else {
        finish(null, result);
      }
    });
  });
}
