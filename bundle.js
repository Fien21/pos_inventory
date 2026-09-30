const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const outputFile = path.join(projectRoot, 'pos_inventory_codebase.txt');

// Dirs/files to include
const targets = [
  'client/src',
  'client/package.json',
  'server/src',
  'server/prisma/schema.prisma',
  'server/prisma/seed.ts',
  'server/package.json'
];

// Extensions to include
const validExts = ['.ts', '.tsx', '.json', '.prisma', '.css', '.html'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (validExts.includes(path.extname(file)) || path.basename(file) === 'package.json') {
        results.push(file);
      }
    }
  });
  return results;
}

let allFiles = [];

targets.forEach(target => {
  const fullPath = path.join(projectRoot, target);
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      allFiles = allFiles.concat(walk(fullPath));
    } else {
      allFiles.push(fullPath);
    }
  }
});

let outputContent = `POS Inventory Codebase Dump\nGenerated on ${new Date().toISOString()}\n\n`;

allFiles.forEach(file => {
  const relPath = path.relative(projectRoot, file);
  const content = fs.readFileSync(file, 'utf-8');
  outputContent += `\n================================================================================\n`;
  outputContent += `FILE: ${relPath}\n`;
  outputContent += `================================================================================\n\n`;
  outputContent += content + `\n`;
});

fs.writeFileSync(outputFile, outputContent);
console.log(`Successfully bundled ${allFiles.length} files into ${outputFile}`);
