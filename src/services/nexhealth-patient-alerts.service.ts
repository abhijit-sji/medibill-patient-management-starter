/**
 * NexHealth Patient Alerts Sync Service
 * Create and manage patient alerts via NexHealth API
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';
import { authenticateNexHealth } from './nexhealth.service';

const NEXHEALTH_BASE_URL = 'https://nexhealth.info';
const API_VERSION = '2';

interface NexHealthPatientAlert {
  id: number;
  patient_id: number;
  note: string;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NexHealthSettings {
  subdomain: string;
  location_id: string;
}

async function getNexHealthConfig(clinicId: string): Promise<NexHealthSettings> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('clinic_id', clinicId)
    .eq('integration_name', 'nexhealth')
    .single();

  if (error || !data) {
    throw new Error('NexHealth not configured for this clinic');
  }

  return data.settings as unknown as NexHealthSettings;
}

/**
 * Fetch patient alerts from NexHealth
 */
export async function fetchPatientAlertsFromNexHealth(
  clinicId: string,
  nexhealthPatientId: number
): Promise<NexHealthPatientAlert[]> {
  const token = await authenticateNexHealth(clinicId);
  const config = await getNexHealthConfig(clinicId);

  const url = new URL(`${NEXHEALTH_BASE_URL}/patients/${nexhealthPatientId}/patient_alerts`);
  url.searchParams.set('subdomain', config.subdomain);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': `application/vnd.Nexhealth+json;version=${API_VERSION}`,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch patient alerts: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Create a patient alert in NexHealth
 */
export async function createPatientAlertInNexHealth(
  clinicId: string,
  nexhealthPatientId: number,
  note: string
): Promise<NexHealthPatientAlert> {
  const token = await authenticateNexHealth(clinicId);
  const config = await getNexHealthConfig(clinicId);

  const url = new URL(`${NEXHEALTH_BASE_URL}/patients/${nexhealthPatientId}/patient_alerts`);
  url.searchParams.set('subdomain', config.subdomain);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Accept': `application/vnd.Nexhealth+json;version=${API_VERSION}`,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create patient alert: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Disable a patient alert in NexHealth
 */
export async function disablePatientAlertInNexHealth(
  clinicId: string,
  nexhealthPatientId: number,
  alertId: number
): Promise<NexHealthPatientAlert> {
  const token = await authenticateNexHealth(clinicId);
  const config = await getNexHealthConfig(clinicId);

  const url = new URL(`${NEXHEALTH_BASE_URL}/patients/${nexhealthPatientId}/patient_alerts/${alertId}`);
  url.searchParams.set('subdomain', config.subdomain);

  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      'Accept': `application/vnd.Nexhealth+json;version=${API_VERSION}`,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ disabled_at: new Date().toISOString() }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to disable patient alert: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Sync patient alerts from NexHealth to local database
 */
export async function syncPatientAlertsFromNexHealth(
  clinicId: string,
  localPatientId: string,
  nexhealthPatientId: number
): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const nexhealthAlerts = await fetchPatientAlertsFromNexHealth(clinicId, nexhealthPatientId);

    for (const nhAlert of nexhealthAlerts) {
      try {
        // Check if already exists
        const { data: existing } = await (supabase.from('patient_alerts') as any)
          .select('id')
          .eq('nexhealth_id', nhAlert.id)
          .eq('patient_id', localPatientId)
          .maybeSingle();

        const alertData = {
          clinic_id: clinicId,
          patient_id: localPatientId,
          note: nhAlert.note,
          is_active: !nhAlert.disabled_at,
          disabled_at: nhAlert.disabled_at,
          nexhealth_id: nhAlert.id,
          nexhealth_synced_at: new Date().toISOString(),
          severity: 'info', // NexHealth doesn't have severity, default to info
        };

        if (existing) {
          await (supabase.from('patient_alerts') as any)
            .update(alertData)
            .eq('id', existing.id);
        } else {
          await (supabase.from('patient_alerts') as any)
            .insert(alertData);
        }

        synced++;
      } catch (err: any) {
        errors.push(`Failed to sync alert ${nhAlert.id}: ${err.message}`);
      }
    }

    return { success: true, synced, errors };
  } catch (err: any) {
    return { success: false, synced, errors: [err.message] };
  }
}

/**
 * Create alert locally and push to NexHealth if patient is synced
 */
export async function createAlertWithNexHealthSync(
  clinicId: string,
  patientId: string,
  note: string,
  severity: 'info' | 'warning' | 'critical' = 'info',
  createdBy?: string
): Promise<{ localAlert: any; nexhealthAlert?: NexHealthPatientAlert }> {
  // First, create local alert
  const { data: localAlert, error } = await (supabase.from('patient_alerts') as any)
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      note,
      severity,
      is_active: true,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create local alert: ${error.message}`);
  }

  // Check if patient is synced with NexHealth
  const { data: patient } = await (supabase
    .from('patients')
    .select('bio_json')
    .eq('id', patientId)
    .single() as any);

  // Extract nexhealth_patient_id from bio_json if available
  const nexhealthPatientId = patient?.bio_json?.nexhealth_id || patient?.bio_json?.id;

  let nexhealthAlert: NexHealthPatientAlert | undefined;

  if (nexhealthPatientId) {
    try {
      nexhealthAlert = await createPatientAlertInNexHealth(
        clinicId,
        parseInt(String(nexhealthPatientId)),
        note
      );

      // Update local alert with NexHealth ID
      await (supabase.from('patient_alerts') as any)
        .update({
          nexhealth_id: nexhealthAlert.id,
          nexhealth_synced_at: new Date().toISOString(),
        })
        .eq('id', localAlert.id);
    } catch (err) {
      console.warn('Could not sync alert to NexHealth:', err);
    }
  }

  return { localAlert, nexhealthAlert };
}

