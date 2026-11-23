# BoldCreate CLI evaluation

The BoldCreate executor is invoked in print mode and requests newline-delimited
JSON events. The process boundary lives in `boldcreate-cli.mjs`; it preserves
raw stdout/stderr and parsed events so an adapter can retain execution evidence.

## Authentication

For CI, configure repository or organization secrets and expose them to the
evaluation job as environment variables:

- `BOLDCREATE_CLIENT_ID`
- `BOLDCREATE_CLIENT_SECRET`

Do not place credentials in prompts, command-line arguments, checked-in files,
or result artifacts. For API-key authentication, pass an explicit model with
`--model` or set `BOLDCREATE_MODEL`.

## Execution contract

The helper invokes:

```text
boldcreate -p <prompt> --mode json --no-session --yes [--model <id>] [--cwd <dir>]
```

It treats exit codes other than zero, malformed JSONL output, empty event
streams, and process timeouts as execution failures. Exit code 3 means the CLI
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
