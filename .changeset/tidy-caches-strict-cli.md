---
"@walletwright/core": minor
---

Fix a set of state-representation defects found by a repo-wide simplification audit.

**Caches now publish from staging.** Extension extraction and the onboarded profile build both wrote
in place, so an interrupted run (Ctrl-C, ENOSPC, a CI timeout, a flaky MV3 worker) could leave a
partial directory that still satisfied the "does it exist" check every later run made. That surfaced
much later as an unlock or selector timeout rather than as a build failure. Both now build inside the
cache and publish by rename. Profile replacement keeps the prior cache at a recovery path until the
new one lands, so a failed or interrupted publication can restore it.

**`launchWallet` no longer leaks its throwaway profile copy.** Cleanup was bound to the browser
context's `close` event, which does not exist yet if the profile copy or the launch itself fails, and
which nobody awaited. `launchWallet` now returns `close()` alongside `context` and `wallet`: it closes
the browser and then awaits removal of the copy. `context.close()` still triggers a best-effort
cleanup, so existing code keeps working, but `close()` is the documented path.

**Approval handling is more precise.** A popup respawned mid-approval is now positioned on screen like
the first one (it previously skipped that, and an off-screen window renders fine but refuses clicks).
The "did it close" check now tracks the exact page it drove instead of scanning the context for any
matching URL, which reported failure whenever a wallet chained a second popup or left a notification
window on its home screen. That check also now applies to `connectToDapp()`, which could previously
report success on a popup that never closed. MetaMask's `reject` gained the third-party-notice
dismissal and retry that `approve` already had, since the notice covers the whole footer.

**The `cache` CLI validates its flags.** It now uses `node:util`'s `parseArgs` in strict mode, so an
unknown flag, a flag missing its value, `--headless false` (which used to turn headless _on_), and
`--wallet=value` are all handled correctly instead of silently ignored or inverted. `--setup` combined
with a flag it would discard is now an error. Failures set `process.exitCode` rather than calling
`process.exit`, which could truncate the error message when stderr was piped.

**The mocks give each install its own bridge.** Installing `installMockWallet` or
`installMockStandardWallet` twice with different options used to discard the second handler while
returning its address, so the page signed with the first install's key on the first install's chain.

**Breaking (types only):** `WalletDefinition.reject` is now required. Every wallet in the registry
already declares it, and the public `Wallet` type has always promised rejection unconditionally, so
this only affects external code that annotates a `WalletDefinition` literal by hand. `isWalletKind` is
now exported.
