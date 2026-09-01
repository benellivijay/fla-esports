import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/result_model.dart';

class ResultState {
  final bool isLoading;
  final bool isSubmitting;
  final MatchResultModel? mySubmission;
  final List<AdminResultQueueItemModel> adminQueue;
  final String? errorMessage;

  const ResultState({
    this.isLoading = false,
    this.isSubmitting = false,
    this.mySubmission,
    this.adminQueue = const [],
    this.errorMessage,
  });

  ResultState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    MatchResultModel? mySubmission,
    List<AdminResultQueueItemModel>? adminQueue,
    String? errorMessage,
  }) {
    return ResultState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      mySubmission: mySubmission ?? this.mySubmission,
      adminQueue: adminQueue ?? this.adminQueue,
      errorMessage: errorMessage,
    );
  }
}

final resultProvider = StateNotifierProvider<ResultNotifier, ResultState>((ref) {
  return ResultNotifier();
});

class ResultNotifier extends StateNotifier<ResultState> {
  final ApiClient _apiClient = ApiClient();

  ResultNotifier() : super(const ResultState());

  Future<void> fetchMySubmission(String tournamentId) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get('/tournaments/$tournamentId/results/my-submission');
      if (res.statusCode == 200 && res.data['data'] != null) {
        final sub = MatchResultModel.fromJson(res.data['data']);
        state = state.copyWith(isLoading: false, mySubmission: sub);
      } else {
        state = state.copyWith(isLoading: false, mySubmission: null);
      }
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<bool> submitResult({
    required String tournamentId,
    required int claimedRank,
    required int claimedKills,
    File? screenshotFile,
    String? screenshotUrl,
  }) async {
    state = state.copyWith(isSubmitting: true, errorMessage: null);
    try {
      FormData formData;
      if (screenshotFile != null) {
        formData = FormData.fromMap({
          'claimedRank': claimedRank,
          'claimedKills': claimedKills,
          'screenshot': await MultipartFile.fromFile(
            screenshotFile.path,
            filename: 'proof_${DateTime.now().millisecondsSinceEpoch}.jpg',
          ),
        });
      } else {
        formData = FormData.fromMap({
          'claimedRank': claimedRank,
          'claimedKills': claimedKills,
          'screenshotUrl': screenshotUrl ?? '/uploads/default_proof.jpg',
        });
      }

      final res = await _apiClient.dio.post(
        '/tournaments/$tournamentId/results/submit',
        data: formData,
      );

      if (res.statusCode == 201 && res.data['success'] == true) {
        final sub = MatchResultModel.fromJson(res.data['data']);
        state = state.copyWith(isSubmitting: false, mySubmission: sub);
        return true;
      }
      state = state.copyWith(isSubmitting: false);
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to submit match result.';
      state = state.copyWith(isSubmitting: false, errorMessage: msg);
      return false;
    }
  }

  Future<void> fetchAdminQueue({String? tournamentId, String? status}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get(
        '/admin/results/queue',
        queryParameters: {
          if (tournamentId != null) 'tournamentId': tournamentId,
          if (status != null) 'status': status,
        },
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        final List list = res.data['data']['queue'] ?? [];
        final parsed = list.map((item) => AdminResultQueueItemModel.fromJson(item as Map<String, dynamic>)).toList();
        state = state.copyWith(isLoading: false, adminQueue: parsed);
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load results queue.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  Future<bool> reviewResult({
    required String resultId,
    required String decision,
    int? confirmedRank,
    int? confirmedKills,
    String? rejectionReason,
  }) async {
    try {
      final res = await _apiClient.dio.post(
        '/admin/results/$resultId/review',
        data: {
          'decision': decision,
          if (confirmedRank != null) 'confirmedRank': confirmedRank,
          if (confirmedKills != null) 'confirmedKills': confirmedKills,
          if (rejectionReason != null) 'rejectionReason': rejectionReason,
        },
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        await fetchAdminQueue();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
