/**
 * @file formats/JsonlFormatHandler.ts
 * @description JSONL/NDJSON format handler.
 */

import * as fs from 'node:fs';
import * as readline from 'node:readline';
import type { FileFormatHandler } from './FileFormatHandler';
import type { JsonlRow, LoadResult } from '../types';

function normalizeAdd(
  add: JsonlRow | { rowData: JsonlRow; insertAt?: number | null }
): { rowData: JsonlRow; insertAt?: number | null } | null {
  if ('rowData' in add) {
    return add;
  }
  return { rowData: add };
}

export class JsonlFormatHandler implements FileFormatHandler {
  extensions = ['jsonl', 'ndjson'];
  displayName = 'JSONL';

  async loadRows(filePath: string, offset: number, count: number): Promise<LoadResult> {
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

  serialize(data: JsonlRow[]): string {
    return data.map((r) => JSON.stringify(r)).join('\n') + '\n';
  }

  deserialize(content: string): JsonlRow[] {
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

  applyChanges(
    originalContent: string,
    updates?: Array<{ rowIndex: number; rowData: JsonlRow }>,
    adds?: Array<JsonlRow | { rowData: JsonlRow; insertAt?: number | null }>,
    deletes?: Set<number>
  ): string {
    const deleteSet = deletes ?? new Set();
    const updateList = updates ?? [];
    const addList = adds ?? [];

    // Map every non-empty line to its logical row index
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
    let addIndex = 0;

    for (let vi = 0; vi < validIndices.length; vi++) {
      const currentPosition = vi * 2;
      while (addIndex < anchoredAdds.length && (anchoredAdds[addIndex].insertAt ?? 0) < currentPosition) {
        resultLines.push(JSON.stringify(anchoredAdds[addIndex].rowData));
        addIndex++;
      }

      if (deleteSet.has(vi)) continue;

      const lineIdx = validIndices[vi];
      const rowData = updateMap.get(vi);
      resultLines.push(rowData ? JSON.stringify(rowData) : rawLines[lineIdx]);
    }

    for (const add of appendedAdds) {
      resultLines.push(JSON.stringify(add.rowData));
    }

    return resultLines.map((line) => line).join('\n') + (resultLines.length > 0 ? '\n' : '');
  }
}
