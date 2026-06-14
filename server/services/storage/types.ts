export interface StorageAdapter {
  save(file: Buffer, fileName: string, mimeType: string): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

export interface ScanResult {
  clean: boolean;
  threat?: string;
}
