import { BadRequestException } from '@nestjs/common';
import { ComponentType, COMPONENT_TYPES } from './schemas/component.schema';

type Config = Record<string, unknown>;

export interface ComponentDefinition {
  type: ComponentType;
  defaultTitle: string;
  defaultConfig: Config;
  /**
   * Validates a merged configuration and returns the normalised version that
   * is stored. Unknown keys are dropped.
   */
  sanitize: (config: Config) => Config;
  /**
   * Keys that describe presentation rather than personal content. Only these
   * survive when a profile is turned into a reusable template.
   */
  templateKeys: string[];
}

/* ─── Field validators ─────────────────────────────────────────────────── */

function fail(path: string, rule: string): never {
  throw new BadRequestException(`${path} ${rule}`);
}

function text(value: unknown, path: string, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') fail(path, 'must be a string');
  if (value.length > max) fail(path, `must be at most ${max} characters`);
  return value;
}

function flag(value: unknown, path: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') fail(path, 'must be a boolean');
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function integer(
  value: unknown,
  path: string,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(path, 'must be a whole number');
  }
  if (value < min || value > max)
    fail(path, `must be between ${min} and ${max}`);
  return value;
}

/**
 * An http(s) URL, or an empty string. Anything else — notably `javascript:`
 * and `data:` URLs — is rejected because these values become links on a
 * public page.
 */
function webUrl(value: unknown, path: string): string {
  const raw = text(value, path, 2000).trim();
  if (raw === '') return '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(path, 'must be a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(path, 'must be an http(s) URL');
  }
  return parsed.toString();
}

function emailAddress(value: unknown, path: string): string {
  const raw = text(value, path, 254).trim();
  if (raw === '') return '';
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(raw)) {
    fail(path, 'must be a valid email address');
  }
  return raw;
}

function list<T>(
  value: unknown,
  path: string,
  maxItems: number,
  mapItem: (item: unknown, itemPath: string) => T | null,
): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(path, 'must be an array');
  if (value.length > maxItems)
    fail(path, `must contain at most ${maxItems} items`);
  const out: T[] = [];
  value.forEach((item, index) => {
    const mapped = mapItem(item, `${path}[${index}]`);
    if (mapped !== null) out.push(mapped);
  });
  return out;
}

function textList(
  value: unknown,
  path: string,
  maxItems: number,
  maxLength: number,
): string[] {
  return list(value, path, maxItems, (item, itemPath) => {
    const entry = text(item, itemPath, maxLength).trim();
    return entry === '' ? null : entry;
  });
}

function record(value: unknown, path: string): Config {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Config;
}

