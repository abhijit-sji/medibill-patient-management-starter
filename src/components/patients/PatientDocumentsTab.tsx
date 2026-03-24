/**
 * Patient Documents Tab
 * Component to display and manage patient documents in patient detail view
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
  FileText,
  Plus,
  MoreHorizontal,
  Download,
  Trash2,
  ExternalLink,
  Image,
  File,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePatientDocuments, useDeletePatientDocument } from '@/hooks/usePatientDocuments';
import { formatFileSize, type PatientDocument } from '@/services/patient-documents.service';
import { UploadDocumentDialog } from '@/components/documents/UploadDocumentDialog';

interface PatientDocumentsTabProps {
  patientId: string;
  patientName: string;
}

export function PatientDocumentsTab({ patientId, patientName }: PatientDocumentsTabProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<PatientDocument | null>(null);

  const { data: documents = [], isLoading } = usePatientDocuments(patientId);
  const deleteDocument = useDeletePatientDocument();

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-5 w-5" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes('image')) return <Image className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const handleDownload = (doc: PatientDocument) => {
    window.open(doc.file_url, '_blank');
  };

  const handleDeleteClick = (doc: PatientDocument) => {
    setSelectedDocument(doc);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedDocument) {
      await deleteDocument.mutateAsync({ id: selectedDocument.id });
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Documents</h3>
          {documents.length > 0 && (
            <Badge variant="secondary">{documents.length}</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setIsUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Upload
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card className="p-6 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No documents uploaded</p>
          <Button variant="link" size="sm" onClick={() => setIsUploadDialogOpen(true)}>
            Upload a document
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    {getFileIcon(doc.file_type)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {doc.document_type?.name && (
                        <Badge variant="outline" className="text-xs">
                          {doc.document_type.name}
                        </Badge>
                      )}
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.open(doc.file_url, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(doc)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {doc.notes && (
                <p className="text-xs text-muted-foreground mt-2 pl-13">{doc.notes}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDocumentDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        patientId={patientId}
        patientName={patientName}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDocument?.filename}"? This will also remove
              the file from storage.
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

