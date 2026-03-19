import { describe, it, expect } from 'vitest';
import { calculateReadingTime } from './reading-time';

describe('calculateReadingTime', () => {
  it('should return at least 1 minute for any content', () => {
    const result = calculateReadingTime('Hello', 'en');
    expect(result.minutes).toBeGreaterThanOrEqual(1);
  });

  it('should return at least 1 minute for empty content', () => {
    const result = calculateReadingTime('', 'en');
    expect(result.minutes).toBe(1);
    expect(result.words).toBe(0);
  });

  it('should count English words correctly', () => {
    const words = Array(200).fill('word').join(' ');
    const result = calculateReadingTime(words, 'en');
    expect(result.words).toBe(200);
    expect(result.minutes).toBe(1); // 200 words / 200 wpm = 1 min
  });

  it('should count CJK characters correctly', () => {
    const chars = '中'.repeat(300);
    const result = calculateReadingTime(chars, 'zh-CN');
    expect(result.words).toBe(300);
    expect(result.minutes).toBe(1); // 300 chars / 300 cpm = 1 min
  });

  it('should handle mixed CJK and English content', () => {
    // 300 CJK chars (1 min) + 200 English words (1 min) = 2 min
    const cjk = '中'.repeat(300);
    const english = Array(200).fill('word').join(' ');
    const result = calculateReadingTime(cjk + ' ' + english, 'zh-CN');
    expect(result.words).toBe(300 + 200);
    expect(result.minutes).toBe(2);
  });

  it('should ceil minutes up', () => {
    // 1 English word = 1/200 min = 0.005 min → ceil to 1
    const result = calculateReadingTime('hello', 'en');
    expect(result.minutes).toBe(1);
  });

  it('should increase minutes with longer content', () => {
    const short = calculateReadingTime('hello world', 'en');
    const long = calculateReadingTime(Array(1000).fill('word').join(' '), 'en');
    expect(long.minutes).toBeGreaterThan(short.minutes);
  });

  it('should handle whitespace-only content', () => {
    const result = calculateReadingTime('   \n\t  ', 'en');
    expect(result.minutes).toBe(1);
    expect(result.words).toBe(0);
  });

  it('should work with both locale values', () => {
    const content = '这是一段中文内容 with some English words';
    const zhResult = calculateReadingTime(content, 'zh-CN');
    const enResult = calculateReadingTime(content, 'en');
    // Same content should produce same word count regardless of locale
    expect(zhResult.words).toBe(enResult.words);
  });
});
