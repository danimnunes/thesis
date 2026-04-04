import { describe, expect, it } from "vitest";

import { NotImplementedError, ProblemDetailsError } from "../index.ts";

describe("error NotImplementedError", () => {
  it("should extend ProblemDetailsError", () => {
    expect.assertions(1);

    const error = new NotImplementedError("Test Error");

    expect(error instanceof ProblemDetailsError).toBe(true);
  });

  it("should have 'Not Implemented' as default title", () => {
    expect.assertions(1);

    const error = new NotImplementedError();

    expect(error.title).toBe("Not Implemented");
  });

  it("should have the correct properties", () => {
    expect.assertions(7);

    const error = new NotImplementedError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("NotImplementedError");
    expect(error.status).toStrictEqual(NotImplementedError.statusCode);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new NotImplementedError("Test Error", {
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
      status: NotImplementedError.statusCode,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new NotImplementedError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe(
      `${NotImplementedError.statusCode} - Test Error`,
    );
  });
});
