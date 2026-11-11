#!/usr/bin/env node
/**
 * Laya (లయ) — Line Count Budget Verifier
 * Enforces architectural modularity rule: all production files strictly < 300 lines.
 */

import fs from 'node:fs';
import path from 'node:path';

const MAX_LINES = 300;
const DIRS_TO_CHECK = ['src', 'public'];
const EXTENSIONS = new Set(['.ts', '.js', '.css']);

let breachCount = 0;
let fileCount = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      scanDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!EXTENSIONS.has(ext)) continue;
      // Skip test suites
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;

      fileCount++;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;

      if (lines > MAX_LINES) {
        console.error(`❌ [BREACH] ${fullPath}: ${lines} lines (budget: ${MAX_LINES})`);
        breachCount++;
      }
    }
  }
}

for (const dir of DIRS_TO_CHECK) {
  scanDir(dir);
}

if (breachCount > 0) {
  console.error(`\n🚨 Found ${breachCount} file(s) exceeding the ${MAX_LINES}-line budget!\n`);
  process.exit(1);
} else {
  console.log(`✅ [LINE BUDGET PASSED] Checked ${fileCount} files. All files are under ${MAX_LINES} lines.\n`);
  process.exit(0);
}
