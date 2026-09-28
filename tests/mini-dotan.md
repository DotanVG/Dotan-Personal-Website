Mini Dotan verification
======================

Run the focused logic checks with Node 22.6+:

```sh
node --experimental-strip-types --test tests/mini-dotan.test.mjs
npm run build
```

The public WebP is the unchanged selected Mini Dotan atlas: 1536×2288,
1,677,838 bytes, SHA-256
`D241653858BE209CEB776BB8E4BE5FB41A5DE97FA0949A8015D4ED2494DC2A7D`.
Frames use explicit scaled pixel offsets. Idle uses six cells; the extra seventh
cell is preserved but not played. No new runtime dependencies were added.

Browser checks performed against the production build:

- Contact opens on click, Enter and Space; Escape restores focus. Focus survives
  the success and “Send another” DOM replacements. Both forms have unique IDs.
- Required-field validation, pending state, closing/reopening during submission,
  failed-response draft retention and successful-response state were checked
  with mocked fetch responses. No test message was sent to Formspree.
- Quiet and hide survive reloads. Footer restore works. Blocked storage does
  not prevent quiet, hide or restore. Reduced motion leaves a still contact button.
- Programmatic scrolling does not hop; wheel scrolling does. Gesture/cooldown
  and both direction calculations also have focused unit coverage.
- A settled Zota item produces its authoritative content after the 45-second
  message interval. Ambient messages are capped at three per mount.
- Explore has no companion DOM. Its implementation is not imported by the pet.
- Light/dark screenshots and 320×568, 390×844 and desktop layouts inspected.
  Small bubbles scroll internally. All used atlas rows inspected at 88px and
  108px, including all sixteen look poses; no blank frames or crop bleed.

Real iOS/Android software keyboards were not available; visual-viewport resize
handling is implemented, and constrained viewport layout was checked in Chromium.
The build retains the existing unrelated Open Graph image lint warning.

Drag-and-drop follow-up
-----------------------

The pet supports touch, mouse and pen dragging after 12px of movement, then docks
at the nearest bottom corner. The selected side is a storage-safe boolean.
Settings offer the equivalent move button without requiring dragging. Open forms
and pending submissions cannot be dragged. Quiet/reduced-motion users can still
place the pet manually, without locomotion animation.

The dependency-free browser regression test uses Chromium CDP to generate actual
touch events. With the production preview on port 3009 and an automation browser
open, run:

```sh
node tests/mini-dotan-drag.browser.mjs <browser-CDP-websocket-URL>
```

Use an isolated browser session: the test resets the three pet preferences and
sets a 393×852 touch viewport. It checks both walking rows, drop click suppression,
touch cancellation, small finger jitter, quiet-mode placement, page scroll
isolation and tapping contact after a drag. Walking rows 1 and 2 were also visually
inspected at 88px and 108px. This is Chromium touch emulation, not a physical iPhone.
