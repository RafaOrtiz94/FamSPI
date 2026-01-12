/**
 * Tests para dateUtils
 */

import {
  toDate,
  formatDateSafe,
  formatDateTimeSafe,
  isValidDateInput,
  toISOStringSafe
} from './dateUtils';

describe('dateUtils', () => {
  describe('toDate', () => {
    it('should handle null/undefined', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
      expect(toDate('')).toBeNull();
    });

    it('should handle valid Date objects', () => {
      const date = new Date('2026-01-09T12:00:00Z');
      expect(toDate(date)).toEqual(date);
    });

    it('should handle ISO strings', () => {
      const result = toDate('2026-01-09T12:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2026-01-09T12:00:00.000Z');
    });

    it('should handle epoch timestamps (seconds)', () => {
      const result = toDate(1672531200); // 2023-01-01T00:00:00Z in seconds
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should handle epoch timestamps (milliseconds)', () => {
      const result = toDate(1672531200000); // 2023-01-01T00:00:00Z in ms
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should handle invalid strings', () => {
      expect(toDate('invalid')).toBeNull();
      expect(toDate('not-a-date')).toBeNull();
    });

    it('should handle YYYY-MM-DD format', () => {
      const result = toDate('2026-01-09');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString().startsWith('2026-01-09')).toBe(true);
    });
  });

  describe('formatDateSafe', () => {
    it('should format valid dates', () => {
      const result = formatDateSafe('2026-01-09T12:00:00Z', 'dd/MM/yyyy');
      expect(result).toBe('09/01/2026');
    });

    it('should return placeholder for invalid inputs', () => {
      expect(formatDateSafe(null)).toBe('—');
      expect(formatDateSafe(undefined)).toBe('—');
      expect(formatDateSafe('invalid')).toBe('—');
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-01-09T12:00:00Z');
      const result = formatDateSafe(date, 'yyyy-MM-dd');
      expect(result).toBe('2026-01-09');
    });
  });

  describe('formatDateTimeSafe', () => {
    it('should format valid dates with time', () => {
      const result = formatDateTimeSafe('2026-01-09T12:00:00Z');
      expect(result).toBe('09/01/2026 12:00');
    });

    it('should return placeholder for invalid inputs', () => {
      expect(formatDateTimeSafe(null)).toBe('—');
      expect(formatDateTimeSafe('invalid')).toBe('—');
    });
  });

  describe('isValidDateInput', () => {
    it('should return true for valid inputs', () => {
      expect(isValidDateInput('2026-01-09T12:00:00Z')).toBe(true);
      expect(isValidDateInput(new Date())).toBe(true);
      expect(isValidDateInput(1672531200)).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isValidDateInput(null)).toBe(false);
      expect(isValidDateInput('invalid')).toBe(false);
      expect(isValidDateInput('')).toBe(false);
    });
  });

  describe('toISOStringSafe', () => {
    it('should return ISO string for valid dates', () => {
      const result = toISOStringSafe('2026-01-09T12:00:00Z');
      expect(result).toBe('2026-01-09T12:00:00.000Z');
    });

    it('should return null for invalid inputs', () => {
      expect(toISOStringSafe(null)).toBeNull();
      expect(toISOStringSafe('invalid')).toBeNull();
    });
  });
});