export type SparseVector = Map<number, number>;

export interface Embedder {
  name: string;
  embed(text: string): SparseVector | null;
}

export class DisabledEmbedder implements Embedder {
  public readonly name = 'disabled';
  embed(): SparseVector | null {
    return null;
  }
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
    .filter((token) => token.length >= 2);
}

export function hashingEmbed(text: string, dims: number): SparseVector {
  const vec: SparseVector = new Map();
  const tokens = tokenize(text);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dims;
    vec.set(idx, (vec.get(idx) ?? 0) + 1);
  }
  return vec;
}

export class HashingEmbedder implements Embedder {
  public readonly name = 'hashing';
  constructor(private readonly dims: number = 512) {}
  embed(text: string): SparseVector {
    return hashingEmbed(text, this.dims);
  }
}

export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const value of a.values()) {
    normA += value * value;
  }
  for (const value of b.values()) {
    normB += value * value;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }

  // Iterate smaller map for dot product.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [idx, value] of small.entries()) {
    const other = large.get(idx);
    if (other) {
      dot += value * other;
    }
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

