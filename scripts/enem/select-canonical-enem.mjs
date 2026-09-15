import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function selectCanonicalEntries(inventory) {
  const selections = [];
  const years = [...new Set((inventory?.entries || []).map(entry => entry.year))].sort((a, b) => a - b);
  for (const year of years) {
    for (const day of [1, 2]) selections.push(selectYearDay(inventory.entries, year, day));
  }
  return selections;
}

function selectYearDay(entries, year, day) {
  const pool = entries.filter(entry => entry.year === year && entry.day === day && entry.application === 'regular');
  const standardProofs = pool.filter(entry => entry.documentKind === 'prova' && isStandardPrinted(entry));
  const preferred = standardProofs.filter(entry => preferredLabel(entry.sourceLabel, day));
  const candidates = preferred.length ? primaryDayCandidates(preferred, day) : primaryDayCandidates(standardProofs, day);
  if (!candidates.length) throw new Error(`missing canonical prova for ${year} day ${day}`);
  if (candidates.length !== 1) throw new Error(`ambiguous canonical prova for ${year} day ${day}`);

  const prova = candidates[0];
  const matchingKeys = matchingAnswerKeys(pool, prova);
  if (matchingKeys.length !== 1) throw new Error(`missing matching gabarito for ${year} day ${day}`);

  return {
    year,
    day,
    selectionReason: preferred.length ? 'preferred-caderno' : 'fallback-first-standard-caderno',
    prova,
    gabarito: matchingKeys[0]
  };
}

function isStandardPrinted(entry) {
  return !/(ampliada|superampliada|braile|ledor|libras|dosvox|nvda)/i.test(entry.sourceLabel || '');
}

function preferredLabel(label, day) {
  return day === 1
    ? /caderno\s*1\s*[-–]\s*azul/i.test(label || '')
    : /caderno\s*5\s*[-–]\s*amarelo/i.test(label || '');
}

function primaryDayCandidates(entries, day) {
  const primary = entries.filter(entry => officialDay(entry) === day);
  return primary.length ? primary : entries;
}

function matchingAnswerKeys(pool, prova) {
  const sameLabel = pool.filter(entry => entry.documentKind === 'gabarito' && entry.sourceLabel === prova.sourceLabel);
  const provaDay = officialDay(prova);
  if (provaDay === null) return sameLabel;
  const sameOfficialDay = sameLabel.filter(entry => officialDay(entry) === provaDay);
  return sameOfficialDay.length ? sameOfficialDay : sameLabel;
}

function officialDay(entry) {
  const path = new URL(entry.officialUrl).pathname.toLocaleLowerCase();
  const match = path.match(/(?:^|[_-])d([123])(?:[_-]|\\.)/);
  return match ? Number(match[1]) : null;
}

async function main() {
  const inventoryPath = argumentValue('--inventory');
  const outputPath = argumentValue('--output');
  if (!inventoryPath || !outputPath) throw new Error('missing --inventory or --output');
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const selections = selectCanonicalEntries(inventory);
  if (selections.length !== 34) throw new Error(`expected 34 canonical cadernos, received ${selections.length}`);
  const output = {
    schema: 'bsestudos.enem-canonical-selection.v1',
    generatedAt: new Date().toISOString(),
    sourceInventory: inventoryPath.replaceAll('\\', '/'),
    cadernoCount: selections.length,
    gabaritoCount: selections.length,
    selections
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ cadernoCount: selections.length, gabaritoCount: selections.length }));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] || null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
