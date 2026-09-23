# Workbench + annotated feedback mockup

Static design mockup for the UI direction confirmed on 2026-09-23 (see `../../../ui-direction-discussion.md`). It is not wired to the app.

Open `index.html` in a browser. Tabs switch views; a URL hash opens one directly (`#desktop`, `#mobile`, `#home`, `#mock`, `#compare`), and a `-clean` suffix (e.g. `#home-clean`) hides the legend and notes for screenshots.

- `index.html`: one self-contained file (Google Fonts only). Design tokens are defined in its `:root` and listed in the legend at the top, ready to carry into `public/style.css`.
- `current/`: screenshots of the UI as of 2026-09-23 (fake provider), used by the 現況對照 view.
- `screenshots/`: the proposal at 1440 and 390 wide.

Feedback content uses the field names from `src/model-schemas.js`; every quote is matched word for word against the sample transcript at load time (a console warning is logged if one is not found).
