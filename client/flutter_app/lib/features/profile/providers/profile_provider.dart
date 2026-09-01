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
    fetchProfileAndKyc();
  }

  Future<void> fetchProfileAndKyc() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final profileRes = await _apiClient.dio.get(ApiEndpoints.profileMe);

      if (profileRes.statusCode == 200 && profileRes.data['success'] == true) {
        final data = profileRes.data['data'];
        final profile = ProfileModel.fromJson(data['profile']);
        final kyc = KycModel.fromJson(data);

        state = state.copyWith(
          isLoading: false,
          profile: profile,
          kyc: kyc,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load profile details.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  Future<void> fetchProfile() async => await fetchProfileAndKyc();

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
