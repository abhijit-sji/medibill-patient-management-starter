import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface PatientWithDetails {
  id: string;
  mrn: string;
  name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  dob: string;
  insurance: string | null;
  insurance_id: string | null;
  insurance_group: string | null;
  insurance_provider: string | null;
  balance: number;
  copay: number;
  previousBalance: number;
  lastVisit: string | null;
  status: 'active' | 'inactive' | 'pending';
  address: string | null;
  photo: string;
  // Additional fields for EditPatientDialog
  gender: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  allergies: string | null;
  medications: string | null;
  medical_history: string | null;
  notes: string | null;
  is_active: boolean;
  // NexHealth sync fields
  nexhealth_patient_id: string | null;
  nexhealth_synced_at: string | null;
  nexhealth_sync_status: string | null;
  // Source tracking
  source: 'platform' | 'nexhealth' | null;
}

export function usePatients(options?: { page?: number; pageSize?: number }) {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ['patients', page, pageSize],
    queryFn: async (): Promise<{ patients: PatientWithDetails[]; total: number; page: number; pageSize: number; totalPages: number }> => {
      // Get total count (all patients - active and inactive)
      const { count, error: countError } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', DEMO_CLINIC_ID);

      if (countError) throw countError;

      // Get paginated patients (all patients - active and inactive)
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', DEMO_CLINIC_ID)
        // .order('is_active', { ascending: false })
        .order('last_name', { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Fetch last appointment for each patient
      const patientIds = patients?.map(p => p.id) || [];
      const { data: lastAppointments } = await supabase
        .from('appointments')
        .select('patient_id, appointment_date')
        .in('patient_id', patientIds)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false });

      const lastVisitMap = new Map<string, string>();
      lastAppointments?.forEach(apt => {
        if (!lastVisitMap.has(apt.patient_id!)) {
          lastVisitMap.set(apt.patient_id!, apt.appointment_date);
        }
      });

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        patients: (patients || []).map((patient, index) => {
          const lastVisit = lastVisitMap.get(patient.id);
          return {
            id: patient.id,
            mrn: `MRN${patient.id.slice(0, 6).toUpperCase()}`,
            name: `${patient.first_name} ${patient.last_name}`,
            first_name: patient.first_name,
            last_name: patient.last_name,
            phone: patient.phone,
            email: patient.email,
            dob: formatDate(patient.dob),
            insurance: patient.insurance_provider,
            insurance_id: patient.insurance_id,
            insurance_group: patient.insurance_group,
            insurance_provider: patient.insurance_provider,
            balance: (patient.copay_amount || 0) + (patient.previous_balance || 0),
            copay: patient.copay_amount || 0,
            previousBalance: patient.previous_balance || 0,
            lastVisit: lastVisit ? formatDate(lastVisit) : null,
            status: patient.is_active ? 'active' : 'inactive',
            address: formatAddress(patient),
            photo: `https://i.pravatar.cc/150?img=${(index % 70) + 1}`,
            // Additional fields
            gender: patient.gender,
            city: patient.city,
            state: patient.state,
            zip: patient.zip,
            emergency_contact_name: patient.emergency_contact_name,
            emergency_contact_phone: patient.emergency_contact_phone,
            emergency_contact_relationship: patient.emergency_contact_relationship,
            allergies: patient.allergies,
            medications: patient.medications,
            medical_history: patient.medical_history,
            notes: patient.notes,
            is_active: patient.is_active ?? true,
            // NexHealth sync fields
            nexhealth_patient_id: (patient as any).nexhealth_patient_id || null,
            nexhealth_synced_at: (patient as any).nexhealth_synced_at || null,
            nexhealth_sync_status: (patient as any).nexhealth_sync_status || null,
            // Source tracking - prioritize nexhealth_patient_id check
            source: (patient as any).nexhealth_patient_id 
              ? 'nexhealth' 
              : ((patient as any).source === 'nexhealth' ? 'nexhealth' : 'platform'),
          };
        }),
        total,
        page,
        pageSize,
        totalPages,
      };
    }
  });
}

export function usePatientByPhone(phone: string) {
  return useQuery({
    queryKey: ['patient', 'phone', phone],
    queryFn: async () => {
      const cleanPhone = phone.replace(/\D/g, '');
      
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', DEMO_CLINIC_ID)
        .eq('is_active', true);

      if (error) throw error;

      // Find patient by matching phone (removing formatting)
      const patient = data?.find(p => p.phone.replace(/\D/g, '').includes(cleanPhone));
      
      if (!patient) return null;

      return {
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        first_name: patient.first_name,
        last_name: patient.last_name,
        phone: patient.phone,
        copay: patient.copay_amount || 0,
        previousBalance: patient.previous_balance || 0,
        photo: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`
      };
    },
    enabled: phone.replace(/\D/g, '').length >= 10
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatAddress(patient: any): string {
  const parts = [patient.address, patient.city, patient.state, patient.zip].filter(Boolean);
  return parts.join(', ') || 'N/A';
}
