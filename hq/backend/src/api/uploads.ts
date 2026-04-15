import type express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { TaskAttachment } from '../shared/task-types';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_REQUEST = 5;

function getUploadsDir(): string {
  const agencyHome = process.env.AGENCY_HOME || path.join(process.env.HOME || '~', '.agency');
  const dir = path.resolve(agencyHome.replace(/^~/, process.env.HOME || ''), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, getUploadsDir());
    },
    filename(_req, file, cb) {
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${uniqueId}${ext}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: MAX_FILES_PER_REQUEST,
    },
    fileFilter(_req, file, cb) {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`不支持的文件类型: ${file.mimetype}`));
      }
    },
  });
}

export function registerUploadRoutes(app: express.Application) {
  const upload = createUploadMiddleware();

  app.post('/api/uploads', upload.array('files', MAX_FILES_PER_REQUEST), (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择至少一个文件' });
    }

    const attachments: TaskAttachment[] = files.map((f) => ({
      id: `att_${crypto.randomBytes(6).toString('hex')}`,
      filename: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
      uploadedAt: new Date().toISOString(),
    }));

    return res.status(201).json({ attachments });
  });

  app.get('/api/uploads/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(getUploadsDir(), filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件未找到' });
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
      '.csv': 'text/csv', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp',
      '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // Error handler for multer
  app.use('/api/uploads', ((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '文件大小超过 10MB 限制' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `最多上传 ${MAX_FILES_PER_REQUEST} 个文件` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  }) as express.ErrorRequestHandler);
}
