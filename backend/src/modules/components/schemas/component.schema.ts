import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type ComponentDocument = HydratedDocument<ProfileComponent>;

export type ComponentType =
  | 'hero'
  | 'about'
  | 'links'
  | 'projects'
  | 'skills'
  | 'experience'
  | 'timeline'
  | 'gallery'
  | 'resume'
  | 'github'
  | 'discord'
  | 'spotify'
  | 'contact'
  | 'social_cards'
  | 'custom_section';

export const COMPONENT_TYPES: ComponentType[] = [
  'hero',
  'about',
  'links',
  'projects',
  'skills',
  'experience',
  'timeline',
  'gallery',
  'resume',
  'github',
  'discord',
  'spotify',
  'contact',
  'social_cards',
  'custom_section',
];

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class ProfileComponent extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: COMPONENT_TYPES })
  type: ComponentType;

  @Prop({ trim: true })
  title?: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: true })
  visible: boolean;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop()
  scheduledStart?: Date;

  @Prop()
  scheduledEnd?: Date;

  /** Typed discriminated configuration per component type */
  @Prop({ type: Object, default: () => ({}) })
  config: Record<string, unknown>;
}

export const ProfileComponentSchema =
  SchemaFactory.createForClass(ProfileComponent);
ProfileComponentSchema.index({ userId: 1, order: 1 });
export const ComponentSchema = ProfileComponentSchema;
