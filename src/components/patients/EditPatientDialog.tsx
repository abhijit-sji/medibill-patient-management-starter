/**
 * Edit Patient Dialog Component
 * Modal dialog for editing existing patients - aligned with AddPatientDialog
 * Medibill Voice Sync Health
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { patientSchema, type PatientFormData } from '@/lib/schemas/patient.schema';
import { useUpdatePatient } from '@/hooks/useData';
import type { Database } from '@/lib/database.types';
import { updateNexHealthPatient, type NexHealthPatientBio } from '@/services/nexhealth-patients.service';
import type { PatientWithDetails } from '@/hooks/usePatients';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Cloud } from 'lucide-react';

type Patient = Database['public']['Tables']['patients']['Row'];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

/**
 * Capitalize first letter of gender for NexHealth API
 */
function formatGender(gender: string | undefined): string | undefined {
  if (!gender || gender === 'prefer_not_to_say') return undefined;
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

interface EditPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientWithDetails | null;
  onUpdated?: () => void;
}

export function EditPatientDialog({ open, onOpenChange, patient, onUpdated }: EditPatientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const updatePatient = useUpdatePatient();

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      dob: '',
      phone: '',
      home_phone_number: '',
      cell_phone_number: '',
      work_phone_number: '',
      custom_contact_number: '',
      email: '',
      address: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      zip: '',
      race: '',
      ssn: '',
      weight: null,
      height: null,
      insurance_provider: '',
      insurance_id: '',
      insurance_group: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relationship: '',
      allergies: '',
      medications: '',
      medical_history: '',
      notes: '',
      is_active: true,
    },
  });

  // Load patient data when dialog opens
  useEffect(() => {
    if (patient && open) {
      // Parse DOB - handle multiple formats
      let dobFormatted = '';
      if (patient.dob) {
        try {
          const dobStr = String(patient.dob).trim();
          // Try MM/DD/YYYY format
          if (dobStr.includes('/')) {
            const parts = dobStr.split('/');
            if (parts.length === 3) {
              dobFormatted = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            }
          }
          // Try YYYY-MM-DD format
          else if (dobStr.includes('-') && dobStr.split('-')[0].length === 4) {
            dobFormatted = dobStr;
          }
          // Try DD-MM-YYYY format
          else if (dobStr.includes('-')) {
            const parts = dobStr.split('-');
            if (parts.length === 3 && parts[0].length === 2) {
              dobFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          // Fallback to Date parsing
          else {
            const date = new Date(dobStr);
            if (!isNaN(date.getTime())) {
              dobFormatted = date.toISOString().split('T')[0];
            }
          }
        } catch {
          dobFormatted = '';
        }
      }

      // Parse bio_json if available for additional fields
      const bio = (patient as any).bio_json || {};

      // Normalize gender to valid enum value
      const normalizeGender = (g: string | null): '' | 'male' | 'female' | 'other' | 'prefer_not_to_say' => {
        if (!g) return '';
        const lower = g.toLowerCase();
        if (lower === 'male' || lower === 'female' || lower === 'other' || lower === 'prefer_not_to_say') {
          return lower as 'male' | 'female' | 'other' | 'prefer_not_to_say';
        }
        return '';
      };

      form.reset({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        dob: dobFormatted,
        phone: patient.phone || '',
        home_phone_number: bio.home_phone_number || (patient as any).home_phone_number || '',
        cell_phone_number: bio.cell_phone_number || (patient as any).cell_phone_number || '',
        work_phone_number: bio.work_phone_number || (patient as any).work_phone_number || '',
        custom_contact_number: bio.custom_contact_number || (patient as any).custom_contact_number || '',
        email: patient.email || '',
        gender: normalizeGender(patient.gender),
        address: patient.address || bio.street_address || '',
        address_line_1: bio.address_line_1 || (patient as any).address_line_1 || '',
        address_line_2: bio.address_line_2 || (patient as any).address_line_2 || '',
        city: patient.city || '',
        state: patient.state || '',
        zip: patient.zip || '',
        race: bio.race || (patient as any).race || '',
        ssn: bio.ssn || (patient as any).ssn || '',
        weight: bio.weight || (patient as any).weight || null,
        height: bio.height || (patient as any).height || null,
        insurance_provider: patient.insurance_provider || '',
        insurance_id: patient.insurance_id || '',
        insurance_group: patient.insurance_group || '',
        emergency_contact_name: patient.emergency_contact_name || '',
        emergency_contact_phone: patient.emergency_contact_phone || '',
        emergency_contact_relationship: patient.emergency_contact_relationship || '',
        allergies: patient.allergies || '',
        medications: patient.medications || '',
        medical_history: patient.medical_history || '',
        notes: patient.notes || '',
        is_active: patient.is_active ?? true,
      });
    }
  }, [patient, open, form]);

  const onSubmit = async (data: PatientFormData) => {
    if (!patient) return;

    setIsSubmitting(true);
    try {
      // Prepare updates for local database
      const updates: Record<string, any> = {
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob,
        phone: data.phone,
        email: data.email || null,
        gender: data.gender || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        insurance_provider: data.insurance_provider || null,
        insurance_id: data.insurance_id || null,
        insurance_group: data.insurance_group || null,
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        emergency_contact_relationship: data.emergency_contact_relationship || null,
        allergies: data.allergies || null,
        medications: data.medications || null,
        medical_history: data.medical_history || null,
        notes: data.notes || null,
        is_active: data.is_active,
        // Additional fields
        home_phone_number: data.home_phone_number || null,
        cell_phone_number: data.cell_phone_number || null,
        work_phone_number: data.work_phone_number || null,
        custom_contact_number: data.custom_contact_number || null,
        address_line_1: data.address_line_1 || null,
        address_line_2: data.address_line_2 || null,
        race: data.race || null,
        ssn: data.ssn || null,
        weight: data.weight || null,
        height: data.height || null,
      };

      // Update local database
      await updatePatient.mutateAsync({
        patientId: patient.id,
        updates: updates as any,
      });

      toast.success('Patient updated in local database');

      // Sync to NexHealth if patient has a NexHealth ID
      if (patient.nexhealth_patient_id) {
        try {
          const nexhealthBio: NexHealthPatientBio = {
            date_of_birth: data.dob,
            phone_number: data.phone || undefined,
            home_phone_number: data.home_phone_number || undefined,
            cell_phone_number: data.cell_phone_number || undefined,
            work_phone_number: data.work_phone_number || undefined,
            custom_contact_number: data.custom_contact_number || undefined,
            gender: formatGender(data.gender),
            street_address: data.address || undefined,
            address_line_1: data.address_line_1 || undefined,
            address_line_2: data.address_line_2 || undefined,
            city: data.city || undefined,
            state: data.state || undefined,
            zip_code: data.zip || undefined,
            insurance_name: data.insurance_provider || undefined,
            race: data.race || undefined,
            ssn: data.ssn || undefined,
            weight: data.weight || undefined,
            height: data.height || undefined,
          };

          await updateNexHealthPatient(patient.nexhealth_patient_id, {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email || undefined,
            bio: nexhealthBio,
          });
          toast.success('Patient synced to NexHealth');
        } catch (nexhealthError: any) {
          console.error('Error syncing to NexHealth:', nexhealthError);
          toast.warning('Patient updated locally, but failed to sync to NexHealth');
        }
      }

      // Invalidate queries to refresh patient list
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['nexhealth-patients'] });

      await onUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating patient:', error);
      toast.error(error?.message || 'Failed to update patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Edit Patient</DialogTitle>
            {patient.nexhealth_patient_id && (
              <Badge variant="outline" className="text-blue-600">
                <Cloud className="h-3 w-3 mr-1" />
                Synced with NexHealth
              </Badge>
            )}
          </div>
          <DialogDescription>
            Update patient information. Fields marked with * are required.
            {patient.nexhealth_patient_id && ' Changes will be synced to NexHealth.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit, () => toast.error('Please fix the highlighted fields and try again.'))}
            className="space-y-6"
          >
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Recommended for NexHealth integration</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="race"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Race</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Asian, White, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ssn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSN</FormLabel>
                      <FormControl>
                        <Input placeholder="XXX-XX-XXXX" {...field} />
                      </FormControl>
                      <FormDescription>Format: XXX-XX-XXXX</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (lbs)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="150" 
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (inches)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="70" 
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Phone Numbers */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Phone Numbers</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Phone *</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="home_phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cell_phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cell Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="work_phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="custom_contact_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other Contact Number</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Address</h3>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address_line_1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Apt, Suite, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_line_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Building, Floor, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" maxLength={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Insurance Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Insurance Information</h3>
              <FormField
                control={form.control}
                name="insurance_provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance Provider</FormLabel>
                    <FormControl>
                      <Input placeholder="Blue Cross Blue Shield" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="insurance_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member ID</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insurance_group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Number</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Emergency Contact</h3>
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergency_contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergency_contact_relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input placeholder="Spouse" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Medical Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Medical Information</h3>
              <FormField
                control={form.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allergies</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="List any known allergies"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Medications</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="List current medications"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medical_history"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical History</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Relevant medical history"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
