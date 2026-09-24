# 0037 — Job Snapshot direct-link handoff

`http://127.0.0.1:<app-port>/#/snapshots/<UUID>` opens a saved Job Snapshot on initial load. An existing Question Set shows its recommended question; an unanalyzed snapshot offers a deliberate **產生題目** action. Opening the link alone creates neither an analysis nor a Practice Record. Malformed, unknown, and deleted IDs show practice history with an error. Normal navigation clears the link so a later reload opens Home instead of reopening the snapshot. The 104 import skill reports the route only after a successful snapshot POST.

The browser regression uses a temporary workspace, an ephemeral loopback port, and the fake language provider. Run `npm run test:browser:deep-links`. It covers analyzed and unanalyzed entry, unknown and deleted IDs, malformed routes, no automatic model calls or records, and return to normal navigation. No real practice data or port 4310 is involved.
