import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { AuthIdentity, User, UserDocument } from './schemas/user.schema';

/** The shape of an identity returned by an OAuth provider. */
export interface ExternalIdentity {
  provider: string;
  providerId: string;
  username?: string;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
}

/** Account details safe to return to the account's owner. */
export interface AccountDto {
  id: string;
  email: string;
  /** False when the address is a placeholder generated for an OAuth account. */
  emailIsPlaceholder: boolean;
  displayName?: string;
  avatarUrl?: string;
  hasPassword: boolean;
  identities: Array<{
    provider: string;
    username?: string;
    displayName?: string;
    email?: string;
    linkedAt?: string;
  }>;
}

const PLACEHOLDER_EMAIL_DOMAIN = 'oauth.stackly.local';

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;
    return bcrypt.compare(password, hash);
  }

  async create(email: string, plainPassword: string): Promise<UserDocument> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.hashPassword(plainPassword);
    const createdUser = new this.userModel({
      email: normalizedEmail,
      passwordHash,
    });

    try {
      return await createdUser.save();
    } catch (err) {
      // Two concurrent registrations for the same address: the unique index
      // is the source of truth.
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Finds the account already linked to an external identity.
   * The provider's stable id is the only key used here.
   */
  async findByIdentity(
    provider: string,
    providerId: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        identities: {
          $elemMatch: {
            provider: provider.toLowerCase(),
            providerId: String(providerId),
          },
        },
      })
      .exec();
  }

  private toIdentity(identity: ExternalIdentity): AuthIdentity {
    return {
      provider: identity.provider.toLowerCase(),
      providerId: String(identity.providerId),
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      email: identity.email,
      linkedAt: new Date(),
    };
  }

  /**
   * Links an external identity to an existing account without touching the
   * account's password or other credentials. Linking an identity that is
   * already attached refreshes its display details.
   */
  async linkIdentity(
    userId: string,
    identity: ExternalIdentity,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    const provider = identity.provider.toLowerCase();
    const providerId = String(identity.providerId);

    const existing = user.identities?.find(
      (i) => i.provider === provider && i.providerId === providerId,
    );

    if (existing) {
      existing.username = identity.username ?? existing.username;
      existing.displayName = identity.displayName ?? existing.displayName;
      existing.avatarUrl = identity.avatarUrl ?? existing.avatarUrl;
      existing.email = identity.email ?? existing.email;
    } else {
      user.identities = [...(user.identities ?? []), this.toIdentity(identity)];
    }

    if (!user.displayName && identity.displayName) {
      user.displayName = identity.displayName;
    }
    if (!user.avatarUrl && identity.avatarUrl) {
      user.avatarUrl = identity.avatarUrl;
    }

    try {
      await user.save();
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException(
          'That provider account is already linked to another Stackly account',
        );
      }
      throw err;
    }
    return user;
  }

  /**
   * Removes a linked identity. Refused when it is the account's only way to
   * sign in, which would lock the owner out.
   */
  async unlinkIdentity(
    userId: string,
    provider: string,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    const normalized = provider.toLowerCase();
    const remaining = (user.identities ?? []).filter(
      (i) => i.provider !== normalized,
    );

    if (remaining.length === (user.identities ?? []).length) {
      throw new NotFoundException(
        'That provider is not linked to this account',
      );
    }
    if (!user.passwordHash && remaining.length === 0) {
      throw new BadRequestException(
        'Set a password before unlinking your only sign-in method',
      );
    }

    user.identities = remaining;
    await user.save();
    return user;
  }

  /**
   * Creates an account for an OAuth identity. No password is stored, so the
   * account can only be reached through the provider until the user sets one.
   */
  async createOAuthUser(identity: ExternalIdentity): Promise<UserDocument> {
    const email = this.buildOAuthEmail(identity);

    const created = new this.userModel({
      email,
      identities: [this.toIdentity(identity)],
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      emailFromProvider: true,
      emailVerified: Boolean(identity.email && identity.emailVerified),
    });

    try {
      return await created.save();
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // A concurrent callback for the same identity won the race.
      const winner = await this.findByIdentity(
        identity.provider,
        identity.providerId,
      );
      if (winner) return winner;
      throw new ConflictException('An account with this email already exists');
    }
  }

  /**
   * Builds the address stored for an OAuth account. When the provider does
   * not vouch for an email, a deterministic placeholder is used; its domain
   * makes it obvious the address is not real and can never receive mail.
   */
  private buildOAuthEmail(identity: ExternalIdentity): string {
    if (identity.email && identity.emailVerified) {
      return identity.email.toLowerCase().trim();
    }

    const provider = identity.provider.toLowerCase();
    const id = String(identity.providerId).replace(/[^a-zA-Z0-9]/g, '');
    return `${provider}-${id}@${PLACEHOLDER_EMAIL_DOMAIN}`;
  }

  /**
   * Changes the account password. Accounts created through OAuth have no
   * password yet, so the first one can be set without a current password —
   * the caller is already authenticated through their provider.
   */
  async updatePassword(
    userId: string,
    currentPass: string | undefined,
    newPass: string,
  ): Promise<void> {
    const user = await this.findById(userId);

    if (user.passwordHash) {
      const matches = await this.comparePassword(
        currentPass ?? '',
        user.passwordHash,
      );
      if (!matches) {
        throw new BadRequestException('Current password does not match');
      }
    }

    user.passwordHash = await this.hashPassword(newPass);
    await user.save();
  }

  /**
   * Called when an OAuth provider proves ownership of an address that an
   * existing, never-verified account was registered with.
   *
   * Whoever created that account may not own the address (anyone can sign up
   * with someone else's email), so its password is discarded before the
   * verified owner is let in. Returns true when credentials were reset, in
   * which case the caller must also revoke the account's sessions.
   */
  async claimVerifiedEmail(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (user.emailVerified) return false;

    const hadPassword = Boolean(user.passwordHash);
    user.emailVerified = true;
    user.passwordHash = undefined;
    await user.save();
    return hadPassword;
  }

  toAccountDto(user: UserDocument): AccountDto {
    return {
      id: user._id.toString(),
      email: user.email,
      emailIsPlaceholder: user.email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`),
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      hasPassword: Boolean(user.passwordHash),
      identities: (user.identities ?? []).map((i) => ({
        provider: i.provider,
        username: i.username,
        displayName: i.displayName,
        email: i.email,
        linkedAt: i.linkedAt ? new Date(i.linkedAt).toISOString() : undefined,
      })),
    };
  }

  async deleteById(userId: string): Promise<void> {
    await this.userModel.findByIdAndDelete(userId).exec();
  }
}
