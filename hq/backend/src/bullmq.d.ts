declare module 'bullmq' {
  import type { EventEmitter } from 'node:events';

  export interface Job<T = unknown> {
    id?: string;
    data: T;
    attemptsMade: number;
  }

  export interface WorkerOptions {
    connection: unknown;
    concurrency?: number;
  }

  export class Worker<T = unknown> extends EventEmitter {
    constructor(name: string, processor: (job: Job<T>) => Promise<void>, opts: WorkerOptions);
    on(event: 'completed', handler: (job: Job<T>) => void): this;
    on(event: 'failed', handler: (job: Job<T> | undefined, err: Error) => void): this;
    close(): Promise<void>;
  }

  export interface QueueAddOptions {
    attempts?: number;
    backoff?: { type: string; delay: number };
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  }

  export class Queue<T = unknown> extends EventEmitter {
    constructor(name: string, opts: WorkerOptions);
    add(name: string, data: T, opts?: QueueAddOptions): Promise<Job<T>>;
    close(): Promise<void>;
  }
}
