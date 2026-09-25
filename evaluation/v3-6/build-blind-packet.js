import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CANDIDATE_CONTRACT_VERSION} from './evidence-first-candidate.js';

const directory = dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(await readFile(join(directory, 'pilot-inputs.json'), 'utf8'));
const requestedParts = JSON.parse(await readFile(join(directory, 'pilot-question-parts.json'), 'utf8'));
assert.equal(source.length, 8);
assert.equal(new Set(source.map(item => item.caseId)).size, source.length);
assert.ok(source.every(item => item.question?.id === item.caseId && item.question.text?.trim() && item.transcript?.trim()));
assert.deepEqual(new Set(source.map(item => item.question.category)), new Set(['role-fit', 'experience-depth', 'behavioral', 'technical-communication']));
assert.deepEqual(Object.keys(requestedParts).sort(), source.map(item => item.caseId).sort());
for (const item of source) {
  const parts = requestedParts[item.caseId];
  assert.ok(Array.isArray(parts) && parts.length > 0 && new Set(parts).size === parts.length);
  assert.ok(parts.every(part => typeof part === 'string' && part.length > 0 && item.question.text.includes(part)));
}
const checksum = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const packet = source.map(({caseId, question, transcript}) => ({
  caseId,
  inputChecksum: checksum({contractVersion: CANDIDATE_CONTRACT_VERSION, question, transcript}),
  contractVersion: CANDIDATE_CONTRACT_VERSION,
  question,
  transcript
}));
const output = join(directory, 'pilot-blind-packet.json');
try {
  const saved = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(saved, packet, 'Frozen blind packet differs from source; preserve the old packet and create a new version');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await writeFile(output, JSON.stringify(packet, null, 2) + '\n', {flag: 'wx'});
}
console.log(JSON.stringify({path: 'evaluation/v3-6/pilot-blind-packet.json', cases: packet.length, checksum: checksum(packet), requestedPartsChecksum: checksum(requestedParts)}));
