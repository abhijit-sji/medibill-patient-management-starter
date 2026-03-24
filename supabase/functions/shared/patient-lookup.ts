/**
 * Patient Lookup
 * Find existing patients or create new patient records
 * Medibill Voice Sync Health - Phase 1
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface PatientLookupResult {
  found: boolean;
  patient_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  dob?: string;
  is_new_patient?: boolean;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

function isFuzzyNameMatch(inputFirst: string, inputLast: string, patientFirst: string, patientLast: string): boolean {
  const inFirst = normalizeName(inputFirst);
  const inLast = normalizeName(inputLast);
  const dbFirst = normalizeName(patientFirst);
  const dbLast = normalizeName(patientLast);

  // Fast exact case-insensitive match
  if (inFirst === dbFirst && inLast === dbLast) {
    return true;
  }

  const firstDistance = levenshtein(inFirst, dbFirst);
  const lastDistance = levenshtein(inLast, dbLast);

  // Allow small typos (e.g. Mamum vs Mamun => distance 1)
  // Be stricter on last name to avoid mismatches across families.
  const firstOk = firstDistance <= 2;
  const lastOk = lastDistance <= 1;

  return firstOk && lastOk;
}

/**
 * Find a patient by name and date of birth
 */
export async function findPatient(
  firstName: string,
  lastName: string,
  dateOfBirth: string // YYYY-MM-DD
): Promise<PatientLookupResult> {
  console.log('Looking up patient:', {
    firstName,
    lastName,
    dateOfBirth,
    dobType: typeof dateOfBirth
  });

  try {
    // Normalize the date to YYYY-MM-DD format
    let normalizedDOB = dateOfBirth;

    // Try to parse various date formats
    try {
      const dobDate = new Date(dateOfBirth);
      if (!isNaN(dobDate.getTime())) {
        // Format as YYYY-MM-DD
        const year = dobDate.getFullYear();
        const month = String(dobDate.getMonth() + 1).padStart(2, '0');
        const day = String(dobDate.getDate()).padStart(2, '0');
        normalizedDOB = `${year}-${month}-${day}`;
        console.log('Normalized DOB:', { original: dateOfBirth, normalized: normalizedDOB });
      }
    } catch (e) {
      console.log('Could not parse date, using as-is:', dateOfBirth);
    }

    // Try exact match first
    let { data: patients, error } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone, email, dob, is_active')
      .eq('clinic_id', DEFAULT_CLINIC_ID)
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .eq('dob', normalizedDOB)
      .eq('is_active', true);

    console.log('Patient search result:', {
      searchedDOB: normalizedDOB,
      foundCount: patients?.length || 0,
      error: error?.message
    });

    if (error) {
      console.error('Error searching for patient:', error);
      throw new Error('Failed to search for patient');
    }

    if (patients && patients.length > 0) {
      // Patient found
      const patient = patients[0];
      console.log('Patient found:', patient.id);

      return {
        found: true,
        patient_id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        phone: patient.phone,
        email: patient.email || undefined,
        dob: patient.dob,
        is_new_patient: false,
      };
    }

    // Fuzzy fallback: same clinic + DOB + active, allow small typos in name
    const { data: dobMatches, error: dobError } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone, email, dob, is_active')
      .eq('clinic_id', DEFAULT_CLINIC_ID)
      .eq('dob', normalizedDOB)
      .eq('is_active', true)
      .limit(20);

    if (dobError) {
      console.error('Error searching for patient (fuzzy fallback):', dobError);
      throw new Error('Failed to search for patient (fuzzy)');
    }

    if (dobMatches && dobMatches.length > 0) {
      const inputFirst = firstName;
      const inputLast = lastName;

      const candidate = dobMatches.find(p =>
        isFuzzyNameMatch(inputFirst, inputLast, p.first_name, p.last_name)
      );

      if (candidate) {
        console.log('Patient found via fuzzy name match:', candidate.id);
        return {
          found: true,
          patient_id: candidate.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          phone: candidate.phone,
          email: candidate.email || undefined,
          dob: candidate.dob,
          is_new_patient: false,
        };
      }
    }

    // Patient not found
    console.log('Patient not found');
    return {
      found: false,
    };

  } catch (error) {
    console.error('Error in findPatient:', error);
    throw error;
  }
}

/**
 * Create a new patient record
 */
export async function createPatient(
  firstName: string,
  lastName: string,
  dateOfBirth: string,
  phone: string,
  email?: string
): Promise<PatientLookupResult> {
  console.log('Creating new patient:', { firstName, lastName, dateOfBirth, phone });

  try {
    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        clinic_id: DEFAULT_CLINIC_ID,
        first_name: firstName,
        last_name: lastName,
        dob: dateOfBirth,
        phone: phone,
        email: email || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating patient:', error);
      throw new Error('Failed to create patient record');
    }

    console.log('Patient created:', patient.id);

    return {
      found: true,
      patient_id: patient.id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone,
      email: patient.email || undefined,
      dob: patient.dob,
      is_new_patient: true,
    };

  } catch (error) {
    console.error('Error in createPatient:', error);
    throw error;
  }
}

/**
 * Find patient by phone number (alternative lookup)
 */
export async function findPatientByPhone(phone: string): Promise<PatientLookupResult> {
  console.log('Looking up patient by phone:', phone);

  try {
    // Normalize phone number (remove formatting)
    const normalizedPhone = phone.replace(/\D/g, '');

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone, email, dob, is_active')
      .eq('clinic_id', DEFAULT_CLINIC_ID)
      .eq('is_active', true);

    if (error) {
      console.error('Error searching by phone:', error);
      throw new Error('Failed to search for patient');
    }

    // Find patient with matching phone (normalize for comparison)
    const patient = patients?.find(p =>
      p.phone.replace(/\D/g, '') === normalizedPhone
    );

    if (patient) {
      console.log('Patient found by phone:', patient.id);

      return {
        found: true,
        patient_id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        phone: patient.phone,
        email: patient.email || undefined,
        dob: patient.dob,
        is_new_patient: false,
      };
    }

    console.log('Patient not found by phone');
    return {
      found: false,
    };

  } catch (error) {
    console.error('Error in findPatientByPhone:', error);
    throw error;
  }
}

/*
 * Usage Example:
 *
 * // Try to find existing patient
 * let result = await findPatient('John', 'Doe', '1990-05-15');
 *
 * if (!result.found) {
 *   // Patient doesn't exist, create new record
 *   result = await createPatient('John', 'Doe', '1990-05-15', '555-1234', 'john@example.com');
 * }
 *
 * console.log('Patient ID:', result.patient_id);
 */
