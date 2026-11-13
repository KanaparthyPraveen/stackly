import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Changelog,
  ChangelogDocument,
  ChangeAction,
} from './schemas/changelog.schema';

@Injectable()
export class ChangelogService {
  private readonly logger = new Logger(ChangelogService.name);

  constructor(
    @InjectModel(Changelog.name)
    private readonly changelogModel: Model<ChangelogDocument>,
  ) {}

  /**
   * Appends an entry to the user's activity log.
   *
   * The log is an audit aid, not part of the transaction: a failure to write
   * it must never turn a successful change into an error for the user.
   */
  async record(
    userId: string,
    action: ChangeAction,
    summary: string,
    payload: Record<string, unknown> = {},
    entityId?: string,
  ): Promise<void> {
    try {
      await this.changelogModel.create({
        userId: new Types.ObjectId(userId),
        action,
        summary,
        payload,
        entityId,
      });
    } catch (err) {
      this.logger.warn(
        `Could not record "${action}": ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async findByUser(
    userId: string,
    limit = 50,
    skip = 0,
  ): Promise<ChangelogDocument[]> {
    return this.changelogModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec() as unknown as ChangelogDocument[];
  }
}
