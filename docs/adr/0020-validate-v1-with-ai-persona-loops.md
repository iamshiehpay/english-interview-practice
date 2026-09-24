# Validate v1.0.0 with AI persona Practice Loops and AI-reviewed labels

## Decision

Version 1.0.0 is an **AI-validated** release. Its Practice Loop gate is five AI persona loops attested by an AI verifier, never in the creator's name. Its twenty Evaluation Case labels are drafted by a rater persona and individually approved by an independent AI reviewer, identified as AI-reviewed in the artifacts and release report. Real creator use and human labels are post-v1.0.0 work. The original creator validation mode remains available for that later work.

This amends [ADR 0014](0014-require-a-small-versioned-evaluation-suite.md) for v1.0.0 only: its rule that human-labelled expectations are primary does not apply to this release. Deterministic constraints and the existing evaluation coverage remain required; an AI label cannot override a failed constraint.

## AI persona Practice Loop

One loop means an AI agent drives the real local application's UI through one complete Practice Loop, with a real language-model provider rather than the fake provider. Before starting, the agent documents the persona's background and then answers within it without inventing further experience. The completed loop leaves a real Practice Record id and links to a document under `docs/verification/` that records the walkthrough. An AI verifier checks the ledger against those records and signs `attestedBy` and `attestedAt`; `creator` remains `null`. The ledger marks every persona loop `synthetic: true`, names its `persona`, and links its `evidence`.

Across the five loops together, the gate still requires at least two Job Snapshots, at least two Question Categories, one Experience Gap, and one induced failure followed by recovery. Every record id is unique. Runs 2–5 of the [2026-09-23 walkthrough](../verification/persona-walkthrough-2026-09-23.md) count as the first four loops. The fifth loop, on a Common Question, and the independent AI attestation follow in issue 0034.

## Rationale and accepted risk

The creator chose to release a useful v1.0.0 without making their personal availability the final gate. Persona loops and independently reviewed AI labels exercise the application pipeline, UI, evidence handling and evaluation workflow while preserving the four coverage requirements. Their provenance is explicit so a reader can assess the evidence without mistaking it for human use.

This bar does **not** validate a real learner's comprehension, motivation or voice. The walkthrough used text answers and fake speech, so it is not evidence for real speech. AI-reviewed labels are not human judgment. Nothing in v1.0.0 may be described as human-validated. Real creator Practice Loops, real speech use and human-reviewed labels remain work after v1.0.0.
