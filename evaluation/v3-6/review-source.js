import assert from 'node:assert/strict';

// The semantic reviewer must see the same question and answer that were frozen
// before feedback. Output checksums alone do not include the transcript.
export function assertFrozenReviewItems(items, blindPacket, requestedParts) {
  assert.equal(blindPacket.length, 8);
  assert.equal(items.length, 16);
  assert.deepEqual(Object.keys(requestedParts).sort(), blindPacket.map(item => item.caseId).sort());
  let index = 0;
  for (const source of blindPacket) for (const repeat of [1, 2]) {
    const item = items[index++];
    assert.equal(item.caseId, source.caseId);
    assert.equal(item.repeat, repeat);
    assert.equal(item.inputChecksum, source.inputChecksum);
    assert.deepEqual(item.question, source.question);
    assert.equal(item.transcript, source.transcript);
    assert.deepEqual(item.requestedParts, requestedParts[source.caseId]);
  }
}
