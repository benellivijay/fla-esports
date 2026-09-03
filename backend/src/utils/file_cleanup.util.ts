import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { Logger } from './logger';

export class FileCleanupUtil {
  /**
   * Automatically deletes an uploaded screenshot or proof file from server storage.
   * Resolves paths safely within the configured uploads directory to prevent traversal.
   */
  public static deleteUploadedFile(fileUrlOrPath?: string | null): boolean {
    if (!fileUrlOrPath || typeof fileUrlOrPath !== 'string') return false;

    // Ignore placeholder/already deleted indicators
    if (fileUrlOrPath.startsWith('[DELETED') || fileUrlOrPath === 'null' || fileUrlOrPath.trim() === '') {
      return false;
    }

    try {
      let filename = fileUrlOrPath.trim();

      // Handle full URLs like https://domain.com/uploads/screenshot-123.jpg
      if (filename.startsWith('http://') || filename.startsWith('https://')) {
        try {
          const parsed = new URL(filename);
          filename = path.basename(parsed.pathname);
        } catch {
          filename = path.basename(filename);
        }
      } else {
        // Handle paths like /uploads/screenshot-123.jpg or \uploads\screenshot-123.jpg
        filename = path.basename(filename);
      }

      if (!filename || filename === '.' || filename === '/' || filename === '\\') {
        return false;
      }

      const uploadsDir = path.resolve(config.uploads.directory);
      const targetFilePath = path.resolve(uploadsDir, filename);

      // Security Check: verify target file path is strictly inside uploadsDir
      if (!targetFilePath.startsWith(uploadsDir)) {
        Logger.warn(`[FILE_CLEANUP] Path traversal blocked for: ${fileUrlOrPath}`);
        return false;
      }

      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
        Logger.info(`[FILE_CLEANUP] Successfully deleted screenshot from server storage: ${filename}`);
        return true;
      } else {
        Logger.info(`[FILE_CLEANUP] File already absent on disk: ${filename}`);
        return false;
      }
    } catch (err: any) {
      Logger.error(`[FILE_CLEANUP] Failed to delete file (${fileUrlOrPath}): ${err.message}`);
      return false;
    }
  }
}
