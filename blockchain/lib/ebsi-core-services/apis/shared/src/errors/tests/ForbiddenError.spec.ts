import { describe, expect, it } from "vitest";

import { ForbiddenError, ProblemDetailsError } from "../index.ts";

describe("error ForbiddenError", () => {
  it("should extend ProblemDetailsError", () => {
    expect.assertions(1);

    const error = new ForbiddenError("Test Error");

    expect(error instanceof ProblemDetailsError).toBe(true);
  });

  it("should have 'Forbidden' as default title", () => {
    expect.assertions(1);

    const error = new ForbiddenError();

    expect(error.title).toBe("Forbidden");
  });

  it("should have the correct properties", () => {
    expect.assertions(7);

    const error = new ForbiddenError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("ForbiddenError");
    expect(error.status).toStrictEqual(ForbiddenError.statusCode);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new ForbiddenError("Test Error", {
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
      status: ForbiddenError.statusCode,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new ForbiddenError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe(`${ForbiddenError.statusCode} - Test Error`);
  });
});
