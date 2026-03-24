/**
 * Patient Alerts Service
 * Handles CRUD operations for patient alerts
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';

export interface PatientAlert {
  id: number;
  clinic_id: string | null;
  patient_id: string;
  note: string;
  severity: 'info' | 'warning' | 'critical';
  is_active: boolean;
  disabled_at: string | null;
  disabled_by: string | null;
  created_by: string | null;
  nexhealth_id: number | null;
  nexhealth_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface CreatePatientAlertParams {
  clinic_id?: string;
  patient_id: string;
  note: string;
  severity?: 'info' | 'warning' | 'critical';
  created_by?: string;
}

export interface UpdatePatientAlertParams {
  note?: string;
  severity?: 'info' | 'warning' | 'critical';
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Get all active alerts for a patient
 */
export async function getPatientAlerts(patientId: string): Promise<PatientAlert[]> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .order('severity', { ascending: false }) // critical first
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching patient alerts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all alerts for a patient (including inactive)
 */
export async function getAllPatientAlerts(patientId: string): Promise<PatientAlert[]> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all patient alerts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all active alerts for a clinic
 */
export async function getAllActiveAlerts(clinicId?: string): Promise<PatientAlert[]> {
  let query = (supabase.from('patient_alerts') as any)
    .select(`
      *,
      patient:patients(id, first_name, last_name)
    `)
    .eq('is_active', true)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all active alerts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get alerts by severity
 */
export async function getAlertsBySeverity(severity: AlertSeverity, clinicId?: string): Promise<PatientAlert[]> {
  let query = (supabase.from('patient_alerts') as any)
    .select(`
      *,
      patient:patients(id, first_name, last_name)
    `)
    .eq('severity', severity)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching alerts by severity:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single alert by ID
 */
export async function getPatientAlertById(id: number): Promise<PatientAlert | null> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching patient alert:', error);
    throw error;
  }

  return data;
}

/**
 * Create a new patient alert
 */
export async function createPatientAlert(params: CreatePatientAlertParams): Promise<PatientAlert> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .insert({
      clinic_id: params.clinic_id,
      patient_id: params.patient_id,
      note: params.note,
      severity: params.severity ?? 'info',
      is_active: true,
      created_by: params.created_by,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating patient alert:', error);
    throw error;
  }

  return data;
}

/**
 * Update a patient alert
 */
export async function updatePatientAlert(id: number, params: UpdatePatientAlertParams): Promise<PatientAlert> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .update({
      ...params,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating patient alert:', error);
    throw error;
  }

  return data;
}

/**
 * Disable (soft delete) a patient alert
 */
export async function disablePatientAlert(id: number, disabledBy?: string): Promise<PatientAlert> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .update({
      is_active: false,
      disabled_at: new Date().toISOString(),
      disabled_by: disabledBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error disabling patient alert:', error);
    throw error;
  }

  return data;
}

/**
 * Re-enable a patient alert
 */
export async function enablePatientAlert(id: number): Promise<PatientAlert> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .update({
      is_active: true,
      disabled_at: null,
      disabled_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error enabling patient alert:', error);
    throw error;
  }

  return data;
}

/**
 * Hard delete a patient alert
 */
export async function deletePatientAlert(id: number): Promise<void> {
  const { error } = await (supabase.from('patient_alerts') as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting patient alert:', error);
    throw error;
  }
}

/**
 * Check if patient has any active alerts
 */
export async function hasActiveAlerts(patientId: string): Promise<boolean> {
  const { count, error } = await (supabase.from('patient_alerts') as any)
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('is_active', true);

  if (error) {
    console.error('Error checking active alerts:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Get alert count by severity for a patient
 */
export async function getAlertCountBySeverity(patientId: string): Promise<Record<AlertSeverity, number>> {
  const { data, error } = await (supabase.from('patient_alerts') as any)
    .select('severity')
    .eq('patient_id', patientId)
    .eq('is_active', true);

  if (error) {
    console.error('Error getting alert counts:', error);
    return { info: 0, warning: 0, critical: 0 };
  }

  const counts: Record<AlertSeverity, number> = { info: 0, warning: 0, critical: 0 };
  (data || []).forEach((alert: { severity: AlertSeverity }) => {
    counts[alert.severity] = (counts[alert.severity] || 0) + 1;
  });

  return counts;
}

/**
 * Get severity badge variant
 */
export function getAlertSeverityVariant(severity: AlertSeverity): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (severity) {
    case 'critical': return 'destructive';
    case 'warning': return 'secondary';
    case 'info': return 'outline';
    default: return 'outline';
  }
}

/**
 * Get severity color for UI
 */
export function getAlertSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

