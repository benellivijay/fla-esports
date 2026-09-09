"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCleanupUtil = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
const logger_1 = require("./logger");
class FileCleanupUtil {
    /**
     * Automatically deletes an uploaded screenshot or proof file from server storage.
     * Resolves paths safely within the configured uploads directory to prevent traversal.
     */
    static deleteUploadedFile(fileUrlOrPath) {
        if (!fileUrlOrPath || typeof fileUrlOrPath !== 'string')
            return false;
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
                    filename = path_1.default.basename(parsed.pathname);
                }
                catch {
                    filename = path_1.default.basename(filename);
                }
            }
            else {
                // Handle paths like /uploads/screenshot-123.jpg or \uploads\screenshot-123.jpg
                filename = path_1.default.basename(filename);
            }
            if (!filename || filename === '.' || filename === '/' || filename === '\\') {
                return false;
            }
            const uploadsDir = path_1.default.resolve(env_1.config.uploads.directory);
            const targetFilePath = path_1.default.resolve(uploadsDir, filename);
            // Security Check: verify target file path is strictly inside uploadsDir
            if (!targetFilePath.startsWith(uploadsDir)) {
                logger_1.Logger.warn(`[FILE_CLEANUP] Path traversal blocked for: ${fileUrlOrPath}`);
                return false;
            }
            if (fs_1.default.existsSync(targetFilePath)) {
                fs_1.default.unlinkSync(targetFilePath);
                logger_1.Logger.info(`[FILE_CLEANUP] Successfully deleted screenshot from server storage: ${filename}`);
                return true;
            }
            else {
                logger_1.Logger.info(`[FILE_CLEANUP] File already absent on disk: ${filename}`);
                return false;
            }
        }
        catch (err) {
            logger_1.Logger.error(`[FILE_CLEANUP] Failed to delete file (${fileUrlOrPath}): ${err.message}`);
            return false;
        }
    }
}
exports.FileCleanupUtil = FileCleanupUtil;
