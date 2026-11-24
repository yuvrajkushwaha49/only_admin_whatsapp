import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'templates');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `tpl-media-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    cb(null, safeName);
  }
});

const CHUNKS_DIR = path.resolve(process.cwd(), 'uploads', 'chunks');
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

export const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadId = (req.body.uploadId || 'temp').replace(/[^a-zA-Z0-9_-]/g, '');
      const userChunkDir = path.join(CHUNKS_DIR, uploadId);
      if (!fs.existsSync(userChunkDir)) {
        fs.mkdirSync(userChunkDir, { recursive: true });
      }
      cb(null, userChunkDir);
    },
    filename: (req, file, cb) => {
      const chunkIndex = req.body.chunkIndex !== undefined ? req.body.chunkIndex : Date.now();
      cb(null, `chunk_${chunkIndex}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per chunk limit
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.jpg', '.jpeg', '.png', '.mp4', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExts.includes(ext)) {
    const err = new Error(`Unsupported file type: ${ext}. Supported: .jpg, .png, .mp4, .pdf`);
    err.statusCode = 400;
    return cb(err, false);
  }

  cb(null, true);
};

export const templateMediaUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

export default templateMediaUpload;
