# Command line

`node tools/shellback.mjs` is the one entry point for people and agents.

```bash
node tools/shellback.mjs commands --json   # every command, machine-readable
node tools/shellback.mjs commands          # the same list for people
node tools/shellback.mjs run build         # run one command (same as npm run build)
```

The registry is read from `package.json` scripts, so the CLI and npm cannot drift. Each script needs a summary in `tools/shellback.mjs`. `tests/unit/cli-parity.test.ts` fails when a script has no summary, when the registry and `package.json` disagree, or when a command names a tool that does not exist.

Unknown names exit with code 2. `run` exits with the status of the command it ran.
