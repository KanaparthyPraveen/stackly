import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Profile,
  ProfileDocument,
  SocialLinks,
} from './schemas/profile.schema';
import {
  AppearanceConfig,
  mergeAppearance,
  resolveAppearance,
} from './schemas/appearance.schema';
import {
  CreateProfileDto,
  PublicProfileDto,
  UpdateProfileDto,
  UpdateAppearanceDto,
} from './dto/profile.dto';
import { ChangelogService } from '../changelog/changelog.service';

/**
 * Names that can never be claimed: they collide with application routes or
 * would be misleading as a profile address.
 */
export const RESERVED_USERNAMES = [
  'admin',
  'api',
  'auth',
  'dashboard',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'settings',
  'profile',
  'profiles',
  'about',
  'help',
  'support',
  'terms',
  'privacy',
  'status',
  'health',
  'me',
  'anonymous',
  'system',
  'stackly',
  'null',
  'undefined',
  'root',
  'test',
  'demo',
  'example',
  'test-github',
  'templates',
  'docs',
  'static',
  'assets',
  'public',
  'favicon',
  '_next',
  'www',
  'app',
  'media',
  'security',
];

const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

const SOCIAL_KEYS = [
  'github',
  'x',
  'linkedin',
  'discord',
  'youtube',
  'instagram',
] as const;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/** Empty strings clear a field; everything else is stored trimmed. */
function cleaned(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
    private readonly changelog: ChangelogService,
  ) {}

  private validateUsername(username: string): void {
    if (!USERNAME_REGEX.test(username)) {
      throw new BadRequestException(
        'Username must be 3–30 characters and contain only lowercase letters, numbers, hyphens, or underscores',
      );
    }
    if (RESERVED_USERNAMES.includes(username)) {
      throw new BadRequestException(
        `Username "${username}" is reserved and cannot be used`,
      );
    }
  }

  /**
   * Builds the sanitized public representation of a profile.
   *
   * This is an allow-list: only the fields named here ever leave the server
   * for a visitor. Ids, timestamps and anything added to the document later
   * stay private unless they are added here on purpose.
   */
  toPublicDto(profile: ProfileDocument): PublicProfileDto {
    const appearance = resolveAppearance(profile.appearance);

    return {
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      location: profile.location,
      website: profile.website,
      live: profile.live === true,
      usernameClaimed: profile.usernameClaimed === true,
      ghostMode: profile.ghostMode === true,
      social: {
        github: profile.social?.github,
        x: profile.social?.x,
        linkedin: profile.social?.linkedin,
        discord: profile.social?.discord,
        youtube: profile.social?.youtube,
        instagram: profile.social?.instagram,
      },
      appearance: {
        accent: appearance.accent,
        background: appearance.background,
        typography: appearance.typography,
        buttonStyle: appearance.buttonStyle,
        layout: appearance.layout,
        colors: { ...appearance.colors },
        surface: { ...appearance.surface },
        typographyScale: { ...appearance.typographyScale },
        button: { ...appearance.button },
        canvas: { ...appearance.canvas },
        layoutOrder: [...appearance.layoutOrder],
      },
    };
  }

  async checkAvailability(
    username: string,
  ): Promise<{ available: boolean; reason?: string }> {
    const clean = String(username).toLowerCase().trim();
    if (!USERNAME_REGEX.test(clean)) {
      return {
        available: false,
        reason:
          'Username must be 3–30 characters and contain only lowercase letters, numbers, hyphens, or underscores',
      };
    }
    if (RESERVED_USERNAMES.includes(clean)) {
      return { available: false, reason: `Username "${clean}" is reserved` };
    }
    const existing = await this.findByUsername(clean);
    if (existing) {
      return { available: false, reason: 'Username is already taken' };
    }
    return { available: true };
  }

  async findByUserId(userId: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findByUsername(username: string): Promise<ProfileDocument | null> {
    const clean = String(username).toLowerCase().trim();
    // Anything that is not a well-formed username cannot match a profile.
    if (!USERNAME_REGEX.test(clean)) return null;
    return this.profileModel.findOne({ username: clean }).exec();
  }

  /** True when visitors are allowed to see the profile. */
  isPublic(profile: Pick<Profile, 'live' | 'ghostMode'>): boolean {
    return profile.live === true && profile.ghostMode !== true;
  }

  /**
   * Lookup used by every public-facing route. A profile that is unpublished
   * or in ghost mode is treated as if it does not exist, so visitors cannot
   * tell the difference between a hidden profile and a missing one.
   */
  async findPublicByUsername(
    username: string,
  ): Promise<ProfileDocument | null> {
    const profile = await this.findByUsername(username);
    if (!profile || !this.isPublic(profile)) return null;
    return profile;
  }

  /**
   * Like {@link findPublicByUsername}, but the owner can always see their own
   * profile — that is what makes previewing an unpublished page possible.
   */
  async findViewableByUsername(
    username: string,
    viewerUserId?: string,
  ): Promise<ProfileDocument | null> {
    const profile = await this.findByUsername(username);
    if (!profile) return null;
    if (this.isPublic(profile)) return profile;
    if (viewerUserId && profile.userId.toString() === viewerUserId)
      return profile;
    return null;
  }

  /**
   * Creates the caller's profile, or — when it already exists — claims the
   * requested username for it.
   */
  async getOrCreate(
    userId: string,
    dto?: CreateProfileDto,
  ): Promise<ProfileDocument> {
    const requested = dto?.username?.toLowerCase().trim();
    if (requested) this.validateUsername(requested);

    const existing = await this.findByUserId(userId);
    if (existing) {
      if (requested && requested !== existing.username) {
        return this.update(userId, { username: requested });
      }
      return existing;
    }

    if (requested) {
      const conflict = await this.findByUsername(requested);
      if (conflict) throw new ConflictException('Username is already taken');
    }

    try {
      return await this.profileModel.create({
        userId: new Types.ObjectId(userId),
        username: requested ?? `user_${userId.slice(-6)}`,
        appearance: resolveAppearance(),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('Username is already taken');
      }
      throw err;
    }
  }

  async update(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileDocument> {
    const profile = await this.ensureProfile(userId);
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const wasPublic = this.isPublic(profile);

    if (dto.username !== undefined) {
      const username = dto.username.toLowerCase().trim();
      if (username !== profile.username) {
        this.validateUsername(username);
        const conflict = await this.profileModel
          .findOne({
            username,
            userId: { $ne: new Types.ObjectId(userId) },
          })
          .exec();
        if (conflict) throw new ConflictException('Username is already taken');
        before.username = profile.username;
        after.username = username;
        profile.username = username;
        profile.usernameClaimed = true;
      }
    }

    if (dto.usernameClaimed !== undefined) {
      profile.usernameClaimed = dto.usernameClaimed;
    }

    const textFields = [
      'displayName',
      'bio',
      'avatarUrl',
      'location',
      'website',
    ] as const;
    for (const field of textFields) {
      const value = dto[field];
      if (value === undefined) continue;
      before[field] = profile[field];
      after[field] = cleaned(value);
      profile[field] = cleaned(value);
    }

    if (dto.live !== undefined) {
      before.live = profile.live;
      after.live = dto.live;
      profile.live = dto.live;
    }
    if (dto.ghostMode !== undefined) {
      before.ghostMode = profile.ghostMode;
      after.ghostMode = dto.ghostMode;
      profile.ghostMode = dto.ghostMode;
    }

    if (dto.social !== undefined) {
      const social: SocialLinks = profile.social ?? {};
      const beforeSocial: Record<string, unknown> = {};
      const afterSocial: Record<string, unknown> = {};
      // Only keys present in the request are touched, so saving one social
      // link never wipes the others.
      for (const key of SOCIAL_KEYS) {
        const value = dto.social[key];
        if (value === undefined) continue;
        beforeSocial[key] = social[key];
        afterSocial[key] = cleaned(value);
        social[key] = cleaned(value);
      }
      profile.social = social;
      profile.markModified?.('social');
      before.social = beforeSocial;
      after.social = afterSocial;
    }

    try {
      await profile.save();
    } catch (err) {
      // Two people claiming the same username at once: the unique index wins.
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('Username is already taken');
      }
      throw err;
    }

    await this.changelog.record(
      userId,
      'profile.updated',
      'Updated profile information',
      { before, after },
    );

    const isPublic = this.isPublic(profile);
    if (isPublic !== wasPublic) {
      await this.changelog.record(
        userId,
        isPublic ? 'profile.published' : 'profile.unpublished',
        isPublic
          ? `Published profile at /${profile.username}`
          : 'Profile hidden from the public',
      );
    }

    return profile;
  }

  /** Returns the fully resolved appearance config for the owner. */
  async getAppearance(userId: string): Promise<AppearanceConfig> {
    const profile = await this.ensureProfile(userId);
    return resolveAppearance(profile.appearance);
  }

  /**
   * Merges a partial appearance patch into the stored configuration and saves it.
   * Nested sections are merged key-by-key so a client can PATCH a single field
   * (e.g. `surface.opacity`) without wiping the rest of the section.
   */
  async updateAppearance(
    userId: string,
    dto: UpdateAppearanceDto,
  ): Promise<AppearanceConfig> {
    const profile = await this.ensureProfile(userId);
    const before = resolveAppearance(profile.appearance);
    const after = mergeAppearance(before, dto);

    profile.appearance = after;
    profile.markModified?.('appearance');
    await profile.save();

    await this.changelog.record(
      userId,
      'appearance.updated',
      'Updated appearance settings',
      { before, after },
    );

    return after;
  }

  /**
   * Replaces the whole appearance with a complete configuration. Used when a
   * template is applied: the template's look is cloned into the profile.
   */
  async replaceAppearance(
    userId: string,
    appearance: AppearanceConfig,
  ): Promise<AppearanceConfig> {
    const profile = await this.ensureProfile(userId);
    const next = resolveAppearance(appearance);
    profile.appearance = next;
    profile.markModified?.('appearance');
    await profile.save();
    return next;
  }

  /** Ensures a profile exists for a user (used after sign-up / OAuth). */
  async ensureProfile(
    userId: string,
    username?: string,
    defaults: { displayName?: string; avatarUrl?: string } = {},
  ): Promise<ProfileDocument> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    const fallback = `user_${userId.slice(-6)}`;
    const candidates: string[] = [];
    if (username) {
      const candidate = username.toLowerCase().trim();
      if (
        USERNAME_REGEX.test(candidate) &&
        !RESERVED_USERNAMES.includes(candidate)
      ) {
        candidates.push(candidate);
      }
    }
    candidates.push(fallback, `user_${userId.slice(-10)}`);

    const isExplicit = Boolean(username && !candidates[0].startsWith('user_'));

    for (const candidate of candidates) {
      if (await this.findByUsername(candidate)) continue;
      try {
        return await this.profileModel.create({
          userId: new Types.ObjectId(userId),
          username: candidate,
          displayName: defaults.displayName,
          avatarUrl: defaults.avatarUrl,
          appearance: resolveAppearance(),
          usernameClaimed:
            isExplicit && candidate === username?.toLowerCase().trim(),
        });
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
        // Either the username was taken in the meantime, or a concurrent
        // request already created this user's profile.
        const created = await this.findByUserId(userId);
        if (created) return created;
      }
    }

    throw new ConflictException(
      'Could not allocate a username for this account',
    );
  }

  /**
   * Explicitly sets a custom username for a new or existing user,
   * flags the profile as claimed, and activates live visibility.
   */
  async claimUsername(
    userId: string,
    username: string,
    displayName?: string,
  ): Promise<ProfileDocument> {
    const clean = username.toLowerCase().trim();
    this.validateUsername(clean);
    return this.update(userId, {
      username: clean,
      displayName: displayName?.trim() || undefined,
      usernameClaimed: true,
      live: true,
    });
  }

  private async requireProfile(userId: string): Promise<ProfileDocument> {
    const profile = await this.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }
}
