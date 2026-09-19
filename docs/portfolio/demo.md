# Two-and-a-half-minute demo

[Watch the recorded synthetic demonstration](demo.webm) — 2:30.30, with explanatory captions and no audio narration. Captured locally on2026-09-18; demonstration providers only.

Prerequisites: Node22 or newer, npm, a modern browser, a terminal in this project's directory. No dependency install, account, API key, microphone or external network is needed for the default demo. The optional automated smoke requires the separately installed `agent-browser` CLI and its browser.

Start an isolated demo workspace (macOS/Linux):

```sh
WORKSPACE_DIR="$(mktemp -d /tmp/interview-coach-demo.XXXXXX)" PORT=4318 COACH_LANGUAGE_PROVIDER=fake COACH_SPEECH_PROVIDER=fake GREENHOUSE_BOARD= npm start
```

Open `http://127.0.0.1:4318`. If the port is occupied, choose another port and open that port instead. This explicit configuration keeps existing personal workspaces and credentials out of the demonstration.

| Time | Action and narration |
|---|---|
| 0:00–0:20 | Show the named demonstration providers. Explain that ratings and speech are illustrative; the product requires reviewable evidence. |
| 0:20–0:40 | Paste the two-line JD below, select **Save Job Snapshot**, then **Generate Question Set**. |
| 0:40–1:00 | Show a verbatim capability citation, four question categories, recommendation and manual selection. Select the first **Practise this question**. |
| 1:00–1:25 | Type the first answer below. Select **Save answer**, then **Get feedback / Retry**. Point to four ratings, the exact quote and one priority. A reference answer remains unavailable. |
| 1:25–1:50 | Type the revision. Save and request feedback again. Show the two attempts and comparison; state that fixed demo ratings cannot establish improvement. |
| 1:50–2:15 | Enter the Focus Point below and select **Save Practice Record**. Reload and reopen the completed record. |
| 2:15–2:30 | Show the evaluation summary and explain pending human labels, live quality evaluation and five creator loops. |

JD:

```text
Build reliable Python APIs.
Explain engineering trade-offs.
```

First answer: `I would build an API.`

Revision: `I would validate inputs and test timeout failures because clients need predictable behavior.`

Focus Point: `Explain one concrete trade-off`

Teardown: use the application's delete-all-local-data control with its exact confirmation if desired, then Ctrl-C in the terminal. The temporary directory is disposable; no personal workspace was selected.

The underlying click flow is automated by `npm run test:browser`. The recorded run follows this timed flow through automated browser interactions. Neither the video nor browser smoke counts as creator real-use validation.

Optional video capture: install `agent-browser` with its browser and FFmpeg available on `PATH`, then run `node evaluation/record-demo.js`. It drives the same isolated fake-provider flow with explanatory captions for150seconds and writes `docs/portfolio/demo.webm`. These tools are capture prerequisites, not application runtime dependencies.
