const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'node_modules/lightweight-charts/dist/typings.d.ts');
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('SeriesAttachedParameter')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
