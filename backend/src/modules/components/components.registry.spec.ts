import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  toTemplateConfig,
  validateComponentConfig,
} from './components.registry';

describe('component registry', () => {
  it('fills in defaults and drops unknown keys', () => {
    const config = validateComponentConfig('hero', {
      headline: 'Hello',
      __proto__pollution: true,
      extra: 'nope',
    });

    expect(config).toEqual({
      headline: 'Hello',
      subline: '',
      showAvatar: true,
      badgeText: '',
    });
  });

  it('rejects script URLs that would become links on a public page', () => {
    expect(() =>
      validateComponentConfig('custom_section', {
        ctaUrl: 'javascript:alert(1)',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      validateComponentConfig('resume', {
        resumeUrl: 'data:text/html,<script>1</script>',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      validateComponentConfig('gallery', { images: ['javascript:alert(1)'] }),
    ).toThrow(BadRequestException);
  });

  it('accepts http(s) URLs', () => {
    const config = validateComponentConfig('custom_section', {
      ctaLabel: 'Docs',
      ctaUrl: 'https://example.com/docs',
    });
    expect(config.ctaUrl).toBe('https://example.com/docs');
  });

  it('rejects wrong types and oversized values', () => {
    expect(() => validateComponentConfig('hero', { headline: 42 })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateComponentConfig('about', { content: 'x'.repeat(5000) }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateComponentConfig('contact', { email: 'not-an-email' }),
    ).toThrow(BadRequestException);
    expect(() => validateComponentConfig('projects', { limit: 9999 })).toThrow(
      BadRequestException,
    );
  });

  it('normalises list items into a stable shape', () => {
    const config = validateComponentConfig('experience', {
      items: [
        { role: 'Engineer', organization: 'Acme', summary: 'Built things' },
      ],
    });
    expect(config.items).toEqual([
      {
        title: 'Engineer',
        company: 'Acme',
        date: '',
        description: 'Built things',
      },
    ]);
  });

  it('rejects an unknown component type', () => {
    expect(() => validateComponentConfig('nope' as never, {})).toThrow(
      BadRequestException,
    );
  });

  it('keeps only presentation settings when building a template', () => {
    expect(
      toTemplateConfig('contact', {
        email: 'ada@example.com',
        formEnabled: false,
        messagePlaceholder: 'Write to me',
      }),
    ).toEqual({
      email: '',
      formEnabled: false,
      messagePlaceholder: 'Write to me',
    });

    expect(
      toTemplateConfig('about', {
        content: 'My private life story',
        highlights: ['Secret'],
      }),
    ).toEqual({ content: '', highlights: [] });

    expect(
      toTemplateConfig('resume', {
        resumeUrl: 'https://example.com/my-cv.pdf',
        buttonLabel: 'Get CV',
      }),
    ).toEqual({ resumeUrl: '', downloadEnabled: true, buttonLabel: 'Get CV' });
  });
});
