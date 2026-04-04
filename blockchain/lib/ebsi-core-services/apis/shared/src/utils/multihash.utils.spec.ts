import { hexToBytes } from "@noble/curves/utils.js";
import { digest } from "multiformats";
import { describe, expect, it } from "vitest";

import {
  hashNames,
  multihashDecode,
  multihashEncode,
} from "./multihash.utils.ts";

describe("multihashEncode / multihashDecode", () => {
  it("should produce the expected result", () => {
    expect.assertions(7);

    expect(
      Buffer.from(
        multihashEncode(
          "41dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
          "sha2-256",
        ),
      ).toString("hex"),
    ).toBe(
      "122041dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
    );

    expect(
      Buffer.from(
        multihashDecode(
          Buffer.from(
            "122041dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
            "hex",
          ),
        ).bytes,
      ).toString("hex"),
    ).toBe(
      "122041dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
    );

    expect(
      Buffer.from(
        multihashDecode(
          Buffer.from(
            "122041dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
            "hex",
          ),
        ).digest,
      ).toString("hex"),
    ).toBe("41dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8");

    expect(
      multihashDecode(
        Buffer.from(
          "122041dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
          "hex",
        ),
      ).code,
    ).toBe(hashNames["sha2-256"]);

    expect(
      Buffer.from(
        multihashEncode(
          "41dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
          "sha3-256",
        ),
      ).toString("hex"),
    ).toBe(
      "162041dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
    );

    // Same result whether the input string is prefixed with 0x or not
    expect(
      Buffer.from(
        multihashEncode(
          "0x41dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
          "sha2-256",
        ),
      ).toString("hex"),
    ).toBe(
      "122041dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
    );

    // Should support truncated hashes (here, 8 bytes)
    expect(
      Buffer.from(
        multihashEncode(
          Buffer.from(
            "41dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
            "hex",
          )
            .slice(0, 8)
            .toString("hex"),
          "sha2-256",
          8,
        ),
      ).toString("hex"),
    ).toBe("120841dd7b6443542e75");
  });

  it("should throw an error when the input is not valid", () => {
    expect.assertions(3);

    expect(() =>
      multihashEncode(
        "41dd7b6443542e75701aa98a0c235951a28a0d851b11XXX64d20022ab11d2589a8",
        "sha2-256",
      ),
    ).toThrow(
      new Error('hex string expected, got non-hex character "XX" at index 44'),
    );

    expect(() =>
      multihashEncode(
        "41dd7b6443542e75701aa98a0c235951a28a0d851b11564d22ab11d2589a8",
        "sha2-256",
      ),
    ).toThrow(new Error("hex string expected, got unpadded hex of length 61"));

    expect(() =>
      multihashDecode(
        digest.create(
          // eslint-disable-next-line unicorn/numeric-separators-style
          0xb403, // Invalid code
          hexToBytes(
            "41dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
          ),
        ).bytes,
      ),
    ).toThrow(new Error("multihash unknown function code: 0xb403"));
  });

  it("should throw an error when the algorithm is not valid", () => {
    expect.assertions(1);

    expect(() =>
      multihashEncode(
        "41dd7b6443542e75701aa98a0c235951a28a0d851b11564d20022ab11d2589a8",
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Ignored for the test
        "test",
      ),
    ).toThrow(new Error("Unrecognized hash function named: test"));
  });
});
