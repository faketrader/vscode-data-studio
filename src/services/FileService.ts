/**
 * @file services/FileService.ts
 * @description Low-level JSONL file I/O.
 * Responsible for reading rows from disk and applying batched mutations.
 */

import * as fs from 'node:fs';
import * as readline from 'node:readline';
import type { JsonlRow, LoadResult, SaveChangesPayload } from '../types';

/**
 * Reads a slice of rows from a JSONL file while counting total non-empty lines.
 *
 * Streams the file so it is memory-efficient for large files.
 *
 * @param filePath  Absolute path to the JSONL file.
 * @param offset    Zero-based index of the first row to include.
 * @param count     Maximum number of rows to return.
 */
export function loadRows(filePath: string, offset: number, count: number): Promise<LoadResult> {
  const rows: JsonlRow[] = [];
  const columnSet = new Set<string>();
  let totalLines = 0;
  let currentLine = 0;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      totalLines++;

      if (currentLine >= offset && currentLine < offset + count) {
        try {
          const obj = JSON.parse(trimmed) as JsonlRow;
          rows.push(obj);
          for (const k of Object.keys(obj)) columnSet.add(k);
        } catch {
          rows.push({ _raw: trimmed, _parseError: true });
        }
      }

      currentLine++;
    });

    rl.on('close', () => resolve({ rows, totalLines, columns: [...columnSet] }));
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/**
 * Applies batched changes to JSONL file content and returns the new string.
 *
 * Operations are applied in this order:
 *   1. Deletes (by original row index, descending to keep indices stable)
 *   2. Updates (replace JSON on the matched line)
 *   3. Appends new rows at the end
 *
 * @param originalContent  Current file text.
 * @param payload          Batch of changes from the webview.
 */
export function applyChanges(
  originalContent: string,
  payload: Required<SaveChangesPayload>
): string {
  const { updates, adds } = payload;
  const deleteSet = new Set(payload.deletes);

  // Map every non-empty line to its logical row index
  const rawLines = originalContent.split('\n');
  const validIndices: number[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim()) validIndices.push(i);
  }

  const updateMap = new Map(updates.map((u) => [u.rowIndex, u.rowData]));

  const resultLines: string[] = [];

  for (let vi = 0; vi < validIndices.length; vi++) {
    if (deleteSet.has(vi)) continue;

    const updated = updateMap.get(vi);
    resultLines.push(updated ? JSON.stringify(updated) : rawLines[validIndices[vi]]);
  }

  for (const row of adds) {
    resultLines.push(JSON.stringify(row));
  }

  return resultLines.join('\n') + '\n';
}
