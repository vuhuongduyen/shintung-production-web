import fs from "node:fs";

const source = process.argv[2];
const target = process.argv[3];
if (!source || !target) throw new Error("Usage: node import-base-forecast.js input.txt output.json");

const rawLines = fs.readFileSync(source, "utf8").split(/\r?\n/);
const lines = [];
for (let i = 0; i < rawLines.length; i += 1) {
  const trimmed = rawLines[i].trim();
  if (/^\d{2}\/\d{4}$/.test(trimmed)) {
    let j = i + 1;
    while (j < rawLines.length && !rawLines[j].trim()) j += 1;
    if (j < rawLines.length && !/^\d{2}\/\d{4}/.test(rawLines[j].trim())) {
      lines.push(`${trimmed} ${rawLines[j].trim()}`);
      i = j;
      continue;
    }
  }
  lines.push(rawLines[i]);
}

const number = (value) => Number(String(value).replace(/,/g, ""));
const records = [];
for (const line of lines) {
  const match = line.trim().match(/^(\d{2}\/\d{4})\s+(.*?)\s+([A-Z0-9]{7,12})\s{2,}(.*)$/);
  if (!match) continue;
  const [, month, group, sku, rest] = match;
  const parts = rest.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
  const numericStart = parts.findIndex((part, index) => {
    if (index < 1 || parts.length - index < 7) return false;
    return parts.slice(index, index + 7).every((value) => /^-?[\d,.]+$/.test(value));
  });
  if (numericStart < 1) continue;
  const pre = parts.slice(0, numericStart);
  const values = parts.slice(numericStart, numericStart + 7).map(number);
  const warning = parts.slice(numericStart + 7).join(" ");
  let lineCode = "";
  if (/^(A|B|C|NK)$/.test(pre.at(-1) || "")) lineCode = pre.pop();
  const name = pre.shift() || "";
  const spec = pre.join(" ");
  records.push({
    month, group: group.trim(), sku, name, spec, line: lineCode,
    f30: values[0], f60: values[1], f90: values[2], d30: values[3],
    d60: values[4], used: values[5], d90: values[6], warning,
  });
}

records.sort((a, b) => a.month.localeCompare(b.month) || a.group.localeCompare(b.group, "vi") || a.sku.localeCompare(b.sku));
fs.writeFileSync(target, `${JSON.stringify(records, null, 2)}\n`);
const summary = Object.groupBy(records, (row) => row.month);
console.log(Object.fromEntries(Object.entries(summary).map(([month, rows]) => [month, { rows: rows.length, f30: rows.reduce((s, r) => s + r.f30, 0), f60: rows.reduce((s, r) => s + r.f60, 0), f90: rows.reduce((s, r) => s + r.f90, 0) }])));
