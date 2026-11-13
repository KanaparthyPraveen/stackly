import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type IntegrationDocument = HydratedDocument<Integration>;

export const INTEGRATION_STATUSES = [
  'connected',
  'disconnected',
  /** The provider rejected the stored credential; the user must reconnect. */
  'reauth_required',
  /** Legacy value kept so documents written by earlier versions still load. */
  'coming-soon',
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const SYNC_STATUSES = ['idle', 'syncing', 'ok', 'error'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const INTEGRATION_KINDS = ['oauth', 'api_key', 'manual'] as const;
export type StoredIntegrationKind = (typeof INTEGRATION_KINDS)[number];

/**
 * A third-party account connected to a user's profile.
 *
 * This is deliberately separate from the sign-in identities on the user
 * document: connecting GitHub here does not let anyone sign in, and signing
 * in with GitHub does not connect it here.
 */
@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      // Defence in depth: credentials never serialise, even if a query
      // explicitly selected them.
      delete ret.accessToken;
      delete ret.refreshToken;
      return ret;
    },
  },
})
export class Integration extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** Provider id, e.g. "github", "discord", "spotify". */
  @Prop({ required: true, lowercase: true, trim: true })
  integrationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: INTEGRATION_KINDS })
  kind?: StoredIntegrationKind;

  @Prop({ type: String, enum: INTEGRATION_STATUSES, default: 'disconnected' })
  status: IntegrationStatus;

  /** Display handle, e.g. "@ada". */
  @Prop()
  handle?: string;

  /** Stable account id at the provider. */
  @Prop()
  externalId?: string;

  @Prop()
  profileUrl?: string;

  @Prop()
  avatarUrl?: string;

  /** Access token or API key — AES-256-GCM encrypted, never selected by default. */
  @Prop({ select: false })
  accessToken?: string;

  /** Refresh token — AES-256-GCM encrypted, never selected by default. */
  @Prop({ select: false })
  refreshToken?: string;

  @Prop()
  tokenExpiresAt?: Date;

  @Prop({ type: [String], default: undefined })
  scopes?: string[];

  /** Normalised provider data, cached so public pages never call the provider. */
  @Prop({ type: Object, default: () => ({}) })
  data: Record<string, unknown>;

  /** Provider metadata written by earlier versions. Superseded by `data`. */
  @Prop({ type: Object, default: () => ({}) })
  metadata: Record<string, unknown>;

  @Prop({ type: String, enum: SYNC_STATUSES, default: 'idle' })
  syncStatus: SyncStatus;

  @Prop()
  lastSyncedAt?: Date;

  /** Short, user-safe description of the last sync failure. */
  @Prop()
  lastSyncError?: string;

  @Prop({ type: Number, default: 0 })
  syncFailures: number;

  /** When the background job should next refresh this integration. */
  @Prop()
  nextSyncAt?: Date;

  /** Lease that stops two workers syncing the same integration at once. */
  @Prop()
  syncLockedUntil?: Date;

  @Prop()
  connectedAt?: Date;
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);
IntegrationSchema.index({ userId: 1, integrationId: 1 }, { unique: true });
IntegrationSchema.index({ status: 1, nextSyncAt: 1 });
