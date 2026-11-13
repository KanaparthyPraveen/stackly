import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type ChangelogDocument = HydratedDocument<Changelog>;

export type ChangeAction =
  | 'link.created'
  | 'link.updated'
  | 'link.deleted'
  | 'link.reordered'
  | 'link.toggled'
  | 'profile.updated'
  | 'profile.published'
  | 'profile.unpublished'
  | 'appearance.updated'
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.synced'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.reordered'
  | 'component.created'
  | 'component.updated'
  | 'component.deleted'
  | 'component.reordered'
  | 'media.uploaded'
  | 'media.updated'
  | 'media.deleted'
  | 'template.created'
  | 'template.updated'
  | 'template.deleted'
  | 'template.applied'
  | 'template.duplicated';

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Changelog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  action: ChangeAction;

  /** Human-readable summary of the change */
  @Prop({ required: true })
  summary: string;

  /** Snapshot of what changed: { before, after } or any relevant payload */
  @Prop({ type: Object, default: () => ({}) })
  payload: Record<string, unknown>;

  /** Reference ID of the affected entity (linkId, integrationId, etc.) */
  @Prop()
  entityId?: string;
}

export const ChangelogSchema = SchemaFactory.createForClass(Changelog);
// Keep last 1000 entries per user (TTL index on createdAt — 6 months)
ChangelogSchema.index({ userId: 1, createdAt: -1 });
ChangelogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 180 },
);
