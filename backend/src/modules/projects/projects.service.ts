import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import {
  CreateProjectDto,
  PublicProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ChangelogService } from '../changelog/changelog.service';
import { ProfileService } from '../profile/profile.service';
import { AnalyticsService } from '../analytics/analytics.service';

export const MAX_PROJECTS_PER_USER = 100;

export interface ProjectClickContext {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  viewerUserId?: string;
}

/** Empty strings clear an optional field. */
function optional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    private readonly changelog: ChangelogService,
    @Optional() private readonly profileService?: ProfileService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async findAllForUser(userId: string): Promise<ProjectDocument[]> {
    return this.projectModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ order: 1 })
      .exec();
  }

  async findPublicForUser(userId: string): Promise<PublicProjectDto[]> {
    const projects = await this.projectModel
      .find({
        userId: new Types.ObjectId(userId),
        visible: { $ne: false },
      })
      .sort({ featured: -1, order: 1 })
      .exec();

    return projects.map((p) => this.toPublicDto(p));
  }

  /** Allow-list of what a visitor may see of a project. */
  toPublicDto(p: ProjectDocument): PublicProjectDto {
    return {
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      tech: p.tech,
      repoUrl: p.repoUrl,
      liveUrl: p.liveUrl,
      docsUrl: p.docsUrl,
      images: p.images,
      status: p.status,
      featured: p.featured,
      stars: p.stars,
      forks: p.forks,
    };
  }

  /**
   * Records a visitor's click on a project shown on a published profile.
   * The project is verified on the server; the owner's own clicks and
   * repeats by the same visitor are not counted.
   */
  async recordClick(
    projectId: string,
    context: ProjectClickContext = {},
  ): Promise<{ success: boolean }> {
    const project = await this.projectModel.findById(projectId).exec();
    if (!project || project.visible === false) {
      throw new NotFoundException('Project not found');
    }

    const ownerId = project.userId.toString();
    const profile = await this.profileService?.findByUserId(ownerId);
    if (!profile || !this.profileService?.isPublic(profile)) {
      throw new NotFoundException('Project not found');
    }

    if (
      this.analytics &&
      context.viewerUserId !== ownerId &&
      !this.analytics.isBot(context.userAgent)
    ) {
      await this.analytics.track({
        profileUserId: ownerId,
        eventType: 'project_click',
        entityId: project._id.toString(),
        entityLabel: project.name,
        ip: context.ip,
        userAgent: context.userAgent,
        referrer: context.referrer,
      });
    }

    return { success: true };
  }

  async create(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectDocument> {
    const owner = new Types.ObjectId(userId);
    const count = await this.projectModel.countDocuments({ userId: owner });
    if (count >= MAX_PROJECTS_PER_USER) {
      throw new BadRequestException(
        `A profile can have at most ${MAX_PROJECTS_PER_USER} projects`,
      );
    }

    // The first project is featured automatically; only one can be featured.
    const featured = dto.featured !== undefined ? dto.featured : count === 0;

    if (featured) {
      await this.projectModel.updateMany(
        { userId: owner, featured: true },
        { $set: { featured: false } },
      );
    }

    const project = await this.projectModel.create({
      userId: owner,
      name: dto.name,
      description: dto.description,
      tech: dto.tech || [],
      repoUrl: optional(dto.repoUrl),
      liveUrl: optional(dto.liveUrl),
      docsUrl: optional(dto.docsUrl),
      images: dto.images || [],
      status: dto.status || 'live',
      featured,
      visible: dto.visible !== undefined ? dto.visible : true,
      order: await this.nextOrder(owner, count),
    });

    await this.changelog.record(
      userId,
      'project.created',
      `Created project "${project.name}"`,
      { after: { name: project.name, repoUrl: project.repoUrl } },
      project._id.toString(),
    );

    return project;
  }

  /** New projects go to the end, even after earlier ones were deleted. */
  private async nextOrder(
    owner: Types.ObjectId,
    count: number,
  ): Promise<number> {
    if (count === 0) return 0;
    const last = await this.projectModel
      .findOne({ userId: owner })
      .sort({ order: -1 })
      .select('order')
      .lean()
      .exec();
    return last ? (last.order ?? 0) + 1 : count;
  }

  async update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectDocument> {
    const project = await this.assertOwnership(userId, projectId);
    const before = {
      name: project.name,
      repoUrl: project.repoUrl,
      status: project.status,
      featured: project.featured,
      visible: project.visible,
    };

    if (dto.featured === true && !project.featured) {
      await this.projectModel.updateMany(
        { userId: new Types.ObjectId(userId), featured: true },
        { $set: { featured: false } },
      );
    }

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.tech !== undefined) project.tech = dto.tech;
    if (dto.repoUrl !== undefined) project.repoUrl = optional(dto.repoUrl);
    if (dto.liveUrl !== undefined) project.liveUrl = optional(dto.liveUrl);
    if (dto.docsUrl !== undefined) project.docsUrl = optional(dto.docsUrl);
    if (dto.images !== undefined) project.images = dto.images;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.featured !== undefined) project.featured = dto.featured;
    if (dto.visible !== undefined) project.visible = dto.visible;

    await project.save();

    await this.changelog.record(
      userId,
      'project.updated',
      `Updated project "${project.name}"`,
      {
        before,
        after: {
          name: project.name,
          repoUrl: project.repoUrl,
          status: project.status,
          featured: project.featured,
          visible: project.visible,
        },
      },
      projectId,
    );

    return project;
  }

  async delete(userId: string, projectId: string): Promise<void> {
    const project = await this.assertOwnership(userId, projectId);
    const name = project.name;
    await project.deleteOne();

    await this.changelog.record(
      userId,
      'project.deleted',
      `Deleted project "${name}"`,
      { name },
      projectId,
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
      await this.projectModel.bulkWrite(ops);
    }

    await this.changelog.record(
      userId,
      'project.reordered',
      `Reordered ${unique.length} projects`,
      { ids: unique },
    );
  }

  async setFeatured(
    userId: string,
    projectId: string,
    featured: boolean,
  ): Promise<ProjectDocument> {
    const project = await this.assertOwnership(userId, projectId);

    if (featured) {
      await this.projectModel.updateMany(
        { userId: new Types.ObjectId(userId), _id: { $ne: project._id } },
        { $set: { featured: false } },
      );
    }

    project.featured = featured;
    await project.save();

    await this.changelog.record(
      userId,
      'project.updated',
      `${featured ? 'Featured' : 'Unfeatured'} project "${project.name}"`,
      { featured },
      projectId,
    );

    return project;
  }

  async assertOwnership(
    userId: string,
    projectId: string,
  ): Promise<ProjectDocument> {
    let project: ProjectDocument | null = null;
    try {
      project = await this.projectModel.findById(projectId).exec();
    } catch {
      throw new NotFoundException('Project not found');
    }

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId.toString() !== userId) throw new ForbiddenException();
    return project;
  }
}
