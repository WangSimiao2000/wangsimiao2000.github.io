/**
 * 数据加载工具函数
 * 从 data/*.yml 读取 YAML 数据文件并返回类型化的数据
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type {
  FriendLink,
  GalleryItem,
  ToolItem,
  ContactItem,
  Locale,
} from '../types';

/** 分享平台配置 */
export interface SharePlatform {
  type: string;
  icon: string;
  link: string;
}

export interface ShareData {
  platforms: SharePlatform[];
}

/** 项目根目录下的 data/ 路径 */
function getDataDir(): string {
  return path.resolve(process.cwd(), 'data');
}

/** 读取并解析 YAML 文件 */
function loadYaml<T>(filePath: string): T {
  const fullPath = path.resolve(getDataDir(), filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return yaml.load(content) as T;
}

/** 加载友链数据 */
export function loadFriends(): FriendLink[] {
  return loadYaml<FriendLink[]>('friends.yml');
}

/** 友链检查结果 */
export interface FriendsChecked {
  alive: FriendLink[];
  dead: FriendLink[];
}

/** 加载友链检查结果（如果存在） */
export function loadFriendsChecked(): FriendsChecked | null {
  const fullPath = path.resolve(getDataDir(), 'friends_checked.yml');
  if (!fs.existsSync(fullPath)) return null;
  return loadYaml<FriendsChecked>('friends_checked.yml');
}

/** 加载相册数据 */
export function loadGallery(): GalleryItem[] {
  return loadYaml<GalleryItem[]>('gallery.yml');
}

/** 加载工具列表数据 */
export function loadTools(): ToolItem[] {
  return loadYaml<ToolItem[]>('tools.yml');
}

/** 加载社交联系方式数据 */
export function loadContact(): ContactItem[] {
  return loadYaml<ContactItem[]>('contact.yml');
}

/** 加载分享平台配置 */
export function loadShare(): ShareData {
  return loadYaml<ShareData>('share.yml');
}

/** 加载指定语言的 locale 数据 */
export function loadLocale(locale: Locale): Record<string, unknown> {
  return loadYaml<Record<string, unknown>>(`locales/${locale}.yml`);
}
