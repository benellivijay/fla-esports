import { AuthService } from '../modules/auth/auth.service';
import { ProfileService } from '../modules/profile/profile.service';
import { GDriveAuthStore } from '../services/gdrive_auth_store.service';
import { getDb } from '../database/db';
import { CryptoUtil } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

async function runGDriveAuthTests() {
  console.log('?? Running Google Drive Player Auth & Registration Storage Tests...\n');

  // Initialize store
  await GDriveAuthStore.initStore();

  const testEmail = `gdrive_player_${Date.now()}@example.com`;
  const testUsername = `gdrive_user_${Math.floor(1000 + Math.random() * 9000)}`;
  const testPassword = 'Password@123';

  // Test 1: Register player and store pending OTP in Google Drive
  console.log('Test 1: Register player and persist pending registration');
  const regResult = await AuthService.register(testUsername, testEmail, testPassword);
  if (!regResult.success) {
    throw new Error('Registration failed.');
  }

  const pending = await GDriveAuthStore.getPendingRegistration(testEmail);
  if (!pending || pending.username !== testUsername) {
    throw new Error('Pending registration was not stored in GDrive store.');
  }
  console.log('? Test 1 Passed: Pending registration stored with encrypted credentials.');

  // Test 2: Verify OTP and save player to Google Drive Auth Store
  console.log('\nTest 2: Verify OTP and create player in Google Drive Store');
  const db = getDb();
  const pendingRow = db.prepare('SELECT * FROM pending_registrations WHERE LOWER(email) = ?').get(testEmail) as any;
  
  // Create simulated valid OTP
  const mockOtp = '123456';
  const mockOtpHash = CryptoUtil.hash(mockOtp);
  await GDriveAuthStore.savePendingRegistration({
    ...pending,
    otp_hash: mockOtpHash,
  });

  const verifyResult = await AuthService.verifyRegistrationOtp(testEmail, mockOtp);
  if (!verifyResult.accessToken || !verifyResult.user) {
    throw new Error('OTP verification failed.');
  }
  if (verifyResult.user.email !== testEmail || verifyResult.user.username !== testUsername) {
    throw new Error('User record data mismatch.');
  }

  // Ensure pending was cleared and player was stored in GDrive
  const pendingAfter = await GDriveAuthStore.getPendingRegistration(testEmail);
  if (pendingAfter) {
    throw new Error('Pending registration was not removed after verification.');
  }

  const storedPlayer = await GDriveAuthStore.getPlayer(testEmail);
  if (!storedPlayer || storedPlayer.username !== testUsername) {
    throw new Error('Player was not persisted in GDrive store.');
  }
  console.log('? Test 2 Passed: Player verified and persisted into Google Drive store.');

  // Test 3: Sign in using email/username from Google Drive store
  console.log('\nTest 3: Sign in using email & username from Google Drive store');
  const signInWithEmail = await AuthService.signIn(testEmail, testPassword);
  if (!signInWithEmail.accessToken || signInWithEmail.user.id !== storedPlayer.id) {
    throw new Error('Sign in with email failed.');
  }

  const signInWithUsername = await AuthService.signIn(testUsername, testPassword);
  if (!signInWithUsername.accessToken || signInWithUsername.user.id !== storedPlayer.id) {
    throw new Error('Sign in with username failed.');
  }
  console.log('? Test 3 Passed: Successfully signed in using both email and username against Google Drive store.');

  // Test 4: Link Free Fire UID and verify Google Drive sync
  console.log('\nTest 4: Link Free Fire UID and verify sync');
  const testFfUid = `998877${Math.floor(100 + Math.random() * 900)}`;
  const testFfIgn = `FLA_${testUsername}`;
  const ffResult = await ProfileService.initiateFFVerification(storedPlayer.id, testFfUid, testFfIgn);
  if (ffResult.status !== 'verified') {
    throw new Error('FF UID link failed.');
  }

  const updatedPlayer = await GDriveAuthStore.getPlayer(storedPlayer.id);
  if (updatedPlayer?.ff_uid !== testFfUid || updatedPlayer?.ff_ign !== testFfIgn) {
    throw new Error('Free Fire UID update was not synced to GDrive store.');
  }
  console.log('? Test 4 Passed: Free Fire UID linked and synced to Google Drive store.');

  // Test 5: Google OAuth Sign-in & Storage
  console.log('\nTest 5: Google OAuth Sign-in and persistent storage');
  const googleEmail = `google_player_${Date.now()}@gmail.com`;
  const googleSub = `goog_${uuidv4()}`;
  const googleResult = await AuthService.googleAuth({
    email: googleEmail,
    googleId: googleSub,
    name: 'Google Test Player',
    avatarUrl: 'https://example.com/avatar.png',
  });

  if (!googleResult.accessToken || googleResult.user.email !== googleEmail) {
    throw new Error('Google OAuth auth failed.');
  }

  const googlePlayer = await GDriveAuthStore.getPlayerByGoogleId(googleSub);
  if (!googlePlayer || googlePlayer.email !== googleEmail) {
    throw new Error('Google player was not saved to Google Drive store.');
  }
  console.log('? Test 5 Passed: Google OAuth player registered and saved to Google Drive store.');

  // Test 6: Flush and restore registry
  console.log('\nTest 6: Flush and restore player registry from JSON format');
  const flushSuccess = await GDriveAuthStore.flushPlayersToDrive();
  if (!flushSuccess) {
    throw new Error('Failed to flush player registry.');
  }

  const restoredCount = await GDriveAuthStore.restoreFromDrive();
  if (restoredCount < 2) {
    throw new Error(`Expected at least 2 restored players, got ${restoredCount}`);
  }
  console.log(`? Test 6 Passed: Successfully flushed and restored ${restoredCount} players from JSON registry.`);

  console.log('\n?? ALL GOOGLE DRIVE AUTH STORAGE TESTS PASSED 100%!');
}

runGDriveAuthTests().catch((err) => {
  console.error('? Test failed:', err);
  process.exit(1);
});
