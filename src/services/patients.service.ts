/**
 * Patient Service
 * Handles all patient-related database operations
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/database.types';
import { logPHIAccess, logDataModification } from '@/services/hipaa-audit.service';

type Patient = Database['public']['Tables']['patients']['Row'];
type PatientInsert = Database['public']['Tables']['patients']['Insert'];
type PatientUpdate = Database['public']['Tables']['patients']['Update'];

const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001'; // Demo clinic

/**
 * Get all patients for a clinic with pagination
 */
export async function getAllPatients(
  clinicId: string = DEFAULT_CLINIC_ID,
  options?: { page?: number; pageSize?: number }
): Promise<{ patients: Patient[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Get total count
  const { count, error: countError } = await supabase
    .from('patients' as any)
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('is_active', true);

  if (countError) {
    console.error('Error fetching patient count:', countError);
    throw countError;
  }

  // Get paginated data
  const { data, error } = await supabase
    .from('patients' as any)
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .order('last_name', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('Error fetching patients:', error);
    throw error;
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    patients: (data || []) as unknown as Patient[],
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get a single patient by ID
 */
export async function getPatientById(patientId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients' as any)
    .select('*')
    .eq('id', patientId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching patient:', error);
    throw error;
  }

  // Fire-and-forget PHI access audit log
  logPHIAccess('patient', patientId, patientId, 'Patient record viewed').catch(() => {});

  return data as unknown as Patient | null;
}

/**
 * Sanitize phone number for safe query use
 */
function sanitizePhone(phone: string): string {
  // Only allow digits, plus, spaces, parentheses, hyphens
  const cleaned = phone.replace(/[^0-9+\s()-]/g, '');
  // Validate format - must be 10-20 chars of valid phone characters
  if (!/^[+]?[0-9\s()-]{10,20}$/.test(cleaned) && cleaned.length > 0) {
    throw new Error('Invalid phone number format');
  }
  return cleaned;
}

/**
 * Find patient by phone number (for AI voice agent)
 */
export async function findPatientByPhone(
  phone: string,
  clinicId: string = DEFAULT_CLINIC_ID
): Promise<Patient | null> {
  // Sanitize and normalize phone number
  const sanitizedPhone = sanitizePhone(phone);
  const normalizedPhone = sanitizedPhone.replace(/\D/g, '');

  if (!normalizedPhone || normalizedPhone.length < 10) {
    return null;
  }

  // Use separate queries instead of .or() with string interpolation to prevent filter injection
  const phoneVariants = [sanitizedPhone, `+${normalizedPhone}`, normalizedPhone];
  
  for (const phoneVariant of phoneVariants) {
    const { data, error } = await supabase
      .from('patients' as any)
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', phoneVariant)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error finding patient by phone:', error);
      throw error;
    }

    const results = (data || []) as unknown as Patient[];
    if (results.length > 0) {
      return results[0];
    }
  }

  return null;
}

/**
 * Create a new patient
 */
export async function createPatient(
  patient: Omit<PatientInsert, 'id' | 'created_at' | 'updated_at'>,
  clinicId: string = DEFAULT_CLINIC_ID
): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients' as any)
    .insert({
      ...patient,
      clinic_id: clinicId,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating patient:', error);
    throw error;
  }

  const created = data as unknown as Patient;
  logDataModification('patient', created.id, null, { id: created.id }, created.id, 'info').catch(() => {});

  return created;
}

/**
 * Update a patient
 */
export async function updatePatient(patientId: string, updates: PatientUpdate): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients' as any)
    .update(updates as any)
    .eq('id', patientId)
    .select()
    .single();

  if (error) {
    console.error('Error updating patient:', error);
    throw error;
  }

  logDataModification('patient', patientId, null, updates as any, patientId, 'info').catch(() => {});

  return data as unknown as Patient;
}

/**
 * Soft delete a patient (mark as inactive)
 */
export async function deletePatient(patientId: string): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients' as any)
    .update({ is_active: false } as any)
    .eq('id', patientId)
    .select()
    .single();

  if (error) {
    console.error('Error deleting patient:', error);
    throw error;
  }

  return data as unknown as Patient;
}

