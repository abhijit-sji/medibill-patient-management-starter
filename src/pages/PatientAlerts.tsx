/**
 * Patient Alerts Page
 * View and manage all patient alerts across the clinic
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
  Search,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  User,
  BellOff,
  BellRing,
  Info as InfoIcon,
  CloudDownload,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  useAllActiveAlerts,
  useAlertsBySeverity,
  useDisablePatientAlert,
  useEnablePatientAlert,
  useDeletePatientAlert,
} from '@/hooks/usePatientAlerts';
import {
  getAlertSeverityVariant,
  getAlertSeverityColor,
  type PatientAlert,
  type AlertSeverity,
} from '@/services/patient-alerts.service';
import { isNexHealthConfigured } from '@/lib/nexhealth-config';

const mockAlerts = [
  { id: 90001, patient_id: 'p1', patient: { id: 'p1', first_name: 'Sarah', last_name: 'Johnson' }, note: 'Severe latex allergy - use nitrile gloves only', severity: 'critical' as AlertSeverity, is_active: true, created_at: '2025-02-20T08:30:00Z', updated_at: '2025-02-20T08:30:00Z', clinic_id: null },
  { id: 90002, patient_id: 'p2', patient: { id: 'p2', first_name: 'Michael', last_name: 'Chen' }, note: 'History of endocarditis - requires antibiotic premedication', severity: 'critical' as AlertSeverity, is_active: true, created_at: '2025-02-18T10:15:00Z', updated_at: '2025-02-18T10:15:00Z', clinic_id: null },
  { id: 90003, patient_id: 'p3', patient: { id: 'p3', first_name: 'Robert', last_name: 'Williams' }, note: 'Uncontrolled diabetes - coordinate with endocrinologist before surgery', severity: 'critical' as AlertSeverity, is_active: true, created_at: '2025-02-15T14:00:00Z', updated_at: '2025-02-15T14:00:00Z', clinic_id: null },
  { id: 90004, patient_id: 'p4', patient: { id: 'p4', first_name: 'Emily', last_name: 'Davis' }, note: 'Patient on blood thinners (Warfarin) - consult physician before extractions', severity: 'warning' as AlertSeverity, is_active: true, created_at: '2025-02-19T09:00:00Z', updated_at: '2025-02-19T09:00:00Z', clinic_id: null },
  { id: 90005, patient_id: 'p5', patient: { id: 'p5', first_name: 'James', last_name: 'Wilson' }, note: 'Moderate anxiety - may require sedation for procedures', severity: 'warning' as AlertSeverity, is_active: true, created_at: '2025-02-17T11:30:00Z', updated_at: '2025-02-17T11:30:00Z', clinic_id: null },
  { id: 90006, patient_id: 'p6', patient: { id: 'p6', first_name: 'Patricia', last_name: 'Martinez' }, note: 'Bisphosphonate therapy - risk of osteonecrosis', severity: 'warning' as AlertSeverity, is_active: true, created_at: '2025-02-16T13:45:00Z', updated_at: '2025-02-16T13:45:00Z', clinic_id: null },
  { id: 90007, patient_id: 'p7', patient: { id: 'p7', first_name: 'Jennifer', last_name: 'Lee' }, note: 'Pregnant - 2nd trimester, avoid elective radiographs', severity: 'warning' as AlertSeverity, is_active: true, created_at: '2025-02-14T08:00:00Z', updated_at: '2025-02-14T08:00:00Z', clinic_id: null },
  { id: 90008, patient_id: 'p8', patient: { id: 'p8', first_name: 'David', last_name: 'Brown' }, note: 'Prefers morning appointments only', severity: 'info' as AlertSeverity, is_active: true, created_at: '2025-02-13T10:00:00Z', updated_at: '2025-02-13T10:00:00Z', clinic_id: null },
  { id: 90009, patient_id: 'p9', patient: { id: 'p9', first_name: 'Maria', last_name: 'Garcia' }, note: 'Requires interpreter - Spanish speaking', severity: 'info' as AlertSeverity, is_active: true, created_at: '2025-02-12T09:30:00Z', updated_at: '2025-02-12T09:30:00Z', clinic_id: null },
  { id: 90010, patient_id: 'p10', patient: { id: 'p10', first_name: 'Christopher', last_name: 'Taylor' }, note: 'Orthodontic treatment in progress with Dr. Smith', severity: 'info' as AlertSeverity, is_active: true, created_at: '2025-02-11T14:15:00Z', updated_at: '2025-02-11T14:15:00Z', clinic_id: null },
  { id: 90011, patient_id: 'p11', patient: { id: 'p11', first_name: 'Amanda', last_name: 'Anderson' }, note: 'Insurance changes effective next month', severity: 'info' as AlertSeverity, is_active: true, created_at: '2025-02-10T11:00:00Z', updated_at: '2025-02-10T11:00:00Z', clinic_id: null },
  { id: 90012, patient_id: 'p12', patient: { id: 'p12', first_name: 'Daniel', last_name: 'Thomas' }, note: 'Patient requested treatment plan review at next visit', severity: 'info' as AlertSeverity, is_active: true, created_at: '2025-02-09T15:30:00Z', updated_at: '2025-02-09T15:30:00Z', clinic_id: null },
];

export default function PatientAlerts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | AlertSeverity>('all');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<PatientAlert | null>(null);
  const [isNexHealthReady, setIsNexHealthReady] = useState(false);
  const [checkingNexHealth, setCheckingNexHealth] = useState(true);

  useEffect(() => {
    isNexHealthConfigured()
      .then(setIsNexHealthReady)
      .catch(() => setIsNexHealthReady(false))
      .finally(() => setCheckingNexHealth(false));
  }, []);

  const { data: allAlerts = [], isLoading, error, refetch } = useAllActiveAlerts();
  const { data: criticalAlerts = [] } = useAlertsBySeverity('critical');
  const { data: warningAlerts = [] } = useAlertsBySeverity('warning');
  const { data: infoAlerts = [] } = useAlertsBySeverity('info');

  const disableAlert = useDisablePatientAlert();
  const enableAlert = useEnablePatientAlert();
  const deleteAlert = useDeletePatientAlert();

  const useMock = allAlerts.length === 0 && !isLoading;
  const displayAllAlerts = useMock ? mockAlerts as unknown as PatientAlert[] : allAlerts;
  const displayCritical = useMock ? (mockAlerts.filter(a => a.severity === 'critical') as unknown as PatientAlert[]) : criticalAlerts;
  const displayWarning = useMock ? (mockAlerts.filter(a => a.severity === 'warning') as unknown as PatientAlert[]) : warningAlerts;
  const displayInfo = useMock ? (mockAlerts.filter(a => a.severity === 'info') as unknown as PatientAlert[]) : infoAlerts;

  // Filter alerts based on search and tab
  const getDisplayAlerts = (): PatientAlert[] => {
    let alerts: PatientAlert[];
    switch (activeTab) {
      case 'critical':
        alerts = displayCritical;
        break;
      case 'warning':
        alerts = displayWarning;
        break;
      case 'info':
        alerts = displayInfo;
        break;
      default:
        alerts = displayAllAlerts;
    }

    if (!searchTerm) return alerts;

    return alerts.filter((alert) => {
      const patientName = `${alert.patient?.first_name || ''} ${alert.patient?.last_name || ''}`.toLowerCase();
      const note = alert.note.toLowerCase();
      const search = searchTerm.toLowerCase();
      return patientName.includes(search) || note.includes(search);
    });
  };

  const displayAlerts = getDisplayAlerts();

  const handleDisable = async (alert: PatientAlert) => {
    await disableAlert.mutateAsync(alert.id);
  };

  const handleEnable = async (alert: PatientAlert) => {
    await enableAlert.mutateAsync(alert.id);
  };

  const handleDeleteClick = (alert: PatientAlert) => {
    setSelectedAlert(alert);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedAlert) {
      await deleteAlert.mutateAsync(selectedAlert.id);
      setIsDeleteDialogOpen(false);
      setSelectedAlert(null);
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Patient Alerts</h1>
        <Card className="p-6">
          <div className="text-center text-destructive">
            <p className="font-semibold">Error loading alerts</p>
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
            <Bell className="h-5 w-5 text-primary" />
            Patient Alerts
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? 'Loading...' : `${displayAllAlerts.length} active alerts`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || !isNexHealthReady}>
            <CloudDownload className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sync NexHealth
            {!isNexHealthReady && !checkingNexHealth && (
              <span className="ml-1 text-xs text-muted-foreground">(Not configured)</span>
            )}
          </Button>
        </div>
      </div>

       {/* Descriptive Info Card */}
       <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
         <div className="flex items-start gap-3">
           <InfoIcon className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
           <p className="text-sm text-muted-foreground">
             Patient Alerts are System Notifications for office staff that generally contain notes 
             or important pieces of information about the patient. Patient Alerts notify via system 
             notification when a staff member accesses the patient file in the health record system.
           </p>
         </div>
       </Card>
 
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Active</p>
              <p className="text-2xl font-bold">{displayAllAlerts.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-red-200 dark:border-red-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="text-2xl font-bold text-red-600">{displayCritical.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-yellow-200 dark:border-yellow-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Warning</p>
              <p className="text-2xl font-bold text-yellow-600">{displayWarning.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Info</p>
              <p className="text-2xl font-bold">{displayInfo.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="border-b px-4">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="all">All Alerts</TabsTrigger>
              <TabsTrigger value="critical" className="text-red-600">
                Critical
                {displayCritical.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {displayCritical.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="warning" className="text-yellow-600">
                Warning
              </TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : displayAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No alerts found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try a different search term' : 'No active alerts in this category'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Alert</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayAlerts.map((alert, index) => (
                    <motion.tr
                      key={alert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {alert.patient?.first_name} {alert.patient?.last_name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`p-3 rounded-lg border ${getAlertSeverityColor(alert.severity)}`}>
                          <div className="flex items-start gap-2">
                            {getSeverityIcon(alert.severity)}
                            <p className="text-sm">{alert.note}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAlertSeverityVariant(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {alert.is_active ? (
                              <DropdownMenuItem onClick={() => handleDisable(alert)}>
                                <BellOff className="h-4 w-4 mr-2" />
                                Disable Alert
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleEnable(alert)}>
                                <BellRing className="h-4 w-4 mr-2" />
                                Enable Alert
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(alert)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this alert? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAlert.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
