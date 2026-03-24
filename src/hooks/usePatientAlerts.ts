/**
 * Patient Alerts Hook
 * React Query hook for managing patient alerts
 * Medibill Voice Sync Health
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPatientAlerts,
  getAllPatientAlerts,
  getAllActiveAlerts,
  getAlertsBySeverity,
  getPatientAlertById,
  createPatientAlert,
  updatePatientAlert,
  disablePatientAlert,
  enablePatientAlert,
  deletePatientAlert,
  hasActiveAlerts,
  getAlertCountBySeverity,
  type PatientAlert,
  type CreatePatientAlertParams,
  type UpdatePatientAlertParams,
  type AlertSeverity,
} from '@/services/patient-alerts.service';
import { createAlertWithNexHealthSync } from '@/services/nexhealth-patient-alerts.service';
import { toast } from 'sonner';

export function usePatientAlerts(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-alerts', patientId],
    queryFn: () => (patientId ? getPatientAlerts(patientId) : []),
    enabled: !!patientId,
  });
}

export function useAllPatientAlerts(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-alerts', 'all', patientId],
    queryFn: () => (patientId ? getAllPatientAlerts(patientId) : []),
    enabled: !!patientId,
  });
}

export function useAllActiveAlerts() {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['patient-alerts', 'active', clinicId],
    queryFn: () => getAllActiveAlerts(clinicId || undefined),
    enabled: true,
  });
}

export function useAlertsBySeverity(severity: AlertSeverity) {
  const { clinicId } = useAuth();

  return useQuery({
    queryKey: ['patient-alerts', 'severity', severity, clinicId],
    queryFn: () => getAlertsBySeverity(severity, clinicId || undefined),
    enabled: true,
  });
}

export function usePatientAlert(id: number | null) {
  return useQuery({
    queryKey: ['patient-alert', id],
    queryFn: () => (id ? getPatientAlertById(id) : null),
    enabled: !!id,
  });
}

export function useHasActiveAlerts(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-alerts', 'has-active', patientId],
    queryFn: () => (patientId ? hasActiveAlerts(patientId) : false),
    enabled: !!patientId,
  });
}

export function useAlertCountBySeverity(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-alerts', 'count', patientId],
    queryFn: () => (patientId ? getAlertCountBySeverity(patientId) : { info: 0, warning: 0, critical: 0 }),
    enabled: !!patientId,
  });
}

export function useCreatePatientAlert() {
  const queryClient = useQueryClient();
  const { clinicId, user } = useAuth();

  return useMutation({
    mutationFn: (params: Omit<CreatePatientAlertParams, 'clinic_id' | 'created_by'>) =>
      createPatientAlert({
        ...params,
        clinic_id: clinicId || undefined,
        created_by: user?.id,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts', variables.patient_id] });
      queryClient.invalidateQueries({ queryKey: ['patient-alerts', 'active'] });
      toast.success('Alert created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create alert: ${error.message}`);
    },
  });
}

export function useCreatePatientAlertWithSync() {
  const queryClient = useQueryClient();
  const { clinicId, user } = useAuth();

  return useMutation({
    mutationFn: ({
      patientId,
      note,
      severity,
    }: {
      patientId: string;
      note: string;
      severity?: AlertSeverity;
    }) => {
      if (!clinicId) throw new Error('Clinic ID required');
      return createAlertWithNexHealthSync(clinicId, patientId, note, severity, user?.id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-alerts', 'active'] });
      toast.success('Alert created and synced');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create alert: ${error.message}`);
    },
  });
}

export function useUpdatePatientAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, params }: { id: number; params: UpdatePatientAlertParams }) =>
      updatePatientAlert(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts'] });
      toast.success('Alert updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update alert: ${error.message}`);
    },
  });
}

export function useDisablePatientAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: number) => disablePatientAlert(id, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts'] });
      toast.success('Alert disabled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to disable alert: ${error.message}`);
    },
  });
}

export function useEnablePatientAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => enablePatientAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts'] });
      toast.success('Alert enabled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to enable alert: ${error.message}`);
    },
  });
}

export function useDeletePatientAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePatientAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts'] });
      toast.success('Alert deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete alert: ${error.message}`);
    },
  });
}

