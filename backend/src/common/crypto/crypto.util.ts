import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const DEV_FALLBACK_KEY = 'stackly-default-dev-secret-32-byte-key';

/**
 * AES-256-GCM encryption for provider credentials stored at rest.
 *
 * Ciphertext format: `<iv hex>:<auth tag hex>:<ciphertext hex>`.
 * The key is derived from `ENCRYPTION_KEY` (falling back to `SESSION_SECRET`
 * so an existing development database keeps working). Production refuses to
 * start without a real key — see `env.validation.ts`.
 */
export class TokenEncryption {
  private static getKey(configuredKey?: string): Buffer {
    const raw =
      configuredKey ||
      process.env.ENCRYPTION_KEY ||
      process.env.SESSION_SECRET ||
      (process.env.NODE_ENV === 'production' ? '' : DEV_FALLBACK_KEY);

    if (!raw) {
      throw new Error('ENCRYPTION_KEY is not configured');
    }
    return createHash('sha256').update(raw).digest();
  }

  static encrypt(plaintext: string, secretKey?: string): string {
    const key = this.getKey(secretKey);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /** True when the value has the shape produced by {@link encrypt}. */
  static isEncrypted(value: string): boolean {
    return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/i.test(value);
  }

  static decrypt(cipherText: string, secretKey?: string): string {
    if (!this.isEncrypted(cipherText)) {
      // Legacy value written before encryption at rest existed.
      return cipherText;
    }

    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    const key = this.getKey(secretKey);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
