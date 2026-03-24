/**
 * NexHealth Patients Service
 * Frontend service to interact with the nexhealth-patients edge function
 * Medibill Voice Sync Health
 */

import { getNexHealthConfig } from '@/lib/nexhealth-config';

const SUPABASE_URL = 'https://qdnpztafkuprifwwqcgj.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/nexhealth-patients`;

export interface NexHealthPatientBio {
  city?: string;
  state?: string;
  gender?: string;
  zip_code?: string;
  new_patient?: boolean;
  non_patient?: boolean;
  phone_number?: string;
  date_of_birth?: string;
  address_line_1?: string;
  address_line_2?: string;
  street_address?: string;
  cell_phone_number?: string;
  home_phone_number?: string;
  work_phone_number?: string;
  custom_contact_number?: string;
  ssn?: string;
  race?: string;
  weight?: number;
  height?: number;
  insurance_name?: string;
}

export interface NexHealthPatient {
  id: number;
  email: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  name: string;
  created_at: string;
  updated_at: string;
  institution_id: number;
  foreign_id: string | null;
  foreign_id_type: string;
  bio: NexHealthPatientBio;
  inactive: boolean;
  last_sync_time: string | null;
  guarantor_id: number | null;
  unsubscribe_sms: boolean;
  billing_type: string | null;
  chart_id: string | null;
  preferred_language: string | null;
  provider_id: number | null;
  location_ids?: number[];
}

export interface NexHealthPatientsResponse {
  success: boolean;
  data: NexHealthPatient[];
  page_info?: {
    has_previous_page: boolean;
    has_next_page: boolean;
    start_cursor: string;
    end_cursor: string;
  };
  error?: string;
}

export interface NexHealthPatientResponse {
  success: boolean;
  data: NexHealthPatient | null;
  error?: string;
}

export interface NexHealthSyncResponse {
  success: boolean;
  message: string;
  synced: number;
  errors?: number;
  error?: string;
}

/**
 * Fetch list of patients from NexHealth API
 */
export async function fetchNexHealthPatients(
  subdomain?: string,
  locationId?: string
): Promise<NexHealthPatientsResponse> {
  // Fetch config if params not provided
  const config = await getNexHealthConfig();
  const effectiveSubdomain = subdomain || config.subdomain;
  const effectiveLocationId = locationId || config.location_id;

  if (!effectiveSubdomain || !effectiveLocationId) {
    return {
      success: false,
      data: [],
      error: 'NexHealth not configured. Please set up credentials in Configuration.',
    };
  }

  const url = `${FUNCTION_URL}?action=list&subdomain=${effectiveSubdomain}&location_id=${effectiveLocationId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch patients: ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch a single patient by ID from NexHealth API
 */
export async function fetchNexHealthPatientById(
  patientId: string,
  subdomain?: string
): Promise<NexHealthPatientResponse> {
  // Fetch config if params not provided
  const config = await getNexHealthConfig();
  const effectiveSubdomain = subdomain || config.subdomain;

  if (!effectiveSubdomain) {
    return {
      success: false,
      data: null,
      error: 'NexHealth not configured. Please set up credentials in Configuration.',
    };
  }

  const url = `${FUNCTION_URL}?action=get&patient_id=${patientId}&subdomain=${effectiveSubdomain}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch patient: ${errorText}`);
  }

  return response.json();
}

/**
 * Create a new patient in NexHealth
 */
export async function createNexHealthPatient(
  patientData: {
    provider_id?: number;
    first_name: string;
    last_name: string;
    email?: string;
    bio?: NexHealthPatientBio;
  },
  subdomain?: string,
  locationId?: string
): Promise<NexHealthPatientResponse> {
  // Fetch config if params not provided
  const config = await getNexHealthConfig();
  const effectiveSubdomain = subdomain || config.subdomain;
  const effectiveLocationId = locationId || config.location_id;

  if (!effectiveSubdomain || !effectiveLocationId) {
    return {
      success: false,
      data: null,
      error: 'NexHealth not configured. Please set up credentials in Configuration.',
    };
  }

  const url = `${FUNCTION_URL}?action=create&subdomain=${effectiveSubdomain}&location_id=${effectiveLocationId}`;
  
  // Format request body according to NexHealth API spec
  const body = {
    provider: patientData.provider_id ? { provider_id: patientData.provider_id } : undefined,
    patient: {
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      email: patientData.email,
      bio: patientData.bio,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create patient: ${errorText}`);
  }

  return response.json();
}

