# Patient Management - Database Schema

## Overview

The patient management module uses five primary tables to store patient demographics, clinical alerts, recall schedules, recall type definitions, and document type categories. All tables follow the project conventions: snake_case names (plural), UUID primary keys via `gen_random_uuid()`, money as `NUMERIC(10,2)`, enums as `TEXT + CHECK`, and timestamps as `TIMESTAMPTZ`.

---

## Tables

### `patients`

Core patient demographics and contact information. Supports both platform-created and NexHealth-synced records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `clinic_id` | `UUID` | NO | | FK to `clinics.id` |
| `first_name` | `TEXT` | NO | | Patient first name |
| `last_name` | `TEXT` | NO | | Patient last name |
| `dob` | `DATE` | NO | | Date of birth |
| `phone` | `TEXT` | NO | | Primary phone number |
| `email` | `TEXT` | YES | | Email address |
| `gender` | `TEXT` | YES | | Gender (male/female/other/prefer_not_to_say) |
| `address` | `TEXT` | YES | | Street address |
| `address_line_1` | `TEXT` | YES | | NexHealth address line 1 |
| `address_line_2` | `TEXT` | YES | | NexHealth address line 2 |
| `city` | `TEXT` | YES | | City |
| `state` | `TEXT` | YES | | 2-letter state code |
| `zip` | `TEXT` | YES | | 5-digit ZIP code |
| `insurance_provider` | `TEXT` | YES | | Insurance carrier name |
| `insurance_id` | `TEXT` | YES | | Insurance member ID |
| `insurance_group` | `TEXT` | YES | | Insurance group number |
| `copay_amount` | `NUMERIC(10,2)` | YES | `0` | Default copay amount |
| `previous_balance` | `NUMERIC(10,2)` | YES | `0` | Outstanding balance |
| `emergency_contact_name` | `TEXT` | YES | | Emergency contact name |
| `emergency_contact_phone` | `TEXT` | YES | | Emergency contact phone |
| `emergency_contact_relationship` | `TEXT` | YES | | Relationship to patient |
| `allergies` | `TEXT` | YES | | Known allergies |
| `medications` | `TEXT` | YES | | Current medications |
| `medical_history` | `TEXT` | YES | | Medical history notes |
| `notes` | `TEXT` | YES | | General notes |
| `is_active` | `BOOLEAN` | NO | `true` | Soft delete flag |
| `source` | `TEXT` | YES | `'platform'` | Origin: 'platform' or 'nexhealth' |
| `nexhealth_patient_id` | `TEXT` | YES | | NexHealth patient ID |
| `nexhealth_synced_at` | `TIMESTAMPTZ` | YES | | Last NexHealth sync timestamp |
| `nexhealth_sync_status` | `TEXT` | YES | | Sync status: pending/synced/failed/error/removed |
| `nexhealth_error` | `TEXT` | YES | | Last sync error message |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Last update time |

**Indexes:** `clinic_id`, `phone`, `email`, `nexhealth_patient_id`, `(clinic_id, is_active)`

---

### `patient_alerts`

Clinical alerts and notifications attached to patient records. Alerts have severity levels and support soft-disable.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto-increment | Primary key |
| `clinic_id` | `UUID` | YES | | FK to `clinics.id` |
| `patient_id` | `UUID` | NO | | FK to `patients.id` |
| `note` | `TEXT` | NO | | Alert text content |
| `severity` | `TEXT` | NO | `'info'` | Alert level: 'info', 'warning', 'critical' |
| `is_active` | `BOOLEAN` | NO | `true` | Whether alert is active |
| `disabled_at` | `TIMESTAMPTZ` | YES | | When alert was disabled |
| `disabled_by` | `UUID` | YES | | User who disabled the alert |
| `created_by` | `UUID` | YES | | User who created the alert |
| `nexhealth_id` | `INTEGER` | YES | | NexHealth alert ID |
| `nexhealth_synced_at` | `TIMESTAMPTZ` | YES | | Last NexHealth sync |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Last update time |

**CHECK constraint:** `severity IN ('info', 'warning', 'critical')`

---

### `patient_recalls`

Recall appointments tracking when patients are due for recurring care.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto-increment | Primary key |
| `clinic_id` | `UUID` | YES | | FK to `clinics.id` |
| `patient_id` | `UUID` | NO | | FK to `patients.id` |
| `recall_type_id` | `INTEGER` | YES | | FK to `recall_types.id` |
| `appointment_id` | `UUID` | YES | | FK to `appointments.id` (when scheduled) |
| `date_due` | `DATE` | NO | | When the recall is due |
| `status` | `TEXT` | NO | `'pending'` | Status: pending/scheduled/completed/cancelled |
| `notes` | `TEXT` | YES | | Notes about the recall |
| `nexhealth_id` | `INTEGER` | YES | | NexHealth recall ID |
| `foreign_id` | `TEXT` | YES | | External system ID |
| `foreign_id_type` | `TEXT` | YES | | External system name |
| `nexhealth_synced_at` | `TIMESTAMPTZ` | YES | | Last NexHealth sync |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Last update time |

**CHECK constraint:** `status IN ('pending', 'scheduled', 'completed', 'cancelled')`

---

### `recall_types`

Definitions for recurring care types with interval configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto-increment | Primary key |
| `name` | `TEXT` | NO | | Recall type name (e.g., "Dental Cleaning") |
| `description` | `TEXT` | YES | | Description |
| `interval_num` | `INTEGER` | YES | | Interval amount |
| `interval_unit` | `TEXT` | YES | | Interval unit: 'days', 'weeks', 'months' |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Last update time |

---

### `document_types`

Categories for organizing patient documents (consent forms, lab results, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `SERIAL` | NO | auto-increment | Primary key |
| `clinic_id` | `UUID` | YES | | FK to `clinics.id` |
| `name` | `TEXT` | NO | | Document type name |
| `description` | `TEXT` | YES | | Description of the document type |
| `is_active` | `BOOLEAN` | NO | `true` | Whether type is active |
| `nexhealth_id` | `INTEGER` | YES | | NexHealth document type ID |
| `nexhealth_synced_at` | `TIMESTAMPTZ` | YES | | Last NexHealth sync |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Last update time |

---

## Relationships

```
clinics 1──* patients
patients 1──* patient_alerts
patients 1──* patient_recalls
recall_types 1──* patient_recalls
appointments 1──? patient_recalls
clinics 1──* document_types
```

## Row-Level Security

- All tables enforce clinic-level isolation via `clinic_id` matching the authenticated user's clinic.
- The `patients` table service layer filters by `clinic_id` and `is_active` by default.
- PHI access is logged via `hipaa-audit.service.ts` on patient record views and modifications.
