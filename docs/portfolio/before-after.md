# Synthetic before-and-after example

**Demonstration only.** These are the exact synthetic transcripts used by the browser smoke test. They are not a real learner's answers or evidence of measured learning improvement. Provider: Deterministic demonstration provider; every rating is fixed at2.

JD:

> Build reliable Python APIs.
> Explain engineering trade-offs.

Question (role-fit, linked to the first JD line):

> Why does this responsibility interest you, and what would you aim to learn? Focus: Build reliable Python APIs.

First attempt:

> I would build an API.

Revised attempt:

> I would validate inputs and test timeout failures because clients need predictable behavior.

Both receive the same displayed priority: “Explain one concrete example or trade-off supporting your approach.” The first report quotes the exact first attempt; the second report quotes the exact revision above. The comparison shows relevance2→2, support2→2, structure2→2 and English expression2→2. The revision names concrete checks and a reason, but this fake feedback does not measure whether it adequately answers the role-fit question.

Saved Focus Point:

> Explain one concrete trade-off

Reproduce via `npm run test:browser` or follow [the demo](demo.md). The test saves both attempts, opens the comparison, saves this Focus Point, reloads and reopens the completed record. No real candidate achievement is implied.
