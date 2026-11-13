import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { AppearanceConfig, AppearanceConfigSchema } from './appearance.schema';

export type ProfileDocument = HydratedDocument<Profile>;

@Schema({ _id: false })
export class SocialLinks {
  @Prop() github?: string;
  @Prop() x?: string;
  @Prop() linkedin?: string;
  @Prop() discord?: string;
  @Prop() youtube?: string;
  @Prop() instagram?: string;
}
export const SocialLinksSchema = SchemaFactory.createForClass(SocialLinks);

export { AppearanceConfig, AppearanceConfigSchema } from './appearance.schema';

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Profile extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  username: string;

  @Prop({ trim: true })
  displayName?: string;

  @Prop({ trim: true })
  bio?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  website?: string;

  @Prop({ default: false })
  live: boolean;

  /** True once the user has explicitly chosen/claimed their username. */
  @Prop({ default: false })
  usernameClaimed: boolean;

  /**
   * Ghost mode: the profile stays fully intact for its owner but every public
   * surface (profile, links, projects, components) is hidden from visitors.
   */
  @Prop({ default: false })
  ghostMode: boolean;

  @Prop({ type: SocialLinksSchema, default: () => ({}) })
  social: SocialLinks;

  @Prop({ type: AppearanceConfigSchema, default: () => ({}) })
  appearance: AppearanceConfig;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
