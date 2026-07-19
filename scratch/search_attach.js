const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'node_modules/lightweight-charts-drawing/dist/lightweight-charts-drawing.es.js');
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf-8');
  console.log('Found file. Has attachPrimitive:', content.includes('attachPrimitive'));
  
  // Let's print some lines containing attachPrimitive
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('attachPrimitive')) {
      console.log(`${idx + 1}: ${line}`);
    }
  });
} else {
  console.log('File not found at:', file);
}
