import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// Find all .ts and .tsx files in watson directories
const dirs = [
  'app/watson-excel-validator',
  'components/watson',
  'hooks/watson',
  'lib/watson',
  'lib/watson-firebase.ts',
  'types/watson',
];

const files = execSync(
  `find ${dirs.join(' ')} -name '*.ts' -o -name '*.tsx'`,
  { cwd: process.cwd(), encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

const replacements = [
  ['@/lib/firebase', '@/lib/watson-firebase'],
  ['@/components/OfflinePage', '@/components/watson/OfflinePage'],
  ['@/components/providers', '@/components/watson/providers'],
  ['@/components/ui/', '@/components/watson/ui/'],
  ['@/components/editor/', '@/components/watson/editor/'],
  ['@/components/export/', '@/components/watson/export/'],
  ['@/components/logs/', '@/components/watson/logs/'],
  ['@/components/pricelist/', '@/components/watson/pricelist/'],
  ['@/components/promotion/', '@/components/watson/promotion/'],
  ['@/components/suggestions/', '@/components/watson/suggestions/'],
  ['@/components/table/', '@/components/watson/table/'],
  ['@/components/upload/', '@/components/watson/upload/'],
  ['@/components/validation/', '@/components/watson/validation/'],
  ['@/hooks/use', '@/hooks/watson/use'],
  ['@/lib/validators', '@/lib/watson/validators'],
  ['@/lib/excel-parser', '@/lib/watson/excel-parser'],
  ['@/lib/excel-exporter', '@/lib/watson/excel-exporter'],
  ['@/lib/auto-fixer', '@/lib/watson/auto-fixer'],
  ['@/lib/fix-suggestions', '@/lib/watson/fix-suggestions'],
  ['@/lib/fmcode-mapping', '@/lib/watson/fmcode-mapping'],
  ['@/lib/price-optimizer', '@/lib/watson/price-optimizer'],
  ['@/lib/api-utils', '@/lib/watson/api-utils'],
  ['"@/lib/utils"', '"@/lib/watson/utils"'],
  ['@/types/invoice', '@/types/watson/invoice'],
  ['@/types/pricelist', '@/types/watson/pricelist'],
  ['@/types/promotion', '@/types/watson/promotion'],
  ['@/types/activity', '@/types/watson/activity'],
];

let totalChanges = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let changed = false;
  
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
    }
  }
  
  if (changed) {
    writeFileSync(file, content);
    totalChanges++;
    console.log(`✅ ${file}`);
  }
}

console.log(`\nDone! Fixed imports in ${totalChanges} files.`);