/** Reads the first of several accepted spellings of a field. */
function pick(source: Config, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

/* ─── Registry ─────────────────────────────────────────────────────────── */

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  hero: {
    type: 'hero',
    defaultTitle: 'Hero',
    defaultConfig: {
      headline: '',
      subline: '',
      showAvatar: true,
      badgeText: '',
    },
    templateKeys: ['showAvatar'],
    sanitize: (cfg) => ({
      headline: text(cfg.headline, 'hero.headline', 120),
      subline: text(cfg.subline, 'hero.subline', 240),
      showAvatar: flag(cfg.showAvatar, 'hero.showAvatar', true),
      badgeText: text(cfg.badgeText, 'hero.badgeText', 40),
    }),
  },
  about: {
    type: 'about',
    defaultTitle: 'About Me',
    defaultConfig: { content: '', highlights: [] },
    templateKeys: [],
    sanitize: (cfg) => ({
      content: text(cfg.content, 'about.content', 3000),
      highlights: textList(cfg.highlights, 'about.highlights', 12, 200),
    }),
  },
  links: {
    type: 'links',
    defaultTitle: 'Links',
    defaultConfig: { style: 'cards', category: 'all' },
    templateKeys: ['style'],
    sanitize: (cfg) => ({
      style: oneOf(
        cfg.style,
        'links.style',
        ['cards', 'buttons', 'minimal'],
        'cards',
      ),
      category: text(cfg.category, 'links.category', 50) || 'all',
    }),
  },
  projects: {
    type: 'projects',
    defaultTitle: 'Featured Projects',
    defaultConfig: { displayMode: 'grid', featuredOnly: false, limit: 6 },
    templateKeys: ['displayMode', 'featuredOnly', 'limit'],
    sanitize: (cfg) => ({
      displayMode: oneOf(
        cfg.displayMode,
        'projects.displayMode',
        ['grid', 'carousel', 'list'],
        'grid',
      ),
      featuredOnly: flag(cfg.featuredOnly, 'projects.featuredOnly', false),
      limit: integer(cfg.limit, 'projects.limit', 1, 24, 6),
    }),
  },
  skills: {
    type: 'skills',
    defaultTitle: 'Skills & Technologies',
    defaultConfig: { categories: [] },
    templateKeys: [],
    sanitize: (cfg) => ({
      categories: list(
        cfg.categories,
        'skills.categories',
        12,
        (item, path) => {
          if (typeof item === 'string') {
            const name = text(item, path, 60).trim();
            return name ? { name, items: [] as string[] } : null;
          }
          const entry = record(item, path);
          const name = text(
            pick(entry, 'name', 'title', 'category'),
            `${path}.name`,
            60,
          ).trim();
          if (!name) return null;
          return {
            name,
            items: textList(entry.items, `${path}.items`, 40, 40),
          };
        },
      ),
    }),
  },
  experience: {
    type: 'experience',
    defaultTitle: 'Experience',
    defaultConfig: { items: [] },
    templateKeys: [],
    sanitize: (cfg) => ({
      items: list(cfg.items, 'experience.items', 30, (item, path) => {
        const entry = record(item, path);
        const normalised = {
          title: text(
            pick(entry, 'title', 'role', 'name', 'headline'),
            `${path}.title`,
            120,
          ).trim(),
          company: text(
            pick(entry, 'company', 'organization', 'place'),
            `${path}.company`,
            120,
          ).trim(),
          date: text(pick(entry, 'date', 'period'), `${path}.date`, 60).trim(),
          description: text(
            pick(entry, 'description', 'body', 'summary'),
            `${path}.description`,
            1000,
          ),
        };
        return normalised.title || normalised.company || normalised.description
          ? normalised
          : null;
      }),
    }),
  },
  timeline: {
    type: 'timeline',
    defaultTitle: 'Milestones & Timeline',
    defaultConfig: { events: [] },
    templateKeys: [],
    sanitize: (cfg) => ({
      events: list(cfg.events, 'timeline.events', 50, (item, path) => {
        const entry = record(item, path);
        const normalised = {
          title: text(
            pick(entry, 'title', 'name', 'headline'),
            `${path}.title`,
            120,
          ).trim(),
          date: text(pick(entry, 'date', 'period'), `${path}.date`, 60).trim(),
          description: text(
            pick(entry, 'description', 'body', 'summary'),
            `${path}.description`,
            1000,
          ),
        };
        return normalised.title || normalised.description ? normalised : null;
      }),
    }),
  },
  gallery: {
    type: 'gallery',
    defaultTitle: 'Gallery',
    defaultConfig: { images: [], layout: 'grid' },
    templateKeys: ['layout'],
    sanitize: (cfg) => ({
      images: list(cfg.images, 'gallery.images', 24, (item, path) => {
        const entry =
          typeof item === 'string' ? { url: item } : record(item, path);
        const url = webUrl(pick(entry, 'url', 'src'), `${path}.url`);
        if (!url) return null;
        return {
          url,
          caption: text(pick(entry, 'caption', 'alt'), `${path}.caption`, 160),
        };
      }),
      layout: oneOf(
        cfg.layout,
        'gallery.layout',
        ['grid', 'masonry', 'carousel'],
        'grid',
      ),
    }),
  },
  resume: {
    type: 'resume',
    defaultTitle: 'Resume',
    defaultConfig: {
      resumeUrl: '',
      downloadEnabled: true,
      buttonLabel: 'Download Resume',
    },
    templateKeys: ['downloadEnabled', 'buttonLabel'],
    sanitize: (cfg) => ({
      resumeUrl: webUrl(cfg.resumeUrl, 'resume.resumeUrl'),
      downloadEnabled: flag(
        cfg.downloadEnabled,
        'resume.downloadEnabled',
        true,
      ),
      buttonLabel:
        text(cfg.buttonLabel, 'resume.buttonLabel', 40) || 'Download Resume',
    }),
  },
  github: {
    type: 'github',
    defaultTitle: 'GitHub Activity',
    defaultConfig: { showStats: true, showPinned: true, username: '' },
    templateKeys: ['showStats', 'showPinned'],
    sanitize: (cfg) => {
      const username = text(cfg.username, 'github.username', 39).trim();
      if (
        username &&
        !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username)
      ) {
        fail('github.username', 'must be a valid GitHub username');
      }
      return {
        showStats: flag(cfg.showStats, 'github.showStats', true),
        showPinned: flag(cfg.showPinned, 'github.showPinned', true),
        username,
      };
    },
  },
  discord: {
    type: 'discord',
    defaultTitle: 'Discord Community',
    defaultConfig: { serverInvite: '', showStatus: true },
    templateKeys: ['showStatus'],
    sanitize: (cfg) => ({
      serverInvite: webUrl(cfg.serverInvite, 'discord.serverInvite'),
      showStatus: flag(cfg.showStatus, 'discord.showStatus', true),
    }),
  },
  spotify: {
    type: 'spotify',
    defaultTitle: 'Now Listening',
    defaultConfig: { showCurrentTrack: true, showTopTracks: true },
    templateKeys: ['showCurrentTrack', 'showTopTracks'],
    sanitize: (cfg) => ({
      showCurrentTrack: flag(
        cfg.showCurrentTrack,
        'spotify.showCurrentTrack',
        true,
      ),
      showTopTracks: flag(cfg.showTopTracks, 'spotify.showTopTracks', true),
    }),
  },
  contact: {
    type: 'contact',
    defaultTitle: 'Get in Touch',
    defaultConfig: {
      email: '',
      formEnabled: true,
      messagePlaceholder: 'Say hello...',
    },
    templateKeys: ['formEnabled', 'messagePlaceholder'],
    sanitize: (cfg) => ({
      email: emailAddress(cfg.email, 'contact.email'),
      formEnabled: flag(cfg.formEnabled, 'contact.formEnabled', true),
      messagePlaceholder: text(
        cfg.messagePlaceholder,
        'contact.messagePlaceholder',
        160,
      ),
    }),
  },
  social_cards: {
    type: 'social_cards',
    defaultTitle: 'Socials',
    defaultConfig: { platforms: ['github', 'x', 'linkedin'] },
    templateKeys: ['platforms'],
    sanitize: (cfg) => ({
      platforms: textList(cfg.platforms, 'social_cards.platforms', 12, 30),
    }),
  },
  custom_section: {
    type: 'custom_section',
    defaultTitle: 'Custom Section',
    defaultConfig: { heading: '', bodyText: '', ctaLabel: '', ctaUrl: '' },
    templateKeys: [],
    sanitize: (cfg) => ({
      heading: text(cfg.heading, 'custom_section.heading', 120),
      bodyText: text(cfg.bodyText, 'custom_section.bodyText', 3000),
      ctaLabel: text(cfg.ctaLabel, 'custom_section.ctaLabel', 40),
      ctaUrl: webUrl(cfg.ctaUrl, 'custom_section.ctaUrl'),
    }),
  },
};

