import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { UpdateAppearanceDto } from '../dto/profile.dto';
import { mergeAppearance, resolveAppearance } from './appearance.schema';

/** Mimics a Mongoose sub-document: values live behind `toObject()`. */
function asSubdocument(values: Record<string, unknown>) {
  return {
    $__: { internal: true },
    _doc: values,
    toObject: () => values,
  };
}

describe('appearance merge', () => {
  it('reads stored values out of a Mongoose sub-document', () => {
    const stored = asSubdocument({
      accent: 'jade',
      background: 'gradient',
      surface: { style: 'elevated', opacity: 42, borderWidth: 1, radius: 22 },
    });

    const resolved = resolveAppearance(stored);

    expect(resolved.accent).toBe('jade');
    expect(resolved.background).toBe('gradient');
    expect(resolved.surface.style).toBe('elevated');
    expect(resolved.surface.opacity).toBe(42);
  });

  it('applies a validated DTO instance without wiping unset fields', () => {
    const stored = {
      accent: 'jade',
      background: 'gradient',
      layout: 'compact',
    };
    // A class instance carries every declared property, most of them undefined.
    const patch = plainToInstance(UpdateAppearanceDto, {
      surface: { opacity: 60 },
    });

    const merged = mergeAppearance(stored, patch);

    expect(merged.surface.opacity).toBe(60);
    expect(merged.surface.style).toBe('glass');
    expect(merged.accent).toBe('jade');
    expect(merged.background).toBe('gradient');
    expect(merged.layout).toBe('compact');
  });

  it('clears an optional colour override with null', () => {
    const stored = { colors: { primary: '#FF0055', secondary: '#00FFAA' } };

    const merged = mergeAppearance(stored, { colors: { primary: null } });

    expect(merged.colors.primary).toBeUndefined();
    expect(merged.colors.secondary).toBe('#00FFAA');
  });

  it('restores the default when a required field is set to null', () => {
    const merged = mergeAppearance(
      { surface: { opacity: 80 } },
      { surface: { opacity: null } },
    );
    expect(merged.surface.opacity).toBe(5);
  });

  it('fills every section for an empty stored config', () => {
    const resolved = resolveAppearance(undefined);
    expect(resolved.accent).toBe('signal');
    expect(resolved.canvas.contentWidth).toBe(680);
    expect(resolved.layoutOrder).toEqual([]);
  });
});
