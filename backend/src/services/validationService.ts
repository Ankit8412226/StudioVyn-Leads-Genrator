/**
 * Validation Service — Validates email, phone, and website data (Phase 7)
 */
import { logger } from '../utils/logger';

export interface ValidationResult {
  email: 'valid' | 'invalid' | 'missing' | 'suspicious';
  phone: 'valid' | 'invalid' | 'missing' | 'suspicious';
  website: 'valid' | 'invalid' | 'missing' | 'suspicious';
  overallValid: boolean;
}

/**
 * Validate email format
 */
function validateEmail(email?: string): 'valid' | 'invalid' | 'missing' | 'suspicious' {
  if (!email || email.trim() === '') return 'missing';

  const trimmed = email.trim().toLowerCase();

  // Basic regex validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return 'invalid';

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /^(test|example|fake|noreply|no-reply|admin|info@example)/i,
    /@(example\.com|test\.com|localhost|mailinator\.com|tempmail)/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) return 'suspicious';
  }

  return 'valid';
}

/**
 * Validate phone number
 */
function validatePhone(phone?: string): 'valid' | 'invalid' | 'missing' | 'suspicious' {
  if (!phone || phone.trim() === '') return 'missing';

  // Strip formatting
  const digits = phone.replace(/[\s\-\(\)\+\.]/g, '');

  // Must have at least 7 digits (shortest valid phone numbers)
  if (digits.length < 7) return 'invalid';

  // Must not exceed 15 digits (ITU-T E.164)
  if (digits.length > 15) return 'invalid';

  // All characters should be digits after stripping formatting
  if (!/^\d+$/.test(digits)) return 'invalid';

  // Check for obviously fake patterns
  const suspiciousPatterns = [
    /^0{7,}$/,                // All zeros
    /^1234567/,               // Sequential
    /^(\d)\1{6,}$/,           // Repeating digit
    /^0000000/,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(digits)) return 'suspicious';
  }

  return 'valid';
}

/**
 * Validate website URL
 */
function validateWebsite(website?: string): 'valid' | 'invalid' | 'missing' | 'suspicious' {
  if (!website || website.trim() === '') return 'missing';

  const trimmed = website.trim();

  // Add protocol if missing for URL parsing
  const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(urlStr);

    // Must have a valid hostname
    if (!url.hostname || url.hostname.length < 3) return 'invalid';

    // Must have a TLD
    if (!url.hostname.includes('.')) return 'invalid';

    // Check for suspicious patterns
    const suspiciousHosts = ['example.com', 'test.com', 'localhost', '127.0.0.1'];
    if (suspiciousHosts.includes(url.hostname)) return 'suspicious';

    return 'valid';
  } catch {
    return 'invalid';
  }
}

/**
 * Validate all lead contact info
 */
export function validateLeadData(lead: {
  email?: string;
  phone?: string;
  website?: string;
}): ValidationResult {
  const emailResult = validateEmail(lead.email);
  const phoneResult = validatePhone(lead.phone);
  const websiteResult = validateWebsite(lead.website);

  // Overall valid if at least one contact method is valid and none are invalid
  const hasValidContact = emailResult === 'valid' || phoneResult === 'valid';
  const hasInvalidData = emailResult === 'invalid' || phoneResult === 'invalid';

  const overallValid = hasValidContact && !hasInvalidData;

  return {
    email: emailResult,
    phone: phoneResult,
    website: websiteResult,
    overallValid,
  };
}

/**
 * Check if a lead should be marked as qualified based on validation
 */
export function isValidForQualification(validation: ValidationResult): boolean {
  // Never qualify leads with invalid primary contact
  if (validation.phone === 'invalid' && validation.email === 'invalid') {
    return false;
  }

  // Must have at least one valid contact method
  return validation.phone === 'valid' || validation.email === 'valid';
}
