import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Project extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  @Prop({ type: [String], default: [] })
  tech: string[];

  @Prop({ trim: true })
  repoUrl?: string;

  @Prop({ trim: true })
  liveUrl?: string;

  @Prop({ trim: true })
  docsUrl?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({
    enum: ['live', 'beta', 'wip', 'archived'],
    default: 'live',
  })
  status: string;

  @Prop({ default: false })
  featured: boolean;

  @Prop({ default: true })
  visible: boolean;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop()
  githubRepoId?: number;

  @Prop()
  githubRepoName?: string;

  @Prop({ type: Number, default: 0 })
  stars: number;

  @Prop({ type: Number, default: 0 })
  forks: number;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ userId: 1, order: 1 });
ProjectSchema.index({ userId: 1, featured: 1 });
