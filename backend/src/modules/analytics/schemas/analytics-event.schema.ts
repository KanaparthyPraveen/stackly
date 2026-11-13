import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type AnalyticsEventDocument = HydratedDocument<AnalyticsEvent>;

export type EventType = 'profile_view' | 'link_click' | 'project_click';

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class AnalyticsEvent extends Document {
  /** Owner of the profile being viewed */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  profileUserId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['profile_view', 'link_click', 'project_click'],
  })
  eventType: EventType;

  /** Fingerprint for dedup: IP + UA hash (not stored raw) */
  @Prop({ select: false })
  fingerprint?: string;

  /** entity ID — linkId or projectId for click events */
  @Prop()
  entityId?: string;

  /** entity label — link title or project name for display */
  @Prop()
  entityLabel?: string;

  /** Country code (2-letter ISO) derived from IP — only stored if available */
  @Prop()
  country?: string;

  /** Broad device category: mobile, desktop, tablet */
  @Prop()
  deviceCategory?: string;

  /** Broad browser category: chrome, firefox, safari, other */
  @Prop()
  browserCategory?: string;

  /** Referrer domain only (not full URL) */
  @Prop()
  referrerDomain?: string;
}

export const AnalyticsEventSchema =
  SchemaFactory.createForClass(AnalyticsEvent);
// Index for per-profile queries ordered by time
AnalyticsEventSchema.index({ profileUserId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ profileUserId: 1, eventType: 1, createdAt: -1 });
// Auto-delete events older than 1 year (privacy + storage)
AnalyticsEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 },
);
