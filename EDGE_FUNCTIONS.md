# Patient Management — Edge Functions

## Overview

The patient management module uses four Supabase Edge Functions. All run on the Deno runtime and require a valid user JWT. Two functions handle bulk operations on existing records; two handle the patient self-registration workflow.

**Base URL:** `https://qdnpztafkuprifwwqcgj.supabase.co/functions/v1/`

---

## `bulk-import-patients`

**Path:** `supabase/functions/bulk-import-patients/index.ts`
**Method:** `POST`
**Authentication:** JWT required
**JWT Verification:** Enabled

### Purpose

Accepts a batch of patient records as CSV or JSON, validates each record, checks for phone-number duplicates against existing `patients` rows, and upserts valid records into the `patients` table. Returns a structured result with counts of successful insertions, failures, and detected duplicates.

### Request

```http
POST /functions/v1/bulk-import-patients
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

```json
{
  "clinic_id": "00000000-0000-0000-0000-000000000001",
  "patients": [
    {
      "first_name": "Jane",
      "last_name": "Smith",
      "dob": "1985-04-12",
      "phone": "555-867-5309",
      "email": "jane.smith@example.com",
      "insurance_provider": "Blue Cross",
      "insurance_id": "BCB123456"
    }
  ],
  "options": {
    "skip_duplicates": true,
    "update_existing": false
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `clinic_id` | `string` (UUID) | Yes | Target clinic; must match the JWT `clinic_id` claim |
| `patients` | `object[]` | Yes | Array of patient objects (max 500 per request) |
| `patients[].first_name` | `string` | Yes | Patient first name |
| `patients[].last_name` | `string` | Yes | Patient last name |
| `patients[].dob` | `string` (ISO 8601 date) | Yes | Date of birth (`YYYY-MM-DD`) |
| `patients[].phone` | `string` | Yes | Primary phone number (normalized internally) |
| `patients[].email` | `string` | No | Email address |
| `options.skip_duplicates` | `boolean` | No (default: `true`) | Skip records whose phone matches an existing patient |
| `options.update_existing` | `boolean` | No (default: `false`) | Update the existing record instead of skipping |

### Response — Success (200)

```json
{
  "success": 48,
  "failed": 1,
  "duplicates": 1,
  "errors": [
    {
      "row": 3,
      "field": "dob",
      "message": "Invalid date format. Expected YYYY-MM-DD."
    }
  ],
  "inserted_ids": ["uuid-1", "uuid-2", "..."]
}
```

| Field | Description |
|---|---|
| `success` | Number of rows successfully inserted |
| `failed` | Number of rows that failed validation or caused a DB error |
| `duplicates` | Number of rows skipped because a matching phone was found |
| `errors` | Array of per-row error details (row index, field, message) |
| `inserted_ids` | UUID array of newly created `patients` rows |

### Duplicate Detection Logic

Phone numbers are normalized before comparison (strips spaces, dashes, parentheses; prepends country code). Multiple format variants of each incoming phone number are compared against existing `patients.phone` values:

```typescript
const variants = normalizePhoneVariants(patient.phone);
// e.g. ["+15558675309", "5558675309", "555-867-5309", "(555) 867-5309"]
```

Records are inserted in batches of 50 using `supabase.from('patients').upsert()`.

### Response — Error Responses

| Status | Code | Cause |
|---|---|---|
| `400` | `INVALID_PAYLOAD` | Missing required fields or malformed JSON |
| `400` | `BATCH_TOO_LARGE` | More than 500 records submitted in a single request |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | `clinic_id` in request body does not match JWT `clinic_id` claim |
| `500` | `INTERNAL_ERROR` | Database error during batch insert |

### Deployment

```bash
supabase functions deploy bulk-import-patients --project-ref qdnpztafkuprifwwqcgj
```

---

## `search-patients`

**Path:** `supabase/functions/search-patients/index.ts`
**Method:** `GET`
**Authentication:** JWT required
**JWT Verification:** Enabled

### Purpose

Performs a full-text search across patient records, matching on first name, last name, full name, email address, phone number, and date of birth. Returns a ranked list of matching patients scoped to the authenticated user's clinic.

### Request

```http
GET /functions/v1/search-patients?q=jane+smith&clinic_id=00000000-0000-0000-0000-000000000001&limit=20
Authorization: Bearer <user_jwt>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | `string` | Yes | Search query (minimum 2 characters) |
| `clinic_id` | `string` (UUID) | Yes | Clinic to search within; must match JWT `clinic_id` claim |
| `limit` | `integer` | No (default: `20`, max: `100`) | Maximum results to return |
| `offset` | `integer` | No (default: `0`) | Pagination offset |

### Response — Success (200)

```json
{
  "patients": [
    {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Smith",
      "dob": "1985-04-12",
      "phone": "555-867-5309",
      "email": "jane.smith@example.com",
      "is_active": true,
      "last_appointment_date": "2026-02-14"
    }
  ],
  "total": 3,
  "query": "jane smith"
}
```

### Search Implementation

The function executes an `ILIKE` query across multiple columns:

```sql
SELECT p.*, MAX(a.appointment_date) AS last_appointment_date
FROM patients p
LEFT JOIN appointments a ON a.patient_id = p.id
WHERE p.clinic_id = $1
  AND p.is_active = true
  AND (
    p.first_name ILIKE '%' || $2 || '%'
    OR p.last_name ILIKE '%' || $2 || '%'
    OR (p.first_name || ' ' || p.last_name) ILIKE '%' || $2 || '%'
    OR p.email ILIKE '%' || $2 || '%'
    OR p.phone ILIKE '%' || $2 || '%'
    OR CAST(p.dob AS TEXT) ILIKE '%' || $2 || '%'
  )
GROUP BY p.id
ORDER BY p.last_name, p.first_name
LIMIT $3 OFFSET $4;
```

### Response — Error Responses

| Status | Code | Cause |
|---|---|---|
| `400` | `QUERY_TOO_SHORT` | `q` parameter is fewer than 2 characters |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | `clinic_id` parameter does not match JWT claim |
| `500` | `INTERNAL_ERROR` | Database error |

### Deployment

```bash
supabase functions deploy search-patients --project-ref qdnpztafkuprifwwqcgj
```

---

## `generate-registration-token`

**Path:** `supabase/functions/generate-registration-token/index.ts`
**Method:** `POST`
**Authentication:** JWT required (clinic staff or admin)
**JWT Verification:** Enabled

### Purpose

Generates a one-time, time-limited registration token for patient self-registration. Creates a `kiosk_sessions` row with `type = 'registration'` and returns a fully constructed registration link containing the token. The link is typically forwarded to the patient using `send-registration-link`.

### Request

```http
POST /functions/v1/generate-registration-token
Authorization: Bearer <staff_jwt>
Content-Type: application/json
```

```json
{
  "clinic_id": "00000000-0000-0000-0000-000000000001",
  "appointment_id": "uuid-of-appointment",
  "patient_phone": "+15551234567",
  "patient_email": "patient@example.com",
  "expires_in_hours": 72
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `clinic_id` | `string` (UUID) | Yes | Issuing clinic |
| `appointment_id` | `string` (UUID) | No | Associated appointment (used to pre-fill registration context) |
| `patient_phone` | `string` | Conditional | Patient phone number — at least one of `patient_phone` or `patient_email` is required |
| `patient_email` | `string` | Conditional | Patient email address — at least one of `patient_phone` or `patient_email` is required |
| `expires_in_hours` | `integer` | No (default: `72`) | Token validity window in hours |

### Response — Success (200)

```json
{
  "registration_link": "https://app.ephysician.biz/patients/register?token=eyJ...",
  "token": "eyJ...",
  "session": {
    "id": "uuid",
    "expires_at": "2026-03-19T10:00:00Z"
  }
}
```

### Token Storage

The function inserts a row into `kiosk_sessions`:

```sql
INSERT INTO kiosk_sessions (
  clinic_id, type, token, patient_phone, patient_email,
  appointment_id, expires_at, created_at
)
VALUES (
  $1, 'registration', $2, $3, $4, $5,
  NOW() + ($6 || ' hours')::INTERVAL,
  NOW()
);
```

The `token` value is a URL-safe signed JWT or a random UUID string depending on the implementation variant.

### Response — Error Responses

| Status | Code | Cause |
|---|---|---|
| `400` | `MISSING_IDENTIFIER` | Neither `patient_phone` nor `patient_email` was provided |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | `clinic_id` does not match JWT `clinic_id` claim |
| `500` | `INTERNAL_ERROR` | Token generation or database insert error |

### Deployment

```bash
supabase functions deploy generate-registration-token --project-ref qdnpztafkuprifwwqcgj
```

---

## `send-registration-link`

**Path:** `supabase/functions/send-registration-link/index.ts`
**Method:** `POST`
**Authentication:** JWT required
**JWT Verification:** Enabled

### Purpose

Delivers a patient self-registration link via SMS (Twilio) or email (SendGrid / Resend). Accepts a pre-generated `registration_link` from `generate-registration-token`. Logs the send event on the associated `kiosk_sessions` row.

### Request

```http
POST /functions/v1/send-registration-link
Authorization: Bearer <staff_jwt>
Content-Type: application/json
```

```json
{
  "clinic_id": "00000000-0000-0000-0000-000000000001",
  "channel": "sms",
  "patient_phone": "+15551234567",
  "patient_email": "patient@example.com",
  "patient_name": "Jane Smith",
  "registration_link": "https://app.ephysician.biz/patients/register?token=eyJ...",
  "message_template": "Hi {name}, please complete your registration: {link}"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `clinic_id` | `string` (UUID) | Yes | Sending clinic |
| `channel` | `"sms"` \| `"email"` | Yes | Delivery channel |
| `patient_phone` | `string` | Required if `channel = "sms"` | Destination phone number |
| `patient_email` | `string` | Required if `channel = "email"` | Destination email address |
| `patient_name` | `string` | No | Used for `{name}` personalization in message template |
| `registration_link` | `string` | Yes | Pre-built registration URL (from `generate-registration-token`) |
| `message_template` | `string` | No | Custom message; supports `{name}`, `{link}` placeholders |

### Response — Success (200)

```json
{
  "sent": true,
  "channel": "sms",
  "message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "delivered_to": "+15551234567"
}
```

### Default Message Templates

**SMS default:**
```
Hi {name}, {clinic_name} has sent you a registration link.
Please complete your information here: {link}
This link expires in 72 hours.
```

**Email default:**
- Subject: `Complete Your Patient Registration — {clinic_name}`
- Body: HTML with clinic branding, registration call-to-action button, and link expiry notice

### API Keys

The function resolves the active email provider from `integration_settings` (keyed by `integration_name = 'email'` for the clinic). Twilio credentials are read from Supabase Edge secrets.

### Response — Error Responses

| Status | Code | Cause |
|---|---|---|
| `400` | `INVALID_CHANNEL` | `channel` is not `"sms"` or `"email"` |
| `400` | `MISSING_DESTINATION` | No phone number (SMS) or email address (email) provided |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | `clinic_id` does not match JWT claim |
| `502` | `DELIVERY_FAILED` | Twilio or email provider rejected the request |
| `500` | `INTERNAL_ERROR` | Unexpected runtime error |

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Yes (SMS) | Twilio API credential |
| `TWILIO_AUTH_TOKEN` | Yes (SMS) | Twilio API credential |
| `TWILIO_PHONE_NUMBER` | Yes (SMS) | Sender number |
| `SENDGRID_API_KEY` | One of these (email) | SendGrid delivery |
| `RESEND_API_KEY` | One of these (email) | Resend delivery |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Required for `kiosk_sessions` updates |

### Deployment

```bash
supabase functions deploy send-registration-link --project-ref qdnpztafkuprifwwqcgj
```

---

## Shared Utility

All four functions share the patient lookup helper from `supabase/functions/shared/patient-lookup.ts`, which provides normalized phone matching and clinic-scoped patient queries used by the Voice AI inbound call flow as well.
