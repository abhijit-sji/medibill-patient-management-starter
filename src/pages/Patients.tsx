/**
 * Patients Page - Database-First with NexHealth Sync
 * Patients are stored and displayed from the local database
 * NexHealth sync is a background operation that populates the database
 * Medibill Voice Sync Health
 */

import { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePatients } from '@/hooks/usePatients';
import { useDeletePatient } from '@/hooks/useData';
import type { PatientWithDetails } from '@/hooks/usePatients';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddPatientDialog } from '@/components/patients/AddPatientDialog';
import { EditPatientDialog } from '@/components/patients/EditPatientDialog';
import { BulkImportDialog } from '@/components/patients/BulkImportDialog';
import { 
  Search, User, Phone, Mail, Calendar, Plus, Edit, Trash2,
  Upload, RefreshCw, Database, MoreHorizontal, CloudDownload,
  CheckCircle2, Cloud, UserCheck, UserX, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  syncNexHealthPatients,
  deleteNexHealthPatient,
} from '@/services/nexhealth-patients.service';
import { 
  hardDeletePatient,
  removeFromPlatform,
  togglePatientStatus,
  bulkDeactivatePatients,
  bulkDeletePatients,
} from '@/services/patients.service';
import { isNexHealthConfigured } from '@/lib/nexhealth-config';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-green-100', text: 'text-green-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
];

