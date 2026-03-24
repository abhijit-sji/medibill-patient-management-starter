# Patient Management — Code Map

## Overview

This document maps every file in the `patient-management` module and shows the full dependency graph from route entry points down to the Supabase client, Zod schemas, and edge functions.

---

## Dependency Graph

```
src/pages/Patients.tsx
├── src/components/patients/PatientTable.tsx
│   └── @tanstack/react-table
├── src/components/patients/AddPatientDialog.tsx
│   └── src/lib/schemas/patient.schema.ts  (Zod)
├── src/components/patients/EditPatientDialog.tsx
│   └── src/lib/schemas/patient.schema.ts  (Zod)
├── src/components/patients/BulkImportDialog.tsx
│   └── (CSV/Excel parsing — internal utility)
│       └── supabase/functions/bulk-import-patients  (via service layer)
├── src/hooks/usePatients.ts
│   └── src/services/patients.service.ts
│       └── src/integrations/supabase/client.ts
└── (Supabase Realtime subscription for INSERT/UPDATE on patients)

src/pages/PatientDetail.tsx
├── src/components/patients/PatientAlertsTab.tsx
│   └── src/hooks/usePatientAlerts.ts
│       └── src/services/patient-alerts.service.ts
├── src/components/patients/PatientRecallsTab.tsx
│   └── src/hooks/usePatientRecalls.ts
│       └── src/services/patient-recalls.service.ts
├── src/components/patients/PatientDocumentsTab.tsx
│   └── src/hooks/usePatientDocuments.ts
│       └── src/services/patient-documents.service.ts
├── src/components/recalls/AddPatientRecallDialog.tsx
│   └── src/services/patient-recalls.service.ts
└── src/integrations/supabase/client.ts  (direct query for patient detail)

src/pages/PatientRegistration.tsx  [public route]
├── (validates registration token via kiosk_sessions table)
├── (3-step wizard state: local useState)
├── react-signature-canvas
├── canvas-confetti
└── src/integrations/supabase/client.ts  (auth.signUp + patients INSERT)

src/hooks/usePatients.ts
└── src/services/patients.service.ts
    └── src/integrations/supabase/client.ts
        (tables: patients)

src/lib/schemas/patient.schema.ts
└── zod
```

---

## File Reference

### Pages

| File | Route | Auth | Description |
|---|---|---|---|
| `src/pages/Patients.tsx` | `/patients` | Required | Patient list with search, pagination, bulk select, NexHealth sync trigger, and Add Patient / Bulk Import entry points |
| `src/pages/PatientDetail.tsx` | `/patients/:id` | Required | Tabbed patient detail: Profile, Appointments, Reminders, Payments, Calls |
| `src/pages/PatientRegistration.tsx` | `/patients/register` | None (public) | 3-step self-registration wizard. Validates token from `kiosk_sessions`. Creates Supabase Auth user + `patients` row on completion. |

---

### Components

| File | Description |
|---|---|
| `src/components/patients/AddPatientDialog.tsx` | Single-patient creation form inside a `Dialog`. Validates with `patientSchema` (Zod). Calls `createPatient()` on submit. Invalidates React Query cache on success. |
| `src/components/patients/EditPatientDialog.tsx` | Pre-populated patient edit form. Same Zod schema as `AddPatientDialog`. Calls `updatePatient()`. |
| `src/components/patients/BulkImportDialog.tsx` | CSV/Excel upload with 3-phase UX (upload → preview → results). Calls `bulkCreatePatients()` from `patients.service.ts`. Displays per-row error details and import summary. |
| `src/components/patients/PatientAlertsTab.tsx` | Lists active and resolved clinical alerts for a patient. Supports add, disable, and hard-delete actions. Severity badges (critical / warning / info). |
| `src/components/patients/PatientRecallsTab.tsx` | Lists recall schedule entries for a patient. Shows overdue status. Links to appointment booking. Includes `AddPatientRecallDialog`. |
| `src/components/patients/PatientDocumentsTab.tsx` | Lists patient documents by `document_types` category. Upload and download actions via Supabase Storage. |
| `src/components/recalls/AddPatientRecallDialog.tsx` | Dialog for creating a new recall entry. Recall type picker, due date selector, notes field. |

---

### Hooks

| File | Description |
|---|---|
| `src/hooks/usePatients.ts` | React Query wrapper for patient list and detail queries. Exports `usePatients(clinicId, { page, pageSize })`, `usePatient(id)`, `useCreatePatient()`, `useUpdatePatient()`, `useDeletePatient()`, `useBulkDeletePatients()`. Handles cache invalidation on mutations. |
| `src/hooks/usePatientAlerts.ts` | React Query wrapper for `patient_alerts`. Exports `usePatientAlerts(patientId)`, `useCreatePatientAlert()`, `useDisablePatientAlert()`. |
| `src/hooks/usePatientRecalls.ts` | React Query wrapper for `patient_recalls`. Exports `usePatientRecalls(patientId)`, `useCreatePatientRecall()`, `useUpdatePatientRecall()`. |
| `src/hooks/usePatientDocuments.ts` | React Query wrapper for patient document storage operations. |
| `src/hooks/useDocumentTypes.ts` | React Query wrapper for `document_types` reference data. |

