import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/slot_model.dart';

class SlotBookingState {
  final bool isLoading;
  final bool isBooking;
  final SlotGridModel? grid;
  final List<int> selectedSlotNumbers;
  final String? errorMessage;
  final List<UserBookingMatchModel> myMatches;

  const SlotBookingState({
    this.isLoading = false,
    this.isBooking = false,
    this.grid,
    this.selectedSlotNumbers = const [],
    this.errorMessage,
    this.myMatches = const [],
  });

  int? get selectedSlotNumber => selectedSlotNumbers.isNotEmpty ? selectedSlotNumbers.first : null;

  SlotBookingState copyWith({
    bool? isLoading,
    bool? isBooking,
    SlotGridModel? grid,
    List<int>? selectedSlotNumbers,
    int? selectedSlotNumber,
    String? errorMessage,
    List<UserBookingMatchModel>? myMatches,
  }) {
    return SlotBookingState(
      isLoading: isLoading ?? this.isLoading,
      isBooking: isBooking ?? this.isBooking,
      grid: grid ?? this.grid,
      selectedSlotNumbers: selectedSlotNumbers ?? (selectedSlotNumber != null ? [selectedSlotNumber] : this.selectedSlotNumbers),
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

  void selectSlot(int slotNumber, {String mode = 'solo'}) {
    if (slotNumber <= 0) {
      state = state.copyWith(selectedSlotNumbers: []);
      return;
    }

    if (mode == 'squad') {
      final teamNum = ((slotNumber - 1) ~/ 4) + 1;
      final start = (teamNum - 1) * 4 + 1;
      final squadSlots = [start, start + 1, start + 2, start + 3];
      // If entire team is already selected, unselect
      if (state.selectedSlotNumbers.length == 4 && state.selectedSlotNumbers.every((s) => squadSlots.contains(s))) {
        state = state.copyWith(selectedSlotNumbers: []);
      } else {
        state = state.copyWith(selectedSlotNumbers: squadSlots);
      }
    } else if (mode == 'duo') {
      final teamNum = ((slotNumber - 1) ~/ 2) + 1;
      final start = (teamNum - 1) * 2 + 1;
      final duoSlots = [start, start + 1];
      // If entire duo is already selected, unselect
      if (state.selectedSlotNumbers.length == 2 && state.selectedSlotNumbers.every((s) => duoSlots.contains(s))) {
        state = state.copyWith(selectedSlotNumbers: []);
      } else {
        state = state.copyWith(selectedSlotNumbers: duoSlots);
      }
    } else {
      if (state.selectedSlotNumbers.contains(slotNumber)) {
        state = state.copyWith(selectedSlotNumbers: []);
      } else {
        state = state.copyWith(selectedSlotNumbers: [slotNumber]);
      }
    }
  }

  void selectTeam(int teamNumber, {required String mode}) {
    if (mode == 'squad') {
      final start = (teamNumber - 1) * 4 + 1;
      final squadSlots = [start, start + 1, start + 2, start + 3];
      if (state.selectedSlotNumbers.length == 4 && state.selectedSlotNumbers.every((s) => squadSlots.contains(s))) {
        state = state.copyWith(selectedSlotNumbers: []);
      } else {
        state = state.copyWith(selectedSlotNumbers: squadSlots);
      }
    } else if (mode == 'duo') {
      final start = (teamNumber - 1) * 2 + 1;
      final duoSlots = [start, start + 1];
      if (state.selectedSlotNumbers.length == 2 && state.selectedSlotNumbers.every((s) => duoSlots.contains(s))) {
        state = state.copyWith(selectedSlotNumbers: []);
      } else {
        state = state.copyWith(selectedSlotNumbers: duoSlots);
      }
    }
  }

  void toggleSlot(int slotNumber, {required String mode}) {
    if (mode == 'solo') {
      selectSlot(slotNumber, mode: mode);
      return;
    }

    final current = List<int>.from(state.selectedSlotNumbers);
    final targetTeam = mode == 'squad' 
        ? ((slotNumber - 1) ~/ 4) + 1 
        : ((slotNumber - 1) ~/ 2) + 1;

    // Check if currently selected slots belong to a different team
    if (current.isNotEmpty) {
      final currentTeam = mode == 'squad' 
          ? ((current.first - 1) ~/ 4) + 1 
          : ((current.first - 1) ~/ 2) + 1;
      if (currentTeam != targetTeam) {
        // Reset selection to the new slot in the new team
        state = state.copyWith(selectedSlotNumbers: [slotNumber]);
        return;
      }
    }

    if (current.contains(slotNumber)) {
      current.remove(slotNumber);
    } else {
      current.add(slotNumber);
      current.sort();
    }
    state = state.copyWith(selectedSlotNumbers: current);
  }

  void clearSelection() {
    state = state.copyWith(selectedSlotNumbers: []);
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
          selectedSlotNumbers: grid.currentUserBookedSlots.isNotEmpty 
              ? grid.currentUserBookedSlots 
              : (grid.currentUserBookedSlot != null ? [grid.currentUserBookedSlot!] : []),
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
    if (state.selectedSlotNumbers.isEmpty) {
      state = state.copyWith(errorMessage: 'Please select your match slot(s) first.');
      return false;
    }

    state = state.copyWith(isBooking: true, errorMessage: null);
    try {
      final res = await _apiClient.dio.post(
        '/tournaments/$tournamentId/book',
        data: {
          'slotNumbers': state.selectedSlotNumbers,
          'slotNumber': state.selectedSlotNumbers.first,
          if (teamName != null && teamName.isNotEmpty) 'teamName': teamName,
          if (teammates != null && teammates.isNotEmpty) 'teammates': teammates,
        },
      );

      if (res.statusCode == 201 && res.data['success'] == true) {
        state = state.copyWith(isBooking: false, selectedSlotNumbers: []);
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
