import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../home/providers/tournament_provider.dart';

class AdminCreateTournamentScreen extends ConsumerStatefulWidget {
  const AdminCreateTournamentScreen({super.key});

  @override
  ConsumerState<AdminCreateTournamentScreen> createState() => _AdminCreateTournamentScreenState();
}

class _AdminCreateTournamentScreenState extends ConsumerState<AdminCreateTournamentScreen> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _entryFeeController = TextEditingController(text: '50');
  final TextEditingController _prizePoolController = TextEditingController(text: '2000');
  final TextEditingController _perKillController = TextEditingController(text: '10');
  final TextEditingController _maxSlotsController = TextEditingController(text: '48');
  final TextEditingController _roomIdController = TextEditingController();
  final TextEditingController _roomPassController = TextEditingController();
  final TextEditingController _rulesController = TextEditingController();

  String _selectedMode = 'solo';
  String _selectedMap = 'Bermuda';
  String _selectedEntryType = 'paid';
  DateTime _selectedDate = DateTime.now().add(const Duration(hours: 3));
  TimeOfDay _selectedTime = TimeOfDay.fromDateTime(DateTime.now().add(const Duration(hours: 3)));
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _entryFeeController.dispose();
    _prizePoolController.dispose();
    _perKillController.dispose();
    _maxSlotsController.dispose();
    _roomIdController.dispose();
    _roomPassController.dispose();
    _rulesController.dispose();
    super.dispose();
  }

  void _handleCreate() async {
    if (!_formKey.currentState!.validate()) return;

    final startDateTime = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _selectedTime.hour,
      _selectedTime.minute,
    );

    final prizePool = double.tryParse(_prizePoolController.text.trim()) ?? 0.0;
    final perKill = double.tryParse(_perKillController.text.trim()) ?? 0.0;
    final entryFee = _selectedEntryType == 'paid' ? (double.tryParse(_entryFeeController.text.trim()) ?? 0.0) : 0.0;
    final maxSlots = int.tryParse(_maxSlotsController.text.trim()) ?? 48;

    final prizeDistribution = [
      {'rank': 1, 'amount': (prizePool * 0.5), 'percentage': 50},
      {'rank': 2, 'amount': (prizePool * 0.3), 'percentage': 30},
      {'rank': 3, 'amount': (prizePool * 0.2), 'percentage': 20},
    ];

    final payload = {
      'title': _titleController.text.trim(),
      'description': _descController.text.trim().isEmpty ? null : _descController.text.trim(),
      'game': 'Free Fire',
      'mode': _selectedMode,
      'map': _selectedMap,
      'entryType': _selectedEntryType,
      'entryFee': entryFee,
      'prizePool': prizePool,
      'prizeDistribution': prizeDistribution,
      'perKillPrize': perKill,
      'maxSlots': maxSlots,
      'startTime': startDateTime.toIso8601String(),
      'roomId': _roomIdController.text.trim().isEmpty ? null : _roomIdController.text.trim(),
      'roomPassword': _roomPassController.text.trim().isEmpty ? null : _roomPassController.text.trim(),
      'rules': _rulesController.text.trim().isEmpty ? null : _rulesController.text.trim(),
    };

    setState(() => _isSubmitting = true);
    final success = await ref.read(tournamentListProvider.notifier).createTournament(payload);
    setState(() => _isSubmitting = false);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tournament published successfully.')),
      );
      Navigator.pop(context);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to publish tournament. Please check details.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Create new tournament'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Basic Information Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Basic details', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _titleController,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'Tournament title (e.g. Bermuda Solo Clash #1)'),
                      validator: (val) => val == null || val.trim().isEmpty ? 'Title is required' : null,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _descController,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      maxLines: 2,
                      decoration: const InputDecoration(labelText: 'Description (optional)'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Mode & Map Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Game mode and map', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _selectedMode,
                            dropdownColor: AppColors.surface,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Mode'),
                            items: const [
                              DropdownMenuItem(value: 'solo', child: Text('Solo')),
                              DropdownMenuItem(value: 'duo', child: Text('Duo')),
                              DropdownMenuItem(value: 'squad', child: Text('Squad')),
                            ],
                            onChanged: (val) => setState(() => _selectedMode = val!),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _selectedMap,
                            dropdownColor: AppColors.surface,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Map'),
                            items: const [
                              DropdownMenuItem(value: 'Bermuda', child: Text('Bermuda')),
                              DropdownMenuItem(value: 'Purgatory', child: Text('Purgatory')),
                              DropdownMenuItem(value: 'Kalahari', child: Text('Kalahari')),
                              DropdownMenuItem(value: 'Alpine', child: Text('Alpine')),
                              DropdownMenuItem(value: 'NexTerra', child: Text('NexTerra')),
                            ],
                            onChanged: (val) => setState(() => _selectedMap = val!),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Entry & Prizes Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Entry fee and prizes', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _selectedEntryType,
                            dropdownColor: AppColors.surface,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Entry type'),
                            items: const [
                              DropdownMenuItem(value: 'paid', child: Text('Paid (₹)')),
                              DropdownMenuItem(value: 'free', child: Text('Free')),
                            ],
                            onChanged: (val) => setState(() => _selectedEntryType = val!),
                          ),
                        ),
                        if (_selectedEntryType == 'paid') ...[
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              controller: _entryFeeController,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                              decoration: const InputDecoration(labelText: 'Entry fee (₹)'),
                              validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _prizePoolController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Prize pool (₹)'),
                            validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _perKillController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Per kill bounty (₹)'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Slots & Schedule Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Slots and schedule', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _maxSlotsController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'Max player slots (e.g. 48)'),
                      validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final d = await showDatePicker(
                                context: context,
                                initialDate: _selectedDate,
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now().add(const Duration(days: 30)),
                                builder: (ctx, child) => Theme(data: AppTheme.lightTheme, child: child!),
                              );
                              if (d != null) setState(() => _selectedDate = d);
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.border, width: 0.5),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.calendar_today_outlined, color: AppColors.textSecondary, size: 16),
                                  const SizedBox(width: 8),
                                  Text(DateFormat('d MMM yyyy').format(_selectedDate), style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final t = await showTimePicker(
                                context: context,
                                initialTime: _selectedTime,
                                builder: (ctx, child) => Theme(data: AppTheme.lightTheme, child: child!),
                              );
                              if (t != null) setState(() => _selectedTime = t);
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.border, width: 0.5),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.access_time_rounded, color: AppColors.textSecondary, size: 16),
                                  const SizedBox(width: 8),
                                  Text(_selectedTime.format(context), style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Custom Room Credentials Card (Optional at creation)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Custom room credentials (optional)', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 4),
                    const Text(
                      'Can be added later, any time before match start.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _roomIdController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Room ID (optional)',
                              hintText: 'e.g. 1049281',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _roomPassController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Password (optional)',
                              hintText: 'e.g. 8888',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Submit Pill CTA
              ElevatedButton(
                onPressed: _isSubmitting ? null : _handleCreate,
                child: _isSubmitting
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                    : const Text('Publish tournament'),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
