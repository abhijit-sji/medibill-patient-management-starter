# Patient Management — UI Layout

## Overview

The patient management module surfaces across three primary routes and several supporting dialogs. It is the highest-traffic section of the application for clinic staff.

---

## Routes

| Route | Component | Auth | Layout | Description |
|---|---|---|---|---|
| `/patients` | `src/pages/Patients.tsx` | Required | `<Layout>` | Patient list with search, pagination, and bulk actions |
| `/patients/:id` | `src/pages/PatientDetail.tsx` | Required | `<Layout>` | Patient detail with tabbed sections |
| `/patients/register` | `src/pages/PatientRegistration.tsx` | None (public) | None | 3-step self-registration wizard |

---

## `/patients` — Patient List Page

### Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Page header                                                     │
│  "Patients"                   [Add Patient ▼]  [Sync NexHealth] │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Search by name, phone, email, or DOB...]                   │
│  Filters: [Status: All ▼]  [Provider ▼]  [Source: All ▼]       │
├─────────────────────────────────────────────────────────────────┤
│  Patients Table                                                  │
│  ┌───────────┬────────────┬───────────────┬────────┬──────────┐ │
│  │ Name      │ DOB        │ Phone         │ Status │ Last Appt│ │
│  ├───────────┼────────────┼───────────────┼────────┼──────────┤ │
│  │ Jane Smith│ Apr 12 '85 │ (555)867-5309 │ Active │ Feb 2026 │ │
│  │ Tom Wilson│ Jun 03 '72 │ (555)234-5678 │ Active │ Jan 2026 │ │
│  │ Bob Jones │ Nov 18 '55 │ (555)876-4321 │Inactive│ Dec 2025 │ │
│  └───────────┴────────────┴───────────────┴────────┴──────────┘ │
│  Showing 1–25 of 312        [< Prev]  [1] [2] [3]  [Next >]    │
└─────────────────────────────────────────────────────────────────┘
```

### Add Patient Dropdown

The `[Add Patient ▼]` button opens a dropdown with two options:
- **Add Patient** — opens `AddPatientDialog` (single patient form)
- **Bulk Import (CSV/Excel)** — opens `BulkImportDialog`

### Patient Table Columns

| Column | Description | Sortable |
|---|---|---|
| Name | First + last name; links to `/patients/:id` | Yes |
| DOB | Formatted date of birth | Yes |
| Phone | Primary phone number | No |
| Email | Email address (hidden on mobile) | No |
| Status | Active / Inactive badge | Yes |
| Last Appointment | Most recent appointment date | Yes |

Row click: navigates to `/patients/:id`.
Row checkbox: enables bulk select mode (bulk deactivate / bulk delete actions appear in header).

### Quick View Drawer

Hovering or pressing a quick-view icon on a row opens a right-side `Sheet` (shadcn/ui) showing:
- Patient name, DOB, phone, email
- Most recent appointment date and status
- Outstanding balance
- Direct links to full detail tabs

### Search

- Input triggers `search-patients` edge function call after 300ms debounce
- Minimum 2 characters
- Results replace the paginated table while a search query is active
- Clear button resets to paginated view

---

## `AddPatientDialog` — Single Patient Form

Rendered inside a `Dialog`. Required fields: first name, last name, DOB, phone. Validated against `src/lib/schemas/patient.schema.ts` (Zod).

```
┌───────────────────────────────────┐
│  Add Patient                  [X] │
├───────────────────────────────────┤
│  First Name*  [_______________]   │
│  Last Name*   [_______________]   │
│  Date of Birth* [MM / DD / YYYY]  │
│  Phone*       [_______________]   │
│  Email        [_______________]   │
│  ── Insurance (optional) ──       │
│  Provider     [_______________]   │
│  Member ID    [_______________]   │
│                                   │
│  [Cancel]       [Add Patient]     │
└───────────────────────────────────┘
```

---

## `BulkImportDialog` — CSV Uploader

Opened from the "Bulk Import" dropdown option. Three-phase flow:

**Phase 1 — Upload:**
```
┌──────────────────────────────────────────────┐
│  Bulk Import Patients                    [X]  │
├──────────────────────────────────────────────┤
│  [Download CSV Template]                      │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │   Drop your CSV or Excel file here     │  │
│  │        or click to browse              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Cancel]                        [Continue]  │
└──────────────────────────────────────────────┘
```

**Phase 2 — Preview:**
Shows first 5 rows of parsed data. Column mapping interface if headers differ from expected. Row count badge. Warning count for detected issues.

**Phase 3 — Results:**
```
┌──────────────────────────────────────────────┐
│  Import Complete                         [X]  │
├──────────────────────────────────────────────┤
│  ✅  48 patients imported successfully        │
│  ⚠️   1 duplicate skipped (phone match)       │
│  ❌  1 row failed validation (see details)    │
│                                              │
│  [View Error Details]       [Done]           │
└──────────────────────────────────────────────┘
```

---

## `/patients/:id` — Patient Detail Page

### Page Header

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Patients                                              │
├─────────────────────────────────────────────────────────────────┤
│  [JS]   Jane Smith                                               │
│         jane.smith@example.com · (555) 867-5309                 │
│         Active · Source: Platform · DOB: Apr 12, 1985           │
│                                                                  │
│  [Edit Patient]  [Send Registration Link]  [Deactivate]         │
└─────────────────────────────────────────────────────────────────┘
```

