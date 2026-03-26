import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const cache = new WeakMap<z.ZodTypeAny, Record<string, unknown>>();

export function toJsonSchema(schema: z.ZodTypeAny, name: string): Record<string, unknown> {
  const cached = cache.get(schema);
  if (cached) {
    return cached;
  }

  // zod-to-json-schema returns a plain JSON-serializable object.
  const jsonSchema = zodToJsonSchema(schema as any, {
    name,
    $refStrategy: 'none',
  }) as unknown as Record<string, unknown>;

  cache.set(schema, jsonSchema);
  return jsonSchema;
}

