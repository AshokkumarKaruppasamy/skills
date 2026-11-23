import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAssistantText,
  parseBoldCreateEvents,
} from "./boldcreate-cli.mjs";

test("parses newline-delimited JSON events and ignores blank lines", () => {
  const parsed = parseBoldCreateEvents([
    '{"type":"assistant","text":"First"}',
    "",
    '{"type":"tool_call","name":"read_file"}',
    '{"type":"assistant","text":"Second"}',
  ].join("\n"));
  assert.equal(parsed.events.length, 3);
  assert.deepEqual(parsed.malformedLines, []);
});

test("preserves malformed JSON lines as diagnostics", () => {
  const parsed = parseBoldCreateEvents('{"type":"assistant"}\nnot-json');
  assert.equal(parsed.events.length, 1);
  assert.deepEqual(parsed.malformedLines, [{ line: 2, content: "not-json" }]);
});

test("extracts assistant text without treating tool calls as answers", () => {
  const answer = extractAssistantText([
    { type: "tool_call", name: "read_file", text: "not the answer" },
    { type: "assistant", text: "Completed the task." },
  ]);
  assert.equal(answer, "Completed the task.");
});

test("extracts text blocks from assistant content arrays", () => {
  const answer = extractAssistantText([{
    type: "assistant",
    content: [{ type: "text", text: "A" }, { type: "text", text: "B" }],
  }]);
  assert.equal(answer, "A\nB");
});
