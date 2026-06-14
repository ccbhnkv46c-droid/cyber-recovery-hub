import { config } from '../../../lib/config';
import type { ScanResult } from './types';

export async function scanFile(buffer: Buffer, fileName: string): Promise<ScanResult> {
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.dll', '.msi'];
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  if (blockedExtensions.includes(ext)) {
    return { clean: false, threat: `Blocked file type: ${ext}` };
  }

  if (buffer.length > 25 * 1024 * 1024) {
    return { clean: false, threat: 'File exceeds 25MB limit' };
  }

  if (!config.virusScan.enabled) return { clean: true };

  try {
    const net = await import('net');
    return await new Promise((resolve) => {
      const client = net.createConnection(
        { host: config.virusScan.clamavHost, port: config.virusScan.clamavPort },
        () => {
          client.write('zINSTREAM\0');
          const chunk = Buffer.alloc(4);
          chunk.writeUInt32BE(buffer.length, 0);
          client.write(chunk);
          client.write(buffer);
          const end = Buffer.alloc(4);
          end.writeUInt32BE(0, 0);
          client.write(end);
        }
      );
      let response = '';
      client.on('data', (d) => { response += d.toString(); });
      client.on('end', () => {
        const clean = response.includes('OK') && !response.includes('FOUND');
        resolve({ clean, threat: clean ? undefined : response.trim() });
      });
      client.on('error', () => resolve({ clean: true }));
      setTimeout(() => { client.destroy(); resolve({ clean: true }); }, 5000);
    });
  } catch {
    return { clean: true };
  }
}
