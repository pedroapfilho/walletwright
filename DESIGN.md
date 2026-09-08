---
name: walletwright
description: A docs-native developer-tool world; charcoal ground, Geist, one pass-check green, hairline cards, the API as content.
colors:
  ground: "oklch(0.2 0.008 255)"
  ground-card: "oklch(0.22 0.009 255)"
  ground-raised: "oklch(0.24 0.009 255)"
  ground-well: "oklch(0.17 0.008 255)"
  ink: "oklch(0.95 0.004 255)"
  ink-muted: "oklch(0.72 0.01 255)"
  ink-faint: "oklch(0.56 0.01 255)"
  hairline: "oklch(1 0 0 / 10%)"
  hairline-strong: "oklch(1 0 0 / 18%)"
  pass-green: "oklch(0.8 0.17 150)"
  pass-green-hover: "oklch(0.85 0.17 150)"
  pass-green-ink: "oklch(0.2 0.05 150)"
  pass-green-selection: "oklch(0.8 0.17 150 / 35%)"
  error-red: "oklch(0.72 0.19 25)"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 6vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "normal"
  lede:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body-small:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: "normal"
  code:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  code-inline:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  code-ref:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "1.5rem"
  2xl: "2rem"
  section: "3.5rem"
  column-gap: "4rem"
  hero-top: "5rem"
components:
  button-primary:
    backgroundColor: "{colors.pass-green}"
    textColor: "{colors.pass-green-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1.15rem"
  button-primary-hover:
    backgroundColor: "{colors.pass-green-hover}"
    textColor: "{colors.pass-green-ink}"
  button-ghost:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1.15rem"
  button-ghost-hover:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.ink}"
  button-control:
    backgroundColor: "{colors.ground-well}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.42rem 0.8rem"
  button-control-disabled:
    backgroundColor: "{colors.ground-well}"
    textColor: "{colors.ink-faint}"
  badge-key:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.3rem 0.6rem"
  badge-value:
    backgroundColor: "{colors.ground-card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "0.3rem 0.6rem"
  card:
    backgroundColor: "{colors.ground-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  station:
    backgroundColor: "{colors.ground-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1rem 1.25rem 1.1rem"
  code-block:
    backgroundColor: "{colors.ground-card}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: "1.1rem 1.25rem"
  install-tab:
    backgroundColor: "{colors.ground-card}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    padding: "0.7rem 1rem"
  install-tab-selected:
    backgroundColor: "{colors.ground-card}"
    textColor: "{colors.ink}"
  input-control:
    backgroundColor: "{colors.ground-well}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.4rem 0.6rem"
  link-inline:
    textColor: "{colors.pass-green}"
    typography: "{typography.body}"
---

# Design System: walletwright

## Overview

**Creative North Star: "The Reference"**

walletwright's surfaces look like the first page of its own documentation, the way viem and wagmi
open: a wordmark, one sentence, install tabs, four fact badges, and then the library's six calls set
as a definition list. Nothing on screen is decorative; every block is either something you can
install, call, or verify. The demo dapp carries the same world as a worked example page, a stack of
hairline "stations" whose rows read like `Account —`, `Signature —`, `Error —` until a real wallet
fills them in.

The ground is a near-black charcoal with a faint blue cast, never pure black, and every surface
above it is a step or two lighter with a 1px, 10%-white hairline. Type is Geist at three weights of
grey plus one accent: the pass-check green of a test runner's tick, which appears on the primary
button, the selected install tab, the fact-badge values, inline links, and (in the demo) any value a
wallet has written. Red exists in the demo only, for the error row. There are no shadows, no
gradients, no illustrations, and no eyebrows or kickers above headings; section titles are plain
sentence-case Geist Semi Bold.

Density is documentation density: 15-16px body text, 70rem measure, equal two-column sections where
prose sits left and a filenamed code block sits right. The wallet marks (via `@web3icons/react`) are
the only branded colour on the page beyond the green.

**Key Characteristics:**

- Dark only. The world sets `color-scheme: dark` and pins a single shiki theme; there is no light
  counterpart.
- One accent. Pass-check green (`oklch(0.8 0.17 150)`) is the only chromatic colour the design owns;
  red is a demo-only error state.
- Hairline architecture. Surfaces separate by 1px `oklch(1 0 0 / 10%)` lines and lightness steps,
  never by shadow.
