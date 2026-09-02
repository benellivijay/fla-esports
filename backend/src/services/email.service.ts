import nodemailer from 'nodemailer';
import { Logger } from '../utils/logger';

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const user = (process.env.EMAIL_USER || process.env.SMTP_USER || 'flaadmin40@gmail.com').trim();
    const rawPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || 'qpht stha jrhf hjwh';
    const pass = rawPass.trim().replace(/\s+/g, '');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    return this.transporter;
  }

  public static async sendOtpEmail(to: string, otpCode: string): Promise<boolean> {
    const transporter = this.getTransporter();
    const fromAddress = process.env.EMAIL_FROM || `"FLA ESPORTS" <flaadmin40@gmail.com>`;

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

    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: to.trim().toLowerCase(),
        subject: `[FLA ESPORTS] Your OTP Verification Code: ${otpCode}`,
        html: htmlContent,
      });
      Logger.info(`[EMAIL] Real OTP email successfully sent to ${to} (MessageId: ${info.messageId})`);
      return true;
    } catch (err: any) {
      Logger.error(`[EMAIL] Failed to send email to ${to}: ${err.message}`);
      return false;
    }
  }
}
