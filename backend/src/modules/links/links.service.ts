import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Link, LinkDocument } from './schemas/link.schema';
import { CreateLinkDto, PublicLinkDto, UpdateLinkDto } from './dto/link.dto';
import { ChangelogService } from '../changelog/changelog.service';
import { ProfileService } from '../profile/profile.service';
import { AnalyticsService } from '../analytics/analytics.service';

export const MAX_LINKS_PER_USER = 200;

export interface ClickContext {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  /** Session user, when the click comes from a signed-in browser. */
  viewerUserId?: string;
}

@Injectable()
export class LinksService {
  constructor(
    @InjectModel(Link.name)
    private readonly linkModel: Model<LinkDocument>,
    private readonly changelog: ChangelogService,
    private readonly profileService: ProfileService,
    private readonly analytics: AnalyticsService,
  ) {}

  async findAllForUser(userId: string): Promise<LinkDocument[]> {
    return this.linkModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ order: 1 })
      .exec();
  }

  async findPublicForUser(userId: string): Promise<PublicLinkDto[]> {
    const now = new Date();
    const links = await this.linkModel
      .find({
        userId: new Types.ObjectId(userId),
        enabled: true,
        visible: { $ne: false },
        $and: [
          {
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: now } },
            ],
          },
          {
            $or: [
              { scheduledStart: { $exists: false } },
              { scheduledStart: null },
              { scheduledStart: { $lte: now } },
            ],
          },
        ],
      })
      .sort({ order: 1 })
      .exec();

    return links.map((l) => ({
      id: l._id.toString(),
      title: l.title,
      url: l.url,
      description: l.description,
      icon: l.icon,
      category: l.category,
      order: l.order,
    }));
  }

  private isPubliclyVisible(link: LinkDocument, now = new Date()): boolean {
    if (link.enabled === false || link.visible === false) return false;
    if (link.expiresAt && link.expiresAt.getTime() <= now.getTime())
      return false;
    if (link.scheduledStart && link.scheduledStart.getTime() > now.getTime()) {
      return false;
    }
    return true;
  }

  /**
   * Records a visitor's click on a public link.
   *
   * The link and its label are looked up on the server, the owning profile
   * must be published, repeat clicks by the same visitor are de-duplicated
   * and the owner's own clicks are not counted.
   */
  async recordClick(
    linkId: string,
    context: ClickContext = {},
  ): Promise<{ success: boolean; url: string }> {
    const link = await this.linkModel.findById(linkId).exec();
    if (!link || !this.isPubliclyVisible(link)) {
      throw new NotFoundException('Link not found');
    }

    const ownerId = link.userId.toString();
    const profile = await this.profileService.findByUserId(ownerId);
    if (!profile || !this.profileService.isPublic(profile)) {
      throw new NotFoundException('Link not found');
    }

    const countable =
      context.viewerUserId !== ownerId &&
      !this.analytics.isBot(context.userAgent);

    if (countable) {
      const recorded = await this.analytics.track({
        profileUserId: ownerId,
        eventType: 'link_click',
        entityId: link._id.toString(),
        entityLabel: link.title,
        ip: context.ip,
        userAgent: context.userAgent,
        referrer: context.referrer,
      });

      if (recorded) {
        // Atomic increment — concurrent clicks never overwrite each other.
        await this.linkModel
          .updateOne({ _id: link._id }, { $inc: { clicks: 1 } })
          .exec();
      }
    }

    return { success: true, url: link.url };
  }

  async create(userId: string, dto: CreateLinkDto): Promise<LinkDocument> {
    const owner = new Types.ObjectId(userId);
    const count = await this.linkModel.countDocuments({ userId: owner });
    if (count >= MAX_LINKS_PER_USER) {
      throw new BadRequestException(
        `A profile can have at most ${MAX_LINKS_PER_USER} links`,
      );
    }

    const link = await this.linkModel.create({
      userId: owner,
      title: dto.title,
      url: dto.url,
      description: dto.description,
      icon: dto.icon || '↗',
      category: dto.category,
      visible: dto.visible !== undefined ? dto.visible : true,
      expiresAt: dto.expiresAt,
      scheduledStart: dto.scheduledStart,
      enabled: true,
      order: await this.nextOrder(owner),
    });

    await this.changelog.record(
      userId,
      'link.created',
      `Created link "${link.title}"`,
      { after: { title: link.title, url: link.url } },
      link._id.toString(),
    );

    return link;
  }

  /** New links go to the end, even after earlier ones were deleted. */
  private async nextOrder(owner: Types.ObjectId): Promise<number> {
    const last = await this.linkModel
      .findOne({ userId: owner })
      .sort({ order: -1 })
      .select('order')
      .lean()
      .exec();
    return last ? (last.order ?? 0) + 1 : 0;
  }

  async update(
    userId: string,
    linkId: string,
    dto: UpdateLinkDto,
  ): Promise<LinkDocument> {
    const link = await this.assertOwnership(userId, linkId);
    const before = {
      title: link.title,
      url: link.url,
      enabled: link.enabled,
      visible: link.visible,
    };

    const changed = (Object.keys(dto) as Array<keyof UpdateLinkDto>).filter(
      (key) => dto[key] !== undefined,
    );

    if (dto.title !== undefined) link.title = dto.title;
    if (dto.url !== undefined) link.url = dto.url;
    if (dto.description !== undefined) link.description = dto.description;
    if (dto.icon !== undefined) link.icon = dto.icon || '↗';
    if (dto.enabled !== undefined) link.enabled = dto.enabled;
    if (dto.visible !== undefined) link.visible = dto.visible;
    if (dto.category !== undefined) link.category = dto.category;
    if (dto.expiresAt !== undefined)
      link.expiresAt = dto.expiresAt ?? undefined;
    if (dto.scheduledStart !== undefined) {
      link.scheduledStart = dto.scheduledStart ?? undefined;
    }

    await link.save();

    const toggled = changed.length === 1 && changed[0] === 'enabled';

    await this.changelog.record(
      userId,
      toggled ? 'link.toggled' : 'link.updated',
      toggled
        ? `${dto.enabled ? 'Enabled' : 'Disabled'} link "${link.title}"`
        : `Updated link "${link.title}"`,
      {
        before,
        after: { title: link.title, url: link.url, enabled: link.enabled },
      },
      linkId,
    );

    return link;
  }

  async delete(userId: string, linkId: string): Promise<void> {
    const link = await this.assertOwnership(userId, linkId);
    const title = link.title;
    await link.deleteOne();

    await this.changelog.record(
      userId,
      'link.deleted',
      `Deleted link "${title}"`,
      { before: { title, url: link.url } },
      linkId,
    );
  }

  /**
   * Applies a new display order. Every update is scoped to the caller's user
   * id, so ids belonging to someone else are simply not matched.
   */
  async reorder(userId: string, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id));
    const ops = unique.map((id, index) => ({
      updateOne: {
        filter: {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
        },
        update: { $set: { order: index } },
      },
    }));

    if (ops.length > 0) {
      await this.linkModel.bulkWrite(ops);
    }

    await this.changelog.record(
      userId,
      'link.reordered',
      `Reordered ${unique.length} links`,
      { ids: unique },
    );
  }

  private async assertOwnership(
    userId: string,
    linkId: string,
  ): Promise<LinkDocument> {
    let link: LinkDocument | null = null;
    try {
      link = await this.linkModel.findById(linkId).exec();
    } catch {
      throw new NotFoundException('Link not found');
    }

    if (!link) throw new NotFoundException('Link not found');
    if (link.userId.toString() !== userId) throw new ForbiddenException();
    return link;
  }
}