- Code is content. Every code block carries a filename or an accessible label, and every claim on
  the landing page is rendered from `apps/landing/src/lib/content.ts`.
- Tight display, loose body. Negative tracking scales with size (-0.04em at the wordmark, -0.02em at
  headlines, normal below), while running text sits at 1.6 line-height.

## Colors

A three-step charcoal ground, three greys of ink, two alpha-white hairlines, and one green.

### Primary

- **Pass-Check Green** (`{colors.pass-green}`): the accent of a passing test. Fills the primary
  button (with `{colors.pass-green-ink}` text on it), underlines the selected install tab, colours
  the MIT / wallet-count / chain-count badge values, the inline "Getting started →" link, the
  focus-visible outline everywhere, the input caret in the demo, and any demo value a wallet has
  written. Hovering the primary button lifts it to `{colors.pass-green-hover}`.
- **Pass-Check Selection** (`{colors.pass-green-selection}`): the text-selection highlight in both
  apps, 35% green so selected code stays readable.

### Neutral

- **Charcoal Ground** (`{colors.ground}`): the page background of both the landing and the demo,
  and the `<html>` background so overscroll stays in-world.
- **Charcoal Card** (`{colors.ground-card}`): feature cards, code blocks, the install panel, and demo
  stations. One step above ground.
- **Charcoal Raised** (`{colors.ground-raised}`): ghost buttons and badge keys on the landing. Two
  steps above ground; the highest surface in the system.
- **Charcoal Well** (`{colors.ground-well}`): demo-only. Buttons and the message input sit _below_
  the station they live in, so controls read as recessed rather than lifted.
- **Ink** (`{colors.ink}`): headings, the wordmark, button labels, wallet names, code, and any
  `<strong>` in running text.
- **Ink Muted** (`{colors.ink-muted}`): the lede, section body copy, card descriptions, API
  descriptions, nav links at rest, badge keys, and the demo's row labels and chain tags.
- **Ink Faint** (`{colors.ink-faint}`): captions, spec filenames, the footer line, the demo's
  asides, disabled button labels, and the idle "—" marker. The quietest legible grey.
- **Hairline** (`{colors.hairline}`): every border and divider at rest: nav and footer rules,
  section tops, card edges, API rows, wallet rows, code-block heads, demo rows.
- **Hairline Strong** (`{colors.hairline-strong}`): the hover border on ghost buttons, the resting
  border on demo controls and inputs, and the code-block scrollbar thumb.

### Error (demo only)

- **Error Red** (`{colors.error-red}`): the demo's `#error` value once it holds text, prefixed with a
  bold "Error: ". It never appears on the landing page.

### Named Rules

**The One Green Rule.** Pass-check green is the only accent. It marks the one primary action, the
selected state, a proven fact (badge values, written values), and focus. Never introduce a second
hue for emphasis; use weight or a lighter grey instead.

**The Red Is An Error Rule.** Red appears only in a value that holds an error message. It is never a
decorative or "danger button" colour.

**The Alpha Hairline Rule.** Borders are white at 10% (18% when interactive), not a solid grey, so the
same token reads correctly over every charcoal step.

## Typography

**Display / Body Font:** Geist Variable (with ui-sans-serif, system-ui, sans-serif)
**Mono Font:** Geist Mono Variable (with ui-monospace, monospace)
**Demo:** the test dapp uses the system sans stack (ui-sans-serif, system-ui, -apple-system,
"Segoe UI") for text and JetBrains Mono Variable for values, inputs, and spec references, because it
is a Vite page with no Geist bundle.

**Character:** a single humanist grotesk at one weight (600) for every heading and 400 for every
paragraph, so hierarchy comes from size, tracking, and grey rather than from a second face. Mono is
used wherever a string is literal: install commands, API names, filenames, spec paths, and every
value a wallet writes.

### Hierarchy

- **Display** (600, `clamp(3rem, 6vw, 4.5rem)`, line-height 1, tracking -0.04em): the `walletwright`
  wordmark in the hero. Lowercase, one word, the only display-size text on the site.
- **Headline** (600, 1.6rem, line-height 1.2, tracking -0.02em): section titles ("The whole API",
  "Verified wallets", "Setup"). Sentence case, no kicker above.
