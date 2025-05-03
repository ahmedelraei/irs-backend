import { S3Client } from '@aws-sdk/client-s3';
import * as multer from 'multer';
import * as multerS3 from 'multer-s3';
import * as fs from 'fs';
import { config } from 'dotenv';
config();

// Check environment mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Ensure local uploads directory exists
const localUploadPath = 'uploads';
if (isDevelopment && !fs.existsSync(localUploadPath)) {
  fs.mkdirSync(localUploadPath, { recursive: true });
}

// S3 Client Setup
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_SECRET_KEY,
  },
});

// Local Storage (Development)
const localStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, localUploadPath);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// S3 Storage (Production)
const s3Storage = multerS3({
  s3,
  bucket: process.env.AWS_S3_BUCKET_NAME,
  metadata: (_req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (_req, file, cb) => {
    cb(null, `uploads/${Date.now()}-${file.originalname}`);
  },
});

export const uploadOptions = (): multer.Options => ({
  storage: isDevelopment ? localStorage : s3Storage,
});
