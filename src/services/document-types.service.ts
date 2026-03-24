/**
 * Document Types Service
 * Handles CRUD operations for document types/categories
 * Medibill Voice Sync Health
 */

import { supabase } from '@/integrations/supabase/client';

export interface DocumentType {
  id: number;
  clinic_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  nexhealth_id: number | null;
  nexhealth_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentTypeParams {
  clinic_id?: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateDocumentTypeParams {
  name?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Get all document types for a clinic
 */
export async function getDocumentTypes(clinicId?: string): Promise<DocumentType[]> {
  let query = (supabase.from('document_types') as any)
    .select('*')
    .order('name', { ascending: true });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching document types:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get active document types for a clinic
 */
export async function getActiveDocumentTypes(clinicId?: string): Promise<DocumentType[]> {
  let query = (supabase.from('document_types') as any)
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching active document types:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single document type by ID
 */
export async function getDocumentTypeById(id: number): Promise<DocumentType | null> {
  const { data, error } = await (supabase.from('document_types') as any)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching document type:', error);
    throw error;
  }

  return data;
}

/**
 * Create a new document type
 */
export async function createDocumentType(params: CreateDocumentTypeParams): Promise<DocumentType> {
  const { data, error } = await (supabase.from('document_types') as any)
    .insert({
      clinic_id: params.clinic_id,
      name: params.name,
      description: params.description,
      is_active: params.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating document type:', error);
    throw error;
  }

  return data;
}

/**
 * Update a document type
 */
export async function updateDocumentType(id: number, params: UpdateDocumentTypeParams): Promise<DocumentType> {
  const { data, error } = await (supabase.from('document_types') as any)
    .update({
      ...params,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating document type:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a document type (soft delete)
 */
export async function deleteDocumentType(id: number): Promise<void> {
  const { error } = await (supabase.from('document_types') as any)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting document type:', error);
    throw error;
  }
}

/**
 * Hard delete a document type
 */
export async function hardDeleteDocumentType(id: number): Promise<void> {
  const { error } = await (supabase.from('document_types') as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error hard deleting document type:', error);
    throw error;
  }
}

