import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import 'workouts_screen.dart';

class CreateWorkoutScreen extends ConsumerStatefulWidget {
  final DateTime? initialDate;

  const CreateWorkoutScreen({super.key, this.initialDate});

  @override
  ConsumerState<CreateWorkoutScreen> createState() =>
      _CreateWorkoutScreenState();
}

class _CreateWorkoutScreenState extends ConsumerState<CreateWorkoutScreen> {
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _durationController = TextEditingController();
  final _distanceController = TextEditingController();

  WorkoutType _selectedType = WorkoutType.run;
  late DateTime _selectedDate;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.initialDate ?? DateTime.now();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _durationController.dispose();
    _distanceController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      _showAlert('Please enter a workout name');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final repo = ref.read(workoutRepositoryProvider);
      await repo.createWorkout(
        name: name,
        type: _selectedType.name,
        date: _selectedDate,
        description: _descriptionController.text.trim().isEmpty
            ? null
            : _descriptionController.text.trim(),
        duration: int.tryParse(_durationController.text),
      );

      // Refresh workouts list
      ref.invalidate(workoutsListProvider);

      if (mounted) {
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        _showAlert('Failed to create workout: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  void _showAlert(String message) {
    showCupertinoDialog<void>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Error'),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            child: const Text('OK'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
        ],
      ),
    );
  }

  void _showDatePicker() {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (ctx) => Container(
        height: 280,
        padding: const EdgeInsets.only(top: 6),
        decoration: BoxDecoration(
          color: CupertinoColors.systemBackground.resolveFrom(context),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                CupertinoButton(
                  child: const Text('Cancel'),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
                CupertinoButton(
                  child: const Text('Done'),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ],
            ),
            Expanded(
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: _selectedDate,
                onDateTimeChanged: (date) {
                  setState(() => _selectedDate = date);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('New Workout'),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          child: const Text('Cancel'),
          onPressed: () => context.pop(),
        ),
        trailing: _isSubmitting
            ? const CupertinoActivityIndicator()
            : CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: _submit,
                child: const Text(
                  'Save',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Workout Type
            _SectionHeader(title: 'Type'),
            const SizedBox(height: 8),
            SizedBox(
              height: 80,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: WorkoutType.values.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (ctx, i) {
                  final type = WorkoutType.values[i];
                  final selected = type == _selectedType;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedType = type),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 72,
                      decoration: BoxDecoration(
                        color: selected
                            ? SportColors.forType(type).withValues(alpha: 0.15)
                            : CupertinoColors.systemGrey6
                                .resolveFrom(context),
                        borderRadius: BorderRadius.circular(14),
                        border: selected
                            ? Border.all(
                                color: SportColors.forType(type), width: 2)
                            : null,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(type.emoji,
                              style: const TextStyle(fontSize: 28)),
                          const SizedBox(height: 4),
                          Text(
                            type.displayName,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight:
                                  selected ? FontWeight.w600 : FontWeight.w400,
                              color: selected
                                  ? SportColors.forType(type)
                                  : CupertinoColors.systemGrey
                                      .resolveFrom(context),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 24),

            // Name
            _SectionHeader(title: 'Name'),
            const SizedBox(height: 8),
            CupertinoTextField(
              controller: _nameController,
              placeholder: _namePlaceholder(),
              padding: const EdgeInsets.all(14),
              decoration: _fieldDecoration(context),
              maxLength: 100,
            ),

            const SizedBox(height: 20),

            // Date
            _SectionHeader(title: 'Date'),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _showDatePicker,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: _fieldDecoration(context),
                child: Row(
                  children: [
                    Icon(
                      CupertinoIcons.calendar,
                      size: 20,
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      DateFormat('EEEE, MMMM d, y').format(_selectedDate),
                      style: const TextStyle(fontSize: 16),
                    ),
                    const Spacer(),
                    Icon(
                      CupertinoIcons.chevron_right,
                      size: 16,
                      color: CupertinoColors.systemGrey3.resolveFrom(context),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Duration & Distance row
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SectionHeader(title: 'Duration (min)'),
                      const SizedBox(height: 8),
                      CupertinoTextField(
                        controller: _durationController,
                        placeholder: 'e.g. 45',
                        keyboardType: TextInputType.number,
                        padding: const EdgeInsets.all(14),
                        decoration: _fieldDecoration(context),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SectionHeader(title: 'Distance (km)'),
                      const SizedBox(height: 8),
                      CupertinoTextField(
                        controller: _distanceController,
                        placeholder: 'e.g. 5.0',
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        padding: const EdgeInsets.all(14),
                        decoration: _fieldDecoration(context),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Description
            _SectionHeader(title: 'Description'),
            const SizedBox(height: 8),
            CupertinoTextField(
              controller: _descriptionController,
              placeholder: 'Workout notes...',
              padding: const EdgeInsets.all(14),
              decoration: _fieldDecoration(context),
              maxLines: 4,
              maxLength: 500,
            ),

            const SizedBox(height: 32),

            // Submit button
            CupertinoButton.filled(
              onPressed: _isSubmitting ? null : _submit,
              borderRadius: BorderRadius.circular(14),
              child: _isSubmitting
                  ? const CupertinoActivityIndicator(
                      color: CupertinoColors.white)
                  : const Text(
                      'Create Workout',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 17,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  String _namePlaceholder() {
    switch (_selectedType) {
      case WorkoutType.run:
        return 'Morning Run';
      case WorkoutType.bike:
        return 'Cycling Session';
      case WorkoutType.swim:
        return 'Lap Swim';
      case WorkoutType.walk:
        return 'Afternoon Walk';
      case WorkoutType.strength:
        return 'Upper Body';
      case WorkoutType.other:
        return 'Workout';
    }
  }

  BoxDecoration _fieldDecoration(BuildContext context) {
    return BoxDecoration(
      color: CupertinoColors.systemGrey6.resolveFrom(context),
      borderRadius: BorderRadius.circular(12),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: CupertinoColors.systemGrey.resolveFrom(context),
        letterSpacing: 0.3,
      ),
    );
  }
}
