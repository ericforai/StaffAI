import fs from 'node:fs';
import path from 'node:path';

export interface MemoryRetrievalUsageLogEvent {
  ts: string;
  retriever: string;
  strategy: string;
  query: string;
  options: Record<string, unknown>;
  totalDocuments: number;
  candidateCount: number;
  selectedCount: number;
  timingMs: Record<string, number>;
  selected: Array<{
    relativePath: string;
    type?: string;
    lexicalScore: number;
    vectorScore?: number;
    finalScore: number;
  }>;
}

export function appendUsageLogEvent(filePath: string, event: MemoryRetrievalUsageLogEvent): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf-8');
}

