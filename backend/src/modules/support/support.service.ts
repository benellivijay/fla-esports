import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { EmailService } from '../../services/email.service';
import { Logger } from '../../utils/logger';

export interface CreateTicketDTO {
  userId?: string;
  username: string;
  email: string;
  category: string;
  referenceId?: string;
  subject: string;
  description: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id?: string;
  username: string;
  email: string;
  category: string;
  reference_id?: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export class SupportService {
  public static readonly DISCORD_URL = 'https://discord.gg/DRxf72naQv';
  public static readonly SUPPORT_EMAIL = 'flaadmin40@gmail.com';

  public static async createTicket(dto: CreateTicketDTO): Promise<SupportTicket> {
    const db = getDb();
    const id = uuidv4();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const ticketNumber = `FLA-${randomSuffix}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO support_tickets (
        id, ticket_number, user_id, username, email, category, reference_id, subject, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(
      id,
      ticketNumber,
      dto.userId || null,
      dto.username.trim(),
      dto.email.trim().toLowerCase(),
      dto.category.trim(),
      dto.referenceId ? dto.referenceId.trim() : null,
      dto.subject.trim(),
      dto.description.trim(),
      now,
      now
    );

    const ticket: SupportTicket = {
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
    EmailService.sendSupportTicketEmail({
      ticketId: ticketNumber,
      userEmail: ticket.email,
      username: ticket.username,
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      referenceId: ticket.reference_id,
    }).catch((err) => {
      Logger.error(`[SUPPORT] Email dispatch error: ${err.message}`);
    });

    Logger.info(`[SUPPORT] Created ticket #${ticketNumber} by ${ticket.username} (${ticket.category})`);
    return ticket;
  }

  public static async getUserTickets(userEmail: string, userId?: string): Promise<SupportTicket[]> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM support_tickets 
      WHERE LOWER(email) = ? OR (user_id IS NOT NULL AND user_id = ?)
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userEmail.toLowerCase().trim(), userId || '') as unknown as SupportTicket[];
    return rows;
  }

  public static async getAllTickets(): Promise<SupportTicket[]> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM support_tickets 
      ORDER BY created_at DESC
      LIMIT 100
    `).all() as unknown as SupportTicket[];
    return rows;
  }
}
