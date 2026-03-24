/**
 * Add Patient Recall Dialog
 * Dialog for creating new patient recalls
 * Medibill Voice Sync Health
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMonths } from 'date-fns';
import { useCreatePatientRecall } from '@/hooks/usePatientRecalls';
import { useActiveRecallTypes } from '@/hooks/useRecallTypes';
import { usePatients } from '@/hooks/usePatients';

interface AddPatientRecallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPatientId?: string;
}

export function AddPatientRecallDialog({ 
  open, 
  onOpenChange,
  preselectedPatientId,
}: AddPatientRecallDialogProps) {
  const [patientId, setPatientId] = useState(preselectedPatientId || '');
  const [recallTypeId, setRecallTypeId] = useState('');
  const [dateDue, setDateDue] = useState<Date | undefined>(addMonths(new Date(), 6));
  const [notes, setNotes] = useState('');
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const createPatientRecall = useCreatePatientRecall();
  const { data: recallTypes = [] } = useActiveRecallTypes();
  const { data: patientsData } = usePatients();
  const patients = patientsData?.patients || [];

  useEffect(() => {
    if (preselectedPatientId) {
      setPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  // Auto-set due date based on recall type interval
  useEffect(() => {
    if (recallTypeId) {
      const recallType = recallTypes.find((rt) => rt.id.toString() === recallTypeId);
      if (recallType?.interval_num && recallType?.interval_unit) {
        const now = new Date();
        let newDate = now;
        
        switch (recallType.interval_unit) {
          case 'D':
            newDate = new Date(now.setDate(now.getDate() + recallType.interval_num));
            break;
          case 'W':
            newDate = new Date(now.setDate(now.getDate() + recallType.interval_num * 7));
            break;
          case 'M':
            newDate = addMonths(now, recallType.interval_num);
            break;
          case 'Y':
            newDate = new Date(now.setFullYear(now.getFullYear() + recallType.interval_num));
            break;
        }
        
        setDateDue(newDate);
      }
    }
  }, [recallTypeId, recallTypes]);

  const selectedPatient = patients.find((p) => p.id === patientId);

  const resetForm = () => {
    if (!preselectedPatientId) {
      setPatientId('');
    }
    setRecallTypeId('');
    setDateDue(addMonths(new Date(), 6));
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !dateDue) return;

    await createPatientRecall.mutateAsync({
      patient_id: patientId,
      recall_type_id: recallTypeId ? parseInt(recallTypeId) : undefined,
      date_due: format(dateDue, 'yyyy-MM-dd'),
      notes: notes.trim() || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Patient Recall</DialogTitle>
            <DialogDescription>
              Schedule a recall appointment for a patient.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Patient Selection */}
            <div className="space-y-2">
              <Label>Patient *</Label>
              <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientSearchOpen}
                    className="w-full justify-between"
                    disabled={!!preselectedPatientId}
                  >
                    {selectedPatient ? (
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </span>
                    ) : (
                      'Select patient...'
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search patients..." />
                    <CommandList>
                      <CommandEmpty>No patients found.</CommandEmpty>
                      <CommandGroup>
                        {patients.slice(0, 50).map((patient) => (
                          <CommandItem
                            key={patient.id}
                            value={`${patient.first_name} ${patient.last_name}`}
                            onSelect={() => {
                              setPatientId(patient.id);
                              setPatientSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                patientId === patient.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p>{patient.first_name} {patient.last_name}</p>
                                <p className="text-xs text-muted-foreground">{patient.phone}</p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Recall Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="recall-type">Recall Type</Label>
              <Select value={recallTypeId} onValueChange={setRecallTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recall type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {recallTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id.toString()}>
                      {rt.name}
                      {rt.interval_num && rt.interval_unit && (
                        <span className="text-muted-foreground ml-2">
                          ({rt.interval_num} {rt.interval_unit === 'M' ? 'months' : rt.interval_unit === 'D' ? 'days' : rt.interval_unit === 'W' ? 'weeks' : 'years'})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dateDue && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateDue ? format(dateDue, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateDue}
                    onSelect={(date) => {
                      setDateDue(date);
                      setCalendarOpen(false);
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this recall..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!patientId || !dateDue || createPatientRecall.isPending}>
              {createPatientRecall.isPending ? 'Creating...' : 'Create Recall'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

