import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { getDb } from '../database/db';
import { Logger } from '../utils/logger';

export interface ArchiveOptions {
  localScreenshotUrl: string;
  orderId: string;
  utrNumber: string;
  amount: number;
  status: 'approved' | 'rejected';
  userName?: string;
}

export class GDriveService {
  public static readonly FOLDER_ID = '1aR8N0GpxbdNFbY-u24iFvW145vjR0MhO';

  /**
   * Uploads screenshot to Google Drive folder, updates DB record, and deletes local file.
   */
  public static async archiveScreenshot(options: ArchiveOptions): Promise<string | null> {
    const { localScreenshotUrl, orderId, utrNumber, amount, status, userName } = options;

    if (!localScreenshotUrl || localScreenshotUrl.startsWith('http://') || localScreenshotUrl.startsWith('https://')) {
      return null;
    }

    const cleanRelPath = localScreenshotUrl.startsWith('/') ? localScreenshotUrl.substring(1) : localScreenshotUrl;
    const fullPath = path.resolve(process.cwd(), cleanRelPath);

    if (!fs.existsSync(fullPath)) {
      Logger.warn(`[GDRIVE] Local screenshot not found at ${fullPath}`);
      return null;
    }

    const ext = path.extname(fullPath) || '.png';
    const tag = status.toUpperCase();
    const safeUser = (userName || 'Player').replace(/[^a-zA-Z0-9_-]/g, '_');
    const driveFileName = `[${tag}]_INR${amount}_UTR-${utrNumber}_${safeUser}_${Date.now()}${ext}`;

    try {
      const driveUrl = await this.uploadToDrive(fullPath, driveFileName);

      if (driveUrl) {
        // Update database with the permanent Google Drive URL
        const db = getDb();
        db.prepare('UPDATE payment_orders SET screenshot_url = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?').run(
          driveUrl,
          orderId
        );

        // Delete local temporary file to save server space
        try {
          fs.unlinkSync(fullPath);
          Logger.info(`[GDRIVE] Local screenshot deleted: ${fullPath}`);
        } catch (delErr: any) {
          Logger.warn(`[GDRIVE] Could not delete local file: ${delErr.message}`);
        }

        Logger.info(`[GDRIVE] Archived payment screenshot to Google Drive: ${driveUrl}`);
        return driveUrl;
      }
    } catch (err: any) {
      Logger.error(`[GDRIVE] Failed to upload screenshot to Google Drive: ${err.message}`);
    }

    return null;
  }

  /**
   * Internal upload logic using Service Account or Webhook
   */
  private static async uploadToDrive(filePath: string, fileName: string): Promise<string | null> {
    // 1. Check for Service Account Key file or Env
    const keyFilePath = path.resolve(process.cwd(), 'gdrive-service-account.json');
    const hasKeyFile = fs.existsSync(keyFilePath);
    const hasEnvCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GDRIVE_SERVICE_ACCOUNT_JSON);

    if (hasKeyFile || hasEnvCredentials) {
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: hasKeyFile ? keyFilePath : undefined,
          credentials: process.env.GDRIVE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.GDRIVE_SERVICE_ACCOUNT_JSON) : undefined,
          scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
        });

        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata = {
          name: fileName,
          parents: [this.FOLDER_ID],
        };

        const media = {
          mimeType: 'image/png',
          body: fs.createReadStream(filePath),
        };

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink, webContentLink',
        });

        const fileId = response.data.id;
        const webLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
        return webLink;
      } catch (authErr: any) {
        Logger.error(`[GDRIVE API] Google Auth failed: ${authErr.message}`);
      }
    }

    // 2. Check for Google Apps Script Webhook
    const webhookUrl = process.env.GDRIVE_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          redirect: 'follow',
          body: JSON.stringify({
            folderId: this.FOLDER_ID,
            fileName: fileName,
            fileData: fileBase64,
          }),
        });

        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch (_) {}

        if (data.fileUrl) {
          return data.fileUrl;
        } else if (res.ok && data.success) {
          return `https://drive.google.com/drive/folders/${this.FOLDER_ID}`;
        } else {
          Logger.warn(`[GDRIVE Webhook] Response received: ${text.substring(0, 150)}`);
        }
      } catch (webhookErr: any) {
        Logger.error(`[GDRIVE Webhook] Upload failed: ${webhookErr.message}`);
      }
    }

    Logger.warn(
      `[GDRIVE] Google Drive credentials not found. Place 'gdrive-service-account.json' in backend root or set GDRIVE_WEBHOOK_URL to automatically upload to folder '${this.FOLDER_ID}'. Local file preserved.`
    );
    return null;
  }
}
