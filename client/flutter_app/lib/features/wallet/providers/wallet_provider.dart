import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/wallet_model.dart';

class WalletState {
  final bool isLoading;
  final bool isDepositing;
  final WalletSummaryModel? summary;
  final List<LedgerTransactionModel> transactions;
  final String activeFilter;
  final String? errorMessage;

  const WalletState({
    this.isLoading = false,
    this.isDepositing = false,
    this.summary,
    this.transactions = const [],
    this.activeFilter = 'all',
    this.errorMessage,
  });

  WalletState copyWith({
    bool? isLoading,
    bool? isDepositing,
    WalletSummaryModel? summary,
    List<LedgerTransactionModel>? transactions,
    String? activeFilter,
    String? errorMessage,
  }) {
    return WalletState(
      isLoading: isLoading ?? this.isLoading,
      isDepositing: isDepositing ?? this.isDepositing,
      summary: summary ?? this.summary,
      transactions: transactions ?? this.transactions,
      activeFilter: activeFilter ?? this.activeFilter,
      errorMessage: errorMessage,
    );
  }
}

final walletProvider = StateNotifierProvider<WalletNotifier, WalletState>((ref) {
  return WalletNotifier();
});

class WalletNotifier extends StateNotifier<WalletState> {
  final ApiClient _apiClient = ApiClient();
  static const String _webhookSecret = 'ff_esports_webhook_secret_key_2026';

  WalletNotifier() : super(const WalletState());

  Future<void> fetchSummary() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get('/wallet/summary');
      if (res.statusCode == 200 && res.data['success'] == true) {
        final summary = WalletSummaryModel.fromJson(res.data['data']);
        state = state.copyWith(isLoading: false, summary: summary);
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load wallet balance.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  // Alias for compatibility
  Future<void> fetchWalletSummary() => fetchSummary();

  Future<void> fetchTransactions({String? filter, String? type}) async {
    final activeType = filter ?? type ?? state.activeFilter;
    try {
      final path = activeType == 'all'
          ? '/wallet/transactions'
          : '/wallet/transactions?type=$activeType';
      final res = await _apiClient.dio.get(path);
      if (res.statusCode == 200 && res.data['success'] == true) {
        final List list = res.data['data']['transactions'] ?? [];
        final parsed = list.map((item) => LedgerTransactionModel.fromJson(item as Map<String, dynamic>)).toList();
        state = state.copyWith(transactions: parsed, activeFilter: activeType);
      }
    } catch (_) {}
  }

  void setFilter(String filter) {
    state = state.copyWith(activeFilter: filter);
    fetchTransactions(filter: filter);
  }

  Future<bool> submitUpiQrDeposit({
    required double amount,
    required String utrNumber,
    String? qrUsed,
    List<int>? screenshotBytes,
    String? screenshotName,
  }) async {
    state = state.copyWith(isDepositing: true, errorMessage: null);
    try {
      dynamic postData;
      if (screenshotBytes != null && screenshotBytes.isNotEmpty) {
        postData = FormData.fromMap({
          'amount': amount,
          'utrNumber': utrNumber,
          if (qrUsed != null) 'qrUsed': qrUsed,
          'screenshot': MultipartFile.fromBytes(
            screenshotBytes,
            filename: screenshotName ?? 'payment_screenshot.jpg',
          ),
        });
      } else {
        postData = {
          'amount': amount,
          'utrNumber': utrNumber,
          if (qrUsed != null) 'qrUsed': qrUsed,
        };
      }

      final res = await _apiClient.dio.post(
        '/wallet/deposit/upi-qr',
        data: postData,
      );

      if (res.statusCode == 201 && res.data['success'] == true) {
        state = state.copyWith(isDepositing: false);
        await fetchSummary();
        await fetchTransactions();
        return true;
      }

      final error = res.data?['message'] ?? 'Failed to submit deposit.';
      state = state.copyWith(isDepositing: false, errorMessage: error);
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to complete deposit. Please check UTR.';
      state = state.copyWith(isDepositing: false, errorMessage: msg);
      return false;
    }
  }

  Future<bool> processDeposit(double amount) async {
    state = state.copyWith(isDepositing: true, errorMessage: null);
    try {
      // 1. Create order
      final orderRes = await _apiClient.dio.post(
        '/wallet/deposit/create-order',
        data: {'amount': amount, 'gateway': 'mock_gateway'},
      );

      if (orderRes.statusCode != 201 || orderRes.data['success'] != true) {
        state = state.copyWith(isDepositing: false, errorMessage: 'Failed to create deposit order.');
        return false;
      }

      final orderData = DepositOrderModel.fromJson(orderRes.data['data']);
      final paymentId = 'pay_${DateTime.now().millisecondsSinceEpoch}';

      // 2. Compute valid HMAC signature for mock gateway verification
      final hmac = Hmac(sha256, utf8.encode(_webhookSecret));
      final signature = hmac.convert(utf8.encode('${orderData.orderId}|$paymentId')).toString();

      // 3. Verify & credit deposit
      final verifyRes = await _apiClient.dio.post(
        '/wallet/deposit/verify',
        data: {
          'orderId': orderData.orderId,
          'paymentId': paymentId,
          'signature': signature,
        },
      );

      if (verifyRes.statusCode == 200 && verifyRes.data['success'] == true) {
        state = state.copyWith(isDepositing: false);
        await fetchSummary();
        await fetchTransactions();
        return true;
      }

      state = state.copyWith(isDepositing: false, errorMessage: 'Payment verification failed.');
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to complete deposit.';
      state = state.copyWith(isDepositing: false, errorMessage: msg);
      return false;
    }
  }

  // Alias for compatibility
  Future<bool> initiateMockDeposit(double amount) => processDeposit(amount);
}
