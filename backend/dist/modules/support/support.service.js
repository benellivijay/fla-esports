"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../../database/db");
const email_service_1 = require("../../services/email.service");
const logger_1 = require("../../utils/logger");
class SupportService {
    static DISCORD_URL = 'https://discord.gg/DRxf72naQv';
    static SUPPORT_EMAIL = 'flaadmin40@gmail.com';
    static async createTicket(dto) {
        const db = (0, db_1.getDb)();
        const id = (0, uuid_1.v4)();
        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
        const ticketNumber = `FLA-${randomSuffix}`;
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO support_tickets (
        id, ticket_number, user_id, username, email, category, reference_id, subject, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(id, ticketNumber, dto.userId || null, dto.username.trim(), dto.email.trim().toLowerCase(), dto.category.trim(), dto.referenceId ? dto.referenceId.trim() : null, dto.subject.trim(), dto.description.trim(), now, now);
        const ticket = {
            id,
            ticket_number: ticketNumber,
            user_id: dto.userId,
            username: dto.username.trim(),
            email: dto.email.trim().toLowerCase(),
            category: dto.category.trim(),
            reference_id: dto.referenceId?.trim(),
            subject: dto.subject.trim(),
            description: dto.description.trim(),
            status: 'open',
            created_at: now,
            updated_at: now,
        };
        // Dispatch notification to admin email asynchronously
        email_service_1.EmailService.sendSupportTicketEmail({
            ticketId: ticketNumber,
            userEmail: ticket.email,
            username: ticket.username,
            category: ticket.category,
            subject: ticket.subject,
            description: ticket.description,
            referenceId: ticket.reference_id,
        }).catch((err) => {
            logger_1.Logger.error(`[SUPPORT] Email dispatch error: ${err.message}`);
        });
        logger_1.Logger.info(`[SUPPORT] Created ticket #${ticketNumber} by ${ticket.username} (${ticket.category})`);
        return ticket;
    }
    static async getUserTickets(userEmail, userId) {
        const db = (0, db_1.getDb)();
        const rows = db.prepare(`
      SELECT * FROM support_tickets 
      WHERE LOWER(email) = ? OR (user_id IS NOT NULL AND user_id = ?)
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userEmail.toLowerCase().trim(), userId || '');
        return rows;
    }
    static async getAllTickets() {
        const db = (0, db_1.getDb)();
        const rows = db.prepare(`
      SELECT * FROM support_tickets 
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
        return rows;
    }
}
exports.SupportService = SupportService;
