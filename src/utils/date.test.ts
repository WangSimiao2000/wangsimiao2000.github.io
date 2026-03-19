import { describe, it, expect } from 'vitest';
import { formatDate, formatISODate } from './date';

describe('formatDate', () => {
  it('should format date in zh-CN format (YYYY/MM/DD)', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDate(date, 'zh-CN')).toBe('2024/01/15');
  });

  it('should format date in en format (MMM DD, YYYY)', () => {
    const date = new Date(2024, 0, 15);
    expect(formatDate(date, 'en')).toBe('Jan 15, 2024');
  });

  it('should zero-pad month and day in zh-CN format', () => {
    const date = new Date(2024, 2, 5); // Mar 5, 2024
    expect(formatDate(date, 'zh-CN')).toBe('2024/03/05');
  });

  it('should not zero-pad day in en format', () => {
    const date = new Date(2024, 2, 5);
    expect(formatDate(date, 'en')).toBe('Mar 5, 2024');
  });

  it('should default to zh-CN locale', () => {
    const date = new Date(2024, 11, 25); // Dec 25, 2024
    expect(formatDate(date)).toBe('2024/12/25');
  });

  it('should handle all 12 months in en format', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 12; i++) {
      const date = new Date(2024, i, 1);
      expect(formatDate(date, 'en')).toBe(`${months[i]} 1, 2024`);
    }
  });

  it('should handle end-of-year dates', () => {
    const date = new Date(2024, 11, 31); // Dec 31
    expect(formatDate(date, 'zh-CN')).toBe('2024/12/31');
    expect(formatDate(date, 'en')).toBe('Dec 31, 2024');
  });
});

describe('formatISODate', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15);
    expect(formatISODate(date)).toBe('2024-01-15');
  });

  it('should zero-pad month and day', () => {
    const date = new Date(2024, 2, 5);
    expect(formatISODate(date)).toBe('2024-03-05');
  });
});
