// Extracts and decodes ASCII85+Flate streams from the PDF, then prints readable text ops.
const fs = require('fs');
const zlib = require('zlib');

const raw = fs.readFileSync(process.argv[2] || 'challenge.pdf', 'latin1');

// ASCII85 decode (ReportLab variant, ignores whitespace, ends with ~>)
function a85decode(str) {
  let cleaned = str.replace(/\s+/g, '');
  if (cleaned.endsWith('~>')) cleaned = cleaned.slice(0, -2);
  // handle 'z' shorthand
  let out = [];
  let group = [];
  const pushGroup = (g) => {
    let n = 0;
    for (let i = 0; i < 5; i++) n = n * 85 + (i < g.length ? g[i].charCodeAt(0) - 33 : 84);
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...bytes.slice(0, g.length - 1));
  };
  for (const ch of cleaned) {
    if (ch === 'z') { pushGroup([]); continue; }
    group.push(ch);
    if (group.length === 5) { pushGroup(group); group = []; }
  }
  if (group.length) pushGroup(group);
  return Buffer.from(out);
}

// Find all stream objects with ASCII85Decode/FlateDecode filters
const streamRe = /(\d+)\s+0\s+obj[\s\S]*?\/Filter\s*\[\s*\/ASCII85Decode\s*\/FlateDecode\s*\][\s\S]*?>>\s*stream\r?\n?([\s\S]*?)endstream/g;
let m;
const decodedObjects = {};
while ((m = streamRe.exec(raw)) !== null) {
  const objNum = m[1];
  let data = m[2];
  // trim trailing EOL before endstream
  data = data.replace(/\r?\n$/, '');
  try {
    const bin = a85decode(data);
    const inflated = zlib.inflateSync(bin).toString('latin1');
    decodedObjects[objNum] = inflated;
  } catch (e) {
    console.error(`obj ${objNum}: decode failed: ${e.message}`);
  }
}

// Parse content streams: extract text show operations
function extractText(content) {
  const parts = [];
  // Match (string) Tj and [ (a) (b) ] TJ patterns, including escaped chars
  const tokRe = /\((?:\\.|[^\\()])*\)|\bTj\b|\bTJ\b|\bT\*\b|\bTd\b|\bTD\b|\bET\b|\/F\d+ [\d.]+ Tf/g;
  let current = '';
  let line = '';
  const lines = [];
  let tokens = content.match(tokRe) || [];
  for (const tok of tokens) {
    if (tok.startsWith('(')) {
      current += unescapePdfString(tok);
    } else if (tok === 'Tj') {
      line += current; current = '';
    } else if (tok === 'TJ') {
      line += current; current = '';
    } else if (tok === 'T*' || tok === 'TD' || tok === 'Td') {
      if (line || current) { lines.push(line + current); }
      line = ''; current = '';
    } else if (tok === 'ET') {
      if (line || current) { lines.push(line + current); }
      line = ''; current = '';
    }
  }
  if (line || current) lines.push(line + current);
  return lines;
}

function unescapePdfString(tok) {
  let s = tok.slice(1, -1);
  s = s.replace(/\\([nrtbf()\\])/g, (_, c) => {
    const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
    return map[c];
  });
  s = s.replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
  return s;
}

for (const [objNum, content] of Object.entries(decodedObjects)) {
  console.log(`\n===== OBJECT ${objNum} =====`);
  const lines = extractText(content);
  for (const l of lines) console.log(l);
}