/**
 * Update an existing patient in NexHealth
 */
export async function updateNexHealthPatient(
  patientNexHealthId: string,
  patientData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    bio?: NexHealthPatientBio;
  },
  subdomain?: string
): Promise<NexHealthPatientResponse> {
  // Fetch config if params not provided
  const config = await getNexHealthConfig();
  const effectiveSubdomain = subdomain || config.subdomain;

  if (!effectiveSubdomain) {
    return {
      success: false,
      data: null,
      error: 'NexHealth not configured. Please set up credentials in Configuration.',
    };
  }

  const url = `${FUNCTION_URL}?action=update&patient_id=${patientNexHealthId}&subdomain=${effectiveSubdomain}`;
  
  // Format request body according to NexHealth API spec
  const body = {
    patient: {
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      email: patientData.email,
      bio: patientData.bio,
    },
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update patient: ${errorText}`);
  }

  return response.json();
}

/**
 * Delete (deactivate) a patient in NexHealth
 */
export async function deleteNexHealthPatient(
  patientNexHealthId: string,
  subdomain?: string,
  locationId?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const config = await getNexHealthConfig();
  const effectiveSubdomain = subdomain || config.subdomain;
  const effectiveLocationId = locationId || config.location_id;

  if (!effectiveSubdomain || !effectiveLocationId) {
    return {
      success: false,
      error: 'NexHealth not configured. Please set up credentials in Configuration.',
    };
  }

  const url = `${FUNCTION_URL}?action=delete&patient_id=${patientNexHealthId}&subdomain=${effectiveSubdomain}&location_id=${effectiveLocationId}`;
  
  // Use POST method with action=delete since edge functions often handle via query params
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete patient: ${errorText}`);
  }

  return response.json();
}

/**
 * Search patients in NexHealth
 */
export async function searchNexHealthPatients(
  searchQuery: string,
  subdomain?: string,
  locationId?: string
): Promise<NexHealthPatientsResponse> {
  const config = await getNexHealthConfig();
  const effectiveSubdomain = subdomain || config.subdomain;
  const effectiveLocationId = locationId || config.location_id;

  if (!effectiveSubdomain || !effectiveLocationId) {
    return {
      success: false,
      data: [],
      error: 'NexHealth not configured. Please set up credentials in Configuration.',
    };
  }

  const url = `${FUNCTION_URL}?action=search&q=${encodeURIComponent(searchQuery)}&subdomain=${effectiveSubdomain}&location_id=${effectiveLocationId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to search patients: ${errorText}`);
  }

  return response.json();
}

/**
 * Sync NexHealth patients to local database
 */
export async function syncNexHealthPatients(
  subdomain?: string,
  locationId?: string
): Promise<NexHealthSyncResponse> {
  // Fetch config if params not provided
  const config = await getNexHealthConfig();
  const effectiveSubdomain = subdomain || config.subdomain;
  const effectiveLocationId = locationId || config.location_id;

  if (!effectiveSubdomain || !effectiveLocationId) {
    return {
      success: false,
      message: 'NexHealth not configured',
      synced: 0,
      error: 'NexHealth not configured. Please set up credentials in Configuration.',
    };
  }

  const url = `${FUNCTION_URL}?action=sync&subdomain=${effectiveSubdomain}&location_id=${effectiveLocationId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to sync patients: ${errorText}`);
  }

  return response.json();
}
