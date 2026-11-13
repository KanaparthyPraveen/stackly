import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

/**
 * An external identity linked to a Stackly account.
 *
 * `providerId` is the stable numeric/string id issued by the provider and is
 * the only thing used to match an incoming OAuth callback to an account.
 * The provider's username is stored for display but is never an identity key.
 */
@Schema({ _id: false })
export class AuthIdentity {
  @Prop({ required: true, lowercase: true, trim: true })
  provider: string;

  @Prop({ required: true, trim: true })
  providerId: string;

  @Prop({ trim: true })
  username?: string;

  @Prop({ trim: true })
  displayName?: string;

  @Prop({ trim: true })
  avatarUrl?: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ default: () => new Date() })
  linkedAt: Date;
}
export const AuthIdentitySchema = SchemaFactory.createForClass(AuthIdentity);

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    },
  },
})
export class User extends Document {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  /** Absent for accounts that only ever authenticate through an OAuth provider. */
  @Prop({ required: false })
  passwordHash?: string;

  @Prop({ type: [AuthIdentitySchema], default: [] })
  identities: AuthIdentity[];

  /** Display name chosen by the user, or the provider's name on first sign-in. */
  @Prop({ trim: true })
  displayName?: string;

  @Prop({ trim: true })
  avatarUrl?: string;

  /** True when the email address was supplied by an OAuth provider. */
  @Prop({ default: false })
  emailFromProvider: boolean;

  /**
   * True once ownership of the email address has been proven — today that
   * means an OAuth provider vouched for it. Password sign-up alone does not
   * prove ownership.
   */
  @Prop({ default: false })
  emailVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// One account per (provider, providerId) pair — this is what stops a second
// Stackly account being created for the same GitHub or Google identity.
UserSchema.index(
  { 'identities.provider': 1, 'identities.providerId': 1 },
  { unique: true, sparse: true },
);
