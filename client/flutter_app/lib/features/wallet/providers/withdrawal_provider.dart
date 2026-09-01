import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/withdrawal_model.dart';

class WithdrawalState {
  final bool isLoading;
  final bool isSubmitting;
  final List<WithdrawalRequestModel> myWithdrawals;
  final List<AdminWithdrawalQueueItemModel> adminQueue;
  final String? errorMessage;

  const WithdrawalState({
    this.isLoading = false,
    this.isSubmitting = false,
    this.myWithdrawals = const [],
    this.adminQueue = const [],
    this.errorMessage,
  });

  WithdrawalState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<WithdrawalRequestModel>? myWithdrawals,
    List<AdminWithdrawalQueueItemModel>? adminQueue,
    String? errorMessage,
  }) {
    return WithdrawalState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      myWithdrawals: myWithdrawals ?? this.myWithdrawals,
      adminQueue: adminQueue ?? this.adminQueue,
      errorMessage: errorMessage,
    );
  }
}

final withdrawalProvider = StateNotifierProvider<WithdrawalNotifier, WithdrawalState>((ref) {
  return WithdrawalNotifier();
});

class WithdrawalNotifier extends StateNotifier<WithdrawalState> {
  final ApiClient _apiClient = ApiClient();

  WithdrawalNotifier() : super(const WithdrawalState());

  Future<void> fetchMyWithdrawals() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get('/wallet/withdraw/my-requests');
      if (res.statusCode == 200 && res.data['data'] != null) {
        final List list = res.data['data'] as List;
        final parsed = list.map((item) => WithdrawalRequestModel.fromJson(item as Map<String, dynamic>)).toList();
        state = state.copyWith(isLoading: false, myWithdrawals: parsed);
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to load withdrawals.');
    }
  }

  Future<bool> requestWithdrawal({
    required double amount,
    required String payoutMethod,
    String? upiId,
    String? bankAccountNumber,
    String? bankIfsc,
    String? bankAccountHolderName,
  }) async {
    state = state.copyWith(isSubmitting: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        '/wallet/withdraw/request',
        data: {
          'amount': amount,
          'payoutMethod': payoutMethod,
          if (upiId != null) 'upiId': upiId,
          if (bankAccountNumber != null) 'bankAccountNumber': bankAccountNumber,
          if (bankIfsc != null) 'bankIfsc': bankIfsc,
          if (bankAccountHolderName != null) 'bankAccountHolderName': bankAccountHolderName,
        },
      );

      if (res.statusCode == 201 && res.data['success'] == true) {
        await fetchMyWithdrawals();
        state = state.copyWith(isSubmitting: false);
        return true;
      }
      state = state.copyWith(isSubmitting: false);
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to submit withdrawal request.';
      state = state.copyWith(isSubmitting: false, errorMessage: msg);
      return false;
    }
  }

  Future<void> fetchAdminQueue({String? status}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get(
        '/admin/withdrawals/queue',
        queryParameters: {
          if (status != null) 'status': status,
        },
      );

      if (res.statusCode == 200 && res.data['success'] == true) {
        final List list = res.data['data']['queue'] ?? [];
        final parsed = list.map((item) => AdminWithdrawalQueueItemModel.fromJson(item as Map<String, dynamic>)).toList();
        state = state.copyWith(isLoading: false, adminQueue: parsed);
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load withdrawal queue.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  Future<bool> processWithdrawal({
    required String requestId,
    required String decision,
    String? payoutReferenceId,
    String? rejectionReason,
  }) async {
    try {
      final res = await _apiClient.dio.post(
        '/admin/withdrawals/$requestId/process',
        data: {
          'decision': decision,
          if (payoutReferenceId != null) 'payoutReferenceId': payoutReferenceId,
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
