import type { ArgumentsHost } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { AxiosError } from "axios";

import {
  MethodNotAllowedError,
  ProblemDetailsError,
} from "@ebsiint-api/shared";
import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getNestFastifyApplication } from "../../tests/utils/app.ts";
import { AllExceptionsFilter } from "./http-exception.filter.ts";

const mockGetResponse = vi.fn().mockImplementation(() => ({
  code: vi.fn().mockImplementation((code: unknown) => ({
    type: vi.fn().mockImplementation((type: unknown) => ({
      headers: vi.fn().mockImplementation((headers: unknown) => ({
        send: vi.fn().mockImplementation((send: unknown) => ({
          code,
          headers,
          send,
          type,
        })),
      })),
    })),
  })),
}));

const mockHttpArgumentsHost = vi.fn().mockImplementation(() => ({
  getNext: vi.fn(),
  getRequest: vi.fn(),
  getResponse: mockGetResponse,
})) as ArgumentsHost["switchToHttp"];

const mockArgumentsHost: ArgumentsHost = {
  getArgByIndex: vi.fn() as ArgumentsHost["getArgByIndex"],
  getArgs: vi.fn() as ArgumentsHost["getArgs"],
  getType: vi.fn() as ArgumentsHost["getType"],
  switchToHttp: mockHttpArgumentsHost,
  switchToRpc: vi.fn() as ArgumentsHost["switchToRpc"],
  switchToWs: vi.fn() as ArgumentsHost["switchToWs"],
};

describe("All exception filter tests", () => {
  let app: NestFastifyApplication;
  let service: AllExceptionsFilter;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [],
      providers: [AllExceptionsFilter, ConfigService],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    service = app.get<AllExceptionsFilter>(AllExceptionsFilter);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should handle Problem detail error", () => {
    const problem = new ProblemDetailsError(403, "Custom Error", {
      detail: "Custom detail",
    });
    const response = service.catch(problem, mockArgumentsHost);
    expect(response).toStrictEqual({
      code: 403,
      headers: {},
      send: {
        detail: "Custom detail",
        status: 403,
        title: "Custom Error",
        type: "about:blank",
      },
      type: "application/problem+json",
    });
  });

  it("should handle additional headers on MethodNotAllowedError", () => {
    const problem = new MethodNotAllowedError("Custom Error", ["POST", "PUT"], {
      detail: "Custom detail",
    });
    const response = service.catch(problem, mockArgumentsHost);
    expect(response).toStrictEqual({
      code: MethodNotAllowedError.statusCode,
      headers: {
        Allow: "POST, PUT",
      },
      send: {
        detail: "Custom detail",
        status: MethodNotAllowedError.statusCode,
        title: "Custom Error",
        type: "about:blank",
      },
      type: "application/problem+json",
    });
  });

  it("should handle NotFoundException", () => {
    const detail = "Object Not Found";
    const exception = new NotFoundException(detail);
    const response = service.catch(exception, mockArgumentsHost);
    expect(response).toStrictEqual({
      code: 404,
      headers: {},
      send: {
        detail,
        status: 404,
        title: "Not Found",
        type: "about:blank",
      },
      type: "application/problem+json",
    });
  });

  it("should handle BadRequestException", () => {
    const detail = "Bad Parameter";
    const exception = new BadRequestException(detail);
    const response = service.catch(exception, mockArgumentsHost);
    expect(response).toStrictEqual({
      code: 400,
      headers: {},
      send: {
        detail,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      },
      type: "application/problem+json",
    });
  });

  it("should handle custom HttpException with specific status code", () => {
    const errorMessage = "Unsupported Media Type: bad-x-www-form-urlencoded";
    const statusCode = 415;
    const exception = new HttpException(errorMessage, statusCode);
    const response = service.catch(exception, mockArgumentsHost);
    expect(response).toStrictEqual({
      code: statusCode,
      headers: {},
      send: {
        detail: errorMessage,
        status: statusCode,
        title: errorMessage,
        type: "about:blank",
      },
      type: "application/problem+json",
    });
  });

  describe("Axios errors", () => {
    const axiosError: AxiosError = {
      isAxiosError: true,
      message: "error",
      name: "Error",
      toJSON: () => ({}),
    };

    const expectedError = {
      code: 500,
      headers: {},
      send: {
        detail:
          "The server encountered an internal error and was unable to complete your request",
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
      },
      type: "application/problem+json",
    };

    it("should handle error", () => {
      const response = service.catch(axiosError, mockArgumentsHost);
      expect(response).toStrictEqual(expectedError);
    });

    it("should handle error.response", () => {
      const error = {
        ...axiosError,
        response: {
          config: undefined,
          data: "error",
          headers: undefined,
          status: 400,
          statusText: "Error 400",
        },
      };
      const response = service.catch(error, mockArgumentsHost);
      expect(response).toStrictEqual(expectedError);
    });

    it("should handle error.request", () => {
      const error = {
        ...axiosError,
        request: { url: "/" },
      };
      const response = service.catch(error, mockArgumentsHost);
      expect(response).toStrictEqual(expectedError);
    });
  });
});
