import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model, Types } from 'mongoose';
import { UsersService, type AccountDto } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthenticatedUser } from './guards/session-auth.guard';
import { SessionService } from './session/session.service';
import { ProfileService } from '../profile/profile.service';
import { MediaService } from '../media/media.service';
import { Profile, ProfileDocument } from '../profile/schemas/profile.schema';
import { Link, LinkDocument } from '../links/schemas/link.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import {
  ProfileComponent,
  ComponentDocument,
} from '../components/schemas/component.schema';
import {
  Integration,
  IntegrationDocument,
} from '../integrations/schemas/integration.schema';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import {
  Changelog,
  ChangelogDocument,
} from '../changelog/schemas/changelog.schema';
import {
  Template,
  TemplateDocument,
} from '../templates/schemas/template.schema';
import {
  AnalyticsEvent,
  AnalyticsEventDocument,
} from '../analytics/schemas/analytics-event.schema';

export interface AuthResponse {
  user: AuthenticatedUser;
}

type SessionRequest = Pick<Request, 'session' | 'headers'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly profileService: ProfileService,
    private readonly mediaService: MediaService,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(Link.name)
    private readonly linkModel: Model<LinkDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(ProfileComponent.name)
    private readonly componentModel: Model<ComponentDocument>,
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<IntegrationDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    @InjectModel(Changelog.name)
    private readonly changelogModel: Model<ChangelogDocument>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    @InjectModel(AnalyticsEvent.name)
    private readonly analyticsModel: Model<AnalyticsEventDocument>,
  ) {}

  async validateUser(
    email: string,
    plainPassword: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await this.usersService.comparePassword(
      plainPassword,
      user.passwordHash ?? '',
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: user._id.toString(),
      email: user.email,
    };
  }

  async login(dto: LoginDto, req: SessionRequest): Promise<AuthResponse> {
    const user = await this.validateUser(dto.email, dto.password);
    await this.sessionService.establish(req, user.id);
    return { user };
  }

  async logout(req?: Pick<Request, 'session'>): Promise<{ success: boolean }> {
    await this.sessionService.destroy(req?.session);
    return { success: true };
  }

  async register(dto: RegisterDto, req: SessionRequest): Promise<AuthResponse> {
    const user = await this.usersService.create(dto.email, dto.password);
    const userId = user._id.toString();

    // Every account gets a profile straight away so the dashboard always has
    // something real to load. The username can be changed later.
    await this.profileService.ensureProfile(userId);
    await this.sessionService.establish(req, userId);

    return { user: { id: userId, email: user.email } };
  }

  async getMe(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
      },
    };
  }

  async getAccount(userId: string): Promise<AccountDto> {
    const user = await this.usersService.findById(userId);
    return this.usersService.toAccountDto(user);
  }

  async unlinkIdentity(userId: string, provider: string): Promise<AccountDto> {
    const user = await this.usersService.unlinkIdentity(userId, provider);
    return this.usersService.toAccountDto(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentSessionId?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.usersService.updatePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
    // A password change signs every other device out.
    await this.sessionService.revokeAll(userId, currentSessionId);
    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * Permanently deletes an account and everything it owns.
   *
   * Stored files are removed from object storage first; the user document is
   * deleted last so a partial failure can simply be retried.
   */
  async deleteAccount(
    userId: string,
    req?: Pick<Request, 'session'>,
  ): Promise<{ success: boolean; message: string }> {
    const userOid = new Types.ObjectId(userId);

    await this.mediaService.deleteAllForUser(userId);

    await Promise.all([
      this.profileModel.deleteOne({ userId: userOid }).exec(),
      this.linkModel.deleteMany({ userId: userOid }).exec(),
      this.projectModel.deleteMany({ userId: userOid }).exec(),
      this.componentModel.deleteMany({ userId: userOid }).exec(),
      this.integrationModel.deleteMany({ userId: userOid }).exec(),
      this.mediaModel.deleteMany({ userId: userOid }).exec(),
      this.changelogModel.deleteMany({ userId: userOid }).exec(),
      this.templateModel.deleteMany({ creatorId: userOid }).exec(),
      this.analyticsModel.deleteMany({ profileUserId: userOid }).exec(),
    ]);

    await this.usersService.deleteById(userId);
    await this.sessionService.revokeAll(userId);
    await this.sessionService.destroy(req?.session);

    this.logger.log(`Deleted account ${userId}`);
    return { success: true, message: 'Account and associated data deleted' };
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const userOid = new Types.ObjectId(userId);
    const user = await this.usersService.findById(userId);

    const [
      profile,
      links,
      projects,
      components,
      integrations,
      media,
      templates,
      changelog,
    ] = await Promise.all([
      this.profileModel.findOne({ userId: userOid }).lean().exec(),
      this.linkModel.find({ userId: userOid }).sort({ order: 1 }).lean().exec(),
      this.projectModel
        .find({ userId: userOid })
        .sort({ order: 1 })
        .lean()
        .exec(),
      this.componentModel
        .find({ userId: userOid })
        .sort({ order: 1 })
        .lean()
        .exec(),
      // Provider credentials are never part of an export.
      this.integrationModel
        .find({ userId: userOid })
        .select('-accessToken -refreshToken')
        .lean()
        .exec(),
      this.mediaModel.find({ userId: userOid }).lean().exec(),
      this.templateModel.find({ creatorId: userOid }).lean().exec(),
      this.changelogModel
        .find({ userId: userOid })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .exec(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user._id.toString(),
        email: user.email,
      },
      profile: profile || null,
      links,
      projects,
      components,
      integrations,
      media,
      templates,
      changelog,
    };
  }
}
