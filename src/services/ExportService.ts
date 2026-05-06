/**
 * @file services/ExportService.ts
 * @description Multi-format export/import utilities.
 * Delegates to format handlers via FormatRegistry.
 */

import type { JsonlRow } from '../types';
import { FormatRegistry } from '../formats/FormatRegistry';

/**
 * Serializes data to a specific format.
 * @param data Array of row objects.
 * @param format Format identifier (e.g., 'jsonl', 'csv').
 */
export function serialize(data: JsonlRow[], format: string): string {
  const handler = FormatRegistry.get(format);
  if (!handler) {
    throw new Error(`Unsupported format: ${format}`);
  }
  return handler.serialize(data);
}

/**
 * Parses content in a specific format.
 * @param content Raw file content string.
 * @param format Format identifier (e.g., 'jsonl', 'csv').
 */
export function deserialize(content: string, format: string): JsonlRow[] {
  const handler = FormatRegistry.get(format);
  if (!handler) {
    throw new Error(`Unsupported format: ${format}`);
  }
  return handler.deserialize(content);
}

// ── Legacy exports for backward compatibility ──────────────────────────────

/**
 * @deprecated Use serialize(data, 'csv') instead.
 */
export function toCSV(data: JsonlRow[]): string {
  return serialize(data, 'csv');
}

/**
 * @deprecated Use deserialize(csv, 'csv') instead.
 */
export function fromCSV(csv: string): JsonlRow[] {
  return deserialize(csv, 'csv');
}

/**
 * @deprecated Use deserialize(content, 'jsonl') instead.
 */
export function fromJSONL(content: string): JsonlRow[] {
  return deserialize(content, 'jsonl');
}
