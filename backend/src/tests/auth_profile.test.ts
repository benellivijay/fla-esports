process.env.NODE_ENV = 'test';
import http from 'http';
import { createApp } from '../server';
import { getDb, DatabaseManager } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

interface ApiResponse {
  status: number;
  data: any;
}

function makeRequest(server: http.Server, options: {
  method: string;
  path: string;
  body?: any;
  token?: string;
}): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const postData = options.body ? JSON.stringify(options.body) : '';

    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
    };

    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method,
      headers,
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: rawData });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('🧪 Starting Step 1: Auth & User Profile (Phone + Email KYC) Automated Tests...\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error('     Detail:', detail);
      failedCount++;
    }
  }

  const app = createApp();
  const server = http.createServer(app);
  
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const randSuffix = Math.floor(100000 + Math.random() * 900000);
  const testPhone = `98${randSuffix}12`;
  const testEmail = `player_${randSuffix}@example.com`;
  const testFfUid = `FFUID_${randSuffix}`;
  let accessToken = '';
  let refreshToken = '';
  let userId = '';
  let adminToken = '';
  let adminUserId = '';

  try {
    // 1. Health check
    const healthRes = await makeRequest(server, { method: 'GET', path: '/health' });
    assert(healthRes.status === 200 && healthRes.data.status === 'healthy', 'Health check endpoint returns 200 OK');

    // 2. Send Phone OTP
    const sendOtpRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/auth/otp/send',
      body: { identifier: testPhone, type: 'phone' },
    });
    assert(sendOtpRes.status === 200 && sendOtpRes.data.success === true, 'Send Phone OTP returns success');
    const phoneOtpCode = sendOtpRes.data.debugOtp || '123456';

    // 3. Verify incorrect OTP rejected
    const invalidOtpRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/auth/otp/verify',
      body: { identifier: testPhone, otpCode: '999999', type: 'phone' },
    });
    assert(invalidOtpRes.status === 400 && invalidOtpRes.data.code === 'INVALID_OTP', 'Incorrect OTP rejected with 400 code');

    // 4. Verify correct Phone OTP -> Phone verified (1/2 KYC)
    const verifyOtpRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/auth/otp/verify',
      body: { identifier: testPhone, otpCode: phoneOtpCode, type: 'phone' },
    });
    assert(verifyOtpRes.status === 200 && verifyOtpRes.data.data.accessToken, 'Correct Phone OTP generates access token & user profile');
    
    accessToken = verifyOtpRes.data.data.accessToken;
    refreshToken = verifyOtpRes.data.data.refreshToken;
    userId = verifyOtpRes.data.data.user.id;

    // 5. Check initial profile (Phone verified, Email unverified, KYC is unverified)
    const initialProfileRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/profile/me',
      token: accessToken,
    });
    assert(
      initialProfileRes.data.data.isPhoneVerified === true &&
      initialProfileRes.data.data.isEmailVerified === false &&
      initialProfileRes.data.data.kycStatus === 'unverified',
      'Initial profile has Phone verified, Email unverified, KYC unverified'
    );

    // 6. Send Email OTP for Secondary Verification
    const sendEmailOtpRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/auth/otp/send',
      body: { identifier: testEmail, type: 'email' },
    });
    assert(sendEmailOtpRes.status === 200 && sendEmailOtpRes.data.success === true, 'Send Email OTP returns success');
    const emailOtpCode = sendEmailOtpRes.data.debugOtp || '123456';

    // 7. Verify Secondary Email OTP -> Triggers instant KYC Verified!
    const verifySecondaryRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/auth/verify-secondary',
      token: accessToken,
      body: { identifier: testEmail, otpCode: emailOtpCode, type: 'email' },
    });
    assert(
      verifySecondaryRes.status === 200 && verifySecondaryRes.data.data.kycVerified === true,
      'Verifying Email completes KYC -> returns kycVerified: true'
    );

    // 8. Check profile reflects KYC Verified status under profile
    const verifiedProfileRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/profile/me',
      token: accessToken,
    });
    assert(
      verifiedProfileRes.data.data.isPhoneVerified === true &&
      verifiedProfileRes.data.data.isEmailVerified === true &&
      verifiedProfileRes.data.data.kycStatus === 'verified',
      'Profile reflects KYC Verified symbol once both Phone and Email are verified'
    );

    // 9. Update Profile display name
    const updateProfileRes = await makeRequest(server, {
      method: 'PUT',
      path: '/api/v1/profile/me',
      token: accessToken,
      body: { displayName: `Pro_${randSuffix}` },
    });
    assert(updateProfileRes.status === 200 && updateProfileRes.data.data.display_name === `Pro_${randSuffix}`, 'PUT /profile/me updates display name successfully');

    // 10. Free Fire UID Verification: Direct Instant Linking (Zero Diamond Cost)
    const ffInitRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/profile/ff-uid/initiate',
      token: accessToken,
      body: { ffUid: testFfUid, ffIgn: `Pro_${randSuffix}` },
    });
    assert(
      ffInitRes.status === 200 && ffInitRes.data.data.status === 'verified',
      'Direct FF UID linking instantly links game ID without challenge code'
    );

    // 11. Create Admin user in DB and test Admin Gating
    const db = getDb();
    adminUserId = uuidv4();
    const adminEmail = `admin_${randSuffix}@ffesports.com`;
    db.prepare(`
      INSERT INTO users (id, email, role, status, is_email_verified, created_at, updated_at)
      VALUES (?, ?, 'admin', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(adminUserId, adminEmail);

    adminToken = jwt.sign(
      { userId: adminUserId, role: 'admin', email: adminEmail },
      config.jwt.accessSecret,
      { expiresIn: '1h' }
    );

    // 12. Regular user forbidden from admin queue
    const forbiddenAdminRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/verifications/ff-uid',
      token: accessToken,
    });
    assert(forbiddenAdminRes.status === 403, 'Regular user blocked from admin endpoints (403 Forbidden)');

    // 13. Refresh token rotation
    const refreshRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/auth/refresh',
      body: { refreshToken },
    });
    assert(refreshRes.status === 200 && refreshRes.data.data.accessToken, 'Refresh token rotation issues new access & refresh tokens');

    // 14. Admin inspects audit logs
    const auditLogsRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/audit-logs',
      token: adminToken,
    });
    assert(auditLogsRes.status === 200 && ((Array.isArray(auditLogsRes.data.data) ? auditLogsRes.data.data.length : auditLogsRes.data.logs?.length) ?? 0) >= 1, 'Admin successfully accesses immutable audit logs');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failedCount++;
  } finally {
    server.close();
    DatabaseManager.close();
  }

  console.log(`\n================================`);
  console.log(`Total Passed: ${passedCount}`);
  console.log(`Total Failed: ${failedCount}`);
  console.log(`================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests();
