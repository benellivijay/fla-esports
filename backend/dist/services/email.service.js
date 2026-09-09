"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const https_1 = __importDefault(require("https"));
const logger_1 = require("../utils/logger");
class EmailService {
    static transporter = null;
    static getTransporter() {
        if (this.transporter)
            return this.transporter;
        const user = (process.env.EMAIL_USER || process.env.SMTP_USER || 'flaadmin40@gmail.com').trim();
        const rawPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || 'qpht stha jrhf hjwh';
        const pass = rawPass.trim().replace(/\s+/g, '');
        this.transporter = nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: { user, pass },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
        });
        return this.transporter;
    }
    static httpsPost(url, headers, data) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const postData = JSON.stringify(data);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    ...headers,
                },
                timeout: 10000,
            };
            const req = https_1.default.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => resolve({ status: res.statusCode || 200, body }));
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('HTTPS Request Timeout'));
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }
    static async sendOtpEmail(to, otpCode) {
        const cleanTo = to.trim().toLowerCase();
        const fromAddress = process.env.EMAIL_FROM || `"FLA ESPORTS" <flaadmin40@gmail.com>`;
        const subject = `[FLA ESPORTS] Your OTP Verification Code: ${otpCode}`;
        const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background: #0f141c; color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #232d3f;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #3b82f6; margin: 0; font-size: 24px; letter-spacing: 1px;">FLA ESPORTS</h1>
          <p style="color: #94a3b8; margin-top: 4px; font-size: 13px;">Official Tournament Verification</p>
        </div>
        
        <div style="background: #182234; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #2d3b55;">
          <p style="margin: 0 0 10px 0; color: #cbd5e1; font-size: 14px;">Your One-Time Password (OTP) is:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #60a5fa; margin: 10px 0;">${otpCode}</div>
          <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">Valid for 5 minutes. Never share this code with anyone.</p>
        </div>

        <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
          If you did not request this verification code, please ignore this email.
        </p>
      </div>
    `;
        // 1. Try Resend HTTPS REST API first
        const resendKey = (process.env.RESEND_API_KEY || 're_DeNNMmUm_LqkhPcvaWSGUohg3NmjrWEUF').trim();
        if (resendKey) {
            try {
                const res = await this.httpsPost('https://api.resend.com/emails', { Authorization: `Bearer ${resendKey}` }, {
                    from: 'FLA ESPORTS <onboarding@resend.dev>',
                    to: [cleanTo],
                    subject,
                    html: htmlContent,
                });
                if (res.status >= 200 && res.status < 300) {
                    logger_1.Logger.info(`[EMAIL] Sent OTP to ${cleanTo} via Resend HTTPS API (Status: ${res.status})`);
                    return true;
                }
                logger_1.Logger.warn(`[EMAIL] Resend API responded with status ${res.status}: ${res.body}`);
            }
            catch (err) {
                logger_1.Logger.error(`[EMAIL] Resend API error: ${err.message}`);
            }
        }
        // 2. Try Brevo (Sendinblue) HTTPS REST API if configured
        const brevoKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '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').trim();
        if (brevoKey) {
            try {
                const res = await this.httpsPost('https://api.brevo.com/v3/smtp/email', { 'api-key': brevoKey }, {
                    sender: { name: 'FLA ESPORTS', email: 'flaadmin40@gmail.com' },
                    to: [{ email: cleanTo }],
                    subject,
                    htmlContent,
                });
                if (res.status >= 200 && res.status < 300) {
                    logger_1.Logger.info(`[EMAIL] Sent OTP to ${cleanTo} via Brevo HTTPS API (Status: ${res.status})`);
                    return true;
                }
                logger_1.Logger.warn(`[EMAIL] Brevo API responded with status ${res.status}: ${res.body}`);
            }
            catch (err) {
                logger_1.Logger.error(`[EMAIL] Brevo API error: ${err.message}`);
            }
        }
        // 3. Try Google Apps Script Email Webhook if configured
        const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                const res = await this.httpsPost(webhookUrl.trim(), {}, {
                    to: cleanTo,
                    subject,
                    html: htmlContent,
                    otp: otpCode,
                });
                if (res.status >= 200 && res.status < 400) {
                    logger_1.Logger.info(`[EMAIL] Sent OTP to ${cleanTo} via Google Apps Script Webhook`);
                    return true;
                }
            }
            catch (err) {
                logger_1.Logger.error(`[EMAIL] Email Webhook error: ${err.message}`);
            }
        }
        // 4. Default: Gmail SMTP Transport via Nodemailer
        try {
            const transporter = this.getTransporter();
            const info = await transporter.sendMail({
                from: fromAddress,
                to: cleanTo,
                subject,
                html: htmlContent,
            });
            logger_1.Logger.info(`[EMAIL] Real OTP email successfully sent to ${cleanTo} (MessageId: ${info.messageId})`);
            return true;
        }
        catch (err) {
            logger_1.Logger.error(`[EMAIL] Nodemailer SMTP failed to send email to ${cleanTo}: ${err.message}`);
            return false;
        }
    }
    static async sendSupportTicketEmail(ticket) {
        const adminEmail = 'flaadmin40@gmail.com';
        const emailSubject = `[FLA SUPPORT #${ticket.ticketId}] ${ticket.category}: ${ticket.subject}`;
        const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0E17; color: #E8EAF0; padding: 24px; border-radius: 12px; border: 1px solid #2A3150;">
        <h2 style="color: #3DDCFF; margin-top: 0;">New Support Ticket / Complaint Raised</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; color: #E8EAF0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #2A3150; font-weight: bold; width: 140px;">Ticket ID:</td><td style="padding: 8px; border-bottom: 1px solid #2A3150; color: #F4B33C; font-weight: bold;">#${ticket.ticketId}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #2A3150; font-weight: bold;">Player Username:</td><td style="padding: 8px; border-bottom: 1px solid #2A3150;">${ticket.username}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #2A3150; font-weight: bold;">Player Email:</td><td style="padding: 8px; border-bottom: 1px solid #2A3150;"><a href="mailto:${ticket.userEmail}" style="color: #3DDCFF;">${ticket.userEmail}</a></td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #2A3150; font-weight: bold;">Category:</td><td style="padding: 8px; border-bottom: 1px solid #2A3150;">${ticket.category}</td></tr>
          ${ticket.referenceId ? `<tr><td style="padding: 8px; border-bottom: 1px solid #2A3150; font-weight: bold;">Reference ID:</td><td style="padding: 8px; border-bottom: 1px solid #2A3150;">${ticket.referenceId}</td></tr>` : ''}
          <tr><td style="padding: 8px; border-bottom: 1px solid #2A3150; font-weight: bold;">Subject:</td><td style="padding: 8px; border-bottom: 1px solid #2A3150;">${ticket.subject}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 14px; background: #1A2036; border-radius: 8px; border: 1px solid #2A3150;">
          <h4 style="margin: 0 0 8px 0; color: #8A8FA3;">Complaint Description:</h4>
          <p style="margin: 0; white-space: pre-wrap; line-height: 1.5; color: #E8EAF0;">${ticket.description}</p>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #8A8FA3;">This ticket was submitted from the FLA ESPORTS Mobile App.</p>
      </div>
    `;
        try {
            const transporter = this.getTransporter();
            await transporter.sendMail({
                from: `"FLA ESPORTS Support" <${adminEmail}>`,
                to: adminEmail,
                replyTo: ticket.userEmail,
                subject: emailSubject,
                html: htmlContent,
            });
            logger_1.Logger.info(`[SUPPORT] Sent complaint notification for #${ticket.ticketId} to ${adminEmail}`);
            return true;
        }
        catch (err) {
            logger_1.Logger.error(`[SUPPORT] Email notification failed for ticket #${ticket.ticketId}: ${err.message}`);
            return false;
        }
    }
}
exports.EmailService = EmailService;
