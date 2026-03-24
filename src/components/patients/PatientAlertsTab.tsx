/**
 * Patient Alerts Tab
 * Component to display and manage patient alerts in patient detail view
 * Medibill Voice Sync Health
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Bell,
  Plus,
  MoreHorizontal,
  AlertTriangle,
  AlertCircle,
  Info,
  BellOff,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePatientAlerts, useDisablePatientAlert, useDeletePatientAlert } from '@/hooks/usePatientAlerts';
import { getAlertSeverityColor, type PatientAlert, type AlertSeverity } from '@/services/patient-alerts.service';
import { AddAlertDialog } from '@/components/alerts/AddAlertDialog';

interface PatientAlertsTabProps {
  patientId: string;
  patientName: string;
}

export function PatientAlertsTab({ patientId, patientName }: PatientAlertsTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<PatientAlert | null>(null);

  const { data: alerts = [], isLoading } = usePatientAlerts(patientId);
  const disableAlert = useDisablePatientAlert();
  const deleteAlert = useDeletePatientAlert();

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

  const handleDisable = async (alert: PatientAlert) => {
    await disableAlert.mutateAsync(alert.id);
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Patient Alerts</h3>
          {alerts.length > 0 && (
            <Badge variant="secondary">{alerts.length}</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Alert
        </Button>
      </div>

      {alerts.length === 0 ? (
        <Card className="p-6 text-center">
          <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No active alerts</p>
          <Button variant="link" size="sm" onClick={() => setIsAddDialogOpen(true)}>
            Add an alert
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-4 ${getAlertSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <p className="text-sm">{alert.note}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDisable(alert)}>
                      <BellOff className="h-4 w-4 mr-2" />
                      Disable
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(alert)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Alert Dialog */}
      <AddAlertDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        patientId={patientId}
        patientName={patientName}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this alert? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

