/**
 * Patient Documents Hook
 * React Query hook for managing patient documents
 * Medibill Voice Sync Health
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPatientDocuments,
  getAllDocuments,
  getPatientDocumentById,
  createPatientDocument,
  uploadAndCreateDocument,
  updatePatientDocument,
  deletePatientDocument,
  type PatientDocument,
  type CreatePatientDocumentParams,
  type UpdatePatientDocumentParams,
} from '@/services/patient-documents.service';
import { toast } from 'sonner';

export function usePatientDocuments(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: () => (patientId ? getPatientDocuments(patientId) : []),
    enabled: !!patientId,
  });
}

export function useAllDocuments() {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['patient-documents', 'all', clinicId],
    queryFn: () => getAllDocuments(clinicId || undefined),
    enabled: true,
  });
}

export function usePatientDocument(id: number | null) {
  return useQuery({
    queryKey: ['patient-document', id],
    queryFn: () => (id ? getPatientDocumentById(id) : null),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { clinicId, user } = useAuth();

  return useMutation({
    mutationFn: ({
      file,
      patientId,
      documentTypeId,
      notes,
    }: {
      file: File;
      patientId: string;
      documentTypeId?: number;
      notes?: string;
    }) =>
      uploadAndCreateDocument(file, patientId, {
        clinic_id: clinicId || undefined,
        document_type_id: documentTypeId,
        notes,
        uploaded_by: user?.id,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-documents', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-documents', 'all'] });
      toast.success('Document uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
}

export function useCreatePatientDocument() {
  const queryClient = useQueryClient();
  const { clinicId, user } = useAuth();

  return useMutation({
    mutationFn: (params: Omit<CreatePatientDocumentParams, 'clinic_id' | 'uploaded_by'>) =>
      createPatientDocument({
        ...params,
        clinic_id: clinicId || undefined,
        uploaded_by: user?.id,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-documents', variables.patient_id] });
      queryClient.invalidateQueries({ queryKey: ['patient-documents', 'all'] });
      toast.success('Document created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create document: ${error.message}`);
    },
  });
}

export function useUpdatePatientDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, params }: { id: number; params: UpdatePatientDocumentParams }) =>
      updatePatientDocument(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-documents'] });
      toast.success('Document updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update document: ${error.message}`);
    },
  });
}

export function useDeletePatientDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteFile = true }: { id: number; deleteFile?: boolean }) =>
      deletePatientDocument(id, deleteFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-documents'] });
      toast.success('Document deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}

