/**
 * @file services/ExportService.ts
 * @description CSV and JSONL export / import utilities.
 * Pure functions with no VS Code dependencies — easy to unit-test.
 */

import type { JsonlRow } from '../types';

// ── CSV export ──────────────────────────────────────────────────────────────

/**
 * Converts an array of rows to a CSV string.
 * Columns are derived from the union of all row keys (preserving insertion order).
 */
export function toCSV(data: JsonlRow[]): string {
  if (data.length === 0) return '';

  const columns = [...new Set(data.flatMap((r) => Object.keys(r)))];
  const header = columns.map(csvEscape).join(',');
  const rows = data.map((r) => columns.map((c) => csvEscape(r[c])).join(','));
  return [header, ...rows].join('\n') + '\n';
}

/** CSV-escapes a single value. */
function csvEscape(v: unknown): string {
  let s: string;
  if (v == null) s = '';
  else if (typeof v === 'string') s = v;
  else s = JSON.stringify(v) ?? '';

  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replaceAll('"', '""') + '"'
    : s;
}

// ── CSV import ──────────────────────────────────────────────────────────────

/** Parses a CSV string into row objects. */
export function fromCSV(csv: string): JsonlRow[] {
  const lines = csv.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj: JsonlRow = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? '';
    });
    return obj;
  });
}

/** Splits one CSV line into fields, handling quoted values and escaped quotes. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

// ── JSONL import ────────────────────────────────────────────────────────────

/** Parses a JSONL string into row objects. Malformed lines become `{ _raw }` rows. */
export function fromJSONL(content: string): JsonlRow[] {
  return content
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as JsonlRow;
      } catch {
        return { _raw: l } as JsonlRow;
      }
    });
}
