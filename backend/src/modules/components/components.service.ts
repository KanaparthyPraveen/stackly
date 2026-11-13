import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProfileComponent,
  ComponentDocument,
  type ComponentType,
} from './schemas/component.schema';
import {
  CreateComponentDto,
  PublicComponentDto,
  UpdateComponentDto,
} from './dto/component.dto';
import {
  COMPONENT_REGISTRY,
  validateComponentConfig,
} from './components.registry';
import { ChangelogService } from '../changelog/changelog.service';

/** Upper bound on components per profile — keeps public pages bounded. */
export const MAX_COMPONENTS_PER_USER = 60;

@Injectable()
export class ComponentsService {
  constructor(
    @InjectModel(ProfileComponent.name)
    private readonly componentModel: Model<ComponentDocument>,
    private readonly changelog: ChangelogService,
  ) {}

  async findAllForUser(userId: string): Promise<ComponentDocument[]> {
    return this.componentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ order: 1 })
      .exec();
  }

  async findPublicForUser(userId: string): Promise<PublicComponentDto[]> {
    const now = new Date();
    const components = await this.componentModel
      .find({
        userId: new Types.ObjectId(userId),
        enabled: true,
        visible: true,
        $and: [
          {
            $or: [
              { scheduledStart: { $exists: false } },
              { scheduledStart: null },
              { scheduledStart: { $lte: now } },
            ],
          },
          {
            $or: [
              { scheduledEnd: { $exists: false } },
              { scheduledEnd: null },
              { scheduledEnd: { $gte: now } },
            ],
          },
        ],
      })
      .sort({ order: 1 })
      .exec();

    return components.map((c) => this.toPublicDto(c));
  }

  /** Allow-list of what a visitor may see of a component. */
  toPublicDto(c: ComponentDocument): PublicComponentDto {
    return {
      id: c._id.toString(),
      type: c.type,
      title: c.title,
      order: c.order,
      config: c.config,
    };
  }

  async create(
    userId: string,
    dto: CreateComponentDto,
  ): Promise<ComponentDocument> {
    const validatedConfig = validateComponentConfig(dto.type, dto.config);
    this.assertSchedule(dto.scheduledStart, dto.scheduledEnd);

    const count = await this.componentModel.countDocuments({
      userId: new Types.ObjectId(userId),
    });
    if (count >= MAX_COMPONENTS_PER_USER) {
      throw new BadRequestException(
        `A profile can have at most ${MAX_COMPONENTS_PER_USER} components`,
      );
    }

    const title =
      dto.title ?? COMPONENT_REGISTRY[dto.type]?.defaultTitle ?? dto.type;

    const component = await this.componentModel.create({
      userId: new Types.ObjectId(userId),
      type: dto.type,
      title,
      enabled: dto.enabled !== undefined ? dto.enabled : true,
      visible: dto.visible !== undefined ? dto.visible : true,
      scheduledStart: dto.scheduledStart,
      scheduledEnd: dto.scheduledEnd,
      order: count,
      config: validatedConfig,
    });

    await this.changelog.record(
      userId,
      'component.created',
      `Added "${title}" component (${dto.type})`,
      { type: dto.type, title },
      component._id.toString(),
    );

    return component;
  }

  async update(
    userId: string,
    componentId: string,
    dto: UpdateComponentDto,
  ): Promise<ComponentDocument> {
    const component = await this.assertOwnership(userId, componentId);
    const before = {
      title: component.title,
      enabled: component.enabled,
      visible: component.visible,
    };

    if (dto.title !== undefined) component.title = dto.title;
    if (dto.enabled !== undefined) component.enabled = dto.enabled;
    if (dto.visible !== undefined) component.visible = dto.visible;
    if (dto.scheduledStart !== undefined) {
      component.scheduledStart = dto.scheduledStart ?? undefined;
    }
    if (dto.scheduledEnd !== undefined) {
      component.scheduledEnd = dto.scheduledEnd ?? undefined;
    }
    this.assertSchedule(component.scheduledStart, component.scheduledEnd);

    if (dto.config !== undefined) {
      // Partial config updates are merged onto what is stored, then the
      // whole thing is re-validated for the component's type.
      component.config = validateComponentConfig(component.type, {
        ...component.config,
        ...dto.config,
      });
      component.markModified?.('config');
    }

    await component.save();

    await this.changelog.record(
      userId,
      'component.updated',
      `Updated "${component.title}" component`,
      {
        before,
        after: {
          title: component.title,
          enabled: component.enabled,
          visible: component.visible,
        },
      },
      componentId,
    );

    return component;
  }

  async delete(userId: string, componentId: string): Promise<void> {
    const component = await this.assertOwnership(userId, componentId);
    const title = component.title;
    await component.deleteOne();

    await this.changelog.record(
      userId,
      'component.deleted',
      `Removed "${title}" component`,
      { title },
      componentId,
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
      await this.componentModel.bulkWrite(ops);
    }

    await this.changelog.record(
      userId,
      'component.reordered',
      `Reordered ${unique.length} profile components`,
      { ids: unique },
    );
  }

  /** Component types the user already has — used to keep template apply idempotent. */
  async existingTypes(userId: string): Promise<Set<ComponentType>> {
    const components = await this.findAllForUser(userId);
    return new Set(components.map((c) => c.type));
  }

  async assertOwnership(
    userId: string,
    componentId: string,
  ): Promise<ComponentDocument> {
    let component: ComponentDocument | null = null;
    try {
      component = await this.componentModel.findById(componentId).exec();
    } catch {
      throw new NotFoundException('Component not found');
    }

    if (!component) throw new NotFoundException('Component not found');
    if (component.userId.toString() !== userId) throw new ForbiddenException();
    return component;
  }

  private assertSchedule(start?: Date | null, end?: Date | null): void {
    if (start && end && start.getTime() > end.getTime()) {
      throw new BadRequestException(
        'scheduledEnd must be after scheduledStart',
      );
    }
  }
}
