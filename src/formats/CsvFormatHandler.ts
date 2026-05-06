/**
 * @file formats/CsvFormatHandler.ts
 * @description CSV format handler.
 */

import * as fs from 'node:fs';
import * as readline from 'node:readline';
import type { FileFormatHandler } from './FileFormatHandler';
import type { JsonlRow, LoadResult } from '../types';

/**
 * Converts a value to CSV-escaped string.
 */
function csvEscape(v: unknown): string {
  let s: string;
  if (v == null) s = '';
  else if (typeof v === 'string') s = v;
  else s = JSON.stringify(v) ?? '';

  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replaceAll('"', '""') + '"'
    : s;
}

/**
 * Parses a single CSV line into fields, handling quoted values and escaped quotes.
 */
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

function normalizeAdd(
  add: JsonlRow | { rowData: JsonlRow; insertAt?: number | null }
): { rowData: JsonlRow; insertAt?: number | null } | null {
  if ('rowData' in add) {
    return add;
  }
  return { rowData: add };
}

export class CsvFormatHandler implements FileFormatHandler {
  extensions = ['csv'];
  displayName = 'CSV';

  async loadRows(filePath: string, offset: number, count: number): Promise<LoadResult> {
    const rows: JsonlRow[] = [];
    const columnSet = new Set<string>();
    let totalLines = 0;
    let currentLine = 0;
    let headers: string[] = [];

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      let isFirstLine = true;

      rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (isFirstLine) {
          headers = parseCSVLine(line);
          headers.forEach((h) => columnSet.add(h));
          isFirstLine = false;
          totalLines++;
          return;
        }

        totalLines++;

        if (currentLine >= offset && currentLine < offset + count) {
          try {
            const values = parseCSVLine(line);
            const obj: JsonlRow = {};
            headers.forEach((h, i) => {
              obj[h] = values[i] ?? '';
            });
            rows.push(obj);
          } catch {
            rows.push({ _raw: line, _parseError: true });
          }
        }

        currentLine++;
      });

      rl.on('close', () => resolve({ rows, totalLines, columns: [...columnSet] }));
      rl.on('error', reject);
      stream.on('error', reject);
    });
  }

  serialize(data: JsonlRow[]): string {
    if (data.length === 0) return '';

    const columns = [...new Set(data.flatMap((r) => Object.keys(r)))];
    const header = columns.map(csvEscape).join(',');
    const rows = data.map((r) => columns.map((c) => csvEscape(r[c])).join(','));
    return [header, ...rows].join('\n') + '\n';
  }

  deserialize(content: string): JsonlRow[] {
    const lines = content.split('\n').filter((l) => l.trim());
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

  applyChanges(
    originalContent: string,
    updates?: Array<{ rowIndex: number; rowData: JsonlRow }>,
    adds?: Array<JsonlRow | { rowData: JsonlRow; insertAt?: number | null }>,
    deletes?: Set<number>
  ): string {
    const deleteSet = deletes ?? new Set();
    const updateList = updates ?? [];
    const addList = adds ?? [];

    const lines = originalContent.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return '';

    const headers = parseCSVLine(lines[0]);
    const rawLines = originalContent.split('\n');
    const validIndices: number[] = [];
    
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].trim()) validIndices.push(i);
    }

    const updateMap = new Map(updateList.map((u) => [u.rowIndex, u.rowData]));
    const anchoredAdds = addList
      .map(normalizeAdd)
      .filter((add): add is { rowData: JsonlRow; insertAt?: number | null } => add != null && add.insertAt != null)
      .sort((a, b) => (a.insertAt ?? 0) - (b.insertAt ?? 0));
    const appendedAdds = addList
      .map(normalizeAdd)
      .filter((add) => add != null && add.insertAt == null)
      .map((add) => add!);

    const resultLines: string[] = [];
    resultLines.push(headers.map(csvEscape).join(',')); // header

    let addIndex = 0;
    for (let vi = 1; vi < validIndices.length; vi++) {
      const currentPosition = vi * 2;
      while (addIndex < anchoredAdds.length && (anchoredAdds[addIndex].insertAt ?? 0) < currentPosition) {
        const row = anchoredAdds[addIndex].rowData;
        resultLines.push(headers.map((h) => csvEscape(row[h])).join(','));
        addIndex++;
      }

      const rowIndex = vi - 1;
      if (deleteSet.has(rowIndex)) continue;

      const rowData = updateMap.get(rowIndex);
      if (rowData) {
        resultLines.push(headers.map((h) => csvEscape(rowData[h])).join(','));
      } else {
        resultLines.push(rawLines[validIndices[vi]]);
      }
    }

    for (const add of appendedAdds) {
      resultLines.push(headers.map((h) => csvEscape(add.rowData[h])).join(','));
    }

    return resultLines.join('\n') + (resultLines.length > 0 ? '\n' : '');
  }
}
