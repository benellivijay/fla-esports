"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_ENV = 'test';
const auth_service_1 = require("../modules/auth/auth.service");
const gdrive_auth_store_service_1 = require("../services/gdrive_auth_store.service");
const db_1 = require("../database/db");
const crypto_1 = require("../utils/crypto");
async function runTests() {
    console.log('🧪 Running Complete Auth Module Tests...\n');
    const db = (0, db_1.getDb)();
    const timestamp = Date.now();
    const testUser = 'tester_' + timestamp;
    const testEmail = 'tester_' + timestamp + '@example.com';
    const testPass = 'SecurePass123!';
    // Test 1: Register creates pending registration in Google Drive store (Zero unverified user rows)
    console.log('Test 1: Register with username, email, password');
    const regResult = await auth_service_1.AuthService.register(testUser, testEmail, testPass);
    if (!regResult.success)
        throw new Error('Registration failed');
    const pending = await gdrive_auth_store_service_1.GDriveAuthStore.getPendingRegistration(testEmail);
    if (!pending)
        throw new Error('Pending registration was not created in Google Drive pending store');
    const userRow = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(testEmail);
    if (userRow)
        throw new Error('CRITICAL VIOLATION: Player must NOT exist before OTP verification!');
    console.log('✅ Test 1 Passed: Pending registration created in Google Drive, no unverified user row.\n');
    // Test 2: Invalid OTP code verification rejects
    console.log('Test 2: Invalid OTP code verification');
    try {
        await auth_service_1.AuthService.verifyRegistrationOtp(testEmail, '000000');
        throw new Error('Should have thrown on wrong OTP');
    }
    catch (err) {
        if (err.message !== 'Incorrect verification code.')
            throw err;
    }
    console.log('✅ Test 2 Passed: Wrong OTP rejected properly.\n');
    // Test 3: Correct OTP verification creates real user row, deletes pending, and issues tokens
    console.log('Test 3: Correct OTP verification');
    const testOtp = '123456';
    const testOtpHash = crypto_1.CryptoUtil.hash(testOtp);
    await gdrive_auth_store_service_1.GDriveAuthStore.savePendingRegistration({
        ...pending,
        otp_hash: testOtpHash,
    });
    const verifyResult = await auth_service_1.AuthService.verifyRegistrationOtp(testEmail, testOtp);
    if (!verifyResult.accessToken || !verifyResult.refreshToken)
        throw new Error('Tokens not returned on verify');
    if (verifyResult.user.username !== testUser)
        throw new Error('Username mismatch in created user');
    if (!verifyResult.user.is_email_verified)
        throw new Error('Email verified must be true');
    const pendingAfterSuccess = db.prepare('SELECT * FROM pending_registrations WHERE email = ?').get(testEmail);
    if (pendingAfterSuccess)
        throw new Error('Pending registration row should have been deleted!');
    const verifiedUser = db.prepare('SELECT * FROM users WHERE email = ?').get(testEmail);
    if (!verifiedUser || !verifiedUser.password_hash)
        throw new Error('Real user was not created with password hash');
    console.log('? Test 3 Passed: User successfully created with email_verified = true and pending record cleared.\n');
    // Test 4: Sign in with username + password
    console.log('Test 4: Sign in with username');
    const signInUsernameResult = await auth_service_1.AuthService.signIn(testUser, testPass);
    if (signInUsernameResult.user.id !== verifiedUser.id)
        throw new Error('Sign in by username returned wrong user');
    console.log('? Test 4 Passed: Sign in by username succeeded.\n');
    // Test 5: Sign in with email + password
    console.log('Test 5: Sign in with email');
    const signInEmailResult = await auth_service_1.AuthService.signIn(testEmail, testPass);
    if (signInEmailResult.user.id !== verifiedUser.id)
        throw new Error('Sign in by email returned wrong user');
    console.log('? Test 5 Passed: Sign in by email succeeded.\n');
    // Test 6: Sign in with wrong password returns non-leaking generic error
    console.log('Test 6: Sign in with wrong password returns generic error');
    try {
        await auth_service_1.AuthService.signIn(testUser, 'WrongPassword!');
        throw new Error('Should have failed sign in');
    }
    catch (err) {
        if (err.message !== 'Incorrect username/email or password')
            throw new Error('Error message leaked: ' + err.message);
    }
    console.log('? Test 6 Passed: Generic non-leaking error returned.\n');
    // Test 7: Google Sign In / Account Linking
    console.log('Test 7: Google Sign In & Account Linking');
    const googleId = 'google_uid_' + Date.now();
    const googleLinkResult = await auth_service_1.AuthService.googleAuth({
        email: testEmail,
        googleId,
        name: 'Google Linked Player',
    });
    if (googleLinkResult.user?.id !== verifiedUser.id)
        throw new Error('Google sign in did not link to existing account');
    const linkedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(verifiedUser.id);
    if (linkedUser.google_id !== googleId)
        throw new Error('google_id was not linked');
    console.log('? Test 7 Passed: Google Sign-in correctly linked existing email account.\n');
    // Test 8: Google Sign In for brand new user
    console.log('Test 8: Google Sign In for new user creates user without OTP');
    const newGoogleEmail = 'new_google_' + Date.now() + '@gmail.com';
    const newGoogleId = 'google_uid_' + (Date.now() + 1);
    const newGoogleResult = await auth_service_1.AuthService.googleAuth({
        email: newGoogleEmail,
        googleId: newGoogleId,
        name: 'New Google Player',
    });
    if (!newGoogleResult.user || !newGoogleResult.accessToken)
        throw new Error('New Google user creation failed');
    const createdGoogleUser = db.prepare('SELECT * FROM users WHERE id = ?').get(newGoogleResult.user.id);
    if (createdGoogleUser.password_hash !== null && createdGoogleUser.password_hash !== undefined) {
        throw new Error('Password hash for Google-only account must be null');
    }
    console.log('? Test 8 Passed: New Google account created directly with verified email.\n');
    console.log('?? ALL AUTH TESTS PASSED 100%!');
}
runTests().catch((err) => {
    console.error('? Auth Test Failed:', err);
    process.exit(1);
});
