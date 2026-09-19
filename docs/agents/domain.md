# Domain documentation

This project has a single domain context:

- Read `CONTEXT.md` for the product vocabulary and protected distinctions, particularly Answer Attempt versus generated assistance.
- Read applicable decisions in `docs/adr/` before changing behaviour. ADR 0017 governs the current selected-resume and optional-revision flow.
- Treat `docs/learner-flow-discussion.md` (its final second-round decisions) and current verification documents as feature-spec and evidence sources.

Do not alter stored learner records, frozen Job Snapshots, or previous Answer Attempts merely to fit a new workflow.
