"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_ENV = 'test';
const auth_service_1 = require("../modules/auth/auth.service");
const profile_service_1 = require("../modules/profile/profile.service");
const gdrive_auth_store_service_1 = require("../services/gdrive_auth_store.service");
const db_1 = require("../database/db");
const crypto_1 = require("../utils/crypto");
const uuid_1 = require("uuid");
async function runGDriveAuthTests() {
    console.log('?? Running Google Drive Player Auth & Registration Storage Tests...\n');
    // Initialize store
    await gdrive_auth_store_service_1.GDriveAuthStore.initStore();
    const testEmail = `gdrive_player_${Date.now()}@example.com`;
    const testUsername = `gdrive_user_${Math.floor(1000 + Math.random() * 9000)}`;
    const testPassword = 'Password@123';
    // Test 1: Register player and store pending OTP in Google Drive
    console.log('Test 1: Register player and persist pending registration');
    const regResult = await auth_service_1.AuthService.register(testUsername, testEmail, testPassword);
    if (!regResult.success) {
        throw new Error('Registration failed.');
    }
    const pending = await gdrive_auth_store_service_1.GDriveAuthStore.getPendingRegistration(testEmail);
    if (!pending || pending.username !== testUsername) {
        throw new Error('Pending registration was not stored in GDrive store.');
    }
    console.log('? Test 1 Passed: Pending registration stored with encrypted credentials.');
    // Test 2: Verify OTP and save player to Google Drive Auth Store
    console.log('\nTest 2: Verify OTP and create player in Google Drive Store');
    const db = (0, db_1.getDb)();
    const pendingRow = db.prepare('SELECT * FROM pending_registrations WHERE LOWER(email) = ?').get(testEmail);
    // Create simulated valid OTP
    const mockOtp = '123456';
    const mockOtpHash = crypto_1.CryptoUtil.hash(mockOtp);
    await gdrive_auth_store_service_1.GDriveAuthStore.savePendingRegistration({
        ...pending,
        otp_hash: mockOtpHash,
    });
    const verifyResult = await auth_service_1.AuthService.verifyRegistrationOtp(testEmail, mockOtp);
    if (!verifyResult.accessToken || !verifyResult.user) {
        throw new Error('OTP verification failed.');
    }
    if (verifyResult.user.email !== testEmail || verifyResult.user.username !== testUsername) {
        throw new Error('User record data mismatch.');
    }
    // Ensure pending was cleared and player was stored in GDrive
    const pendingAfter = await gdrive_auth_store_service_1.GDriveAuthStore.getPendingRegistration(testEmail);
    if (pendingAfter) {
        throw new Error('Pending registration was not removed after verification.');
    }
    const storedPlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(testEmail);
    if (!storedPlayer || storedPlayer.username !== testUsername) {
        throw new Error('Player was not persisted in GDrive store.');
    }
    console.log('? Test 2 Passed: Player verified and persisted into Google Drive store.');
    // Test 3: Sign in using email/username from Google Drive store
    console.log('\nTest 3: Sign in using email & username from Google Drive store');
    const signInWithEmail = await auth_service_1.AuthService.signIn(testEmail, testPassword);
    if (!signInWithEmail.accessToken || signInWithEmail.user.id !== storedPlayer.id) {
        throw new Error('Sign in with email failed.');
    }
    const signInWithUsername = await auth_service_1.AuthService.signIn(testUsername, testPassword);
    if (!signInWithUsername.accessToken || signInWithUsername.user.id !== storedPlayer.id) {
        throw new Error('Sign in with username failed.');
    }
    console.log('? Test 3 Passed: Successfully signed in using both email and username against Google Drive store.');
    // Test 4: Link Free Fire UID and verify Google Drive sync
    console.log('\nTest 4: Link Free Fire UID and verify sync');
    const testFfUid = `998877${Math.floor(100 + Math.random() * 900)}`;
    const testFfIgn = `FLA_${testUsername}`;
    const ffResult = await profile_service_1.ProfileService.initiateFFVerification(storedPlayer.id, testFfUid, testFfIgn);
    if (ffResult.status !== 'verified') {
        throw new Error('FF UID link failed.');
    }
    const updatedPlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(storedPlayer.id);
    if (updatedPlayer?.ff_uid !== testFfUid || updatedPlayer?.ff_ign !== testFfIgn) {
        throw new Error('Free Fire UID update was not synced to GDrive store.');
    }
    console.log('? Test 4 Passed: Free Fire UID linked and synced to Google Drive store.');
    // Test 5: Google OAuth Sign-in & Username Choice
    console.log('\nTest 5: Google OAuth Sign-in with player-chosen username');
    const googleEmail = `google_player_${Date.now()}@gmail.com`;
    const googleSub = `goog_${(0, uuid_1.v4)()}`;
    // 5a. CheckOnly probe
    const probeResult = await auth_service_1.AuthService.googleAuth({
        email: googleEmail,
        googleId: googleSub,
        name: 'Google Champion Player',
        avatarUrl: 'https://example.com/avatar.png',
        checkOnly: true,
    });
    if (!probeResult.isNewUser || !probeResult.suggestedUsername) {
        throw new Error('Google checkOnly probe failed to identify new user.');
    }
    // 5b. Check username availability
    const customUsername = `champ_${Math.floor(1000 + Math.random() * 9000)}`;
    const availResult = await auth_service_1.AuthService.checkUsername(customUsername);
    if (!availResult.available) {
        throw new Error('Username should have been available.');
    }
    // 5c. Complete Google registration with custom entered username
    const googleResult = await auth_service_1.AuthService.googleAuth({
        email: googleEmail,
        googleId: googleSub,
        name: 'Google Champion Player',
        avatarUrl: 'https://example.com/avatar.png',
        username: customUsername,
    });
    if (!googleResult.accessToken || googleResult.user?.username !== customUsername) {
        throw new Error(`Google OAuth registration did not use custom username. Expected ${customUsername}, got ${googleResult.user?.username}`);
    }
    const googlePlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(customUsername);
    if (!googlePlayer || googlePlayer.email !== googleEmail || googlePlayer.username !== customUsername) {
        throw new Error('Google player with custom username was not saved to Google Drive store.');
    }
    console.log(`✅ Test 5 Passed: Google OAuth player registered with custom chosen username '@${customUsername}' in Google Drive.`);
    // Test 6: Flush and restore registry
    console.log('\nTest 6: Flush and restore player registry from JSON format');
    const flushSuccess = await gdrive_auth_store_service_1.GDriveAuthStore.flushPlayersToDrive();
    if (!flushSuccess) {
        throw new Error('Failed to flush player registry.');
    }
    const restoredCount = await gdrive_auth_store_service_1.GDriveAuthStore.restoreFromDrive();
    if (restoredCount < 2) {
        throw new Error(`Expected at least 2 restored players, got ${restoredCount}`);
    }
    console.log(`✅ Test 6 Passed: Successfully flushed and restored ${restoredCount} players from JSON registry.`);
    console.log('\n🎉 ALL GOOGLE DRIVE AUTH STORAGE TESTS PASSED 100%!');
}
runGDriveAuthTests().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