The `[JS]` avatar uses the patient's initials with a consistent hue derived from the patient ID.

### Tab Navigation

```
[ Profile ] [ Appointments ] [ Reminders ] [ Payments ] [ Calls ]
```

#### Profile Tab

Two-column card layout on desktop, single column on mobile:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│  Demographics            │  │  Insurance               │
│  DOB: Apr 12, 1985       │  │  Provider: Blue Cross     │
│  Gender: Female          │  │  Member ID: BCB123456     │
│  Address: 123 Oak St.    │  │  Group: GRP789            │
│  City, ST 12345          │  │  Copay: $30.00            │
│  Emergency: Bob Smith    │  │  [Verify Eligibility]     │
│  (Brother) 555-999-0000  │  │                           │
└──────────────────────────┘  └──────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  Medical History                                        │
│  Allergies: Penicillin                                  │
│  Medications: Lisinopril 10mg                          │
│  History: Hypertension, diagnosed 2018                  │
│  Notes: Prefers afternoon appointments                  │
└────────────────────────────────────────────────────────┘
```

#### Appointments Tab

Sortable table of all appointments for this patient. Columns: Date, Time, Provider, Type, Status. Includes upcoming and historical appointments. "Book Appointment" button links to the appointment scheduling flow.

#### Reminders Tab

Table of reminder history: Date Sent, Channel (Voice/SMS/Email), Appointment, Status (Delivered/Failed/Confirmed/Cancelled). Shows patient response if CONFIRM/CANCEL/RESCHEDULE was received.

#### Payments Tab

Payment history table: Date, Amount, Status (Succeeded/Failed/Refunded), Method, Appointment. Outstanding balance shown in a summary card at the top. Columns include a receipt download link for succeeded payments.

#### Calls Tab

Voice call history: Date/Time, Direction (Inbound/Outbound), Duration, Outcome (Scheduled/No Answer/etc.), AI Agent. "View Transcript" button opens a modal with the full call transcript from `ai_interactions`.

---

## `/patients/register` — Self-Registration Wizard (Public)

No authenticated layout. Uses a centered card with clinic logo and progress steps indicator.

### Step Indicator

```
[1] Personal Info  →  [2] Insurance  →  [3] Review & Sign
  ●─────────────────────○───────────────────○
```

### Step 1 — Personal Information

```
┌──────────────────────────────────────────────┐
│  [Clinic Logo]                                │
│  Create Your Patient Account                  │
├──────────────────────────────────────────────┤
│  First Name*   [___________________________]  │
│  Last Name*    [___________________________]  │
│  Date of Birth* [MM / DD / YYYY]              │
│  Phone*        [___________________________]  │
│  Email         [___________________________]  │
│  Address       [___________________________]  │
│  City          [________________]             │
│  State [__] ZIP [_______]                     │
│                                              │
│                          [Continue →]        │
└──────────────────────────────────────────────┘
```

### Step 2 — Insurance

```
┌──────────────────────────────────────────────┐
│  Insurance Information              (optional)│
├──────────────────────────────────────────────┤
│  [📷 Upload Insurance Card]                   │
│  — or enter manually —                        │
│  Provider     [___________________________]  │
│  Member ID    [___________________________]  │
│  Group Number [___________________________]  │
│                                              │
│  [← Back]                    [Continue →]   │
└──────────────────────────────────────────────┘
```

Upload triggers simulated OCR extraction — pre-fills fields with extracted values for confirmation.

### Step 3 — Review & Sign

Shows a summary of entered information for review. Below the summary:

```
┌──────────────────────────────────────────────┐
│  Electronic Signature                         │
│  ┌──────────────────────────────────────┐    │
│  │  Sign here                           │    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│  [Clear]                                     │
│                                              │
│  ☐ I confirm the above information is        │
│    accurate and consent to treatment.        │
│                                              │
│  [← Back]          [Complete Registration]  │
└──────────────────────────────────────────────┘
```

On successful submission, a confetti animation plays and a confirmation message is shown.

---

## Responsive Behavior

| Breakpoint | Patient List | Patient Detail | Registration |
|---|---|---|---|
| Mobile (`< 640px`) | Table shows Name + Status only; horizontal scroll; 10 rows/page | Single column tabs; stacked cards | Single column; full-width fields |
| Tablet (`640–1024px`) | 5 columns; 20 rows/page | 2-column profile cards; tab scrolling | Centered card with padding |
| Desktop (`> 1024px`) | All 6 columns; 25 rows/page | 2-column profile layout; full tab content | Centered 2-column wizard |
