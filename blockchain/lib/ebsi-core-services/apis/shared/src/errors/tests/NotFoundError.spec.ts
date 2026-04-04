import { describe, expect, it } from "vitest";

import { NotFoundError, ProblemDetailsError } from "../index.ts";

describe("error NotFoundError", () => {
  it("should extend ProblemDetailsError", () => {
    expect.assertions(1);

    const error = new NotFoundError("Test Error");

    expect(error instanceof ProblemDetailsError).toBe(true);
  });

  it("should have 'Not Found' as default title and 'about:blank' has default type", () => {
    expect.assertions(2);

    const error = new NotFoundError();

    expect(error.title).toBe("Not Found");
    expect(error.type).toBe("about:blank");
  });

  it("should have the correct properties", () => {
    expect.assertions(7);

    const error = new NotFoundError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("NotFoundError");
    expect(error.status).toStrictEqual(NotFoundError.statusCode);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new NotFoundError("Test Error", {
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
      status: NotFoundError.statusCode,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new NotFoundError("Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe(`${NotFoundError.statusCode} - Test Error`);
  });
});
