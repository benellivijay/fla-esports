"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 400, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, _next) => {
    logger_1.Logger.error(`Error processing ${req.method} ${req.originalUrl}:`, err);
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
        });
        return;
    }
    // Multer file upload errors
    if (err.name === 'MulterError') {
        res.status(400).json({
            success: false,
            message: `File upload error: ${err.message}`,
        });
        return;
    }
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
    });
};
exports.errorHandler = errorHandler;
