import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/slot_model.dart';

class SlotBookingState {
  final bool isLoading;
  final bool isBooking;
  final SlotGridModel? grid;
  final int? selectedSlotNumber;
  final String? errorMessage;
  final List<UserBookingMatchModel> myMatches;

  const SlotBookingState({
    this.isLoading = false,
    this.isBooking = false,
    this.grid,
    this.selectedSlotNumber,
    this.errorMessage,
    this.myMatches = const [],
  });

  SlotBookingState copyWith({
    bool? isLoading,
    bool? isBooking,
    SlotGridModel? grid,
    int? selectedSlotNumber,
    String? errorMessage,
    List<UserBookingMatchModel>? myMatches,
  }) {
    return SlotBookingState(
      isLoading: isLoading ?? this.isLoading,
      isBooking: isBooking ?? this.isBooking,
      grid: grid ?? this.grid,
      selectedSlotNumber: selectedSlotNumber ?? this.selectedSlotNumber,
      errorMessage: errorMessage,
      myMatches: myMatches ?? this.myMatches,
    );
  }
}

final slotBookingProvider = StateNotifierProvider<SlotBookingNotifier, SlotBookingState>((ref) {
  return SlotBookingNotifier();
});

class SlotBookingNotifier extends StateNotifier<SlotBookingState> {
  final ApiClient _apiClient = ApiClient();

  SlotBookingNotifier() : super(const SlotBookingState());

  void selectSlot(int slotNumber) {
    state = state.copyWith(selectedSlotNumber: slotNumber);
  }

  Future<void> fetchSlotGrid(String tournamentId) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.get('/tournaments/$tournamentId/slots');
      if (res.statusCode == 200 && res.data['success'] == true) {
        final grid = SlotGridModel.fromJson(res.data['data']);
        state = state.copyWith(
          isLoading: false,
          grid: grid,
          selectedSlotNumber: grid.currentUserBookedSlot,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to load slot grid.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
    }
  }

  Future<bool> bookSelectedSlot({
    required String tournamentId,
    String? teamName,
    List<Map<String, dynamic>>? teammates,
  }) async {
    if (state.selectedSlotNumber == null) {
      state = state.copyWith(errorMessage: 'Please select an available slot number first.');
      return false;
    }

    state = state.copyWith(isBooking: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        '/tournaments/$tournamentId/book',
        data: {
          'slotNumber': state.selectedSlotNumber,
          if (teamName != null && teamName.isNotEmpty) 'teamName': teamName,
          if (teammates != null && teammates.isNotEmpty) 'teammates': teammates,
        },
      );

      if (res.statusCode == 201 && res.data['success'] == true) {
        state = state.copyWith(isBooking: false);
        await fetchSlotGrid(tournamentId);
        await fetchMyMatches();
        return true;
      }
      state = state.copyWith(isBooking: false);
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to book slot.';
      state = state.copyWith(isBooking: false, errorMessage: msg);
      return false;
    }
  }

  Future<void> fetchMyMatches() async {
    try {
      final res = await _apiClient.dio.get('/tournaments/user/my-bookings');
      if (res.statusCode == 200 && res.data['success'] == true) {
        final List list = res.data['data'] ?? [];
        final parsed = list.map((item) => UserBookingMatchModel.fromJson(item as Map<String, dynamic>)).toList();
        state = state.copyWith(myMatches: parsed);
      }
    } catch (_) {}
  }

  Future<bool> cancelBooking(String tournamentId) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post('/tournaments/$tournamentId/cancel-booking');
      if (res.statusCode == 200 && res.data['success'] == true) {
        await fetchSlotGrid(tournamentId);
        await fetchMyMatches();
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to cancel booking.';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    }
  }
}
