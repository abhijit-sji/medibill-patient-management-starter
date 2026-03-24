/**
 * Patient Recalls Hook
 * React Query hook for managing patient recalls
 * Medibill Voice Sync Health
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPatientRecalls,
  getPatientRecallsByStatus,
  getOverdueRecalls,
  getUpcomingRecalls,
  getPatientRecallsByPatientId,
  getPatientRecallById,
  createPatientRecall,
  updatePatientRecall,
  markRecallScheduled,
  markRecallCompleted,
  cancelRecall,
  deletePatientRecall,
  type PatientRecall,
  type CreatePatientRecallParams,
  type UpdatePatientRecallParams,
  type RecallStatus,
} from '@/services/patient-recalls.service';
import { syncPatientRecallsFromNexHealth } from '@/services/nexhealth-patient-recalls.service';
import { toast } from 'sonner';

export function usePatientRecalls() {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['patient-recalls', clinicId],
    queryFn: () => getPatientRecalls(clinicId || undefined),
    enabled: true,
  });
}

export function usePatientRecallsByStatus(status: RecallStatus) {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['patient-recalls', 'status', status, clinicId],
    queryFn: () => getPatientRecallsByStatus(status, clinicId || undefined),
    enabled: true,
  });
}

export function useOverdueRecalls() {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['patient-recalls', 'overdue', clinicId],
    queryFn: () => getOverdueRecalls(clinicId || undefined),
    enabled: true,
  });
}

export function useUpcomingRecalls(days: number = 30) {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['patient-recalls', 'upcoming', days, clinicId],
    queryFn: () => getUpcomingRecalls(days, clinicId || undefined),
    enabled: true,
  });
}

export function usePatientRecallsForPatient(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-recalls', 'patient', patientId],
    queryFn: () => (patientId ? getPatientRecallsByPatientId(patientId) : []),
    enabled: !!patientId,
  });
}

export function usePatientRecall(id: number | null) {
  return useQuery({
    queryKey: ['patient-recall', id],
    queryFn: () => (id ? getPatientRecallById(id) : null),
    enabled: !!id,
  });
}

export function useCreatePatientRecall() {
  const queryClient = useQueryClient();
  const { clinicId } = useAuth();

  return useMutation({
    mutationFn: (params: Omit<CreatePatientRecallParams, 'clinic_id'>) =>
      createPatientRecall({ ...params, clinic_id: clinicId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-recalls'] });
      toast.success('Patient recall created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create patient recall: ${error.message}`);
    },
  });
}

export function useUpdatePatientRecall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, params }: { id: number; params: UpdatePatientRecallParams }) =>
      updatePatientRecall(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-recalls'] });
      toast.success('Patient recall updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update patient recall: ${error.message}`);
    },
  });
}

export function useMarkRecallScheduled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, appointmentId }: { id: number; appointmentId: string }) =>
      markRecallScheduled(id, appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-recalls'] });
      toast.success('Recall marked as scheduled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update recall: ${error.message}`);
    },
  });
}

export function useMarkRecallCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => markRecallCompleted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-recalls'] });
      toast.success('Recall marked as completed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update recall: ${error.message}`);
    },
  });
}

export function useCancelRecall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => cancelRecall(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-recalls'] });
      toast.success('Recall cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel recall: ${error.message}`);
    },
  });
}

export function useDeletePatientRecall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePatientRecall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-recalls'] });
      toast.success('Patient recall deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete patient recall: ${error.message}`);
    },
  });
}

export function useSyncPatientRecallsFromNexHealth() {
  const queryClient = useQueryClient();
  const { clinicId } = useAuth();

  return useMutation({
    mutationFn: () => {
      if (!clinicId) throw new Error('Clinic ID required');
      return syncPatientRecallsFromNexHealth(clinicId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patient-recalls'] });
      if (data.success) {
        toast.success(`Synced ${data.synced} patient recalls from NexHealth`);
      } else {
        toast.error('Sync failed');
      }
      if (data.errors.length > 0) {
        data.errors.slice(0, 3).forEach((err) => toast.warning(err));
      }
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}

