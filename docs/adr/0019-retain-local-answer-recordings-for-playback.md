---
status: accepted
---

# Retain local answer recordings for playback

The learner wants to replay their own spoken answers from Practice Records, including comparing answer versions, and confirmed local storage on 2026-09-21. The next voice delivery will retain submitted-answer recordings in the Local Workspace, associate each with its own answer version, and delete them with their owning practice data; editing a transcript must not alter or misrepresent the original recording. This supersedes ADR 0013's delete-after-transcription default for these retained recordings, while preserving its other data-minimization and disclosure principles.

This is an accepted requirement, not an implemented capability. Existing transcript-only records remain readable without fabricated audio; temporary failed/discarded uploads still require cleanup, while retained recordings must be distinguished from temporary files. Local retention does not decide whether transcription uses a local or external provider, nor authorize new cloud storage or audio-based pronunciation scoring.
