import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CANDIDATE_CONTRACT_VERSION} from './evidence-first-candidate.js';

const root = dirname(fileURLToPath(import.meta.url));
const read = async name => JSON.parse(await readFile(join(root, name), 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const [source, partsByOriginalId, originalPacket] = await Promise.all([
  read('pilot-inputs.json'), read('pilot-question-parts.json'), read('pilot-blind-packet.json')
]);
assert.equal(source.length, 8);
assert.equal(new Set(source.map(item => item.caseId)).size, 8);
assert.deepEqual(Object.keys(partsByOriginalId).sort(), source.map(item => item.caseId).sort());
assert.deepEqual(source.map(({caseId, question, transcript}) => ({
  caseId,
  inputChecksum: hash({contractVersion: CANDIDATE_CONTRACT_VERSION, question, transcript}),
  contractVersion: CANDIDATE_CONTRACT_VERSION,
  question,
  transcript
})), originalPacket, 'Original committed packet changed');

const packet = source.map((item, index) => {
  const caseId = `c${String(index + 1).padStart(2, '0')}`;
  const question = {...item.question, id: caseId};
  const transcript = item.transcript;
  const requestedParts = partsByOriginalId[item.caseId];
  assert.ok(Array.isArray(requestedParts) && requestedParts.length > 0 && new Set(requestedParts).size === requestedParts.length);
  assert.ok(requestedParts.every(part => typeof part === 'string' && part.length > 0 && question.text.includes(part)));
  return {
    caseId,
    inputChecksum: hash({packetVersion: 2, contractVersion: CANDIDATE_CONTRACT_VERSION, question, transcript, requestedParts}),
    packetVersion: 2,
    contractVersion: CANDIDATE_CONTRACT_VERSION,
    question,
    transcript,
    requestedParts
  };
});
assert.deepEqual(new Set(packet.map(item => item.question.category)), new Set(['role-fit', 'experience-depth', 'behavioral', 'technical-communication']));
const output = join(root, 'pilot-blind-packet-v2.json');
try {
  assert.deepEqual(await read('pilot-blind-packet-v2.json'), packet, 'Frozen v2 blind packet differs from source');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await writeFile(output, JSON.stringify(packet, null, 2) + '\n', {flag: 'wx'});
}
console.log(JSON.stringify({path: 'evaluation/v3-7/pilot-blind-packet-v2.json', cases: packet.length, checksum: hash(packet)}));
