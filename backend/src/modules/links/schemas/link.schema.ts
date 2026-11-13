import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type LinkDocument = HydratedDocument<Link>;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Link extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: '↗' })
  icon: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: true })
  visible: boolean;

  @Prop({ trim: true })
  category?: string;

  @Prop()
  expiresAt?: Date;

  @Prop()
  scheduledStart?: Date;

  @Prop({ type: Number, default: 0 })
  clicks: number;

  /** Position used for ordering — lower = higher in the list */
  @Prop({ type: Number, default: 0 })
  order: number;
}

export const LinkSchema = SchemaFactory.createForClass(Link);
// Compound index for fast per-user ordered queries
LinkSchema.index({ userId: 1, order: 1 });
