import { describe, it, expect } from 'vitest';
import {
  loadFriends,
  loadGallery,
  loadTools,
  loadContact,
  loadShare,
  loadLocale,
} from './data';

describe('Data loading utilities', () => {
  describe('loadFriends', () => {
    it('should load friends data as an array', () => {
      const friends = loadFriends();
      expect(Array.isArray(friends)).toBe(true);
      expect(friends.length).toBeGreaterThan(0);
    });

    it('should have required fields for each friend', () => {
      const friends = loadFriends();
      for (const friend of friends) {
        expect(friend).toHaveProperty('name');
        expect(friend).toHaveProperty('url');
        expect(typeof friend.name).toBe('string');
        expect(typeof friend.url).toBe('string');
      }
    });
  });

  describe('loadGallery', () => {
    it('should load gallery data as an array', () => {
      const gallery = loadGallery();
      expect(Array.isArray(gallery)).toBe(true);
      expect(gallery.length).toBeGreaterThan(0);
    });

    it('should have required fields for each gallery item', () => {
      const gallery = loadGallery();
      for (const item of gallery) {
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('image');
        expect(item).toHaveProperty('key');
      }
    });
  });

  describe('loadTools', () => {
    it('should load tools data as an array', () => {
      const tools = loadTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should have required fields for each tool', () => {
      const tools = loadTools();
      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('url');
        expect(tool).toHaveProperty('icon');
      }
    });
  });

  describe('loadContact', () => {
    it('should load contact data as an array', () => {
      const contacts = loadContact();
      expect(Array.isArray(contacts)).toBe(true);
      expect(contacts.length).toBeGreaterThan(0);
    });

    it('should have required fields for each contact', () => {
      const contacts = loadContact();
      for (const contact of contacts) {
        expect(contact).toHaveProperty('type');
        expect(contact).toHaveProperty('icon');
      }
    });
  });

  describe('loadShare', () => {
    it('should load share data with platforms array', () => {
      const share = loadShare();
      expect(share).toHaveProperty('platforms');
      expect(Array.isArray(share.platforms)).toBe(true);
      expect(share.platforms.length).toBeGreaterThan(0);
    });

    it('should have required fields for each share platform', () => {
      const share = loadShare();
      for (const platform of share.platforms) {
        expect(platform).toHaveProperty('type');
        expect(platform).toHaveProperty('icon');
        expect(platform).toHaveProperty('link');
      }
    });
  });

  describe('loadLocale', () => {
    it('should load zh-CN locale data', () => {
      const locale = loadLocale('zh-CN');
      expect(locale).toHaveProperty('layout');
      expect(locale).toHaveProperty('tabs');
      expect(locale).toHaveProperty('search');
      expect(locale).toHaveProperty('post');
    });

    it('should load en locale data', () => {
      const locale = loadLocale('en');
      expect(locale).toHaveProperty('layout');
      expect(locale).toHaveProperty('tabs');
      expect(locale).toHaveProperty('search');
      expect(locale).toHaveProperty('post');
    });

    it('should have matching top-level keys in both locales', () => {
      const zhCN = loadLocale('zh-CN');
      const en = loadLocale('en');
      const zhKeys = Object.keys(zhCN).sort();
      const enKeys = Object.keys(en).sort();
      expect(zhKeys).toEqual(enKeys);
    });
  });
});
