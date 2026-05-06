/**
 * @file formats/index.ts
 * @description Format handlers registry and exports.
 * 
 * To add a new format:
 * 1. Create a new file implementing FileFormatHandler (e.g., ProtobufFormatHandler.ts)
 * 2. Import it here
 * 3. Add registration line in FormatRegistry.registerAll()
 * 4. Update package.json customEditors selector with new file pattern
 */

import { FormatRegistry } from './FormatRegistry';
import { JsonlFormatHandler } from './JsonlFormatHandler';
import { CsvFormatHandler } from './CsvFormatHandler';

export { FileFormatHandler } from './FileFormatHandler';
export { FormatRegistry } from './FormatRegistry';
export { JsonlFormatHandler } from './JsonlFormatHandler';
export { CsvFormatHandler } from './CsvFormatHandler';

/**
 * Registers all available format handlers.
 * Call this once during extension activation.
 */
export function registerAllFormats(): void {
  FormatRegistry.register('jsonl', new JsonlFormatHandler());
  FormatRegistry.register('csv', new CsvFormatHandler());
  // Add new formats here:
  // FormatRegistry.register('tsv', new TsvFormatHandler());
  // FormatRegistry.register('parquet', new ParquetFormatHandler());
}
