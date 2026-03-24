/**
 * Add Patient Dialog Component
 * Modal dialog for adding new patients
 * Aligned with NexHealth API data structure
 * Medibill Voice Sync Health - Updated
 */

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { patientSchema, type PatientFormData } from '@/lib/schemas/patient.schema';
import { createNexHealthPatient, syncNexHealthPatients, type NexHealthPatientBio } from '@/services/nexhealth-patients.service';
import { fetchNexHealthProviders, getProviderDisplayName } from '@/services/nexhealth-providers.service';
import { getAllProviders } from '@/services/providers.service';
import { createPatient } from '@/services/patients.service';
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
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * Capitalize first letter of gender for NexHealth API
 */
function formatGender(gender: string | undefined): string | undefined {
  if (!gender || gender === 'prefer_not_to_say' || gender === '') return undefined;
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

interface AddPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
}

export function AddPatientDialog({ open, onOpenChange, clinicId }: AddPatientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch providers from both NexHealth and local database
  const { data: nexhealthProvidersResult, isLoading: isLoadingNexHealthProviders } = useQuery({
    queryKey: ['nexhealth-providers-dropdown'],
    queryFn: () => fetchNexHealthProviders(),
    enabled: open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: localProviders, isLoading: isLoadingLocalProviders } = useQuery({
    queryKey: ['local-providers-dropdown'],
    queryFn: () => getAllProviders(),
    enabled: open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isLoadingProviders = isLoadingNexHealthProviders || isLoadingLocalProviders;

  // Merge providers from both sources, deduplicating by foreign_id or name
  const providers = useMemo(() => {
    const nexhealthProviders = nexhealthProvidersResult?.data || [];
    const dbProviders = localProviders || [];
    const merged: any[] = [];
    const seenIds = new Set<string>();

    // First add all NexHealth providers (they have the NexHealth ID we need)
    for (const p of nexhealthProviders) {
      const key = String(p.id);
      if (!seenIds.has(key)) {
        seenIds.add(key);
        merged.push({
          id: p.id, // NexHealth ID (number)
          name: getProviderDisplayName(p),
          specialty: p.specialty,
          source: 'nexhealth',
          foreign_id: String(p.id),
        });
      }
    }

    // Then add local providers that aren't already in NexHealth list
    for (const p of dbProviders) {
      // Check if this local provider is already in NexHealth list (by foreign_id)
      if (p.foreign_id && seenIds.has(p.foreign_id)) {
        continue; // Already added from NexHealth
      }
      
      // Check by name to avoid duplicates
      const displayName = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
      const nameKey = displayName.toLowerCase();
      const alreadyExists = merged.some(m => m.name.toLowerCase() === nameKey);
      
      if (!alreadyExists && displayName) {
        merged.push({
          id: p.foreign_id ? Number(p.foreign_id) : null, // Use NexHealth ID if linked
          localId: p.id, // Keep local ID for reference
          name: displayName,
          specialty: p.specialty,
          source: 'local',
          foreign_id: p.foreign_id,
          hasNexHealthId: !!p.foreign_id,
        });
      }
    }

    return merged;
  }, [nexhealthProvidersResult?.data, localProviders]);

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
      gender: '',
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

  const onSubmit = async (data: PatientFormData) => {
    setIsSubmitting(true);
    try {
      // Check if provider_id is a local ID (string starting with "local-") or NexHealth ID (number)
      const providerIdValue = data.provider_id;
      const isLocalOnly = typeof providerIdValue === 'string' && providerIdValue.toString().startsWith('local-');
      
      // Find the selected provider
      const selectedProvider = providers.find((p) => {
        if (isLocalOnly) {
          const localId = providerIdValue.toString().replace('local-', '');
          return p.localId === localId;
        }
        return p.id === providerIdValue;
      });
      
      const hasNexHealthProvider = !isLocalOnly && (selectedProvider?.source === 'nexhealth' || selectedProvider?.hasNexHealthId);

      if (hasNexHealthProvider && data.provider_id) {
        // Get the NexHealth provider ID (must be a number)
        const nexHealthProviderId = typeof data.provider_id === 'number' 
          ? data.provider_id 
          : Number(selectedProvider?.id);
        
        // Build complete NexHealth bio payload
        const nexHealthBio: NexHealthPatientBio = {
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
          
        // Create patient in NexHealth with full bio data
        const nexHealthPayload = {
          provider_id: nexHealthProviderId,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || undefined,
          bio: nexHealthBio,
        };

        // Create patient in NexHealth
        const result = await createNexHealthPatient(nexHealthPayload);

        if (!result.success) {
          throw new Error(result.error || 'Failed to create patient in NexHealth');
        }

        toast.success('Patient created in NexHealth successfully!');

        // Sync to local database
        toast.info('Syncing patient to local database...');
        await syncNexHealthPatients();
        
        toast.success('Patient synced to local database');
      } else {
        // Create patient locally only (no NexHealth sync)
        const localPatient = await createPatient({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          dob: data.dob,
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
          is_active: true,
          // Additional NexHealth-aligned fields for local storage
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
        });

        toast.success('Patient created locally!');
        console.log('Created local patient:', localPatient);
      }
      
      // Invalidate queries to refresh patient list
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['nexhealth-patients'] });

      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating patient:', error);
      toast.error(error?.message || 'Failed to add patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
          <DialogDescription>
            Enter patient information. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Provider Selection - Required for NexHealth */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Provider Assignment</h3>
              <FormField
                control={form.control}
                name="provider_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Provider</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        // Handle both NexHealth IDs and local IDs
                        if (value.startsWith('local-')) {
                          // Store local ID as string for differentiation
                          field.onChange(value);
                        } else {
                          // Store NexHealth ID as number
                          field.onChange(Number(value));
                        }
                      }} 
                      value={typeof field.value === 'string' ? field.value : field.value?.toString() || undefined}
                      disabled={isLoadingProviders}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProviders ? "Loading providers..." : "Select a provider"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providers.length === 0 && !isLoadingProviders && (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No providers available
                          </div>
                        )}
                        {providers.map((provider) => {
                          const hasNexHealthId = provider.source === 'nexhealth' || provider.hasNexHealthId;
                          const key = provider.source === 'nexhealth' 
                            ? `nh-${provider.id}` 
                            : `local-${provider.localId || provider.id}`;
                          // Use NexHealth ID if available, otherwise use local ID
                          const value = hasNexHealthId 
                            ? provider.id?.toString() 
                            : `local-${provider.localId}`;
                          
                          return (
                            <SelectItem 
                              key={key} 
                              value={value || '0'}
                            >
                              <div className="flex items-center gap-2">
                                <span>{provider.name}</span>
                                {provider.specialty && (
                                  <span className="text-muted-foreground">- {provider.specialty}</span>
                                )}
                                {provider.source === 'nexhealth' ? (
                                  <span className="text-xs text-blue-600">(NexHealth)</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">(Platform)</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a provider. Patients with NexHealth-linked providers will sync to NexHealth.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Patient
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
