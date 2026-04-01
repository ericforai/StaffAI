import express from 'express';
import cors from 'cors';
import { randomBytes } from 'crypto';
import { registerContactRoutes } from './api/contacts';
import { registerCompanyRoutes } from './api/companies';
import { registerDealRoutes } from './api/deals';
import { registerTaskRoutes } from './api/tasks';
import { seedUsers, userRepository } from './persistence/repositories';
import {
  authMiddleware,
  requireAuth,
  createSession,
  destroySession,
  getSession,
  getAllAuditEntries,
  queryAudit,
} from './middleware/security';
import type { Role } from './types';

const app = express();
const PORT = process.env.PORT ?? 3344;

app.use(cors());
app.use(express.json());

// ─── Auth Routes ───────────────────────────────────────────────────────────────

// POST /api/crm/auth/login — returns a Bearer token
app.post('/api/crm/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'email and password are required.' });
    return;
  }
  // Demo auth: password is "demo" for all seeded users
  if (password !== 'demo') {
    res.status(401).json({ success: false, error: 'Invalid credentials.' });
    return;
  }
  const user = userRepository.getByEmail(email);
  if (!user || !user.active) {
    res.status(401).json({ success: false, error: 'Invalid credentials.' });
    return;
  }
  const token = randomBytes(32).toString('hex');
  createSession(token, { id: user.id, email: user.email, role: user.role as Role, name: user.name });
  res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

// POST /api/crm/auth/logout — destroy session
app.post('/api/crm/auth/logout', authMiddleware, requireAuth, (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    destroySession(header.slice(7));
  }
  res.json({ success: true });
});

// GET /api/crm/auth/me — current user info
app.get('/api/crm/auth/me', authMiddleware, requireAuth, (req, res) => {
  res.json({ success: true, user: req.currentUser });
});

// ─── Audit Routes ──────────────────────────────────────────────────────────────

// GET /api/crm/audit — all audit entries (admin/manager only)
app.get('/api/crm/audit', authMiddleware, (req, res) => {
  if (!req.currentUser) { res.status(401).json({ success: false, error: 'Authentication required.' }); return; }
  if (req.currentUser.role !== 'admin' && req.currentUser.role !== 'manager') {
    res.status(403).json({ success: false, error: 'Forbidden.' });
    return;
  }
  const { userId, resource, outcome } = req.query ?? {};
  const entries = queryAudit({
    userId: typeof userId === 'string' ? userId : undefined,
    resource: typeof resource === 'string' ? resource : undefined,
    outcome: typeof outcome === 'string' ? (outcome as 'ALLOWED' | 'BLOCKED' | 'REVIEW_REQUIRED') : undefined,
  });
  res.json({ success: true, count: entries.length, entries });
});

// ─── CRM Routes ────────────────────────────────────────────────────────────────

registerContactRoutes(app);
registerCompanyRoutes(app);
registerDealRoutes(app);
registerTaskRoutes(app);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agency-crm', port: PORT });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

seedUsers();

app.listen(PORT, () => {
  console.log(`Agency CRM backend running on http://localhost:${PORT}`);
  console.log('Demo users: admin@crm.dev | manager@crm.dev | sales@crm.dev | viewer@crm.dev  (password: demo)');
});

export { app };
