import * as fs from "fs";
import * as path from "path";

const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "..", "doc_prompt", "products.txt");
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : inputPath.replace(/\.txt$/i, ".json");

interface ProductListEntry {
  productId: string;
  barcode: string;
  description: string;
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTextProductList(filePath: string): ProductListEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const entries = new Map<string, ProductListEntry>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = normalizeText(rawLine)
      .replace(/Untitled folder/g, "")
      .trim();

    if (!line) {
      continue;
    }

    const match = line.match(/^(SK-[A-Z]+-\d+)(?:_|\s+)([0-9_]+)\s+(.+)$/i);

    if (!match) {
      console.log(`⚠️  Skipping unrecognized line: ${rawLine}`);
      continue;
    }

    const productId = normalizeText(match[1]).replace(/_+$/g, "");
    const barcode = normalizeText(match[2]).replace(/_/g, "");
    const description = normalizeText(match[3]);

    if (!entries.has(productId)) {
      entries.set(productId, { productId, barcode, description });
    }
  }

  return Array.from(entries.values());
}

if (!fs.existsSync(inputPath)) {
  console.error(`❌ Input file not found: ${inputPath}`);
  process.exit(1);
}

const entries = parseTextProductList(inputPath);
fs.writeFileSync(outputPath, `${JSON.stringify(entries, null, 2)}\n`, "utf-8");

console.log(`✅ Parsed ${entries.length} unique products`);
console.log(`📄 Input : ${inputPath}`);
console.log(`📝 Output: ${outputPath}`);
