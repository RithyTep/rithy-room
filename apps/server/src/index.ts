import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { setupSocketHandlers } from './socket/handlers.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@rithy-room/shared';

const app = express();
const httpServer = createServer(app);

// Configure Cloudflare R2 (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Configure multer for memory storage (upload to R2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Upload endpoint with Cloudflare R2
app.post('/upload', (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const isAudio = req.file.mimetype.startsWith('audio/');
      const folder = isAudio ? 'audio' : 'images';
      const ext = req.file.originalname.split('.').pop() || (isAudio ? 'webm' : 'jpg');
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const key = `rithy-room/${folder}/${uniqueName}`;

      // Upload to R2
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));

      const publicUrl = `${R2_PUBLIC_URL}/${key}`;
      console.log('File uploaded to R2:', publicUrl);

      // Return appropriate URL field based on file type
      if (isAudio) {
        res.json({ audioUrl: publicUrl });
      } else {
        res.json({ imageUrl: publicUrl });
      }
    } catch (uploadError) {
      console.error('R2 upload error:', uploadError);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });
});

// Setup socket handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