- **Title** (600, 1.05rem): feature-card headings. In the demo, station headings are 600 at 1rem with
  a mono `· EVM` chain tag beside them.
- **Lede** (400, 1.1875rem, muted): the hero's one sentence, 40ch max, with `<strong>` words in
  full ink.
- **Body** (400, 1rem, line-height 1.6, muted, 52ch max): section prose. The demo body is 0.9375rem
  at 1.55.
- **Body Small** (400-600, 0.9375rem): nav links, buttons (600), card descriptions, API
  descriptions, badge links.
- **Label** (500-600, 0.8125rem): badges, install tabs (0.875rem, 500), code-block heads, captions,
  and all demo controls, row labels, and values.
- **Code** (400, 0.82rem, line-height 1.65, mono): highlighted code blocks. The install command is
  the exception at 0.9375rem, since it is meant to be read at a glance.
- **Code Inline** (400, 0.9rem, mono, full ink): API names in the definition list and `<code>` in
  section prose.
- **Code Ref** (400, 0.75rem, mono, faint): spec filenames in the wallet table and the demo's
  station heads and chain tags.

### Named Rules

**The Tracking-Scales-With-Size Rule.** Negative letter-spacing is proportional to size: -0.04em on
the display wordmark, -0.02em on headlines, and normal on everything smaller. Do not track body or
label text.

**The Literal-Is-Mono Rule.** Anything the reader could paste (a command, a function name, a filename,
a hash, a signature) is set in the mono face. Anything they would read is set in the sans.

**The No-Eyebrow Rule.** Headings stand alone. No uppercase kicker, category label, or step number sits
above an `h2` or `h3`.

## Layout

The landing page is a single centred measure of 70rem with 1.5rem inline padding at every viewport.
The nav is a 3.5rem bar with the check-in-a-square mark left and four text links right, closed by a
hairline. The hero is an equal two-column grid (`minmax(0, 1fr) minmax(0, 1fr)`, 4rem column gap,
2.5rem row gap) with 5rem above and 3rem below: wordmark, lede, and three buttons left; the install
tab panel and badge row right.

Every section after the hero opens with a hairline and 3.5rem of vertical padding. The features
section is a 3-column card grid with 1rem gaps. The API, wallets, and setup sections share one
two-column template (prose and list left, a code block right, 4rem gap, top-aligned). The footer
repeats the hairline and 2rem padding with a licence line left and three links right.

Responsive breakpoints are 64rem and 40rem. At 64rem the hero and two-column sections collapse to one
column (prose above code) and the card grid drops to two columns. At 40rem the hero's top padding
falls to 3rem, the nav wraps to two lines, cards go single-column, and the wallet table drops its
chain and spec columns under the name.

The demo dapp uses a tighter 52rem measure with 1.5rem padding (3rem at the bottom), a masthead of
0.7rem × 1.5rem padding closed by a hairline, and stations stacked with 1rem gaps. Inside a station,
controls sit in a wrapping flex row with 0.6rem × 1rem gaps, and value rows are full-width flex rows
with a fixed 5rem label column. At 40rem the message input stretches to full width.

Spacing rhythm is built on 0.5 / 0.75 / 1 / 1.25 / 1.5 / 2rem inside components and 3.5 / 4 / 5rem
between them.

## Elevation & Depth

There are no shadows. Neither `page.css` nor `demo.css` declares a `box-shadow`, and the base
`--elevation-card` token in `globals.css` is never consumed by the `.ref` world. Depth is tonal: the
ground at L 0.20, cards at 0.22, raised chrome at 0.24, and (in the demo) controls recessed to 0.17,
each edge drawn with a 1px 10%-white hairline. Interactive state raises the hairline to 18% white, or
to green on demo controls; it never adds a glow.

### Named Rules

**The Flat-Ledger Rule.** Surfaces are flat at every state. Elevation is expressed by a lightness step
plus a hairline, never by a shadow, gradient, or blur.

**The Recessed-Control Rule.** In the demo, buttons and inputs are darker than the station around
them (`{colors.ground-well}` inside `{colors.ground-card}`), so the instrument's controls read as
set into the panel rather than floating on it.

## Shapes

Radii come in three steps and map to scale: 6px for small chrome (badges, demo buttons, demo inputs,
the copy button), 8px for landing buttons, and 10px for containers (cards, code blocks, the install
panel, demo stations). Nothing is pill-shaped and nothing is square-cornered.

