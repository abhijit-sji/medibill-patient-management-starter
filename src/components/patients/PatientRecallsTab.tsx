/**
 * Patient Recalls Tab
 * Component to display and manage patient recalls in patient detail view
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
  CalendarCheck,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';
import {
  usePatientRecallsForPatient,
  useMarkRecallCompleted,
  useCancelRecall,
  useDeletePatientRecall,
} from '@/hooks/usePatientRecalls';
import { getRecallStatusVariant, type PatientRecall } from '@/services/patient-recalls.service';
import { AddPatientRecallDialog } from '@/components/recalls/AddPatientRecallDialog';

interface PatientRecallsTabProps {
  patientId: string;
  patientName: string;
}

export function PatientRecallsTab({ patientId, patientName }: PatientRecallsTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecall, setSelectedRecall] = useState<PatientRecall | null>(null);

  const { data: recalls = [], isLoading } = usePatientRecallsForPatient(patientId);
  const markCompleted = useMarkRecallCompleted();
  const cancelRecall = useCancelRecall();
  const deleteRecall = useDeletePatientRecall();

  const handleMarkCompleted = async (recall: PatientRecall) => {
    await markCompleted.mutateAsync(recall.id);
  };

  const handleCancel = async (recall: PatientRecall) => {
    await cancelRecall.mutateAsync({ id: recall.id });
  };

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

  const pendingRecalls = recalls.filter((r) => r.status === 'pending');
  const completedRecalls = recalls.filter((r) => r.status === 'completed');

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Recalls</h3>
          {pendingRecalls.length > 0 && (
            <Badge variant="secondary">{pendingRecalls.length} pending</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Recall
        </Button>
      </div>

      {recalls.length === 0 ? (
        <Card className="p-6 text-center">
          <CalendarCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No recalls scheduled</p>
          <Button variant="link" size="sm" onClick={() => setIsAddDialogOpen(true)}>
            Schedule a recall
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {recalls.map((recall) => {
            const isOverdue =
              recall.status === 'pending' &&
              isBefore(parseISO(recall.date_due), new Date());

            return (
              <Card
                key={recall.id}
                className={`p-3 ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      recall.status === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : isOverdue
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-primary/10'
                    }`}>
                      {recall.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : isOverdue ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {recall.recall_type?.name || 'General Recall'}
                        </p>
                        <Badge variant={getRecallStatusVariant(recall.status)}>
                          {isOverdue && recall.status === 'pending' ? 'overdue' : recall.status}
                        </Badge>
                      </div>
                      <p className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        Due: {format(parseISO(recall.date_due), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {recall.status === 'pending' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMarkCompleted(recall)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCancel(recall)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(recall)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {recall.notes && (
                  <p className="text-xs text-muted-foreground mt-2 pl-13">{recall.notes}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Recall Dialog */}
      <AddPatientRecallDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        preselectedPatientId={patientId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recall</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recall? This action cannot be undone.
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

