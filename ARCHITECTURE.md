# Patient Management - Architecture

## Overview

The Patient Management module follows the project's layered architecture: pages delegate to React Query hooks, which wrap service functions that perform all Supabase data access. NexHealth synchronization runs as a parallel data pipeline, with merged/deduplicated results presented to the UI.

## Component Architecture

```mermaid
graph TD
    subgraph Pages
        P1[Patients.tsx]
        P2[PatientRegistration.tsx]
        P3[PatientAlerts.tsx]
        P4[PatientRecalls.tsx]
        P5[DocumentTypes.tsx]
    end

    subgraph Components
        C1[AddPatientDialog]
        C2[EditPatientDialog]
        C3[BulkImportDialog]
        C4[PatientAlertsTab]
        C5[PatientRecallsTab]
        C6[PatientDocumentsTab]
        C7[AddPatientRecallDialog]
    end

    subgraph Hooks
        H1[usePatients]
        H2[usePatientAlerts]
        H3[usePatientRecalls]
        H4[useDocumentTypes]
        H5[usePatientDocuments]
    end

    subgraph Services
        S1[patients.service]
        S2[patient-alerts.service]
        S3[patient-recalls.service]
        S4[document-types.service]
        S5[nexhealth-patients.service]
    end

    subgraph Database
        DB[(Supabase PostgreSQL)]
    end

    P1 --> C1 & C2 & C3
    P1 --> H1
    P3 --> H2
    P4 --> H3 & C7
    P5 --> H4

    H1 --> S1
    H2 --> S2
    H3 --> S3
    H4 --> S4

    P1 --> S5

    S1 & S2 & S3 & S4 & S5 --> DB
```

## Data Flow

### Patient List Flow

```mermaid
sequenceDiagram
    participant User
    participant Patients.tsx
    participant usePatients
    participant Supabase
    participant NexHealth

    User->>Patients.tsx: Navigate to /patients
    Patients.tsx->>usePatients: Fetch with pagination
    usePatients->>Supabase: SELECT from patients (paginated)
    Supabase-->>usePatients: Patient rows + total count
    usePatients->>Supabase: SELECT last appointments
    Supabase-->>usePatients: Appointment dates
    usePatients-->>Patients.tsx: PatientWithDetails[]
    Patients.tsx-->>User: Rendered table with stats

    Note over Patients.tsx: Real-time subscription active
    Supabase-->>Patients.tsx: postgres_changes INSERT/UPDATE
    Patients.tsx->>usePatients: invalidateQueries
```

### Self-Registration Flow

```mermaid
sequenceDiagram
    participant Admin
    participant EdgeFn as generate-registration-token
    participant DB as Supabase DB
    participant Patient
    participant RegPage as PatientRegistration.tsx
    participant CompleteFn as complete-registration

    Admin->>EdgeFn: Generate token (appointmentId, phone/email)
    EdgeFn->>DB: INSERT kiosk_sessions (type=registration, token, expires_at)
    EdgeFn-->>Admin: Registration link with token

    Admin->>Patient: Send link (SMS/email)
    Patient->>RegPage: Open /patients/register?token=xxx
    RegPage->>DB: Validate token (kiosk_sessions)
    DB-->>RegPage: Session data (valid/expired/used)

    Patient->>RegPage: Step 1: Personal info
    Patient->>RegPage: Step 2: Insurance (upload card or manual)
    Patient->>RegPage: Step 3: Review + e-signature
    RegPage->>CompleteFn: Submit registration data
    CompleteFn->>DB: INSERT patient record
    CompleteFn->>DB: UPDATE kiosk_session (consent_signed=true)
    CompleteFn-->>RegPage: Success
    RegPage-->>Patient: Confetti + confirmation
```

### Bulk Import Flow

```mermaid
sequenceDiagram
    participant User
    participant BulkImportDialog
    participant patients.service
    participant Supabase

    User->>BulkImportDialog: Upload CSV/Excel file
    BulkImportDialog->>BulkImportDialog: Parse file to patient array
    BulkImportDialog->>patients.service: bulkCreatePatients()

    loop For each patient
        patients.service->>patients.service: checkPatientDuplicate(phone)
        patients.service->>Supabase: Query existing patients by phone variants
        Supabase-->>patients.service: Existing matches
    end

    patients.service->>Supabase: INSERT batch (50 per batch)
    Supabase-->>patients.service: Inserted records
    patients.service-->>BulkImportDialog: {success, failed, duplicates, errors}
    BulkImportDialog-->>User: Results summary
```

## Key Design Decisions

1. **Database-first with NexHealth as background sync**: Patients are always read from the local `patients` table. NexHealth sync populates this table but does not serve as the primary data source.

2. **Dual delete strategy**: NexHealth-synced patients receive soft delete (`is_active=false`, `nexhealth_sync_status='removed'`), while platform-created patients can be hard deleted.

3. **Phone-based duplicate detection**: Bulk import normalizes phone numbers and checks multiple format variants before inserting.

4. **HIPAA audit logging**: Patient record views and modifications are logged via fire-and-forget calls to `hipaa-audit.service.ts`.

5. **Real-time updates**: The Patients page subscribes to Supabase Realtime for `INSERT` and `UPDATE` events on the `patients` table, automatically refreshing the list when new patients register.

## State Management

- **React Query**: All server state (patient lists, alerts, recalls, document types) is managed via React Query with cache invalidation on mutations.
- **Local state**: UI state (selected patient, dialogs open/closed, pagination, search filter) is managed via `useState` within page components.
- **Zustand**: Not directly used by this module, though `selectedPatientId` from the global store may be consumed by other modules.

## Error Handling

- Services throw errors on failure; pages catch them and display via `sonner` toast notifications.
- The Patients page renders a dedicated error state with a retry button when the initial query fails.
- Bulk operations return partial success/failure counts instead of failing entirely.
