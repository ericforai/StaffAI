import { WorkshopRegistration } from '../shared/workshop-types';

export class WorkshopRegistry {
  private static instance: WorkshopRegistry;
  private workshops: Map<string, WorkshopRegistration> = new Map();

  private constructor() {}

  public static getInstance(): WorkshopRegistry {
    if (!WorkshopRegistry.instance) {
      WorkshopRegistry.instance = new WorkshopRegistry();
    }
    return WorkshopRegistry.instance;
  }

  public register(registration: WorkshopRegistration): void {
    this.workshops.set(registration.url, {
      ...registration,
      registered_at: new Date().toISOString(),
    });
  }

  public list(): WorkshopRegistration[] {
    return Array.from(this.workshops.values());
  }
}
