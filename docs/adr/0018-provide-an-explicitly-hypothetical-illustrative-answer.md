---
status: accepted
---

# Provide an explicitly hypothetical Illustrative Answer for stuck learners

Learners who genuinely do not know how to answer wanted a full English answer to
adapt, but the coach otherwise never hands out answers and never invents the
learner's experience. We add an optional `illustrative` coaching mode, offered
before answering inside the collapsed 「不知道怎麼回答」 section (parallel to, not
replacing, the Chinese `gap` framing), that returns a concrete but explicitly
hypothetical English answer — no fabricated metrics, employers, ownership or
outcomes presented as real — always wrapped in an app-fixed "hypothetical;
replace with your own experience" caveat the model cannot omit, and never counted
as an Answer Attempt or reused as the learner's history.

## Considered options

- **Reshape `gap` to output a full English answer** — rejected: it would lose the
  short Traditional Chinese thinking scaffold `gap` provides today.
- **Allow concrete fictional specifics (invented numbers/employers)** — rejected:
  a learner could paste fabricated claims into a real interview.
- **Let the model write the caveat in `explanationZh`** — rejected: the model
  could weaken or drop the one safeguard that makes the feature safe.

## Consequences

- Touches the checksum-protected model contract surface: a new `illustrative`
  mode in `coachingContract` and `validateCoaching` (English `text` via
  `hasLatin`, **excluded** from the transcript numeric-invention check because the
  answer is hypothetical and has no source transcript), the fake provider, the
  mode allowlist in the server, and the practice UI.
- The versioned evaluation baseline must be re-captured after implementation,
  since model-contract code changes are detected by the offline review.
- Deliberately accepts a small anchoring risk (a full answer shown before the
  learner attempts) because the section is opt-in and addresses the explicit
  "I truly don't know" case.
