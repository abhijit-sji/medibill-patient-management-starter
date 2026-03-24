# Patient Management — API Reference

Supabase Edge Functions for patient registration, bulk import, search, and user management.

## Base URL

```
https://qdnpztafkuprifwwqcgj.supabase.co/functions/v1
```

---

## `POST /generate-registration-token`

Generates a one-time registration token for a new patient invite.

**Auth:** Bearer JWT required (admin/staff)

**Request Body:**
```json
{
  "email": "patient@example.com",
  "clinic_id": "uuid"
}
```

**Response `200`:**
```json
{
  "token": "hex-token",
  "registration_url": "https://app.example.com/patients/register?token=..."
}
```

---

## `POST /send-registration-link`

Sends the registration link to a patient via email.

**Auth:** Bearer JWT required

**Request Body:**
```json
{
  "patient_id": "uuid",
  "email": "patient@example.com"
}
```

**Response `200`:**
```json
{ "success": true }
```

---

## `POST /bulk-import-patients`

Imports a batch of patients from a CSV payload.

**Auth:** Bearer JWT required (admin)

**Request Body:**
```json
{
  "clinic_id": "uuid",
  "patients": [
    { "first_name": "Jane", "last_name": "Doe", "date_of_birth": "1990-01-01", "phone": "+1..." }
  ]
}
```

**Response `200`:**
```json
{
  "imported": 45,
  "skipped": 3,
  "errors": []
}
```

---

## `GET /search-patients`

Full-text search over `patients` by name, DOB, or phone.

**Auth:** Bearer JWT required

**Query Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `q` | Yes | Search term |
| `clinic_id` | No | Filter by clinic |
| `limit` | No | Max results (default 20) |

**Response `200`:**
```json
{
  "patients": [ { "id": "uuid", "first_name": "Jane", "last_name": "Doe", ... } ]
}
```

---

## `POST /invite-user`

Invites a staff user to the platform via Supabase Auth invite.

**Auth:** Bearer JWT required (admin)

**Request Body:**
```json
{
  "email": "staff@clinic.com",
  "role": "staff" | "admin",
  "clinic_id": "uuid"
}
```

---

## `POST /send-welcome-email`

Sends a welcome email to a newly registered patient.

**Auth:** Bearer JWT required

---

## Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid fields |
| `401` | Invalid JWT |
| `409` | Patient already exists |
| `500` | Internal error |
