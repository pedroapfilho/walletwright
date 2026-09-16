# shadcn visual comparison

Before: `1af006429fa6357fbf9d2a4bac4e51a975c96529` (PR merge base).

After UI source: `f7cb6172b341ef3b1b4b9bacc28b3d5744febae7`. Later commits in this PR only add review evidence.

The Open popover now anchors below its trigger instead of covering the viewport corner. Stock control sizes and menu spacing change; documentation content and branding remain.

Manually compared matching desktop (1280×800) and mobile (390×844) viewports in Chromium, light theme, reduced motion. No horizontal overflow or unexpected clipping was observed in the sampled after states. This covers the pages/states below, not every screen, authenticated flow, or dark-mode state.

## Introduction, Open popover expanded

App: `docs`. Route: `/`. Same route and state on both commits.

Desktop

| Before                                     | After                                    |
| ------------------------------------------ | ---------------------------------------- |
| ![Before](page-actions-desktop-before.png) | ![After](page-actions-desktop-after.png) |

Mobile

| Before                                    | After                                   |
| ----------------------------------------- | --------------------------------------- |
| ![Before](page-actions-mobile-before.png) | ![After](page-actions-mobile-after.png) |