export function isComponentType(value: unknown): value is ComponentType {
  return (
    typeof value === 'string' &&
    COMPONENT_TYPES.includes(value as ComponentType)
  );
}

/**
 * Validates a component configuration against its type and returns the
 * normalised config to store: defaults filled in, unknown keys dropped.
 */
export function validateComponentConfig(
  type: ComponentType,
  config?: Config,
): Config {
  if (!isComponentType(type)) {
    throw new BadRequestException(
      `Invalid component type "${String(type)}". Allowed types: ${COMPONENT_TYPES.join(', ')}`,
    );
  }
  if (
    config !== undefined &&
    (typeof config !== 'object' || config === null || Array.isArray(config))
  ) {
    throw new BadRequestException('config must be an object');
  }

  const definition = COMPONENT_REGISTRY[type];
  return definition.sanitize({ ...definition.defaultConfig, ...config });
}

/**
 * Strips everything personal from a component configuration, keeping only
 * the presentation settings. Used when building a reusable template.
 */
export function toTemplateConfig(type: ComponentType, config?: Config): Config {
  const definition = COMPONENT_REGISTRY[type];
  const validated = validateComponentConfig(type, config);
  const out: Config = { ...definition.defaultConfig };
  for (const key of definition.templateKeys) {
    out[key] = validated[key];
  }
  return out;
}
