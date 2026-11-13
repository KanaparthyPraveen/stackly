import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/** True for a 24-character hex string — the only id format the API accepts. */
export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

/**
 * Validates a route parameter as a MongoDB ObjectId.
 *
 * Without this a malformed id reaches Mongoose and surfaces as a 500 (cast
 * error) instead of a clean 400.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isObjectIdString(value) || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid identifier');
    }
    return value;
  }
}
