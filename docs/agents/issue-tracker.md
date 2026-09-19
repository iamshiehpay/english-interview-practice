# Issue tracker: Local Markdown

Issues and feature PRDs live in this repository. Historical and active implementation issues are Markdown files in `docs/issues/`; feature PRDs live in `docs/`.

## Conventions

- One issue per `docs/issues/<NNNN>-<slug>.md` file.
- Put `Status:` near the top of each issue and use the vocabulary in `triage-labels.md`.
- Link the parent PRD and blockers in the issue body.
- Append implementation notes under `## Comments`; do not rewrite historical acceptance evidence.

## Publishing and fetching

When an engineering skill says to publish an issue, create the next numbered file in `docs/issues/`. When it says to fetch an issue, read the referenced Markdown file.
