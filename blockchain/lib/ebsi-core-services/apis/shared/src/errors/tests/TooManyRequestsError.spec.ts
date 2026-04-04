import { describe, expect, it } from "vitest";

import { ProblemDetailsError, TooManyRequestsError } from "../index.ts";

describe("error TooManyRequestsError", () => {
  it("should extend ProblemDetailsError", () => {
    expect.assertions(1);

    const error = new TooManyRequestsError("Test Error");

    expect(error instanceof ProblemDetailsError).toBe(true);
  });

  it("should have 'Too Many Requests' as default title", () => {
    expect.assertions(1);

    const error = new TooManyRequestsError();

    expect(error.title).toBe("Too Many Requests");
  });

  it("should have the correct properties", () => {
    expect.assertions(7);

    const error = new TooManyRequestsError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("TooManyRequestsError");
    expect(error.status).toStrictEqual(TooManyRequestsError.statusCode);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new TooManyRequestsError("Test Error", {
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
      status: TooManyRequestsError.statusCode,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new TooManyRequestsError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe(
      `${TooManyRequestsError.statusCode} - Test Error`,
    );
  });
});
