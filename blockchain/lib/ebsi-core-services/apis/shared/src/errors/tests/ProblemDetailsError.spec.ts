import { describe, expect, it } from "vitest";

import { ProblemDetailsError } from "../index.ts";

describe("error ProblemDetailsError", () => {
  it("should have about:blank has default type", () => {
    expect.assertions(1);

    const error = new ProblemDetailsError(1337, "Test Error");

    expect(error.type).toBe("about:blank");
  });

  it("should have the correct properties", () => {
    expect.assertions(7);

    const error = new ProblemDetailsError(1337, "Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.name).toBe("ProblemDetailsError");
    expect(error.status).toBe(1337);
    expect(error.title).toBe("Test Error");
    expect(error.type).toBe("test");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.extensions).toStrictEqual({ custom: "value" });
  });

  it("should print the correct JSON object", () => {
    expect.assertions(2);

    const error = new ProblemDetailsError(1337, "Test Error", {
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
      status: 1337,
      title: "Test Error",
      type: "test",
    });
  });

  it("should print the correct string", () => {
    expect.assertions(1);

    const error = new ProblemDetailsError(1337, "Test Error", {
      extensions: {
        custom: "value",
      },
      type: "test",
    });

    expect(error.toString()).toBe("1337 - Test Error");
  });
});
