import 'reflect-metadata';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: ReturnType<typeof jest.fn>;
    json: ReturnType<typeof jest.fn>;
  };
  let mockRequest: {
    url: string;
    method: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    statusFn.mockReturnValue({ json: jsonFn });

    mockResponse = {
      status: statusFn,
      json: jsonFn,
    };
    mockRequest = {
      url: '/api/v1/test',
      method: 'GET',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format HttpException correctly', () => {
    const exception = new BadRequestException(['field is required']);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: ['field is required'],
        path: '/api/v1/test',
      }),
    );
  });

  it('should format unhandled errors as 500 without leaking stack traces', () => {
    const exception = new Error('Sensitive database connection string leaked');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
        path: '/api/v1/test',
      }),
    );
    const jsonArg = (
      mockResponse.json.mock.calls[0] as [Record<string, unknown>]
    )[0];
    expect(jsonArg.stack).toBeUndefined();
  });
});
