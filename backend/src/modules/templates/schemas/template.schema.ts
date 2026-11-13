import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import {
  AppearanceConfig,
  AppearanceConfigSchema,
} from '../../profile/schemas/appearance.schema';
import { COMPONENT_TYPES } from '../../components/schemas/component.schema';

export type TemplateDocument = HydratedDocument<Template>;

export { AppearanceConfig, AppearanceConfigSchema };

@Schema({ _id: false })
export class TemplateComponentConfig {
  @Prop({ required: true, enum: COMPONENT_TYPES }) type: string;
  @Prop({ required: true }) title: string;
  @Prop({ type: Number, default: 0 }) order: number;
  @Prop({ type: Object, default: () => ({}) }) config: Record<string, unknown>;
}
export const TemplateComponentConfigSchema = SchemaFactory.createForClass(
  TemplateComponentConfig,
);

/**
 * A reusable look: an appearance configuration plus a set of components.
 *
 * A template is a snapshot. Applying it copies its contents into a profile,
 * so later edits to the template never reach profiles that already used it.
 */
@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Template extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  creatorId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Asset reference used as the template's preview image. */
  @Prop()
  previewImageUrl?: string;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: true })
  isDraft: boolean;

  @Prop({ type: AppearanceConfigSchema, default: () => ({}) })
  appearance: AppearanceConfig;

  @Prop({ type: [TemplateComponentConfigSchema], default: [] })
  components: TemplateComponentConfig[];

  /** How many times the template has been applied to a profile. */
  @Prop({ type: Number, default: 0 })
  clonesCount: number;

  /** The template this one was duplicated from, if any. */
  @Prop({ type: Types.ObjectId, ref: 'Template' })
  sourceTemplateId?: Types.ObjectId;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);
TemplateSchema.index({ isPublic: 1, isDraft: 1, clonesCount: -1 });