Every container is bordered with a single hairline; there are no borderless cards. Lists are ruled,
not boxed: API rows, wallet rows, and demo value rows separate with a top hairline only. The selected
install tab is marked by a 2px green bottom border overlapping the tablist's hairline by 1px, so the
green line sits exactly on the rule.

The brand mark is a 24px rounded square (rx 5.5, 1.8px stroke) containing a 2px check, drawn in
`currentColor` so it survives any ink.

## Components

### Buttons

Small, rounded, text-only; the primary is the one green object in the hero.

- **Shape:** rounded (8px) on the landing; slightly tighter (6px) in the demo.
- **Primary:** green fill (`{colors.pass-green}`) with dark green text (`{colors.pass-green-ink}`),
  0.6rem × 1.15rem padding, 0.9375rem Semi Bold. One per surface: "Get started".
- **Primary hover:** fill lifts to `{colors.pass-green-hover}`, 120ms ease.
- **Ghost:** raised charcoal fill (`{colors.ground-raised}`), hairline border, full-ink text, same
  padding and type. Hover strengthens the border to `{colors.hairline-strong}`; the fill does not
  change.
- **Focus-visible:** 2px green outline offset 2px, on every interactive element in both apps.
- **Demo control button:** well fill (`{colors.ground-well}`), strong hairline border, 0.42rem × 0.8rem
  padding, 0.8125rem Semi Bold, system sans. Hover turns the border green; disabled drops the border
  to the plain hairline, dims the label to `{colors.ink-faint}`, and shows `not-allowed`. Sign buttons
  ship disabled until a connect succeeds; that default is part of the selector contract.

### Badges

A key/value pair in a 6px hairline capsule, 0.8125rem.

- **Key:** raised charcoal fill, muted text, right hairline.
- **Value:** card-level fill, full ink at weight 500; the licence, wallet-count, and chain-count
  values render in green. The npm badge's value is a link.

### Install Tabs

A WAI-ARIA tab strip (`role="tablist"`, arrow/Home/End keys) over server-highlighted panels.

- **Panel:** card fill, hairline border, 10px radius, overflow hidden.
- **Tab:** transparent, 0.875rem weight 500, muted text, 0.7rem × 1rem padding, a 2px transparent
  bottom border pulled 1px into the tablist rule.
- **Selected:** text goes to full ink and the bottom border to green.
- **Command:** mono at 0.9375rem, 1.25rem padding, wrapped so it never scrolls.

### Cards

- **Corner style:** 10px.
- **Background:** `{colors.ground-card}` with a hairline border.
- **Shadow strategy:** none (see Elevation & Depth).
- **Internal padding:** 1.25rem.
- **Content:** a 1.05rem Semi Bold title and a 0.9375rem muted paragraph, 0.5rem apart. No icon, no
  link, no hover state; cards are read, not clicked.

### API Definition List

Six `<dt>/<dd>` rows, each opening with a hairline and 0.9rem of vertical padding.

- **Term:** the call signature in mono at 0.9rem, full ink.
- **Description:** 0.9375rem muted sans, 0.25rem below.

### Code Blocks

Shiki with `github-dark-default` pinned by the world's CSS (`--shiki-dark`), inside a card-level
frame.

- **Frame:** card fill, hairline border, 10px radius, overflow hidden.
- **Head:** when a filename is given, a hairline-ruled figcaption in mono at 0.8125rem, muted, with
  the filename left and a 28px copy button right (clipboard icon swapping to a check for 2s, with an
  `aria-live` "Copied").
- **Body:** mono at 0.82rem, line-height 1.65, 1.1rem × 1.25rem padding, thin scrollbar in
  `{colors.hairline-strong}`. `wrap` blocks pre-wrap instead of scrolling (the run output and the
  setup sample).
- **Caption:** an optional faint mono line at 0.8125rem, 0.9rem below the block.

### Wallet Table

A ruled list, not a `<table>`: each row is a four-column grid (`auto 6rem 7rem 1fr`, 0.75rem gap,
0.7rem vertical padding) opening with a hairline.

