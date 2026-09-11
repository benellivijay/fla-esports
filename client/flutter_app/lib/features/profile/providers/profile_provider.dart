import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../models/profile_model.dart';
import '../models/kyc_model.dart';

class ProfileState {
  final bool isLoading;
  final ProfileModel? profile;
  final KycModel? kyc;
  final String? errorMessage;
  final String? ffChallengeCode;
  final String? ffChallengeInstructions;

  const ProfileState({
    this.isLoading = false,
    this.profile,
    this.kyc,
    this.errorMessage,
    this.ffChallengeCode,
    this.ffChallengeInstructions,
  });

  ProfileState copyWith({
    bool? isLoading,
    ProfileModel? profile,
    KycModel? kyc,
    String? errorMessage,
    String? ffChallengeCode,
    String? ffChallengeInstructions,
  }) {
    return ProfileState(
      isLoading: isLoading ?? this.isLoading,
      profile: profile ?? this.profile,
      kyc: kyc ?? this.kyc,
      errorMessage: errorMessage,
      ffChallengeCode: ffChallengeCode ?? this.ffChallengeCode,
      ffChallengeInstructions: ffChallengeInstructions ?? this.ffChallengeInstructions,
    );
  }
}

final profileProvider = StateNotifierProvider<ProfileNotifier, ProfileState>((ref) {
  return ProfileNotifier();
});

class ProfileNotifier extends StateNotifier<ProfileState> {
  final ApiClient _apiClient = ApiClient();

  ProfileNotifier() : super(const ProfileState()) {
    _loadCachedProfile();
    fetchProfileAndKyc();
  }

  /// Hydrate profile and KYC state immediately from local secure storage
  Future<void> _loadCachedProfile() async {
    try {
      final cachedProfile = await _apiClient.getCachedProfile();
      final cachedUser = await _apiClient.getCachedUser();

      if (cachedProfile != null) {
        final prof = ProfileModel.fromJson(cachedProfile);
        KycModel? kyc;
        if (cachedUser != null) {
          final isPhone = cachedUser['is_phone_verified'] == 1 || cachedUser['is_phone_verified'] == true;
          final isEmail = cachedUser['is_email_verified'] == 1 || cachedUser['is_email_verified'] == true || cachedUser['email_verified'] == 1 || cachedUser['email_verified'] == true;
          kyc = KycModel(
            isPhoneVerified: isPhone,
            isEmailVerified: isEmail,
            phone: cachedUser['phone'] as String?,
            email: cachedUser['email'] as String?,
            status: (isEmail) ? 'verified' : 'unverified',
          );
        }
        state = state.copyWith(
          profile: prof,
          kyc: kyc ?? state.kyc,
        );
      }
    } catch (_) {}
  }

  Future<void> fetchProfileAndKyc() async {
    // Only show full loading spinner if we don't already have a cached profile
    state = state.copyWith(
      isLoading: state.profile == null,
      errorMessage: null,
    );
    try {
      final profileRes = await _apiClient.dio.get(ApiEndpoints.profileMe);

      if (profileRes.statusCode == 200 && profileRes.data['success'] == true) {
        final data = profileRes.data['data'];
        final rawProfile = data?['profile'];
        if (rawProfile == null) {
          state = state.copyWith(
            isLoading: false,
            errorMessage: 'Profile not set up yet. Please complete your profile.',
          );
          return;
        }
        final profile = ProfileModel.fromJson(rawProfile as Map<String, dynamic>);
        final kyc = KycModel.fromJson(data);

        // Cache latest profile
        await _apiClient.saveCachedProfile(profile.toJson());

        state = state.copyWith(
          isLoading: false,
          profile: profile,
          kyc: kyc,
          errorMessage: null,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load profile details.';
      // Do not wipe out existing cached profile on network error
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  Future<void> fetchProfile() async => await fetchProfileAndKyc();

  Future<void> refresh() async => await fetchProfileAndKyc();

  void reset() {
    state = const ProfileState();
  }

  Future<bool> updateDisplayName(String name) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.put(
        ApiEndpoints.profileMe,
        data: {'displayName': name.trim()},
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        await fetchProfileAndKyc();
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to update name.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    }
  }

  Future<bool> linkFfUid({required String ffUid, required String ffIgn}) async =>
      await initiateFfVerification(ffUid: ffUid, ffIgn: ffIgn);

  Future<bool> initiateFfVerification({required String ffUid, required String ffIgn}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.initiateFfUid,
        data: {'ffUid': ffUid, 'ffIgn': ffIgn},
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        final data = res.data['data'];
        state = state.copyWith(
          isLoading: false,
          ffChallengeCode: data['tempChallenge'],
          ffChallengeInstructions: data['instructions'],
        );
        await fetchProfileAndKyc();
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to initiate FF UID verification.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    }
  }

  Future<bool> submitFfProof({required String filePath}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final formData = FormData.fromMap({
        'proofImage': await MultipartFile.fromFile(filePath),
      });

      final res = await _apiClient.dio.post(
        ApiEndpoints.submitFfProof,
        data: formData,
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        await fetchProfileAndKyc();
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to upload verification screenshot.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    }
  }

  Future<bool> sendSecondaryOtp({required String identifier, required String type}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.sendOtp,
        data: {'identifier': identifier, 'type': type},
      );
      state = state.copyWith(isLoading: false);
      return res.statusCode == 200;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to send OTP.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    }
  }

  Future<bool> verifySecondary({
    required String identifier,
    required String otpCode,
    required String type,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        ApiEndpoints.verifySecondary,
        data: {
          'identifier': identifier,
          'otpCode': otpCode,
          'type': type,
        },
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        await fetchProfileAndKyc();
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to verify OTP.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    }
  }

  Future<bool> submitKyc({
    required String panNumber,
    required String fullName,
    required String dob,
    String? filePath,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        '/kyc/submit',
        data: {
          'panNumber': panNumber,
          'fullName': fullName,
          'dob': dob,
        },
      );
      if (res.statusCode == 200 && res.data['success'] == true) {
        await fetchProfileAndKyc();
        return true;
      }
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to submit KYC details.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    }
  }
}
