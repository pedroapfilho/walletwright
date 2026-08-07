---
"@walletwright/core": patch
---

Fix the `walletwright` CLI doing nothing when run from an installed package.

The entry guard compared `import.meta.url` against a raw `process.argv[1]`. Node resolves the
former through symlinks and leaves the latter alone, so every invocation through
`node_modules/.bin/walletwright` (a symlink under any pnpm install) compared unequal, skipped
`main()`, and exited 0 without output. The guard now resolves the entry path first.

With the CLI reachable again, `walletwright --help` and `walletwright -h` print the help text
instead of erroring with "unknown command": flags are now parsed from the whole argv rather than
only the tokens after a command, so a leading flag is seen.