- **Mark:** a 22px branded wallet icon from `@web3icons/react`.
- **Name:** Semi Bold ink. **Chains:** 0.875rem muted, joined with `·`. **Spec:** 0.75rem faint
  mono, allowed to wrap anywhere.

### Inline Link

Green, weight 500, no underline at rest; underline with a 4px offset on hover. Used once per section
at most ("Getting started →").

### Navigation

A hairline-ruled 3.5rem bar. Links are 0.9375rem muted text with 1.4rem gaps, going to full ink on
hover, with no active state and no underline. The footer reuses the same link style at 2rem padding.

### Demo Station (signature component)

The demo's unit: a 10px hairline card at `{colors.ground-card}` with 1rem × 1.25rem padding.

- **Head:** a baseline-aligned flex row: the wallet name at 1rem Semi Bold with a mono `· Chain` tag
  (0.75rem, muted, `::before` middot) and, right-aligned, the spec path(s) in 0.75rem faint mono.
- **Controls:** a wrapping flex row of control buttons, optional labelled input, and inline rows.
- **Input:** well fill, strong hairline border, 6px radius, mono 0.8125rem, green caret, 16rem min
  width (full width at 40rem). Its `value` is `Hello walletwright` by contract.
- **Row:** a hairline-topped flex row (0.4rem vertical padding) with a 5rem muted label and a mono
  value.
- **Value states:** empty renders a faint `—` via `:empty::before`; filled renders green; an
  `.error` value renders red with a bold `Error: ` prefix. The span's own text is never decorated,
  so Playwright reads the raw account, signature, or message.
- **Aside:** faint 0.8125rem prose, 60ch max, for prerequisites such as the local chain note.

### Named Rules

**The Filename Rule.** A code block carries a filename in its head, or, when there is none to show
(an install command, a captured run), an accessible label plus a visible caption. No anonymous code.

**The Dash-Idle Rule.** An output that has not been written shows `—` in faint ink from CSS, not a
placeholder string in the DOM. The DOM stays empty so the selector contract sees exactly what the
wallet wrote.

**The Selector-Contract Rule.** In the demo, element ids, control element types, `disabled` defaults,
and the `#message` value are Playwright selectors owned by `apps/demo/tests`. Restyle freely; never
rename, retype, re-enable, or re-default them, and never touch `src/main.ts` for design work.

## Do's and Don'ts

### Do:

- **Do** keep every surface dark: `color-scheme: dark`, `{colors.ground}` on `<html>`, and one
  pinned shiki theme. A new page is never light or auto-switching.
- **Do** use pass-check green (`{colors.pass-green}`) for exactly the primary action, the selected
  state, proven facts, focus, and written values; everything else is a grey.
- **Do** separate surfaces with a 1px `{colors.hairline}` and a lightness step; strengthen to
  `{colors.hairline-strong}` (or green in the demo) for hover.
- **Do** give every code block a filename head with a copy button, or an accessible label and a
  caption when there is no file.
- **Do** render every wallet, chain, spec path, sample, and run output from
  `apps/landing/src/lib/content.ts`; the page holds no product claims of its own.
- **Do** set commands, API names, filenames, hashes, and signatures in the mono face at 0.75-0.9375rem.
- **Do** keep headings Geist 600 at 1.6rem with -0.02em tracking, sentence case, standing alone.
- **Do** use the three radii by scale: 6px chrome, 8px buttons, 10px containers.
- **Do** ship a 2px green focus-visible outline with 2px offset on every interactive element.

### Don't:

- **Don't** add a shadow, gradient, glow, or backdrop blur; the system is flat and tonal.
- **Don't** introduce a second accent hue, a coloured icon set, or a tinted card. Wallet marks are the
  only branded colour, and red is reserved for a demo error value.
- **Don't** put an eyebrow, kicker, step number, or uppercase category label above a heading.
- **Don't** track body, label, or code text; negative tracking belongs to the wordmark and headlines
  only.
- **Don't** fabricate testimonials, user counts, benchmarks, or logos; the fact badges (npm, MIT, 5
  wallets, 3 chains) are the full set of proof.
- **Don't** change a demo element's id, control type, `disabled` default, or the `#message` value,
  and don't write placeholder text into an output span; idle is `:empty` plus the CSS `—`.
- **Don't** hover-lift cards or add links to them; feature cards are static reference entries.
- **Don't** use a pill radius, a square corner, or a borderless container.