/**
 * Sanitize search query to prevent filter injection
 */
function sanitizeSearchQuery(query: string): string {
  // Remove PostgREST operators and special characters that could manipulate queries
  const cleaned = query.replace(/[,()=<>!.%*]/g, '').trim();
  if (cleaned.length < 2 || cleaned.length > 100) {
    throw new Error('Search query must be between 2 and 100 characters');
  }
  // Only allow alphanumeric, spaces, @, and hyphens
  if (!/^[a-zA-Z0-9\s@-]+$/.test(cleaned)) {
    throw new Error('Search query contains invalid characters');
  }
  return cleaned;
}

/**
 * Search patients by name, phone, or email
 */
export async function searchPatients(
  query: string,
  clinicId: string = DEFAULT_CLINIC_ID
): Promise<Patient[]> {
  // Sanitize search query to prevent filter injection
  const sanitizedQuery = sanitizeSearchQuery(query);
  
  // Use parameterized-style approach with separate field searches
  const searchPattern = `%${sanitizedQuery}%`;
  
  const { data, error } = await supabase
    .from('patients' as any)
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .or(
      `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`
    )
    .order('last_name', { ascending: true });

  if (error) {
    console.error('Error searching patients:', error);
    throw error;
  }

  return (data || []) as unknown as Patient[];
}

/**
 * Get patient statistics
 */
export async function getPatientStats(clinicId: string = DEFAULT_CLINIC_ID) {
  const { count: totalPatients, error: totalError } = await supabase
    .from('patients' as any)
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('is_active', true);

  if (totalError) {
    console.error('Error fetching patient stats:', totalError);
    throw totalError;
  }

  // Get patients created this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: newThisMonth, error: monthError } = await supabase
    .from('patients' as any)
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .gte('created_at', startOfMonth.toISOString());

  if (monthError) {
    console.error('Error fetching monthly patient stats:', monthError);
    throw monthError;
  }

  return {
    totalPatients: totalPatients || 0,
    newThisMonth: newThisMonth || 0,
  };
}

/**
 * Normalize phone number for duplicate checking
 */
