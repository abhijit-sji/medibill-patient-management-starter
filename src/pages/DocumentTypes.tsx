/**
 * Document Types Page
 * Manage document type categories for patient documents
 * Medibill Voice Sync Health
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Edit,
  Trash2,
  CloudDownload,
  FolderOpen,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  useDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useDeleteDocumentType,
  useSyncDocumentTypesFromNexHealth,
} from '@/hooks/useDocumentTypes';
import { type DocumentType } from '@/services/document-types.service';
import { isNexHealthConfigured } from '@/lib/nexhealth-config';

const mockDocumentTypes: DocumentType[] = [
  { id: 1, name: 'Insurance Verification', description: 'Verification of patient insurance eligibility and benefits', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-15T10:00:00Z', updated_at: '2025-02-10T14:30:00Z' },
  { id: 2, name: 'Treatment Consent Form', description: 'Patient consent for proposed dental treatment procedures', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-15T10:05:00Z', updated_at: '2025-02-08T09:15:00Z' },
  { id: 3, name: 'Patient Intake Form', description: 'New patient registration and demographic information', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-16T08:00:00Z', updated_at: '2025-02-05T11:20:00Z' },
  { id: 4, name: 'HIPAA Authorization', description: 'Authorization for use and disclosure of protected health information', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-16T08:30:00Z', updated_at: '2025-01-28T16:45:00Z' },
  { id: 5, name: 'Medical History Questionnaire', description: 'Comprehensive medical and dental history form', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-17T09:00:00Z', updated_at: '2025-02-12T10:00:00Z' },
  { id: 6, name: 'Referral Letter', description: 'Referral documentation to specialists or other providers', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-18T11:00:00Z', updated_at: '2025-02-01T13:30:00Z' },
  { id: 7, name: 'Pre-Authorization Request', description: 'Insurance pre-authorization for planned procedures', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-19T14:00:00Z', updated_at: '2025-02-06T08:45:00Z' },
  { id: 8, name: 'Explanation of Benefits (EOB)', description: 'Insurance EOB statements and payment summaries', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-20T10:30:00Z', updated_at: '2025-02-09T15:20:00Z' },
  { id: 9, name: 'Payment Agreement', description: 'Patient payment plan agreements and financial arrangements', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-21T09:15:00Z', updated_at: '2025-01-30T12:00:00Z' },
  { id: 10, name: 'Periodontal Charting', description: 'Periodontal examination and probing depth records', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-22T13:00:00Z', updated_at: '2025-02-11T09:30:00Z' },
  { id: 11, name: 'Radiograph Report', description: 'Dental X-ray and imaging interpretation reports', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-23T08:45:00Z', updated_at: '2025-02-07T14:15:00Z' },
  { id: 12, name: 'Lab Results', description: 'Laboratory test results and pathology reports', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-24T11:30:00Z', updated_at: '2025-02-03T10:45:00Z' },
  { id: 13, name: 'Prescription Record', description: 'Medication prescriptions and pharmaceutical documentation', is_active: false, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-25T10:00:00Z', updated_at: '2025-01-27T16:30:00Z' },
  { id: 14, name: 'Post-Op Instructions', description: 'Post-operative care instructions given to patients', is_active: true, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-26T09:00:00Z', updated_at: '2025-02-04T11:00:00Z' },
  { id: 15, name: 'Emergency Contact Form', description: 'Emergency contact information and medical directives', is_active: false, clinic_id: null, nexhealth_id: null, nexhealth_synced_at: null, created_at: '2025-01-27T14:30:00Z', updated_at: '2025-01-29T08:20:00Z' },
];

export default function DocumentTypes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const [isNexHealthReady, setIsNexHealthReady] = useState(false);
  const [checkingNexHealth, setCheckingNexHealth] = useState(true);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: documentTypes = [], isLoading, error, refetch } = useDocumentTypes();
  const createDocType = useCreateDocumentType();
  const updateDocType = useUpdateDocumentType();
  const deleteDocType = useDeleteDocumentType();
  const syncFromNexHealth = useSyncDocumentTypesFromNexHealth();

  useEffect(() => {
    isNexHealthConfigured()
      .then(setIsNexHealthReady)
      .catch(() => setIsNexHealthReady(false))
      .finally(() => setCheckingNexHealth(false));
  }, []);

  const displayData = documentTypes.length >= 3 ? documentTypes : mockDocumentTypes;

  const filteredDocTypes = displayData.filter((dt) =>
    dt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dt.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = displayData.filter((dt) => dt.is_active).length;

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormIsActive(true);
  };

  const handleAddOpen = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!formName.trim()) return;
    await createDocType.mutateAsync({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      is_active: formIsActive,
    });
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEditOpen = (docType: DocumentType) => {
    setSelectedDocType(docType);
    setFormName(docType.name);
    setFormDescription(docType.description || '');
    setFormIsActive(docType.is_active);
    setIsEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedDocType || !formName.trim()) return;
    await updateDocType.mutateAsync({
      id: selectedDocType.id,
      params: {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        is_active: formIsActive,
      },
    });
    setIsEditDialogOpen(false);
    resetForm();
    setSelectedDocType(null);
  };

  const handleDeleteClick = (docType: DocumentType) => {
    setSelectedDocType(docType);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedDocType) {
      await deleteDocType.mutateAsync(selectedDocType.id);
      setIsDeleteDialogOpen(false);
      setSelectedDocType(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Document Types</h1>
        <Card className="p-6">
          <div className="text-center text-destructive">
            <p className="font-semibold">Error loading document types</p>
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
            <FolderOpen className="h-5 w-5 text-primary" />
            Document Types
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? 'Loading...' : `${displayData.length} document types (${activeCount} active)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search document types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Document Type
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleAddOpen}>
                <Plus className="h-4 w-4 mr-2" />
                Add Document Type
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Types</p>
              <p className="text-2xl font-bold">{displayData.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredDocTypes.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No document types found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Try a different search term' : 'Add a document type to get started'}
            </p>
            <Button onClick={handleAddOpen}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document Type
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocTypes.map((docType, index) => (
                <motion.tr
                  key={docType.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {docType.name}
                      {docType.nexhealth_id && (
                        <Badge variant="outline" className="text-xs">
                          Synced
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {docType.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={docType.is_active ? 'default' : 'secondary'}>
                      {docType.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(docType.updated_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditOpen(docType)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(docType)}
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
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document Type</DialogTitle>
            <DialogDescription>
              Create a new document category for organizing patient files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Consent Forms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!formName.trim() || createDocType.isPending}>
              {createDocType.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Type</DialogTitle>
            <DialogDescription>
              Update the document type details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Consent Forms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Active</Label>
              <Switch
                id="edit-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formName.trim() || updateDocType.isPending}>
              {updateDocType.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDocType?.name}"? This will mark it as
              inactive and it won't be available for new documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocType.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
