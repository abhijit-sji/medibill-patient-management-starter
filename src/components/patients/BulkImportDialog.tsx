/**
 * Bulk Import Dialog Component
 * Multi-step dialog for importing patients from CSV/Excel files
 * Medibill Voice Sync Health
 */

import { useState, useRef } from 'react';
import { useBulkImportPatients } from '@/hooks/useData';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  parseCSV,
  parseExcel,
  mapColumns,
  validateImportData,
  downloadCSVTemplate,
  type ImportRow,
} from '@/lib/utils/import';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { PatientFormData } from '@/lib/schemas/patient.schema';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
}

type ImportStep = 'upload' | 'mapping' | 'validation' | 'importing' | 'complete';

export function BulkImportDialog({ open, onOpenChange, clinicId }: BulkImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Map<number, keyof PatientFormData>>(new Map());
  const [importResult, setImportResult] = useState<{ rows: ImportRow[]; validCount: number; errorCount: number } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  
  const bulkImport = useBulkImportPatients();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Please upload a CSV or Excel file (.csv, .xls, .xlsx)');
      return;
    }

    // Validate file size (5MB limit)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);

    try {
      let parsedData: Record<string, any>[];
      
      if (fileExtension === '.csv') {
        parsedData = await parseCSV(selectedFile);
      } else {
        parsedData = await parseExcel(selectedFile);
      }

      if (parsedData.length === 0) {
        toast.error('File appears to be empty');
        return;
      }

      setRawData(parsedData);
      
      // Auto-map columns
      const headers = Object.keys(parsedData[0] || {});
      const mapping = mapColumns(headers);
      setColumnMapping(mapping);

      // Validate data
      const result = validateImportData(parsedData, mapping);
      setImportResult(result);

      setStep('validation');
      toast.success(`File loaded: ${parsedData.length} rows found`);
    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast.error(error?.message || 'Failed to parse file');
    }
  };

  const handleDownloadTemplate = () => {
    downloadCSVTemplate();
    toast.success('Template downloaded');
  };

  const handleImport = async () => {
    if (!importResult) return;

    const validRows = importResult.rows.filter((row) => row.isValid);
    
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setStep('importing');
    setImportProgress(0);

    try {
      // Convert validated data to patient insert format
      const patients: Omit<PatientFormData, 'is_active'>[] = validRows.map((row) => {
        const data = row.data as PatientFormData;
        return {
          first_name: data.first_name,
          last_name: data.last_name,
          dob: data.dob,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip: data.zip || null,
          insurance_provider: data.insurance_provider || null,
          insurance_id: data.insurance_id || null,
          insurance_group: data.insurance_group || null,
          emergency_contact_name: data.emergency_contact_name || null,
          emergency_contact_phone: data.emergency_contact_phone || null,
          emergency_contact_relationship: data.emergency_contact_relationship || null,
          allergies: data.allergies || null,
          medications: data.medications || null,
          medical_history: data.medical_history || null,
          notes: data.notes || null,
        };
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const result = await bulkImport.mutateAsync({
        patients: patients as any,
        clinicId: clinicId || '00000000-0000-0000-0000-000000000001',
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      toast.success(
        `Import complete: ${result.success} patients imported, ${result.failed} failed`
      );

      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }

      setStep('complete');
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error?.message || 'Failed to import patients');
      setStep('validation');
    }
  };

  const handleReset = () => {
    setFile(null);
    setRawData([]);
    setColumnMapping(new Map());
    setImportResult(null);
    setImportProgress(0);
    setStep('upload');
  };

  const handleClose = () => {
    if (step === 'importing') {
      toast.warning('Import in progress. Please wait...');
      return;
    }
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Patients</DialogTitle>
          <DialogDescription>
            Import multiple patients from a CSV or Excel file
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file with patient data
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors border-muted-foreground/25 hover:border-primary/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Click to select a file
              </p>
              <p className="text-sm text-muted-foreground">
                Supports CSV, XLS, and XLSX files (max 5MB)
              </p>
            </div>

            {file && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  {file.name.endsWith('.csv') ? (
                    <FileText className="h-5 w-5 text-blue-500" />
                  ) : (
                    <FileSpreadsheet className="h-5 w-5 text-green-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Validation Preview */}
        {step === 'validation' && importResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Validation Results</h3>
                <p className="text-sm text-muted-foreground">
                  Review the validation results before importing
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {importResult.validCount} Valid
                </Badge>
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {importResult.errorCount} Errors
                </Badge>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Row</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.rows.slice(0, 20).map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`border-b ${
                        row.isValid ? 'bg-background' : 'bg-destructive/5'
                      }`}
                    >
                      <td className="px-4 py-2">{row.rowNumber}</td>
                      <td className="px-4 py-2">
                        {row.data.first_name} {row.data.last_name}
                      </td>
                      <td className="px-4 py-2">
                        {row.isValid ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Invalid
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {row.errors.length > 0 && (
                          <div className="flex items-start gap-1">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                            <div className="text-xs text-destructive">
                              {row.errors.slice(0, 2).join(', ')}
                              {row.errors.length > 2 && ` +${row.errors.length - 2} more`}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importResult.rows.length > 20 && (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Showing first 20 rows. {importResult.rows.length - 20} more rows...
                </p>
              )}
            </div>

            {importResult.validCount === 0 && (
              <Card className="p-4 bg-destructive/10 border-destructive">
                <p className="text-sm text-destructive">
                  No valid rows found. Please fix the errors in your file and try again.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
              <h3 className="text-lg font-semibold mb-2">Importing Patients...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we import your patient data
              </p>
            </div>
            <Progress value={importProgress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {importProgress}% complete
            </p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importResult && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Successfully imported {importResult.validCount} patients
                </p>
                {importResult.errorCount > 0 && (
                  <p className="text-sm text-destructive">
                    {importResult.errorCount} rows had errors and were skipped
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </>
          )}
          {step === 'validation' && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Upload Different File
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importResult || importResult.validCount === 0}
              >
                Import {importResult?.validCount || 0} Valid Patients
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

