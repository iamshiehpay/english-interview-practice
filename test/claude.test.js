import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClaudeLanguageModel, configuredProviders} from '../src/cloud.js';

test('Claude adapter posts to the Anthropic Messages API and parses the JSON reply', async () => {
  const calls = [];
  const provider = new ClaudeLanguageModel({apiKey:'test-key', fetcher: async (url, options) => {
    calls.push({url, options});
    return new Response(JSON.stringify({content:[{type:'text', text:JSON.stringify({capabilities:[], questions:[]})}]}), {status:200});
  }});
  const result = await provider.analyze({snapshot:{text:'Build reliable APIs.'}});
  assert.deepEqual(result, {capabilities:[], questions:[]});
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].options.headers['x-api-key'], 'test-key');
  assert.equal(calls[0].options.headers['anthropic-version'], '2023-06-01');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, 'claude-sonnet-5');
  assert.equal(body.output_config.effort, 'high');
  assert.ok(body.system.includes('untrusted data'));
  assert.equal(body.messages[0].role, 'user');
});

test('Claude adapter extracts JSON even when the model wraps it in prose or fences', async () => {
  const provider = new ClaudeLanguageModel({apiKey:'k', fetcher: async () => new Response(JSON.stringify({content:[{type:'thinking', text:'hmm'},{type:'text', text:'```json\n{"text":"ok","meaningZh":"好"}\n```'}]}), {status:200})});
  assert.deepEqual(await provider.followUp({primaryQuestion:{text:'Q'}, primaryAnswer:{transcript:'A'}, previousFollowUps:[]}), {text:'ok', meaningZh:'好'});
});

test('Claude adapter rejects an unparseable reply as a provider error', async () => {
  const provider = new ClaudeLanguageModel({apiKey:'k', fetcher: async () => new Response(JSON.stringify({content:[{type:'text', text:'not json at all'}]}), {status:200})});
  await assert.rejects(() => provider.analyze({snapshot:{text:'x'}}), /Invalid model JSON output/);
});

test('configuredProviders selects Claude by env and requires an API key', () => {
  const {languageModel} = configuredProviders({COACH_LANGUAGE_PROVIDER:'claude', ANTHROPIC_API_KEY:'k'});
  assert.equal(languageModel.name, 'Claude / claude-sonnet-5');
  assert.equal(languageModel.effort, 'high');
  assert.ok(languageModel.external);
  const {languageModel:custom} = configuredProviders({COACH_LANGUAGE_PROVIDER:'claude', ANTHROPIC_API_KEY:'k', COACH_CLAUDE_MODEL:'claude-opus-5'});
  assert.equal(custom.name, 'Claude / claude-opus-5');
  assert.throws(() => configuredProviders({COACH_LANGUAGE_PROVIDER:'claude'}), /ANTHROPIC_API_KEY is required/);
});

test('an empty COACH_CLAUDE_EFFORT omits output_config (Haiku escape hatch)', async () => {
  const {languageModel} = configuredProviders({COACH_LANGUAGE_PROVIDER:'claude', ANTHROPIC_API_KEY:'k', COACH_CLAUDE_MODEL:'claude-haiku-4-5', COACH_CLAUDE_EFFORT:''});
  assert.equal(languageModel.effort, '');
  let sentBody;
  languageModel.fetcher = async (_url, options) => { sentBody = JSON.parse(options.body); return new Response(JSON.stringify({content:[{type:'text', text:'{"capabilities":[],"questions":[]}'}]}), {status:200}); };
  await languageModel.analyze({snapshot:{text:'x'}});
  assert.equal(sentBody.output_config, undefined);
  assert.equal(sentBody.model, 'claude-haiku-4-5');
});
