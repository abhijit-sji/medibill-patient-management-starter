# Patient Management - Integration Guide

## Prerequisites

- Node.js 18+ and npm
- Supabase project with `patients`, `patient_alerts`, `patient_recalls`, `recall_types`, `document_types` tables
- Environment variables configured (see below)

## Environment Variables

```bash
# Required (frontend .env.local)
VITE_SUPABASE_URL=https://qdnpztafkuprifwwqcgj.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>

# Required (Supabase Edge Function secrets)
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Optional (for self-registration email delivery)
SENDGRID_API_KEY=<key>
RESEND_API_KEY=<key>

# Optional (for registration link base URL)
PUBLIC_SITE_URL=https://ephysician.biz
```

## Installation

```bash
# Install all project dependencies
npm install --legacy-peer-deps
```

Key npm packages used by this module:
- `@tanstack/react-table` - Data table with sorting, filtering, pagination
- `react-signature-canvas` - Electronic signature capture on registration
- `canvas-confetti` - Registration completion celebration effect
- `zod` - Patient form validation (`src/lib/schemas/patient.schema.ts`)

## Database Setup

Run migrations in order from `supabase/migrations/`. The initial schema creates the `patients` table. Subsequent migrations add alerts, recalls, and document types.

```bash
# Verify database tables exist
node scripts/testing/check-database.mjs
```

## Edge Function Deployment

```bash
# Deploy all patient-related edge functions
supabase functions deploy generate-registration-token --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy send-registration-link --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy complete-registration --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy bulk-import-patients --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy search-patients --project-ref qdnpztafkuprifwwqcgj
supabase functions deploy send-welcome-email --project-ref qdnpztafkuprifwwqcgj
```

## Step-by-Step Integration

### 1. Adding a Patient Manually

1. Navigate to `/patients`
2. Click "Add Patient" dropdown, select "Add Patient"
3. Fill in the `AddPatientDialog` form (first name, last name, DOB, phone required)
4. Form is validated against `patientSchema` from `src/lib/schemas/patient.schema.ts`
5. On submit, `createPatient()` from `patients.service.ts` inserts the record
6. React Query cache is invalidated, table refreshes

### 2. Bulk Importing Patients

1. Click "Add Patient" dropdown, select "Bulk Import (CSV/Excel)"
2. Upload a CSV or Excel file with columns matching patient fields
3. `BulkImportDialog` parses the file and calls `bulkCreatePatients()`
4. Service checks each patient for phone duplicates across multiple format variants
5. Non-duplicate patients are inserted in batches of 50
6. Results display success/failed/duplicate counts with detailed error messages

### 3. Setting Up Patient Self-Registration

1. **Generate a registration token** by invoking the `generate-registration-token` edge function:
   ```typescript
   const { data } = await supabase.functions.invoke('generate-registration-token', {
     body: {
       appointmentId: 'uuid-of-appointment', // optional
       patientPhone: '+15551234567',          // at least one identifier required
       patientEmail: 'patient@example.com',   // at least one identifier required
       expiresInHours: 72,                    // default 72
       clinicId: '00000000-0000-0000-0000-000000000001'
     }
   });
   // Returns: { registrationLink, session: { id, token, expiresAt } }
   ```

2. **Send the link** via SMS or email using `send-registration-link`

3. **Patient completes registration** at `/patients/register?token=xxx`:
   - Step 1: Personal information (name, DOB, phone, email, address)
   - Step 2: Insurance (upload card with simulated OCR, or manual entry)
   - Step 3: Review and electronic signature

4. On completion, `complete-registration` edge function creates the patient record and marks the kiosk session as used.

### 4. Managing Patient Alerts

```typescript
import { createPatientAlert } from '@/services/patient-alerts.service';

// Create an alert
await createPatientAlert({
  patient_id: 'uuid',
  note: 'Severe latex allergy - use nitrile gloves only',
  severity: 'critical',  // 'info' | 'warning' | 'critical'
  clinic_id: clinicId,
  created_by: userId,
});
```

Alerts can be disabled (soft delete with `disabled_at` timestamp) or hard deleted.

### 5. Managing Recalls

```typescript
import { createPatientRecall } from '@/services/patient-recalls.service';

await createPatientRecall({
  patient_id: 'uuid',
  recall_type_id: 1,           // FK to recall_types
  date_due: '2026-06-15',
  status: 'pending',           // pending | scheduled | completed | cancelled
  notes: 'Patient prefers morning appointments',
});
```

### 6. NexHealth Sync

From the Patients page, click "Sync NexHealth" in the dropdown. This calls `syncNexHealthPatients()` from `nexhealth-patients.service.ts`, which:
1. Fetches patients from the NexHealth API
2. Upserts them into the local `patients` table
3. Sets `nexhealth_patient_id`, `nexhealth_synced_at`, `nexhealth_sync_status`

NexHealth configuration is checked via `isNexHealthConfigured()` from `src/lib/nexhealth-config.ts`.

## API Reference

### Service Functions (`patients.service.ts`)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `getAllPatients` | `clinicId, { page, pageSize }` | `{ patients, total, page, pageSize, totalPages }` | Paginated patient list |
| `getPatientById` | `patientId` | `Patient \| null` | Single patient lookup |
| `findPatientByPhone` | `phone, clinicId` | `Patient \| null` | Phone-based lookup (voice AI) |
| `createPatient` | `patient, clinicId` | `Patient` | Create new patient |
| `updatePatient` | `patientId, updates` | `Patient` | Update patient fields |
| `deletePatient` | `patientId` | `Patient` | Soft delete (is_active=false) |
| `hardDeletePatient` | `patientId` | `void` | Permanent deletion |
| `removeFromPlatform` | `patientId` | `Patient` | Soft delete NexHealth patient |
| `searchPatients` | `query, clinicId` | `Patient[]` | Search by name/phone/email |
| `bulkCreatePatients` | `patients[], clinicId` | `{ success, failed, duplicates, errors }` | Bulk import with dedup |
| `togglePatientStatus` | `patientId, isActive` | `Patient` | Toggle active/inactive |
| `bulkDeactivatePatients` | `patientIds[]` | `{ success, failed }` | Bulk deactivate |
| `bulkDeletePatients` | `patients[]` | `{ success, failed }` | Bulk delete (soft/hard) |
| `getPatientStats` | `clinicId` | `{ totalPatients, newThisMonth }` | Patient statistics |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Registration link invalid | Token expires after 72 hours. Check `kiosk_sessions.expires_at`. |
| Duplicate patients after import | Phone normalization strips formatting. Ensure consistent phone format. |
| NexHealth sync button disabled | Check NexHealth configuration at `/admin/nexhealth`. |
| Patient not appearing after registration | Real-time subscription should auto-refresh. Check browser console for channel errors. |
| Alerts not loading | Verify `patient_alerts` table exists and RLS policies allow read access. |