function normalizePhoneForDuplicate(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Check if a patient already exists by phone number
 */
async function checkPatientDuplicate(
  phone: string,
  clinicId: string
): Promise<{ isDuplicate: boolean; existingPatient?: Patient }> {
  if (!phone || phone.trim().length === 0) {
    return { isDuplicate: false };
  }

  const normalizedPhone = normalizePhoneForDuplicate(phone);
  
  if (normalizedPhone.length < 10) {
    return { isDuplicate: false };
  }

  // Check multiple phone number formats
  const phoneVariants = [
    phone.trim(),
    normalizedPhone,
    `+${normalizedPhone}`,
    `+1${normalizedPhone}`,
    `(${normalizedPhone.slice(0, 3)}) ${normalizedPhone.slice(3, 6)}-${normalizedPhone.slice(6)}`,
  ];

  for (const phoneVariant of phoneVariants) {
    const { data, error } = await supabase
      .from('patients' as any)
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .eq('phone', phoneVariant)
      .limit(1);

    if (error) {
      console.error('Error checking duplicate:', error);
      continue;
    }

    if (data && data.length > 0) {
      return {
        isDuplicate: true,
        existingPatient: data[0] as unknown as Patient,
      };
    }
  }

  // Also check by normalized phone in all existing patients
  const { data: allPatients, error } = await supabase
    .from('patients' as any)
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', true);

  if (!error && allPatients) {
    const duplicate = allPatients.find((p: any) => {
      const existingNormalized = normalizePhoneForDuplicate(p.phone || '');
      return existingNormalized === normalizedPhone && existingNormalized.length >= 10;
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        existingPatient: duplicate as unknown as Patient,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Bulk create patients with duplicate checking
 */
export async function bulkCreatePatients(
  patients: Omit<PatientInsert, 'id' | 'created_at' | 'updated_at'>[],
  clinicId: string = DEFAULT_CLINIC_ID
): Promise<{ success: number; failed: number; duplicates: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  const patientsToInsert: any[] = [];

  // First pass: Check for duplicates and collect valid patients
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    
    if (!patient.phone) {
      failedCount++;
      errors.push(`Row ${i + 1}: Phone number is required`);
      continue;
    }

    try {
      const duplicateCheck = await checkPatientDuplicate(patient.phone, clinicId);
      
      if (duplicateCheck.isDuplicate) {
        duplicateCount++;
        const existingName = duplicateCheck.existingPatient
          ? `${duplicateCheck.existingPatient.first_name} ${duplicateCheck.existingPatient.last_name}`
          : 'Unknown';
        errors.push(
          `Row ${i + 1}: Duplicate found - Patient "${patient.first_name} ${patient.last_name}" (${patient.phone}) already exists as "${existingName}"`
        );
        continue;
      }

      // Patient is not a duplicate, add to insert list
      patientsToInsert.push({
        ...patient,
        clinic_id: clinicId,
      });
    } catch (err: any) {
      failedCount++;
      errors.push(`Row ${i + 1}: Error checking duplicate - ${err.message || 'Unknown error'}`);
    }
  }

  // Second pass: Insert non-duplicate patients in batches
  const batchSize = 50;
  for (let i = 0; i < patientsToInsert.length; i += batchSize) {
    const batch = patientsToInsert.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('patients' as any)
        .insert(batch as any)
        .select();

      if (error) {
        failedCount += batch.length;
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        successCount += data?.length || 0;
        if (data && data.length < batch.length) {
          failedCount += batch.length - data.length;
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: Some records failed to insert`);
        }
      }
    } catch (err: any) {
      failedCount += batch.length;
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${err.message || 'Unknown error'}`);
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    duplicates: duplicateCount,
    errors,
  };
}

/**
 * Permanently delete a patient (hard delete) - for platform-created patients
 */
export async function hardDeletePatient(patientId: string): Promise<void> {
  const { error } = await supabase
    .from('patients' as any)
    .delete()
    .eq('id', patientId);

  if (error) {
    console.error('Error hard deleting patient:', error);
    throw error;
  }
}

/**
 * Remove patient from platform (soft delete) - for NexHealth-synced patients
 * Sets is_active = false and updates nexhealth_sync_status
 */
export async function removeFromPlatform(patientId: string): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients' as any)
    .update({ 
      is_active: false,
      nexhealth_sync_status: 'removed'
    } as any)
    .eq('id', patientId)
    .select()
    .single();

  if (error) {
    console.error('Error removing patient from platform:', error);
    throw error;
  }

  return data as unknown as Patient;
}

/**
 * Toggle patient active status
 */
export async function togglePatientStatus(patientId: string, isActive: boolean): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients' as any)
    .update({ is_active: isActive } as any)
    .eq('id', patientId)
    .select()
    .single();

  if (error) {
    console.error('Error toggling patient status:', error);
    throw error;
  }

  return data as unknown as Patient;
}

/**
 * Bulk deactivate patients
 */
export async function bulkDeactivatePatients(patientIds: string[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const id of patientIds) {
    try {
      const { error } = await supabase
        .from('patients' as any)
        .update({ is_active: false } as any)
        .eq('id', id);
      
      if (error) {
        failed++;
      } else {
        success++;
      }
    } catch (error) {
      failed++;
    }
  }
  
  return { success, failed };
}

/**
 * Bulk delete patients (hard delete for platform, soft delete for NexHealth)
 */
export async function bulkDeletePatients(
  patients: Array<{ id: string; source: string | null; nexhealth_patient_id: string | null }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const patient of patients) {
    try {
      const isNexHealth = patient.nexhealth_patient_id || patient.source === 'nexhealth';
      
      if (isNexHealth) {
        await removeFromPlatform(patient.id);
      } else {
        await hardDeletePatient(patient.id);
      }
      success++;
    } catch (error) {
      failed++;
    }
  }
  
  return { success, failed };
}