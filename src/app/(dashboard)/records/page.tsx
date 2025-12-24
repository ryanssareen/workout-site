'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getPersonalRecords, addPersonalRecord, deletePersonalRecord, getCoachStudents } from '@/lib/firebase/firestore';
import { PersonalRecord, PRCategory } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Trophy, Plus, Trash2, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const CATEGORY_CONFIG: Record<PRCategory, { label: string; color: string; icon: string }> = {
  distance: { label: 'Distance', color: 'bg-blue-100 text-blue-700', icon: '🏃' },
  speed: { label: 'Speed', color: 'bg-green-100 text-green-700', icon: '⚡' },
  strength: { label: 'Strength', color: 'bg-red-100 text-red-700', icon: '💪' },
  endurance: { label: 'Endurance', color: 'bg-purple-100 text-purple-700', icon: '🔥' },
};

const PRESET_RECORDS: { name: string; category: PRCategory; unit: string }[] = [
  { name: 'Fastest 5K', category: 'speed', unit: 'min' },
  { name: 'Fastest 10K', category: 'speed', unit: 'min' },
  { name: 'Fastest Half Marathon', category: 'speed', unit: 'min' },
  { name: 'Longest Run', category: 'distance', unit: 'km' },
  { name: 'Longest Bike Ride', category: 'distance', unit: 'km' },
  { name: 'Longest Swim', category: 'distance', unit: 'm' },
  { name: 'Bench Press', category: 'strength', unit: 'kg' },
  { name: 'Squat', category: 'strength', unit: 'kg' },
  { name: 'Deadlift', category: 'strength', unit: 'kg' },
  { name: 'Overhead Press', category: 'strength', unit: 'kg' },
  { name: 'Pull-ups', category: 'strength', unit: 'reps' },
  { name: 'Push-ups', category: 'endurance', unit: 'reps' },
  { name: 'Plank Hold', category: 'endurance', unit: 'sec' },
];

export default function RecordsPage() {
  const user = useAuthStore((state) => state.user);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'distance' as PRCategory,
    value: '',
    unit: 'km',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const isCoach = user?.role === 'coach';

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setLoading(true);

      if (isCoach) {
        const studentList = await getCoachStudents(user.uid);
        setStudents(studentList);
        if (studentList.length > 0 && !selectedStudent) {
          setSelectedStudent(studentList[0].uid);
        }
      }

      const userId = isCoach ? (selectedStudent || '') : user.uid;
      if (userId) {
        const data = await getPersonalRecords(userId);
        setRecords(data);
      }

      setLoading(false);
    };

    loadData();
  }, [user, selectedStudent, isCoach]);

  const handlePresetSelect = (preset: typeof PRESET_RECORDS[0]) => {
    setFormData({
      ...formData,
      name: preset.name,
      category: preset.category,
      unit: preset.unit,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name || !formData.value) return;

    setIsSubmitting(true);
    try {
      const userId = isCoach ? selectedStudent : user.uid;
      await addPersonalRecord(userId, {
        name: formData.name,
        category: formData.category,
        value: parseFloat(formData.value),
        unit: formData.unit,
        date: new Date(formData.date),
        notes: formData.notes || undefined,
      });

      toast.success('Personal record added!');
      setDialogOpen(false);
      setFormData({
        name: '',
        category: 'distance',
        value: '',
        unit: 'km',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      });

      // Reload records
      const data = await getPersonalRecords(userId);
      setRecords(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Delete this personal record?')) return;

    try {
      await deletePersonalRecord(recordId);
      toast.success('Record deleted');
      setRecords(records.filter(r => r.id !== recordId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete record');
    }
  };

  // Group records by category
  const recordsByCategory = records.reduce((acc, record) => {
    if (!acc[record.category]) {
      acc[record.category] = [];
    }
    acc[record.category].push(record);
    return acc;
  }, {} as Record<PRCategory, PersonalRecord[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Personal Records
          </h1>
          <p className="text-muted-foreground">
            Track your best performances and milestones
          </p>
        </div>

        <div className="flex gap-3">
          {/* Coach: Student selector */}
          {isCoach && students.length > 0 && (
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.uid} value={student.uid}>
                    <div className="flex flex-col">
                      <span className="font-medium">{student.displayName || 'No Name'}</span>
                      <span className="text-xs text-muted-foreground">{student.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Add Record Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Personal Record</DialogTitle>
                <DialogDescription>
                  Log a new personal best or milestone
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Preset Selection */}
                <div>
                  <Label className="text-sm font-medium">Quick Select</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PRESET_RECORDS.slice(0, 6).map(preset => (
                      <Button
                        key={preset.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePresetSelect(preset)}
                        className={formData.name === preset.name ? 'border-primary' : ''}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Record Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Fastest 5K"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v: PRCategory) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.icon} {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="value">Value</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={e => setFormData({ ...formData, value: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={v => setFormData({ ...formData, unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="km">km</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="mi">mi</SelectItem>
                        <SelectItem value="min">min</SelectItem>
                        <SelectItem value="sec">sec</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lbs">lbs</SelectItem>
                        <SelectItem value="reps">reps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional details..."
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Record'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Records Grid */}
      {records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Records Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start tracking your personal bests and milestones
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Record
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {(Object.entries(CATEGORY_CONFIG) as [PRCategory, typeof CATEGORY_CONFIG['distance']][]).map(
            ([category, config]) => {
              const categoryRecords = recordsByCategory[category] || [];
              if (categoryRecords.length === 0) return null;

              return (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{config.icon}</span>
                      {config.label}
                    </CardTitle>
                    <CardDescription>
                      {categoryRecords.length} record{categoryRecords.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {categoryRecords.map(record => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{record.name}</span>
                            {record.previousValue && (
                              <Badge variant="secondary" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                +{(record.value - record.previousValue).toFixed(1)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="font-bold text-foreground text-lg">
                              {record.value} {record.unit}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(record.date.toDate(), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {record.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {record.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
