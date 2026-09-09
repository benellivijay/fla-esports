"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportController = void 0;
const support_service_1 = require("./support.service");
const zod_1 = require("zod");
const createTicketSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, 'Username is required'),
    email: zod_1.z.string().email('Valid email is required'),
    category: zod_1.z.string().min(1, 'Category is required'),
    referenceId: zod_1.z.string().optional(),
    subject: zod_1.z.string().min(3, 'Subject must be at least 3 characters'),
    description: zod_1.z.string().min(10, 'Please provide more details (at least 10 characters)'),
});
class SupportController {
    static async createTicket(req, res, next) {
        try {
            const parsed = createTicketSchema.parse(req.body);
            const userId = req.user?.id;
            const ticket = await support_service_1.SupportService.createTicket({
                userId,
                username: parsed.username,
                email: parsed.email,
                category: parsed.category,
                referenceId: parsed.referenceId,
                subject: parsed.subject,
                description: parsed.description,
            });
            res.status(201).json({
                success: true,
                message: 'Support ticket raised successfully. Our team will review it shortly.',
                data: {
                    ticket,
                    discordUrl: support_service_1.SupportService.DISCORD_URL,
                    supportEmail: support_service_1.SupportService.SUPPORT_EMAIL,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getMyTickets(req, res, next) {
        try {
            const user = req.user;
            const email = user?.email || req.query.email;
            if (!email) {
                return res.status(400).json({ success: false, message: 'Email identifier required.' });
            }
            const tickets = await support_service_1.SupportService.getUserTickets(email, user?.id);
            res.status(200).json({
                success: true,
                data: { tickets },
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getSupportInfo(_req, res) {
        res.status(200).json({
            success: true,
            data: {
                discordUrl: support_service_1.SupportService.DISCORD_URL,
                supportEmail: support_service_1.SupportService.SUPPORT_EMAIL,
                categories: [
                    'Payment & Wallet Deposit',
                    'Match Room & Slot Issue',
                    'Prize & Withdrawal Query',
                    'Hacking & Fair Play Report',
                    'Account & KYC Verification',
                    'Other / General Inquiry',
                ],
            },
        });
    }
}
exports.SupportController = SupportController;
