/** A single parsed JSONL row. Keys are data fields; values are arbitrary JSON. */
export type JsonlRow = Record<string, unknown>;

/** Result returned by a partial file load. */
export interface LoadResult {
  rows: JsonlRow[];
  /** Total number of non-empty lines in the file. */
  totalLines: number;
  /** Column keys discovered in this slice. */
  columns: string[];
}

/** Payload sent from the webview when the user clicks Save. */
export interface SaveChangesPayload {
  updates?: Array<{ rowIndex: number; rowData: JsonlRow }>;
  /** Original row indices to delete (before updates are applied). */
  deletes?: number[];
  adds?: JsonlRow[];
}
