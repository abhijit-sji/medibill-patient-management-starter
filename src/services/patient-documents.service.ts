/**
 * Patient Documents Service
 * Handles CRUD operations for patient documents with file upload support
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';

export interface PatientDocument {
  id: number;
  clinic_id: string | null;
  patient_id: string;
  document_type_id: number | null;
  filename: string;
  file_type: string | null;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  notes: string | null;
  nexhealth_id: number | null;
  nexhealth_url: string | null;
  nexhealth_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  document_type?: {
    id: number;
    name: string;
  };
  uploader?: {
    email: string;
  };
}

export interface CreatePatientDocumentParams {
  clinic_id?: string;
  patient_id: string;
  document_type_id?: number;
  filename: string;
  file_type?: string;
  file_url: string;
  file_size?: number;
  uploaded_by?: string;
  notes?: string;
}

export interface UpdatePatientDocumentParams {
  document_type_id?: number;
  filename?: string;
  notes?: string;
}

/**
 * Get all documents for a patient
 */
export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const { data, error } = await (supabase.from('patient_documents') as any)
    .select(`
      *,
      document_type:document_types(id, name)
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching patient documents:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all documents for a clinic
 */
export async function getAllDocuments(clinicId?: string): Promise<PatientDocument[]> {
  let query = (supabase.from('patient_documents') as any)
    .select(`
      *,
      document_type:document_types(id, name),
      patient:patients(id, first_name, last_name)
    `)
    .order('created_at', { ascending: false });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all documents:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single document by ID
 */
export async function getPatientDocumentById(id: number): Promise<PatientDocument | null> {
  const { data, error } = await (supabase.from('patient_documents') as any)
    .select(`
      *,
      document_type:document_types(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching patient document:', error);
    throw error;
  }

  return data;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadDocumentFile(
  file: File,
  patientId: string,
  clinicId?: string
): Promise<{ path: string; url: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${patientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = clinicId ? `${clinicId}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from('patient-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file:', error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('patient-documents')
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Create a patient document record (after file upload)
 */
export async function createPatientDocument(params: CreatePatientDocumentParams): Promise<PatientDocument> {
  const { data, error } = await (supabase.from('patient_documents') as any)
    .insert({
      clinic_id: params.clinic_id,
      patient_id: params.patient_id,
      document_type_id: params.document_type_id,
      filename: params.filename,
      file_type: params.file_type,
      file_url: params.file_url,
      file_size: params.file_size,
      uploaded_by: params.uploaded_by,
      notes: params.notes,
    })
    .select(`
      *,
      document_type:document_types(id, name)
    `)
    .single();

  if (error) {
    console.error('Error creating patient document:', error);
    throw error;
  }

  return data;
}

/**
 * Upload and create a patient document in one operation
 */
export async function uploadAndCreateDocument(
  file: File,
  patientId: string,
  params: {
    clinic_id?: string;
    document_type_id?: number;
    notes?: string;
    uploaded_by?: string;
  }
): Promise<PatientDocument> {
  // Upload file first
  const { url } = await uploadDocumentFile(file, patientId, params.clinic_id);

  // Create document record
  return createPatientDocument({
    clinic_id: params.clinic_id,
    patient_id: patientId,
    document_type_id: params.document_type_id,
    filename: file.name,
    file_type: file.type,
    file_url: url,
    file_size: file.size,
    uploaded_by: params.uploaded_by,
    notes: params.notes,
  });
}

/**
 * Update a patient document
 */
export async function updatePatientDocument(id: number, params: UpdatePatientDocumentParams): Promise<PatientDocument> {
  const { data, error } = await (supabase.from('patient_documents') as any)
    .update({
      ...params,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      document_type:document_types(id, name)
    `)
    .single();

  if (error) {
    console.error('Error updating patient document:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a patient document (and optionally the file)
 */
export async function deletePatientDocument(id: number, deleteFile: boolean = true): Promise<void> {
  // Get the document first to get file path
  if (deleteFile) {
    const doc = await getPatientDocumentById(id);
    if (doc?.file_url) {
      // Extract path from URL and delete from storage
      try {
        const url = new URL(doc.file_url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/patient-documents\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from('patient-documents').remove([pathMatch[1]]);
        }
      } catch (e) {
        console.warn('Could not delete file from storage:', e);
      }
    }
  }

  const { error } = await (supabase.from('patient_documents') as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting patient document:', error);
    throw error;
  }
}

/**
 * Get download URL for a document
 */
export async function getDocumentDownloadUrl(fileUrl: string): Promise<string> {
  // If it's already a full URL, return it
  if (fileUrl.startsWith('http')) {
    return fileUrl;
  }

  // Otherwise, get signed URL from storage
  const { data, error } = await supabase.storage
    .from('patient-documents')
    .createSignedUrl(fileUrl, 3600); // 1 hour expiry

  if (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }

  return data.signedUrl;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file type icon name
 */
export function getFileTypeIcon(mimeType: string | null): string {
  if (!mimeType) return 'file';
  if (mimeType.includes('pdf')) return 'file-text';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'table';
  return 'file';
}

