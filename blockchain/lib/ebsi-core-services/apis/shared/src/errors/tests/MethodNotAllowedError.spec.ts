import { describe, expect, it } from "vitest";

import { MethodNotAllowedError, ProblemDetailsError } from "../index.ts";

describe("error MethodNotAllowedError", () => {
  it("should extend ProblemDetailsError", () => {
    expect.assertions(1);

    const error = new MethodNotAllowedError("Test Error", ["DELETE"]);

    expect(error instanceof ProblemDetailsError).toBe(true);
  });

  it("should have the correct properties", () => {
    expect.assertions(8);

    const error = new MethodNotAllowedError("Test Error", ["GET"], {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("MethodNotAllowedError");
    expect(error.status).toStrictEqual(MethodNotAllowedError.statusCode);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
    expect(error.headers).toStrictEqual({ Allow: "GET" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new MethodNotAllowedError("Test Error", ["GET"], {
      extensions: {
        custom: "value",
      },
      type: "test",
    });
    const jsonError = error.toJSON();

    // JSON.stringify should call toJSON
    // eslint-disable-next-line unicorn/prefer-structured-clone
    expect(JSON.parse(JSON.stringify(error))).toStrictEqual(jsonError);
    expect(jsonError).toStrictEqual({
      custom: "value",
      status: MethodNotAllowedError.statusCode,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new MethodNotAllowedError("Test Error", ["GET"], {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe(
      `${MethodNotAllowedError.statusCode} - Test Error`,
    );
  });
});
