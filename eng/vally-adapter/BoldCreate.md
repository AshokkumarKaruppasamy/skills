# BoldCreate CLI evaluation

The BoldCreate executor is invoked in print mode and requests newline-delimited
JSON events. The process boundary lives in `boldcreate-cli.mjs`; it preserves
raw stdout/stderr and parsed events so an adapter can retain execution evidence.

## Authentication

For CI, configure repository or organization secrets and expose them to the
evaluation job as environment variables:

- `BOLDCREATE_CLIENT_ID` (organization API key client ID, starts with `key_`)
- `BOLDCREATE_CLIENT_SECRET`
- Alternatively, `BOLDCREATE_TOKEN` (sign-in token)

Do not place credentials in prompts, command-line arguments, checked-in files,
or result artifacts. For API-key authentication, the model list is unavailable; pass an explicit model with
`--model` or set `BOLDCREATE_MODEL`.

## Execution contract

The helper invokes:

```text
boldcreate -p <prompt> --mode json --no-session --yes [--model <id>] [--cwd <dir>]
```

It treats exit codes other than zero, malformed JSONL output, empty event
streams, and process timeouts as execution failures. `--yes` automatically
approves every action, so only run evaluations in an isolated, disposable
workspace with the minimum required credentials. Exit code 3 means the CLI
stopped for approval; CI should not silently convert that state into a model
answer.

## Windows

The process is spawned with an argument array and `shell: false`; prompts are
not interpolated into a shell command. The helper uses Node.js process APIs and
path values supplied by the caller, so it does not depend on Bash, GNU
`timeout`, or POSIX path separators. Install BoldCreate using the documented
PowerShell installer, then ensure `boldcreate` is available on `PATH`.

## Tests

Run the focused protocol tests with:

```powershell
node --test eng/vally-adapter/boldcreate-cli.test.mjs
```

These tests cover JSONL parsing and assistant-text extraction. They do not
replace an authenticated end-to-end evaluation against the BoldCreate service.


## Current integration status

This is the initial BoldCreate process boundary and the adapter now accepts an
explicit `--execution-lane boldcreate-cli` label when it is given a legacy
agent-evaluation result document. The repository's current Vally skill lane
still runs through Vally, and the existing native agent workflow still invokes
skill-validator. A complete replacement of those execution paths requires a
scenario/workspace runner that materializes each eval's fixtures and skill
availability for baseline and treatment arms, then emits the adapter's
legacy result contract. The existing Vally comparison and LLM-judge policy
remain authoritative; this helper does not replace them.
