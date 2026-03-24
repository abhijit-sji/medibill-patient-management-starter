/**
 * Patient Recalls Service
 * Handles CRUD operations for patient recalls
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';

export interface PatientRecall {
  id: number;
  clinic_id: string | null;
  patient_id: string;
  recall_type_id: number | null;
  appointment_id: string | null;
  date_due: string;
  status: string;
  notes: string | null;
  nexhealth_id: number | null;
  foreign_id: string | null;
  foreign_id_type: string | null;
  nexhealth_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
  };
  recall_type?: {
    id: number;
    name: string;
    description: string | null;
    interval_num: number | null;
    interval_unit: string | null;
  };
}

export interface CreatePatientRecallParams {
  clinic_id?: string;
  patient_id: string;
  recall_type_id?: number;
  appointment_id?: string;
  date_due: string;
  status?: string;
  notes?: string;
}

export interface UpdatePatientRecallParams {
  recall_type_id?: number;
  appointment_id?: string | null;
  date_due?: string;
  status?: string;
  notes?: string;
}

export type RecallStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'overdue';

/**
 * Get all patient recalls for a clinic
 */
export async function getPatientRecalls(clinicId?: string): Promise<PatientRecall[]> {
  let query = (supabase.from('patient_recalls') as any)
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email),
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .order('date_due', { ascending: true });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching patient recalls:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get patient recalls by status
 */
export async function getPatientRecallsByStatus(status: RecallStatus, clinicId?: string): Promise<PatientRecall[]> {
  let query = (supabase.from('patient_recalls') as any)
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email),
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .eq('status', status)
    .order('date_due', { ascending: true });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching patient recalls by status:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get overdue recalls (date_due < today and status is pending)
 */
export async function getOverdueRecalls(clinicId?: string): Promise<PatientRecall[]> {
  const today = new Date().toISOString().split('T')[0];
  
  let query = (supabase.from('patient_recalls') as any)
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email),
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .eq('status', 'pending')
    .lt('date_due', today)
    .order('date_due', { ascending: true });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching overdue recalls:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get upcoming recalls (next 30 days)
 */
export async function getUpcomingRecalls(days: number = 30, clinicId?: string): Promise<PatientRecall[]> {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  
  let query = (supabase.from('patient_recalls') as any)
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email),
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .eq('status', 'pending')
    .gte('date_due', today)
    .lte('date_due', futureDateStr)
    .order('date_due', { ascending: true });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching upcoming recalls:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get recalls for a specific patient
 */
export async function getPatientRecallsByPatientId(patientId: string): Promise<PatientRecall[]> {
  const { data, error } = await (supabase.from('patient_recalls') as any)
    .select(`
      *,
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .eq('patient_id', patientId)
    .order('date_due', { ascending: false });

  if (error) {
    console.error('Error fetching patient recalls:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single patient recall by ID
 */
export async function getPatientRecallById(id: number): Promise<PatientRecall | null> {
  const { data, error } = await (supabase.from('patient_recalls') as any)
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email),
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching patient recall:', error);
    throw error;
  }

  return data;
}

/**
 * Create a new patient recall
 */
export async function createPatientRecall(params: CreatePatientRecallParams): Promise<PatientRecall> {
  const { data, error } = await (supabase.from('patient_recalls') as any)
    .insert({
      clinic_id: params.clinic_id,
      patient_id: params.patient_id,
      recall_type_id: params.recall_type_id,
      appointment_id: params.appointment_id,
      date_due: params.date_due,
      status: params.status ?? 'pending',
      notes: params.notes,
    })
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email),
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .single();

  if (error) {
    console.error('Error creating patient recall:', error);
    throw error;
  }

  return data;
}

/**
 * Update a patient recall
 */
export async function updatePatientRecall(id: number, params: UpdatePatientRecallParams): Promise<PatientRecall> {
  const { data, error } = await (supabase.from('patient_recalls') as any)
    .update({
      ...params,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      patient:patients(id, first_name, last_name, phone, email),
      recall_type:recall_types(id, name, description, interval_num, interval_unit)
    `)
    .single();

  if (error) {
    console.error('Error updating patient recall:', error);
    throw error;
  }

  return data;
}

/**
 * Mark a recall as scheduled (link to appointment)
 */
export async function markRecallScheduled(id: number, appointmentId: string): Promise<PatientRecall> {
  return updatePatientRecall(id, {
    status: 'scheduled',
    appointment_id: appointmentId,
  });
}

/**
 * Mark a recall as completed
 */
export async function markRecallCompleted(id: number): Promise<PatientRecall> {
  return updatePatientRecall(id, {
    status: 'completed',
  });
}

/**
 * Cancel a recall
 */
export async function cancelRecall(id: number, notes?: string): Promise<PatientRecall> {
  return updatePatientRecall(id, {
    status: 'cancelled',
    notes,
  });
}

/**
 * Delete a patient recall
 */
export async function deletePatientRecall(id: number): Promise<void> {
  const { error } = await (supabase.from('patient_recalls') as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting patient recall:', error);
    throw error;
  }
}

/**
 * Get recall status badge variant
 */
export function getRecallStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed': return 'default';
    case 'scheduled': return 'secondary';
    case 'overdue': return 'destructive';
    case 'cancelled': return 'outline';
    default: return 'outline';
  }
}

