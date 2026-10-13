---
"@walletwright/core": minor
---

`WalletDefinition` declares its approval window under one member, `approval`, in place of `approve`, `reject`, `approvalControls`, `notificationMatch`, and `headlessApprovals`. It names the `confirm` and `cancel` controls, how to click them, the `screens` a wallet can put in front of a request, the window's `urlMatch`, and `headless`. The engine now drives every approval itself: it re-authenticates through the shared unlock flow when a window asks for the password again and fails if the password field does not clear, clicks each control at most once, and waits for the window to close under one set of budgets. An approval that never completes fails naming the controls it clicked, where a Slush re-authentication used to pass without checking that it took.
