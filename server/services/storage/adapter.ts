import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { StorageAdapter } from './types';
import { config } from '../../../lib/config';

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor() {
    this.basePath = path.resolve(config.storage.localPath);
  }

  async ensureDir() {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async save(file: Buffer, fileName: string, _mimeType: string) {
    await this.ensureDir();
    const ext = path.extname(fileName) || '.bin';
    const key = `${uuidv4()}${ext}`;
    const fullPath = path.join(this.basePath, key);
    await fs.writeFile(fullPath, file);
    return { key, url: `/api/files/${key}` };
  }

  async delete(key: string) {
    const fullPath = path.join(this.basePath, path.basename(key));
    await fs.unlink(fullPath).catch(() => {});
  }

  getUrl(key: string) {
    return `/api/files/${key}`;
  }

  getFilePath(key: string) {
    return path.join(this.basePath, path.basename(key));
  }
}

export class S3StorageAdapter implements StorageAdapter {
  async save(_file: Buffer, fileName: string, _mimeType: string) {
    const key = `evidence/${uuidv4()}-${fileName}`;
    console.log(`[S3] Would upload to bucket ${config.storage.s3Bucket}: ${key}`);
    return { key, url: `https://${config.storage.s3Bucket}.s3.${config.storage.s3Region}.amazonaws.com/${key}` };
  }

  async delete(key: string) {
    console.log(`[S3] Would delete: ${key}`);
  }

  getUrl(key: string) {
    return `https://${config.storage.s3Bucket}.s3.${config.storage.s3Region}.amazonaws.com/${key}`;
  }
}

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    adapter = config.storage.provider === 's3'
      ? new S3StorageAdapter()
      : new LocalStorageAdapter();
  }
  return adapter;
}

export function getLocalStorage(): LocalStorageAdapter | null {
  const a = getStorageAdapter();
  return a instanceof LocalStorageAdapter ? a : null;
}
