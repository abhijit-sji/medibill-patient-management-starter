/**
 * Patient Form Schema
 * Zod validation schema for patient data
 * Aligned with NexHealth API bio structure
 * Medibill Voice Sync Health
 */

import { z } from 'zod';

// Phone number validation - US format (optional, allows empty)
const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

// ZIP code validation - 5 digits
const zipRegex = /^\d{5}$/;

// State validation - 2-letter code
const stateRegex = /^[A-Z]{2}$/;

// SSN validation - XXX-XX-XXXX format
const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;

// Optional phone field helper
const optionalPhone = z
  .string()
  .regex(phoneRegex, 'Please enter a valid phone number')
  .optional()
  .or(z.literal(''));

export const patientSchema = z.object({
  // Required fields
  first_name: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .trim(),
  
  last_name: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),
  
  dob: z
    .string()
    .refine(
      (date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime()) && dateObj < new Date();
      },
      {
        message: 'Date of birth must be a valid date in the past',
      }
    ),
  
  // Primary phone (required)
  phone: z
    .string()
    .regex(phoneRegex, 'Please enter a valid phone number')
    .trim(),
  
  // NexHealth additional phone numbers (optional)
  home_phone_number: optionalPhone,
  cell_phone_number: optionalPhone,
  work_phone_number: optionalPhone,
  custom_contact_number: optionalPhone,
  
  // Optional fields with validation
  email: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
  
  // Gender - NexHealth supports Male, Female, Other
  gender: z
    .enum(['male', 'female', 'other', 'prefer_not_to_say', ''])
    .optional()
    .or(z.literal('')),
  
  // Address fields
  address: z
    .string()
    .max(200, 'Address must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  
  // NexHealth additional address fields
  address_line_1: z
    .string()
    .max(100, 'Address line 1 must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  address_line_2: z
    .string()
    .max(100, 'Address line 2 must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  city: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  state: z
    .string()
    .regex(stateRegex, 'State must be a 2-letter code (e.g., NY, CA)')
    .optional()
    .or(z.literal('')),
  
  zip: z
    .string()
    .regex(zipRegex, 'ZIP code must be 5 digits')
    .optional()
    .or(z.literal('')),
  
  // NexHealth bio fields
  race: z
    .string()
    .max(50, 'Race must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  
  ssn: z
    .string()
    .regex(ssnRegex, 'SSN must be in format XXX-XX-XXXX')
    .optional()
    .or(z.literal('')),
  
  weight: z
    .number()
    .positive('Weight must be a positive number')
    .nullable()
    .optional(),
  
  height: z
    .number()
    .positive('Height must be a positive number')
    .nullable()
    .optional(),
  
  // Insurance fields
  insurance_provider: z
    .string()
    .max(100, 'Insurance provider must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  insurance_id: z
    .string()
    .max(50, 'Insurance ID must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  
  insurance_group: z
    .string()
    .max(50, 'Group number must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  
  // Emergency contact
  emergency_contact_name: z
    .string()
    .max(100, 'Emergency contact name must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  emergency_contact_phone: optionalPhone,
  
  emergency_contact_relationship: z
    .string()
    .max(50, 'Relationship must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  
  // Medical fields
  allergies: z
    .string()
    .max(500, 'Allergies must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  
  medications: z
    .string()
    .max(500, 'Medications must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  
  medical_history: z
    .string()
    .max(1000, 'Medical history must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
  
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
  
  // Status
  is_active: z.boolean().default(true),
  
  // Provider (required for NexHealth API, can be number for NexHealth or string for local)
  provider_id: z
    .union([
      z.number().positive('Please select a provider'),
      z.string().min(1, 'Please select a provider'),
    ])
    .nullable()
    .optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;
