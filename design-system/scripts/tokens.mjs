import { readFile, writeFile } from 'node:fs/promises';
const tokens = JSON.parse(await readFile(new URL('../public/tokens.json', import.meta.url), 'utf8'));
const rules = Object.entries(tokens).flatMap(([group, values]) =>
  Object.entries(values).map(([name, value]) => `  --hndrd-${group}-${name}: ${value};`),
);
await writeFile(
  new URL('../public/tokens.css', import.meta.url),
  `/* Generated from tokens.json; edit the JSON source. */\n:root {\n${rules.join('\n')}\n}\n`,
);
