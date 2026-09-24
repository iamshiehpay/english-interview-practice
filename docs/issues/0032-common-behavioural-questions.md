---
status: ready-for-agent
---

# Five common behavioural questions in a collapsed 「常見行為題」 block

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

52–59

## Context

Extends the Common Questions mechanism from 0031. The behavioural items are
Common Questions of category `behavioral`, shown after the job-grounded
questions in their own collapsed block, not counted in the 8–12 and never picked
by short mock sessions (those keep job-grounded behavioural questions). A learner
without a matching experience relies on the existing hints and hypothetical
framing; nothing may invent experience (ADR 0018).

## What to build

- Add five items to the Common Questions list, each with a reserved id
  (e.g. `common-behavioral-conflict`, `-failure`, `-deadline`, `-ownership`,
  `-learning`), category `behavioral`, `capabilityIds: []`, group `behavioral`,
  and an app-authored English and Chinese rationale containing a one-line STAR
  hint (情境、任務、行動、結果). Initial wording from the PRD, to be proof-read in
  this slice:
  1. `Tell me about a time you disagreed with a teammate. How did you handle it?` / 「說一次你和隊友意見不同的經驗：你怎麼處理、結果如何？」
  2. `Tell me about a time you made a mistake or failed. What did you learn?` / 「說一次你犯錯或失敗的經驗：你從中學到什麼、之後怎麼改進？」
  3. `Tell me about a time you had to deliver under a tight deadline. How did you prioritise?` / 「說一次在很緊的期限內交付的經驗：你怎麼排優先順序、取捨了什麼？」
  4. `Tell me about a time you took ownership of a problem that was not assigned to you.` / 「說一次你主動承擔不屬於你分內的問題：你為什麼出手、做了什麼、結果如何？」
  5. `Tell me about a time you had to learn a new technology quickly. How did you approach it?` / 「說一次你必須快速學會新技術的經驗：你怎麼學、怎麼確認自己真的會用？」
- The workbench renders them in a 「常見行為題」 block after the job-grounded
  questions, collapsed by default, labelled as common (not job-grounded)
  questions; counts become e.g. 「常見題 6｜職缺題目 8」.
- They are practised, coached and stored per job like any other question.
- Short mock sessions never select them.

## Acceptance criteria

- [ ] The served Question Set contains the five items after the job-grounded questions, each with text, gloss, STAR-hint rationale, category `behavioral`, empty capability list and group `behavioral`.
- [ ] An Answer Attempt on one of them receives feedback through the fake provider.
- [ ] Short mock sessions never include them, across repeated session creation.
- [ ] The UI shows the collapsed 「常見行為題」 block after the job-grounded questions and the separated counts; browser smoke asserts the block and that it starts collapsed.
- [ ] The self-introduction stays pinned at the top and remains role-fit.
- [ ] `npm test` and `npm run test:browser` pass.

## Files likely touched

- The common-questions module from 0031
- `public/app.js`, possibly `public/styles.css`
- `test/questions.test.js`, `test/mock-sessions.test.js`, `test/browser-smoke.js`

## How to verify

```sh
node --check public/app.js
npm test
npm run test:browser
```

## Blocked by

- [Issue 0031](./0031-common-questions-self-introduction.md)

## Comments
