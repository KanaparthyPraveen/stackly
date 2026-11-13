import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  Template,
  TemplateComponentConfig,
  TemplateDocument,
} from './schemas/template.schema';
import {
  CreateTemplateDto,
  CreateTemplateFromProfileDto,
  TemplateComponentDto,
  TemplateResponseDto,
  UpdateTemplateDto,
} from './dto/template.dto';
import { ProfileService } from '../profile/profile.service';
import {
  mergeAppearance,
  resolveAppearance,
} from '../profile/schemas/appearance.schema';
import { ComponentsService } from '../components/components.service';
import {
  isComponentType,
  toTemplateConfig,
  validateComponentConfig,
} from '../components/components.registry';
import { ChangelogService } from '../changelog/changelog.service';

export const MAX_TEMPLATES_PER_USER = 50;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    private readonly profileService: ProfileService,
    private readonly componentsService: ComponentsService,
    private readonly changelog: ChangelogService,
  ) {}

  private slugify(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'template';
  }

  /** A slug not used by any other template. */
  private async uniqueSlug(
    name: string,
    excludeId?: Types.ObjectId,
  ): Promise<string> {
    const base = this.slugify(name);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const clash = await this.templateModel
        .findOne({
          slug: candidate,
          ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        })
        .select('_id')
        .lean()
        .exec();
      if (!clash) return candidate;
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }

  private isPublished(
    template: Pick<Template, 'isPublic' | 'isDraft'>,
  ): boolean {
    return template.isPublic === true && template.isDraft !== true;
  }

  private isOwner(
    template: Pick<Template, 'creatorId'>,
    userId?: string,
  ): boolean {
    return Boolean(userId) && template.creatorId.toString() === userId;
  }

  /** Validates template components against the component registry. */
  private normaliseComponents(
    components: TemplateComponentDto[] = [],
  ): TemplateComponentConfig[] {
    return components.map((c, index) => ({
      type: c.type,
      title: c.title,
      order: c.order ?? index,
      config: validateComponentConfig(c.type, c.config),
    }));
  }

  toDto(template: TemplateDocument, viewerId?: string): TemplateResponseDto {
    const id = template._id.toString();
    const timestamps = template as TemplateDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };
    return {
      _id: id,
      id,
      name: template.name,
      slug: template.slug,
      description: template.description,
      tags: [...(template.tags ?? [])],
      previewImageUrl: template.previewImageUrl,
      isPublic: template.isPublic === true,
      isDraft: template.isDraft === true,
      published: this.isPublished(template),
      isOwner: this.isOwner(template, viewerId),
      appearance: resolveAppearance(template.appearance),
      components: (template.components ?? [])
        .map((c) => ({
          type: c.type,
          title: c.title,
          order: c.order,
          config: { ...c.config },
        }))
        .sort((a, b) => a.order - b.order),
      clonesCount: template.clonesCount ?? 0,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    };
  }

  /** Template discovery: published templates only. */
  async findPublic(
    tag?: string,
    viewerId?: string,
  ): Promise<TemplateResponseDto[]> {
    const query: Record<string, unknown> = { isPublic: true, isDraft: false };
    if (typeof tag === 'string' && tag.trim()) {
      query.tags = tag.toLowerCase().trim().slice(0, 30);
    }
    const templates = await this.templateModel
      .find(query)
      .sort({ clonesCount: -1, createdAt: -1 })
      .limit(100)
      .exec();
    return templates.map((t) => this.toDto(t, viewerId));
  }

  async findMine(creatorId: string): Promise<TemplateResponseDto[]> {
    const templates = await this.templateModel
      .find({ creatorId: new Types.ObjectId(creatorId) })
      .sort({ createdAt: -1 })
      .exec();
    return templates.map((t) => this.toDto(t, creatorId));
  }

  private async load(templateId: string): Promise<TemplateDocument> {
    let template: TemplateDocument | null = null;
    try {
      template = await this.templateModel.findById(templateId).exec();
    } catch {
      throw new NotFoundException('Template not found');
    }
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  /**
   * Loads a template the viewer is allowed to see: a published one, or one of
   * their own. A private template of someone else looks like it does not
   * exist.
   */
  private async loadViewable(
    templateId: string,
    viewerId?: string,
  ): Promise<TemplateDocument> {
    const template = await this.load(templateId);
    if (!this.isPublished(template) && !this.isOwner(template, viewerId)) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  /** Preview data for a template. */
  async findById(
    templateId: string,
    viewerId?: string,
  ): Promise<TemplateResponseDto> {
    return this.toDto(await this.loadViewable(templateId, viewerId), viewerId);
  }

  private async assertQuota(creatorId: string): Promise<void> {
    const count = await this.templateModel.countDocuments({
      creatorId: new Types.ObjectId(creatorId),
    });
    if (count >= MAX_TEMPLATES_PER_USER) {
      throw new BadRequestException(
        `You can keep at most ${MAX_TEMPLATES_PER_USER} templates`,
      );
    }
  }

  private async insert(
    creatorId: string,
    data: {
      name: string;
      description?: string;
      tags?: string[];
      previewImageUrl?: string;
      isPublic: boolean;
      isDraft: boolean;
      appearance: unknown;
      components: TemplateComponentConfig[];
      sourceTemplateId?: Types.ObjectId;
    },
  ): Promise<TemplateDocument> {
    await this.assertQuota(creatorId);

    const base = {
      creatorId: new Types.ObjectId(creatorId),
      name: data.name,
      description: data.description,
      tags: (data.tags || [])
        .map((t) => t.toLowerCase().trim())
        .filter(Boolean),
      previewImageUrl: data.previewImageUrl || undefined,
      isPublic: data.isPublic,
      isDraft: data.isDraft,
      appearance: resolveAppearance(data.appearance),
      components: data.components,
      sourceTemplateId: data.sourceTemplateId,
    };

    // The slug has a unique index; retry once if a concurrent insert took it.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.templateModel.create({
          ...base,
          slug:
            attempt === 0
              ? await this.uniqueSlug(data.name)
              : `${this.slugify(data.name)}-${randomBytes(4).toString('hex')}`,
        });
      } catch (err) {
        if (!isDuplicateKeyError(err) || attempt === 1) throw err;
      }
    }
    throw new BadRequestException('Could not create template');
  }

  async create(
    creatorId: string,
    dto: CreateTemplateDto,
  ): Promise<TemplateResponseDto> {
    const template = await this.insert(creatorId, {
      name: dto.name,
      description: dto.description,
      tags: dto.tags,
      previewImageUrl: dto.previewImageUrl,
      isPublic: dto.isPublic ?? false,
      isDraft: dto.isDraft ?? true,
      appearance: mergeAppearance(undefined, dto.appearance),
      components: this.normaliseComponents(dto.components),
    });

    await this.changelog.record(
      creatorId,
      'template.created',
      `Created template "${template.name}"`,
      { name: template.name, isPublic: template.isPublic },
      template._id.toString(),
    );

    return this.toDto(template, creatorId);
  }

  /**
   * Turns the caller's current profile into a template.
   *
   * Only the look is captured: the appearance and, for each component, its
   * type, title and presentation settings. Personal content — bio text,
   * email addresses, resume links, gallery images, usernames — is left out,
   * as are credentials and integration data, which never live on components.
   */
  async createFromProfile(
    creatorId: string,
    dto: CreateTemplateFromProfileDto,
  ): Promise<TemplateResponseDto> {
    const profile = await this.profileService.findByUserId(creatorId);
    if (!profile) throw new NotFoundException('Profile not found');

    const components = await this.componentsService.findAllForUser(creatorId);

    const template = await this.insert(creatorId, {
      name: dto.name,
      description: dto.description,
      tags: dto.tags,
      isPublic: false,
      isDraft: true,
      appearance: resolveAppearance(profile.appearance),
      components: components.map((c, index) => ({
        type: c.type,
        title: c.title || c.type,
        order: index,
        config: toTemplateConfig(c.type, c.config),
      })),
    });

    await this.changelog.record(
      creatorId,
      'template.created',
      `Created template "${template.name}" from profile`,
      { name: template.name },
      template._id.toString(),
    );

    return this.toDto(template, creatorId);
  }

  async update(
    creatorId: string,
    templateId: string,
    dto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    const template = await this.assertOwnership(creatorId, templateId);

    if (dto.name !== undefined && dto.name !== template.name) {
      template.name = dto.name;
      template.slug = await this.uniqueSlug(dto.name, template._id);
    }
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.tags !== undefined) {
      template.tags = dto.tags
        .map((t) => t.toLowerCase().trim())
        .filter(Boolean);
    }
    if (dto.previewImageUrl !== undefined) {
      template.previewImageUrl = dto.previewImageUrl || undefined;
    }
    if (dto.isPublic !== undefined) template.isPublic = dto.isPublic;
    if (dto.isDraft !== undefined) template.isDraft = dto.isDraft;
    if (dto.appearance !== undefined) {
      template.appearance = mergeAppearance(
        template.appearance,
        dto.appearance,
      );
      template.markModified('appearance');
    }
    if (dto.components !== undefined) {
      template.components = this.normaliseComponents(dto.components);
      template.markModified('components');
    }

    await template.save();

    await this.changelog.record(
      creatorId,
      'template.updated',
      `Updated template "${template.name}"`,
      { name: template.name, published: this.isPublished(template) },
      templateId,
    );

    return this.toDto(template, creatorId);
  }

  /** Publishing makes a template discoverable; unpublishing hides it again. */
  async setPublished(
    creatorId: string,
    templateId: string,
    published: boolean,
  ): Promise<TemplateResponseDto> {
    return this.update(creatorId, templateId, {
      isPublic: published,
      isDraft: !published,
    });
  }

  /** Copies a visible template into the caller's own private templates. */
  async duplicate(
    userId: string,
    templateId: string,
  ): Promise<TemplateResponseDto> {
    const source = await this.loadViewable(templateId, userId);

    const copy = await this.insert(userId, {
      name: `${source.name} (copy)`.slice(0, 80),
      description: source.description,
      tags: source.tags,
      previewImageUrl: source.previewImageUrl,
      isPublic: false,
      isDraft: true,
      appearance: resolveAppearance(source.appearance),
      components: (source.components ?? []).map((c) => ({
        type: c.type,
        title: c.title,
        order: c.order,
        config: { ...c.config },
      })),
      sourceTemplateId: source._id,
    });

    await this.changelog.record(
      userId,
      'template.duplicated',
      `Duplicated template "${source.name}"`,
      { source: source.slug },
      copy._id.toString(),
    );

    return this.toDto(copy, userId);
  }

  /**
   * "Use template": clones the template's configuration into the caller's
   * profile.
   *
   * The appearance is copied, not referenced, so later changes to the
   * template never reach this profile. Components are added only for types
   * the profile does not have yet — nothing the user already built is
   * overwritten or removed, and applying the same template twice does not
   * create duplicates.
   */
  async applyToProfile(
    userId: string,
    templateId: string,
  ): Promise<{
    success: boolean;
    appliedComponents: number;
    skippedComponents: number;
  }> {
    const template = await this.loadViewable(templateId, userId);

    const profile = await this.profileService.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profile not found');

    const current = resolveAppearance(profile.appearance);
    await this.profileService.replaceAppearance(userId, {
      ...resolveAppearance(template.appearance),
      // The component order belongs to the profile, not to the template.
      layoutOrder: current.layoutOrder,
    });

    const existing = await this.componentsService.existingTypes(userId);
    const ordered = [...(template.components ?? [])].sort(
      (a, b) => a.order - b.order,
    );

    let added = 0;
    let skipped = 0;
    for (const component of ordered) {
      if (!isComponentType(component.type) || existing.has(component.type)) {
        skipped += 1;
        continue;
      }
      await this.componentsService.create(userId, {
        type: component.type,
        title: component.title,
        config: { ...component.config },
      });
      existing.add(component.type);
      added += 1;
    }

    await this.templateModel
      .updateOne({ _id: template._id }, { $inc: { clonesCount: 1 } })
      .exec();

    await this.changelog.record(
      userId,
      'template.applied',
      `Applied template "${template.name}" to profile`,
      { templateName: template.name, componentsAdded: added },
      templateId,
    );

    return {
      success: true,
      appliedComponents: added,
      skippedComponents: skipped,
    };
  }

  async delete(creatorId: string, templateId: string): Promise<void> {
    const template = await this.assertOwnership(creatorId, templateId);
    await template.deleteOne();

    await this.changelog.record(
      creatorId,
      'template.deleted',
      `Deleted template "${template.name}"`,
      { name: template.name },
      templateId,
    );
  }

  private async assertOwnership(
    creatorId: string,
    templateId: string,
  ): Promise<TemplateDocument> {
    const template = await this.load(templateId);
    if (!this.isOwner(template, creatorId)) {
      // A private template of someone else must not be confirmable.
      if (!this.isPublished(template)) {
        throw new NotFoundException('Template not found');
      }
      throw new ForbiddenException();
    }
    return template;
  }
}
