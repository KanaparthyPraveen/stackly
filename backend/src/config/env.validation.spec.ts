import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { validate } from './env.validation';

describe('env.validation', () => {
  it('should validate and apply defaults for empty config', () => {
    const config = validate({});
    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe('development');
    expect(config.FRONTEND_URL).toBe('http://localhost:3000');
    expect(config.MONGODB_URI).toBe('mongodb://localhost:27017/stackly');
    expect(config.SESSION_SECRET).toBe(
      'dev-session-secret-change-in-production',
    );
    expect(config.SESSION_MAX_AGE_MS).toBe(86400000);
  });

  it('should accept valid custom configuration', () => {
    const config = validate({
      PORT: '4000',
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://stackly.dev',
      MONGODB_URI: 'mongodb://remote-host:27017/stackly_prod',
      SESSION_SECRET: 'custom-prod-secret-with-enough-entropy-0001',
      ENCRYPTION_KEY: 'custom-prod-encryption-key-with-entropy-0001',
      SESSION_MAX_AGE_MS: '3600000',
    });

    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('production');
    expect(config.FRONTEND_URL).toBe('https://stackly.dev');
    expect(config.MONGODB_URI).toBe('mongodb://remote-host:27017/stackly_prod');
    expect(config.SESSION_SECRET).toBe(
      'custom-prod-secret-with-enough-entropy-0001',
    );
    expect(config.SESSION_MAX_AGE_MS).toBe(3600000);
  });

  it('should refuse the development session secret in production', () => {
    expect(() =>
      validate({
        NODE_ENV: 'production',
        ENCRYPTION_KEY: 'custom-prod-encryption-key-with-entropy-0001',
      }),
    ).toThrow('SESSION_SECRET');
  });

  it('should require an encryption key in production', () => {
    expect(() =>
      validate({
        NODE_ENV: 'production',
        SESSION_SECRET: 'custom-prod-secret-with-enough-entropy-0001',
      }),
    ).toThrow('ENCRYPTION_KEY');
  });

  it('should treat empty values as unset', () => {
    const config = validate({ PORT: '', GITHUB_CLIENT_ID: '' });
    expect(config.PORT).toBe(3001);
    expect(config.GITHUB_CLIENT_ID).toBeUndefined();
  });

  it('should throw an error for invalid NODE_ENV', () => {
    expect(() => {
      validate({ NODE_ENV: 'invalid_env' });
    }).toThrow('Environment validation error');
  });

  it('should throw an error for non-numeric PORT', () => {
    expect(() => {
      validate({ PORT: 'not-a-number' });
    }).toThrow('Environment validation error');
  });
});
