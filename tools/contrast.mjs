// WCAG 2.x contrast ratio calculator. Run: node tools/contrast.mjs
// Reads the colour tokens straight from frontend/src/styles/tokens.scss so the
// paths never drift from the real palette.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = join(here, '..', 'frontend', 'src', 'styles', 'tokens.scss');

/** Parses `--color-foo: #rrggbb;` declarations into a { foo: '#rrggbb' } map. */
function readColorTokens(path) {
  const css = readFileSync(path, 'utf8');
  const tokens = {};
  const re = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const t = readColorTokens(TOKENS_PATH);

// [label, foregroundTokenOrHex, backgroundTokenOrHex, threshold]
const c = (name) => t[name] ?? name; // allow raw hex (e.g. '#ffffff')

const pairs = [
  ['text / bg', 'text', 'bg', 4.5],
  ['text / surface', 'text', 'surface', 4.5],
  ['text / surface-alt', 'text', 'surface-alt', 4.5],
  ['text-soft / surface', 'text-soft', 'surface', 4.5],
  ['text-soft / bg', 'text-soft', 'bg', 4.5],
  ['text-soft / surface-alt', 'text-soft', 'surface-alt', 4.5],
  ['on-primary / primary (button)', 'on-primary', 'primary', 4.5],
  ['on-primary / primary-hover', 'on-primary', 'primary-hover', 4.5],
  ['primary / surface (link)', 'primary', 'surface', 4.5],
  ['on-bar / bar', 'on-bar', 'bar', 4.5],
  ['positive / surface', 'positive', 'surface', 4.5],
  ['negative / surface', 'negative', 'surface', 4.5],
  ['warning / surface', 'warning', 'surface', 4.5],
  ['positive / positive-bg (chip)', 'positive', 'positive-bg', 4.5],
  ['negative / negative-bg (chip)', 'negative', 'negative-bg', 4.5],
  ['warning / warning-bg (chip)', 'warning', 'warning-bg', 4.5],
  ['border-input / surface (UI)', 'border-input', 'surface', 3.0],
  ['text / accent-soft', 'text', 'accent-soft', 4.5],
];

console.log(`Tokens read from: ${TOKENS_PATH}`);
console.log('WCAG contrast ratios (threshold: 4.5 text, 3.0 UI)\n');
let failures = 0;
for (const [label, fg, bg, threshold] of pairs) {
  const r = ratio(c(fg), c(bg));
  const pass = r >= threshold;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  (>=${threshold})  ${label}`);
}
if (failures > 0) {
  console.error(`\n${failures} pair(s) below threshold.`);
  process.exit(1);
}
