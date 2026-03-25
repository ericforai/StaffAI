import { Redis } from 'ioredis';

/**
 * Shared Redis service for the application.
 * Manages the connection pool and provides access to the Redis client.
 */
export class RedisService {
  private static instance: Redis | null = null;

  /**
   * Get the singleton Redis instance.
   * Initializes the connection if it doesn't exist.
   */
  static getInstance(): Redis {
    if (!this.instance) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      console.log(`Connecting to Redis at ${redisUrl}...`);
      
      this.instance = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: true,
      });

      this.instance.on('error', (err: Error) => {
        console.error('Redis connection error:', err);
      });

      this.instance.on('connect', () => {
        console.log('Successfully connected to Redis');
      });
    }
    return this.instance;
  }

  /**
   * Gracefully shut down the Redis connection.
   */
  static async shutdown(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
    }
  }
}
