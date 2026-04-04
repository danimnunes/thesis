import { describe, expect, it } from "vitest";

import { InternalServerError, ProblemDetailsError } from "../index.ts";

describe("error InternalServerError", () => {
  it("should extend ProblemDetailsError", () => {
    expect.assertions(1);

    const error = new InternalServerError("Test Error");

    expect(error instanceof ProblemDetailsError).toBe(true);
  });

  it("should have 'Internal Server Error' as default title", () => {
    expect.assertions(1);

    const error = new InternalServerError();

    expect(error.title).toBe("Internal Server Error");
  });

  it("should have the correct properties", () => {
    expect.assertions(7);

    const error = new InternalServerError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("InternalServerError");
    expect(error.status).toStrictEqual(InternalServerError.statusCode);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new InternalServerError("Test Error", {
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
      status: InternalServerError.statusCode,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new InternalServerError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe(
      `${InternalServerError.statusCode} - Test Error`,
    );
  });
});
