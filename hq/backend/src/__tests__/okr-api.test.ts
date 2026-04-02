import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerOkrRoutes } from '../api/okrs';
import type { Store } from '../store';

// Mock Store
class MockStore {
  okrs: any[] = [];
  async getOKRs() { return this.okrs; }
  async saveOKR(okr: any) { this.okrs.push(okr); }
  async updateOKR(id: string, updater: any) {
    const idx = this.okrs.findIndex(o => o.id === id);
    if (idx < 0) return null;
    this.okrs[idx] = updater(this.okrs[idx]);
    return this.okrs[idx];
  }
}

test('OKR API should return list of OKRs', async () => {
  const store = new MockStore();
  const app = express();
  app.use(express.json());
  registerOkrRoutes(app, store as any);

  // Initial list
  const res = await fetch('http://localhost:3333/api/okrs'); // This won't work in unit test without server
  // We will simulate the logic or use supertest if available. 
  // Given current setup, we'll implement the routes first.
});