---

### Services

| File | Key Exports | Description |
|---|---|---|
| `src/services/patients.service.ts` | `getAllPatients`, `getPatientById`, `findPatientByPhone`, `createPatient`, `updatePatient`, `deletePatient`, `hardDeletePatient`, `bulkCreatePatients`, `searchPatients`, `getPatientStats` | Core patient CRUD. Calls `auditLog()` on PHI access operations. Handles phone-based duplicate detection in `bulkCreatePatients`. |
| `src/services/patient-alerts.service.ts` | `getPatientAlerts`, `createPatientAlert`, `updatePatientAlert`, `disablePatientAlert`, `deletePatientAlert` | Alert CRUD. Enforces clinic-scoped access. |
| `src/services/patient-recalls.service.ts` | `getPatientRecalls`, `createPatientRecall`, `updatePatientRecall`, `deletePatientRecall` | Recall scheduling. Computes overdue status client-side. |
| `src/services/patient-documents.service.ts` | `getPatientDocuments`, `uploadPatientDocument`, `deletePatientDocument`, `getDocumentDownloadUrl` | Supabase Storage operations for patient files. |
| `src/services/document-types.service.ts` | `getDocumentTypes`, `createDocumentType`, `updateDocumentType` | Reference data for document categories. |
| `src/services/nexhealth-patients.service.ts` | `syncNexHealthPatients`, `isNexHealthConfigured` | NexHealth API integration. Upserts synced patients into `patients` table with `nexhealth_*` tracking fields. |
| `src/services/nexhealth-patient-alerts.service.ts` | `syncNexHealthPatientAlerts` | Syncs NexHealth clinical alerts into `patient_alerts`. |

---

### Schemas

| File | Description |
|---|---|
| `src/lib/schemas/patient.schema.ts` | Zod validation schema used by `AddPatientDialog`, `EditPatientDialog`, and `PatientRegistration`. Validates `first_name`, `last_name`, `dob` (ISO date), `phone` (regex), `email` (optional email format), address fields, and insurance fields. |

---

### Edge Functions

| File | Method | Auth | Description |
|---|---|---|---|
| `supabase/functions/bulk-import-patients/index.ts` | `POST` | JWT | Accepts CSV/JSON batch of patient records; validates, deduplicates by phone, and upserts to `patients` table. Returns success/failed/duplicate counts. |
| `supabase/functions/search-patients/index.ts` | `GET` | JWT | Full-text ILIKE search across `first_name`, `last_name`, `email`, `phone`, `dob`. Returns ranked results with last appointment date. |
| `supabase/functions/generate-registration-token/index.ts` | `POST` | JWT | Creates a `kiosk_sessions` row with `type = 'registration'`; returns signed token and registration link URL. |
| `supabase/functions/send-registration-link/index.ts` | `POST` | JWT | Sends the registration link via SMS (Twilio) or email (SendGrid/Resend). Reads provider keys from `integration_settings` via `shared/integration-settings.ts`. |

---

### Shared Edge Function Utilities

| File | Used By | Description |
|---|---|---|
| `supabase/functions/shared/patient-lookup.ts` | `voice-stream`, `search-patients` | Normalized phone matching and clinic-scoped patient lookup. Shared between voice AI inbound flow and patient management. |
| `supabase/functions/shared/integration-settings.ts` | `send-registration-link` | Resolves active email provider API key from `integration_settings` table. |

---

## Cross-Module Dependencies

| Module | Dependency Direction | Detail |
|---|---|---|
| `hipaa-compliance` | patient-management → hipaa-compliance | `patients.service.ts` calls `auditLog()` from `hipaa.service.ts` on PHI access |
| `appointment-management` | patient-management ← appointment-management | Appointments tab in `PatientDetail` renders appointment data from the appointments service |
| `reminder-system` | patient-management ← reminder-system | Reminders tab renders reminder data from the reminders service |
| `kiosk-checkin` | patient-management ← kiosk-checkin | Kiosk check-in references `patients` table by `patient_id` |
| `voice-ai-inbound` | patient-management ← voice-ai-inbound | `shared/patient-lookup.ts` resolves patients for AI agent function calls |
| `nexhealth-integration` | patient-management ↔ nexhealth-integration | `nexhealth-patients.service.ts` is the integration boundary between NexHealth sync and the local `patients` table |

---

## Module Status

| Dimension | Value |
|---|---|
| Status | Stable |
| Tables | 5 (`patients`, `patient_alerts`, `patient_recalls`, `recall_types`, `document_types`) |
| Edge Functions | 4 (`bulk-import-patients`, `search-patients`, `generate-registration-token`, `send-registration-link`) |
| Components | 7 |
| Hooks | 5 |
| Service Files | 7 |
| Zod Schemas | 1 (`patient.schema.ts`) |
| Public Routes | 1 (`/patients/register`) |
| Authenticated Routes | 4 (`/patients`, `/patients/:id`, `/patient-alerts`, `/patient-recalls`) |
