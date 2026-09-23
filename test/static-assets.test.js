import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './helpers.js';

const fonts = ['inter-latin-400-normal', 'inter-latin-500-normal', 'inter-latin-600-normal', 'inter-latin-700-normal', 'jetbrains-mono-latin-400-normal', 'jetbrains-mono-latin-500-normal'];

test('self-hosted fonts are served as woff2 from this origin (ADR 0013: no third-party request on page load)', async t => {
  const {base} = await harness(t);
  for (const font of fonts) {
    const res = await fetch(`${base}/fonts/${font}.woff2`);
    assert.equal(res.status, 200, font);
    assert.equal(res.headers.get('content-type'), 'font/woff2', font);
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'wOF2', font);
  }
  assert.equal((await fetch(`${base}/fonts/missing.woff2`)).status, 404);
  assert.equal((await fetch(`${base}/fonts/LICENSE-Inter.txt`)).status, 404);
});

test('the page references no third-party origin and the CSP stays same-origin', async t => {
  const {base} = await harness(t);
  const page = await fetch(`${base}/`);
  const csp = page.headers.get('content-security-policy');
  assert.equal(csp, "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'");
  const html = await page.text();
  const css = await (await fetch(`${base}/style.css`)).text();
  assert.doesNotMatch(html + css, /https?:\/\//);
  for (const font of fonts) assert.match(css, new RegExp(`url\\("/fonts/${font}\\.woff2"\\)`));
});