const getAvatarColor = (patient: { first_name?: string; last_name?: string; id?: string }) => {
  const name = `${patient.first_name || ''}${patient.last_name || ''}` || patient.id || '';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function Patients() {
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithDetails | null>(null);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<PatientWithDetails | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<PatientWithDetails | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // NexHealth configuration state
  const [isNexHealthReady, setIsNexHealthReady] = useState(false);
  const [checkingNexHealth, setCheckingNexHealth] = useState(true);
  
  const queryClient = useQueryClient();
  const deletePatientMutation = useDeletePatient();
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

  // Fetch patients from LOCAL DATABASE
  const { 
    data: patientsResult, 
    isLoading, 
    error, 
    refetch 
  } = usePatients({ page: currentPage, pageSize });

  // Real-time subscription: refresh patient list when a new patient is inserted or updated
  // (e.g. after patient self-registration via the registration link)
  useEffect(() => {
    const channel = supabase
      .channel('patients-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'patients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'patients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Check NexHealth configuration on mount
  useEffect(() => {
    const checkConfig = async () => {
      setCheckingNexHealth(true);
      try {
        const configured = await isNexHealthConfigured();
        setIsNexHealthReady(configured);
      } catch (error) {
        console.error('Error checking NexHealth config:', error);
        setIsNexHealthReady(false);
      } finally {
        setCheckingNexHealth(false);
      }
    };
    checkConfig();
  }, []);

  // Sync mutation - syncs NexHealth patients to local database
  const syncMutation = useMutation({
    mutationFn: () => syncNexHealthPatients(),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || `Synced ${data.synced} patients from NexHealth`);
        // Refresh local data after sync
        queryClient.invalidateQueries({ queryKey: ['patients'] });
      } else {
        toast.error(data.error || 'Sync failed');
      }
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  // Get patients from database result
  const patientsData = useMemo(() => {
    return patientsResult?.patients || [];
  }, [patientsResult?.patients]);

  const totalPatients = patientsResult?.total || 0;
  const activePatients = patientsData.filter(p => p.status === 'active').length;
  const syncedPatients = patientsData.filter(p => p.nexhealth_patient_id).length;

  // Toggle patient selection
  const togglePatientSelection = (id: string) => {
    setSelectedPatientIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedPatientIds.size === patientsData.length) {
      setSelectedPatientIds(new Set());
    } else {
      setSelectedPatientIds(new Set(patientsData.map(p => p.id)));
    }
  };

  // Handle edit patient
  const handleEditPatient = (patient: PatientWithDetails) => {
    setPatientToEdit(patient);
    setIsEditDialogOpen(true);
    setSelectedPatient(null); // Close detail sheet
  };

  // Handle delete confirmation
  const handleDeleteClick = (patient: PatientWithDetails) => {
    setPatientToDelete(patient);
    setIsDeleteDialogOpen(true);
    setSelectedPatient(null); // Close detail sheet
  };

  // Handle delete patient
  const handleDeletePatient = async () => {
    if (!patientToDelete) return;

    setIsDeleting(true);
    try {
      const isNexHealthPatient = patientToDelete.nexhealth_patient_id || 
                                  patientToDelete.source === 'nexhealth';

      if (isNexHealthPatient) {
        // Soft delete for NexHealth patients - just remove from platform
        await removeFromPlatform(patientToDelete.id);
        toast.success('Patient removed from platform');
      } else {
        // Hard delete for platform-created patients
        await hardDeletePatient(patientToDelete.id);
        toast.success('Patient permanently deleted');
      }

      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setIsDeleteDialogOpen(false);
      setPatientToDelete(null);
    } catch (error: any) {
      console.error('Error deleting patient:', error);
      toast.error(error?.message || 'Failed to delete patient. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle toggle patient status
  const handleToggleStatus = async (patient: PatientWithDetails) => {
    const newStatus = !patient.is_active;
    setIsToggling(true);
    try {
      await togglePatientStatus(patient.id, newStatus);
      toast.success(`Patient marked as ${newStatus ? 'active' : 'inactive'}`);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update patient status');
    } finally {
      setIsToggling(false);
    }
  };

  // Bulk deactivate handler
  const handleBulkDeactivate = async () => {
    setIsBulkProcessing(true);
    try {
      const result = await bulkDeactivatePatients(Array.from(selectedPatientIds));
      toast.success(`Deactivated ${result.success} patients`);
      if (result.failed > 0) {
        toast.error(`Failed to deactivate ${result.failed} patients`);
      }
      setSelectedPatientIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    } catch (error) {
      toast.error('Failed to deactivate patients');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk delete handler
  const handleBulkDeleteClick = () => {
    setIsBulkDeleteDialogOpen(true);
  };

  const handleBulkDelete = async () => {
    setIsBulkProcessing(true);
    try {
      const patientsToDelete = patientsData
        .filter(p => selectedPatientIds.has(p.id))
        .map(p => ({ id: p.id, source: p.source, nexhealth_patient_id: p.nexhealth_patient_id }));
      
      const result = await bulkDeletePatients(patientsToDelete);
      toast.success(`Deleted ${result.success} patients`);
      if (result.failed > 0) {
        toast.error(`Failed to delete ${result.failed} patients`);
      }
      setSelectedPatientIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    } catch (error) {
      toast.error('Failed to delete patients');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const columns = useMemo<ColumnDef<PatientWithDetails>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={selectedPatientIds.size === patientsData.length && patientsData.length > 0}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedPatientIds.has(row.original.id)}
            onCheckedChange={() => togglePatientSelection(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.original.first_name} ${row.original.last_name}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'name',
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm ${getAvatarColor(row.original).bg} ${getAvatarColor(row.original).text}`}>
              {(row.original.first_name?.[0] || '').toUpperCase()}{(row.original.last_name?.[0] || '').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{row.original.first_name} {row.original.last_name}</p>
                {row.original.nexhealth_patient_id && (
                  <span title="Synced with NexHealth">
                    <Cloud className="h-3 w-3 text-blue-500" />
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{row.original.email || 'No email'}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{row.original.phone || 'N/A'}</span>
          </div>
        ),
      },
      {
        accessorKey: 'dob',
        header: 'Date of Birth',
        cell: ({ row }) => {
          if (!row.original.dob) return <span className="text-muted-foreground">N/A</span>;
          try {
            // Handle MM/DD/YYYY format from hook
            const parts = row.original.dob.split('/');
            if (parts.length === 3) {
              return row.original.dob;
            }
            return format(new Date(row.original.dob), 'MMM dd, yyyy');
          } catch {
            return row.original.dob;
          }
        },
      },
      {
        accessorKey: 'insurance_provider',
        header: 'Insurance',
        cell: ({ row }) => (
          <span>{row.original.insurance_provider || <span className="text-muted-foreground">None</span>}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
            {row.original.status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => {
          const source = row.original.source || 'platform';
          const isNexHealth = row.original.nexhealth_patient_id || source === 'nexhealth';
          
          return isNexHealth ? (
            <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700">
              <Cloud className="h-3 w-3 mr-1" />
              NexHealth
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700">
              <Database className="h-3 w-3 mr-1" />
              Platform
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                handleEditPatient(row.original);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStatus(row.original);
                }}
                disabled={isToggling}
              >
                {row.original.is_active ? (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Mark Inactive
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Mark Active
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(row.original);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [selectedPatientIds, patientsData.length]
  );

  const table = useReactTable({
    data: patientsData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Patients</h1>
        <Card className="p-6">
          <div className="text-center text-destructive">
            <p className="font-semibold">Error loading patients</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Patients</h1>
            {syncMutation.isPending && (
              <Badge variant="secondary" className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {selectedPatientIds.size > 0 && (
              <span className="text-primary font-medium">
                {selectedPatientIds.size} selected
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Patient
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Patient
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import (CSV/Excel)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || !isNexHealthReady || checkingNexHealth}
              >
                <CloudDownload className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                Sync NexHealth
                {!isNexHealthReady && !checkingNexHealth && (
                  <span className="ml-1 text-xs text-muted-foreground">(Not configured)</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedPatientIds.size > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedPatientIds.size === patientsData.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="font-medium">{selectedPatientIds.size} patient(s) selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBulkDeactivate}
                disabled={isBulkProcessing}
              >
                <UserX className="h-4 w-4 mr-2" />
                Deactivate Selected
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDeleteClick}
                disabled={isBulkProcessing}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedPatientIds(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Patients</p>
              <p className="text-2xl font-bold">{totalPatients}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Patients</p>
              <p className="text-2xl font-bold">{activePatients}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <User className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactive Patients</p>
              <p className="text-2xl font-bold">{totalPatients - activePatients}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Patients Table */}
      <Card>
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : patientsData.length === 0 ? (
          <div className="p-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No patients found</h3>
            <p className="text-muted-foreground mb-4">
              Add a new patient or sync from NexHealth to get started.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Patient
              </Button>
              <Button variant="outline" onClick={() => syncMutation.mutate()}>
                <CloudDownload className="h-4 w-4 mr-2" />
                Sync NexHealth
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-6 py-4 text-left text-sm font-medium text-muted-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedPatient(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {patientsData.length > 0 && (
              <div className="flex items-center justify-between border-t p-4">
                {/* Page size selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <Select 
                    value={pageSize.toString()} 
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>

                {/* Page info */}
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalPatients)} of {totalPatients}
                </div>

                {/* Page navigation */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm px-2">
                    Page {currentPage} of {patientsResult?.totalPages || 1}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= (patientsResult?.totalPages || 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(patientsResult?.totalPages || 1)}
                    disabled={currentPage >= (patientsResult?.totalPages || 1)}
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Patient Detail Sheet */}
      <Sheet open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedPatient && (
            <>
              <SheetHeader>
                <SheetTitle>Patient Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </h2>
                      {selectedPatient.nexhealth_patient_id && (
                        <Badge variant="outline" className="text-blue-600">
                          <Cloud className="h-3 w-3 mr-1" />
                          Synced
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{selectedPatient.mrn || selectedPatient.email || 'No email'}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleEditPatient(selectedPatient)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => handleDeleteClick(selectedPatient)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date of Birth
                    </p>
                    <p className="font-medium mt-1">
                      {selectedPatient.dob || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone
                    </p>
                    <p className="font-medium mt-1">{selectedPatient.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </p>
                    <p className="font-medium mt-1">{selectedPatient.email || 'Not provided'}</p>
                  </div>
                </div>

                {selectedPatient.insurance && (
                  <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">Insurance Information</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">Provider</p>
                        <p className="font-medium text-blue-900 dark:text-blue-100">{selectedPatient.insurance}</p>
                      </div>
                      {selectedPatient.insurance_id && (
                        <div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">Member ID</p>
                          <p className="font-medium text-blue-900 dark:text-blue-100">{selectedPatient.insurance_id}</p>
                        </div>
                      )}
                      {selectedPatient.insurance_group && (
                        <div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">Group Number</p>
                          <p className="font-medium text-blue-900 dark:text-blue-100">{selectedPatient.insurance_group}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {selectedPatient.address && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Address</p>
                    <Card className="p-4">
                      <p className="font-medium">{selectedPatient.address}</p>
                    </Card>
                  </div>
                )}

                {(selectedPatient.emergency_contact_name || selectedPatient.emergency_contact_phone) && (
                  <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <h3 className="font-semibold mb-3 text-amber-900 dark:text-amber-100">Emergency Contact</h3>
                    <div className="space-y-2">
                      {selectedPatient.emergency_contact_name && (
                        <div>
                          <p className="text-sm text-amber-700 dark:text-amber-300">Name</p>
                          <p className="font-medium text-amber-900 dark:text-amber-100">{selectedPatient.emergency_contact_name}</p>
                        </div>
                      )}
                      {selectedPatient.emergency_contact_phone && (
                        <div>
                          <p className="text-sm text-amber-700 dark:text-amber-300">Phone</p>
                          <p className="font-medium text-amber-900 dark:text-amber-100">{selectedPatient.emergency_contact_phone}</p>
                        </div>
                      )}
                      {selectedPatient.emergency_contact_relationship && (
                        <div>
                          <p className="text-sm text-amber-700 dark:text-amber-300">Relationship</p>
                          <p className="font-medium text-amber-900 dark:text-amber-100">{selectedPatient.emergency_contact_relationship}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                <div className="space-y-3">
                  <h3 className="font-semibold">Status</h3>
                  <div className="p-3 bg-muted rounded-lg">
                    <Badge variant={selectedPatient.status === 'active' ? 'default' : 'secondary'}>
                      {selectedPatient.status === 'active' ? 'Active Patient' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                {selectedPatient.nexhealth_patient_id && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                      <Cloud className="h-3 w-3" />
                      Synced with NexHealth (ID: {selectedPatient.nexhealth_patient_id})
                    </p>
                    {selectedPatient.nexhealth_synced_at && (
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        Last synced: {format(new Date(selectedPatient.nexhealth_synced_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Patient Dialog */}
      <AddPatientDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {/* Edit Patient Dialog */}
      <EditPatientDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setPatientToEdit(null);
        }}
        patient={patientToEdit}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['patients'] });
        }}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {patientToDelete && (patientToDelete.nexhealth_patient_id || patientToDelete.source === 'nexhealth')
                ? 'Remove Patient from Platform'
                : 'Delete Patient'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {patientToDelete && (patientToDelete.nexhealth_patient_id || patientToDelete.source === 'nexhealth') ? (
                <span className="block">
                  <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 mb-2">
                    <Cloud className="h-3 w-3 mr-1" />
                    NexHealth Patient
                  </Badge>
                  <span className="block mt-2">
                    This patient is synced from NexHealth. The record will be hidden from the platform 
                    but will remain in NexHealth. You can sync again to restore it.
                  </span>
                </span>
              ) : (
                <span className="block">
                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 mb-2">
                    <Database className="h-3 w-3 mr-1" />
                    Platform Patient
                  </Badge>
                  <span className="block mt-2">
                    This action will permanently delete this patient record from the database. 
                    This cannot be undone.
                  </span>
                </span>
              )}
              {patientToDelete && (
                <span className="block mt-3 font-semibold text-foreground">
                  Patient: {patientToDelete.first_name} {patientToDelete.last_name}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePatient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting 
                ? 'Processing...' 
                : patientToDelete && (patientToDelete.nexhealth_patient_id || patientToDelete.source === 'nexhealth')
                  ? 'Remove from Platform'
                  : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPatientIds.size} Patients</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the selected patients:
              <ul className="mt-2 list-disc list-inside">
                <li>Platform patients will be permanently deleted</li>
                <li>NexHealth patients will be removed from platform but remain in NexHealth</li>
              </ul>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={isBulkProcessing}
            >
              {isBulkProcessing ? 'Deleting...' : `Delete ${selectedPatientIds.size} Patients`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
