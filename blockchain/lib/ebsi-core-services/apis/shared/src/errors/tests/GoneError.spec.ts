import { describe, expect, it } from "vitest";

import { GoneError, ProblemDetailsError } from "../index.ts";

describe("error GoneError", () => {
  it("should extend ProblemDetailsError", () => {
    expect.assertions(1);

    const error = new GoneError("Test Error");

    expect(error instanceof ProblemDetailsError).toBe(true);
  });

  it("should have 'Gone' as default title", () => {
    expect.assertions(1);

    const error = new GoneError();

    expect(error.title).toBe("Gone");
  });

  it("should have the correct properties", () => {
    expect.assertions(7);

    const error = new GoneError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("GoneError");
    expect(error.status).toStrictEqual(GoneError.statusCode);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new GoneError("Test Error", {
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
      status: GoneError.statusCode,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new GoneError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe(`${GoneError.statusCode} - Test Error`);
  });
});
