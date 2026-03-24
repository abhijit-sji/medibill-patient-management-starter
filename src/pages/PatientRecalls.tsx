/**
 * Patient Recalls Page
 * Manage patient recall appointments and due dates
 * Medibill Voice Sync Health
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Edit,
  Trash2,
  CloudDownload,
  CalendarCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Phone,
  ChevronDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, isAfter, isBefore, parseISO, addDays } from 'date-fns';
import {
  usePatientRecalls,
  useOverdueRecalls,
  useUpcomingRecalls,
  useDeletePatientRecall,
  useMarkRecallCompleted,
  useCancelRecall,
  useSyncPatientRecallsFromNexHealth,
} from '@/hooks/usePatientRecalls';
import { getRecallStatusVariant, type PatientRecall } from '@/services/patient-recalls.service';
import { AddPatientRecallDialog } from '@/components/recalls/AddPatientRecallDialog';
import { isNexHealthConfigured } from '@/lib/nexhealth-config';

export default function PatientRecalls() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecall, setSelectedRecall] = useState<PatientRecall | null>(null);

  const { data: allRecalls = [], isLoading, error, refetch } = usePatientRecalls();
  const { data: overdueRecalls = [] } = useOverdueRecalls();
  const { data: upcomingRecalls = [] } = useUpcomingRecalls(30);
  
  const deleteRecall = useDeletePatientRecall();
  const markCompleted = useMarkRecallCompleted();
  const cancelRecall = useCancelRecall();
  const syncFromNexHealth = useSyncPatientRecallsFromNexHealth();

  const [isNexHealthReady, setIsNexHealthReady] = useState(false);
  const [checkingNexHealth, setCheckingNexHealth] = useState(true);

  useEffect(() => {
    isNexHealthConfigured()
      .then(setIsNexHealthReady)
      .catch(() => setIsNexHealthReady(false))
      .finally(() => setCheckingNexHealth(false));
  }, []);

  // Mock data for empty state
  const mockRecalls: PatientRecall[] = [
    { id: 1, patient_id: 'p1', recall_type_id: 1, date_due: '2026-01-10', status: 'completed', notes: 'Cleaning completed on time', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2025-12-01T00:00:00Z', updated_at: '2026-01-10T00:00:00Z', patient: { id: 'p1', first_name: 'Sarah', last_name: 'Johnson', phone: '(555) 123-4567', email: null }, recall_type: { id: 1, name: 'Dental Cleaning', description: 'Regular cleaning', interval_num: 6, interval_unit: 'months' } },
    { id: 2, patient_id: 'p2', recall_type_id: 2, date_due: '2026-02-01', status: 'pending', notes: null, clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2025-12-15T00:00:00Z', updated_at: '2025-12-15T00:00:00Z', patient: { id: 'p2', first_name: 'Michael', last_name: 'Chen', phone: '(555) 234-5678', email: null }, recall_type: { id: 2, name: 'Periodontal Maintenance', description: 'Perio maintenance', interval_num: 3, interval_unit: 'months' } },
    { id: 3, patient_id: 'p3', recall_type_id: 3, date_due: '2026-02-15', status: 'pending', notes: 'Patient prefers morning appointments', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', patient: { id: 'p3', first_name: 'Emily', last_name: 'Rodriguez', phone: '(555) 345-6789', email: null }, recall_type: { id: 3, name: 'Oral Cancer Screening', description: 'Annual screening', interval_num: 12, interval_unit: 'months' } },
    { id: 4, patient_id: 'p4', recall_type_id: 1, date_due: '2026-03-01', status: 'scheduled', notes: 'Scheduled for March 1st', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2026-01-10T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', patient: { id: 'p4', first_name: 'James', last_name: 'Williams', phone: '(555) 456-7890', email: null }, recall_type: { id: 1, name: 'Dental Cleaning', description: 'Regular cleaning', interval_num: 6, interval_unit: 'months' } },
    { id: 5, patient_id: 'p5', recall_type_id: 4, date_due: '2026-01-20', status: 'pending', notes: null, clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2025-11-20T00:00:00Z', updated_at: '2025-11-20T00:00:00Z', patient: { id: 'p5', first_name: 'Lisa', last_name: 'Thompson', phone: '(555) 567-8901', email: null }, recall_type: { id: 4, name: 'Fluoride Treatment', description: 'Fluoride application', interval_num: 6, interval_unit: 'months' } },
    { id: 6, patient_id: 'p6', recall_type_id: 5, date_due: '2026-04-15', status: 'pending', notes: 'Due for full mouth series', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2026-01-15T00:00:00Z', updated_at: '2026-01-15T00:00:00Z', patient: { id: 'p6', first_name: 'Robert', last_name: 'Davis', phone: '(555) 678-9012', email: null }, recall_type: { id: 5, name: 'Full Mouth X-Ray', description: 'Complete radiographic survey', interval_num: 24, interval_unit: 'months' } },
    { id: 7, patient_id: 'p7', recall_type_id: 7, date_due: '2026-03-20', status: 'scheduled', notes: 'Crown on #14', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2026-01-20T00:00:00Z', updated_at: '2026-02-10T00:00:00Z', patient: { id: 'p7', first_name: 'Maria', last_name: 'Garcia', phone: '(555) 789-0123', email: null }, recall_type: { id: 7, name: 'Crown Follow-up', description: 'Post-crown evaluation', interval_num: 6, interval_unit: 'months' } },
    { id: 8, patient_id: 'p8', recall_type_id: 8, date_due: '2026-02-28', status: 'pending', notes: 'Implant #19 placed 6 months ago', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2026-01-28T00:00:00Z', updated_at: '2026-01-28T00:00:00Z', patient: { id: 'p8', first_name: 'David', last_name: 'Martinez', phone: '(555) 890-1234', email: null }, recall_type: { id: 8, name: 'Implant Maintenance', description: 'Implant evaluation', interval_num: 6, interval_unit: 'months' } },
    { id: 9, patient_id: 'p9', recall_type_id: 9, date_due: '2026-03-10', status: 'pending', notes: null, clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', patient: { id: 'p9', first_name: 'Jennifer', last_name: 'Anderson', phone: '(555) 901-2345', email: null }, recall_type: { id: 9, name: 'Orthodontic Check', description: 'Ortho progress evaluation', interval_num: 2, interval_unit: 'months' } },
    { id: 10, patient_id: 'p10', recall_type_id: 12, date_due: '2026-05-01', status: 'pending', notes: 'Age 8 - check sealants', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', patient: { id: 'p10', first_name: 'Tommy', last_name: 'Wilson', phone: '(555) 012-3456', email: null }, recall_type: { id: 12, name: 'Pediatric Dental Check', description: 'Pediatric examination', interval_num: 6, interval_unit: 'months' } },
    { id: 11, patient_id: 'p11', recall_type_id: 14, date_due: '2026-02-10', status: 'pending', notes: 'RCT completed Dec 2025', clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2025-12-10T00:00:00Z', updated_at: '2025-12-10T00:00:00Z', patient: { id: 'p11', first_name: 'Patricia', last_name: 'Brown', phone: '(555) 111-2222', email: null }, recall_type: { id: 14, name: 'Root Canal Follow-up', description: 'Post-endodontic evaluation', interval_num: 3, interval_unit: 'months' } },
    { id: 12, patient_id: 'p12', recall_type_id: 1, date_due: '2025-12-15', status: 'completed', notes: null, clinic_id: null, nexhealth_id: null, foreign_id: null, foreign_id_type: null, nexhealth_synced_at: null, appointment_id: null, created_at: '2025-09-15T00:00:00Z', updated_at: '2025-12-15T00:00:00Z', patient: { id: 'p12', first_name: 'Kevin', last_name: 'Taylor', phone: '(555) 222-3333', email: null }, recall_type: { id: 1, name: 'Dental Cleaning', description: 'Regular cleaning', interval_num: 6, interval_unit: 'months' } },
  ];

  const effectiveRecalls = allRecalls.length > 0 ? allRecalls : mockRecalls;

  // Filter recalls based on search term
  const filterRecalls = (recalls: PatientRecall[]) =>
    recalls.filter((recall) => {
      const patientName = `${recall.patient?.first_name || ''} ${recall.patient?.last_name || ''}`.toLowerCase();
      const recallTypeName = recall.recall_type?.name?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return patientName.includes(search) || recallTypeName.includes(search);
    });

  // Get recalls for the current tab
  const getDisplayRecalls = () => {
    switch (activeTab) {
      case 'overdue':
        return filterRecalls(allRecalls.length > 0 ? overdueRecalls : effectiveRecalls.filter(r => r.status === 'pending' && isBefore(parseISO(r.date_due), new Date())));
      case 'upcoming':
        return filterRecalls(allRecalls.length > 0 ? upcomingRecalls : effectiveRecalls.filter(r => r.status === 'pending' && isAfter(parseISO(r.date_due), new Date())));
      case 'pending':
        return filterRecalls(effectiveRecalls.filter((r) => r.status === 'pending'));
      case 'scheduled':
        return filterRecalls(effectiveRecalls.filter((r) => r.status === 'scheduled'));
      case 'completed':
        return filterRecalls(effectiveRecalls.filter((r) => r.status === 'completed'));
      default:
        return filterRecalls(effectiveRecalls);
    }
  };

  const displayRecalls = getDisplayRecalls();

  // Stats
  const pendingCount = effectiveRecalls.filter((r) => r.status === 'pending').length;
  const overdueCount = allRecalls.length > 0 ? overdueRecalls.length : effectiveRecalls.filter(r => r.status === 'pending' && isBefore(parseISO(r.date_due), new Date())).length;
  const scheduledCount = effectiveRecalls.filter((r) => r.status === 'scheduled').length;

  const handleDeleteClick = (recall: PatientRecall) => {
    setSelectedRecall(recall);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedRecall) {
      await deleteRecall.mutateAsync(selectedRecall.id);
      setIsDeleteDialogOpen(false);
      setSelectedRecall(null);
    }
  };

  const handleMarkCompleted = async (recall: PatientRecall) => {
    await markCompleted.mutateAsync(recall.id);
  };

  const handleCancel = async (recall: PatientRecall) => {
    await cancelRecall.mutateAsync({ id: recall.id });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Patient Recalls</h1>
        <Card className="p-6">
          <div className="text-center text-destructive">
            <p className="font-semibold">Error loading recalls</p>
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
          <h1 className="text-xl font-bold flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Patient Recalls
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? 'Loading...' : `${allRecalls.length} total recalls`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Recall
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Recall
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => syncFromNexHealth.mutate()}
                disabled={syncFromNexHealth.isPending || !isNexHealthReady}
              >
                <CloudDownload className="h-4 w-4 mr-2" />
                Sync NexHealth
                {!isNexHealthReady && !checkingNexHealth && (
                  <span className="ml-1 text-xs text-muted-foreground">(Not configured)</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-red-200 dark:border-red-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scheduled</p>
              <p className="text-2xl font-bold">{scheduledCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming (30d)</p>
              <p className="text-2xl font-bold">{upcomingRecalls.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b px-4">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="overdue" className="text-red-600">
                Overdue
                {overdueCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {overdueCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : displayRecalls.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No recalls found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Try a different search term' : 'No recalls in this category'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Recall Type</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRecalls.map((recall, index) => {
                    const isOverdue =
                      recall.status === 'pending' &&
                      isBefore(parseISO(recall.date_due), new Date());
                    
                    return (
                      <motion.tr
                        key={recall.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`border-b hover:bg-muted/50 ${isOverdue ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {recall.patient?.first_name} {recall.patient?.last_name}
                              </p>
                              {recall.patient?.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {recall.patient.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {recall.recall_type?.name || '-'}
                        </TableCell>
                        <TableCell>
                          <div className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            {format(parseISO(recall.date_due), 'MMM d, yyyy')}
                            {isOverdue && (
                              <p className="text-xs">Overdue</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRecallStatusVariant(recall.status)}>
                            {recall.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {recall.notes || '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {recall.status === 'pending' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleMarkCompleted(recall)}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Mark Completed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCancel(recall)}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(recall)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Add Dialog */}
      <AddPatientRecallDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recall</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recall for{' '}
              {selectedRecall?.patient?.first_name} {selectedRecall?.patient?.last_name}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRecall.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

