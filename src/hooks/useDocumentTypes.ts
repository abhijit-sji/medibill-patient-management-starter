/**
 * Document Types Hook
 * React Query hook for managing document types
 * Medibill Voice Sync Health
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDocumentTypes,
  getActiveDocumentTypes,
  getDocumentTypeById,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  type DocumentType,
  type CreateDocumentTypeParams,
  type UpdateDocumentTypeParams,
} from '@/services/document-types.service';
import { syncDocumentTypesFromNexHealth } from '@/services/nexhealth-document-types.service';
import { toast } from 'sonner';

export function useDocumentTypes() {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['document-types', clinicId],
    queryFn: () => getDocumentTypes(clinicId || undefined),
    enabled: true,
  });
}

export function useActiveDocumentTypes() {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['document-types', 'active', clinicId],
    queryFn: () => getActiveDocumentTypes(clinicId || undefined),
    enabled: true,
  });
}

export function useDocumentType(id: number | null) {
  return useQuery({
    queryKey: ['document-type', id],
    queryFn: () => (id ? getDocumentTypeById(id) : null),
    enabled: !!id,
  });
}

export function useCreateDocumentType() {
  const queryClient = useQueryClient();
  const { clinicId } = useAuth();

  return useMutation({
    mutationFn: (params: Omit<CreateDocumentTypeParams, 'clinic_id'>) =>
      createDocumentType({ ...params, clinic_id: clinicId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success('Document type created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create document type: ${error.message}`);
    },
  });
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, params }: { id: number; params: UpdateDocumentTypeParams }) =>
      updateDocumentType(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success('Document type updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update document type: ${error.message}`);
    },
  });
}

export function useDeleteDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteDocumentType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success('Document type deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document type: ${error.message}`);
    },
  });
}

export function useSyncDocumentTypesFromNexHealth() {
  const queryClient = useQueryClient();
  const { clinicId } = useAuth();

  return useMutation({
    mutationFn: () => {
      if (!clinicId) throw new Error('Clinic ID required');
      return syncDocumentTypesFromNexHealth(clinicId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      if (data.success) {
        toast.success(`Synced ${data.synced} document types from NexHealth`);
      } else {
        toast.error('Sync failed');
      }
      if (data.errors.length > 0) {
        data.errors.forEach((err) => toast.warning(err));
      }
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}

