---
status: accepted
---

# Host an isolated public demo on Cloud Run

The portfolio will include a public Google Cloud Run demo while the creator's real practice remains in the Local Workspace. The public deployment uses only deterministic demonstration providers and gives each anonymous visitor an isolated Public Demo Workspace copied from synthetic seed data; it accepts no creator credentials or personal workspace, expires idle workspaces after one hour, bounds workspace and session volume, and may lose all demo state when an instance stops.

This intentionally extends ADR 0008's local-only hosting boundary without turning the product into a multi-user service. A real hosted product would require accounts, durable shared storage, access control and a separate privacy decision. Cloud Run is limited to one normally active instance, scales to zero, listens on its injected port, and is deployed from a reviewed container through GitHub Workload Identity Federation. The local command remains loopback-only and keeps its existing provider and persistence behavior.

## Consequences

The public demo is labelled as synthetic and asks visitors not to enter real personal data. A random secure cookie selects a temporary workspace but is not an account or authentication credential. Infrastructure, cost alerts and deployment automation may observe service health and aggregate session counts, never job descriptions, resumes, transcripts, feedback or recordings. Passing a deployment smoke test does not change the blocked v1.0.0 evaluation decision.
