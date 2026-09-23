---
status: awaiting-human-validation
---

# Hide the question in listening mode

## Parent

[PRD — Voice practice](../prd-voice-practice.md)

## User stories covered

54–62

## Related

Confirmed on 2026-09-21 in
[`voice-practice-discussion.md`](../voice-practice-discussion.md) §"追加確認：聽力模式".
Builds on issue 0014 (read aloud).

## What to build

An opt-in **listening mode**. In a real interview the question arrives by ear only;
today the product always shows it, which is right for the default reading-along
experience and wrong for anyone who wants to practise taking a question in by ear.

A toggle sits beside the read-aloud control wherever a **question** can be read
aloud: the single-question practice screen, the question inside a Practice Record,
a Follow-up Question, and a Short Mock Session question. The Illustrative Answer
and Key-Sentence Correction rewrites are reference text, not questions, and are out
of scope.

The toggle is **off by default**, so the existing behaviour — English question and
Traditional Chinese meaning both on screen — is unchanged unless the learner asks
for it. The choice is remembered across screens and reloads as a per-viewer
convenience; it is a display preference, not practice data, so it does not belong
in the Practice Record.

With the mode on, pressing play hides the English question text and its Chinese
meaning, and a **"顯示題目"** control stays visible the whole time. When the audio
ends the text does **not** come back by itself — working out what was heard is the
point — so revealing it is always a deliberate click. Revealing is per question:
moving to another question starts hidden again while the mode is on.

Two failure rules matter more than the feature itself:

- If read-aloud fails for any reason, the question is revealed immediately. A
  learner must never end up unable to both hear and read it.
- If no read-aloud service is configured, the toggle is not rendered at all, so it
  never offers something that cannot happen.

Hidden text is removed from the accessibility tree, not merely painted over, so a
screen-reader user gets the same experience rather than a silently different one.
The state change is announced.

## Acceptance criteria

- [x] A listening-mode toggle appears beside the question read-aloud control on the
      question screen, in a Practice Record, on a Follow-up Question and in a Short
      Mock Session.
- [x] The toggle is off by default and the current behaviour is unchanged while off.
- [x] The choice is remembered across screens and across a page reload, and a
      browser that refuses storage still works with the mode simply off.
- [x] With the mode on, pressing play hides the English question and its Chinese
      meaning.
- [x] A "顯示題目" control is visible the whole time the text is hidden and reveals
      it in one click.
- [x] The text does not reappear on its own when the audio ends.
- [x] Moving to another question starts hidden again while the mode is on.
- [x] A read-aloud failure reveals the question immediately.
- [x] The toggle is not rendered when the speech provider cannot speak.
- [x] Hidden text is removed from the accessibility tree, and the change is
      announced to assistive technology.
- [x] Turning the mode off while the text is hidden reveals it.
- [x] No Practice Record, Short Mock Session or workspace field is added or changed;
      this is presentation only, and no HTTP contract changes.
- [x] Browser smoke covers: default off, enabling, hiding on play, one-click reveal,
      no auto-reveal on end, reveal on failure, and persistence across a reload.

## Out of Scope

- Hiding the Illustrative Answer or Key-Sentence Correction rewrites.
- Any listening comprehension scoring, replay limits or "how many times did you
  listen" tracking.
- Changing the default reading-along experience.
- Dictation (typing what you heard and being marked on it).

## Blocked by

- [Issue 0014](./0014-read-english-practice-text-aloud.md) (completed)

## Verification

Implemented and verified through the browser seam and a real-browser walk.
[Evidence](../verification/0021.md). Whether it genuinely helps listening practice
is pending learner acceptance.
