import { Logger } from '../utils/logger';

export class SmsService {
  /**
   * Sends real SMS OTP via configured SMS Gateway (Fast2SMS / 2Factor / Twilio)
   */
  public static async sendOtpSms(phone: string, otpCode: string): Promise<boolean> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const mobile10 = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

    // 1. Fast2SMS (India)
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey) {
      try {
        const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${fast2smsKey}&variables_values=${otpCode}&route=otp&numbers=${mobile10}`, {
          method: 'GET',
          headers: { 'cache-control': 'no-cache' },
        });
        const data = await res.json() as any;
        if (data.return === true) {
          Logger.info(`[SMS Fast2SMS] OTP sent successfully to ${mobile10}`);
          return true;
        } else {
          Logger.warn(`[SMS Fast2SMS] Failed: ${JSON.stringify(data)}`);
        }
      } catch (err: any) {
        Logger.error(`[SMS Fast2SMS] Error: ${err.message}`);
      }
    }

    // 2. 2Factor.in (India)
    const twoFactorKey = process.env.TWOFACTOR_API_KEY;
    if (twoFactorKey) {
      try {
        const res = await fetch(`https://2factor.in/v1/${twoFactorKey}/SMS/${mobile10}/${otpCode}/FLA_ESPORTS`, {
          method: 'GET',
        });
        const data = await res.json() as any;
        if (data.Status === 'Success') {
          Logger.info(`[SMS 2Factor] OTP sent successfully to ${mobile10}`);
          return true;
        }
      } catch (err: any) {
        Logger.error(`[SMS 2Factor] Error: ${err.message}`);
      }
    }

    // 3. Twilio (Global)
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    if (twilioSid && twilioAuth && twilioFrom) {
      try {
        const fullNumber = phone.startsWith('+') ? phone : `+91${mobile10}`;
        const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
        const body = new URLSearchParams({
          To: fullNumber,
          From: twilioFrom,
          Body: `[FLA ESPORTS] Your OTP code is ${otpCode}. Valid for 5 minutes.`,
        });

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });
        const data = await res.json() as any;
        if (data.sid) {
          Logger.info(`[SMS Twilio] OTP sent to ${fullNumber}`);
          return true;
        }
      } catch (err: any) {
        Logger.error(`[SMS Twilio] Error: ${err.message}`);
      }
    }

    Logger.warn(
      `[SMS] No SMS Gateway API key found in .env (FAST2SMS_API_KEY / TWOFACTOR_API_KEY / TWILIO_ACCOUNT_SID). OTP for ${phone} is ${otpCode}`
    );
    return false;
  }
}
