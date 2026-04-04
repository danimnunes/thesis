import { TextDecoder } from "node:util";
import { describe, expect, it } from "vitest";

import { multibase } from "./multibase.utils.ts";

const bases: Record<
  keyof typeof multibase,
  {
    /* global BufferEncoding */
    encoding: BufferEncoding;
    inputString: string;
    multibaseString: string;
  }[]
> = {
  base16: [
    {
      encoding: "utf8",
      inputString: new TextDecoder().decode(Uint8Array.from([0x01, 0x02])),
      multibaseString: "f0102",
    },
    {
      encoding: "hex",
      inputString: "8a173fd3e32c0fa78b90fe42d305f202244e2739",
      multibaseString: "f8a173fd3e32c0fa78b90fe42d305f202244e2739",
    },
    {
      encoding: "utf8",
      inputString: "÷ïÿ",
      multibaseString: "fc3b7c3afc3bf",
    },
    {
      encoding: "utf8",
      inputString: "÷ïÿ🥰÷ïÿ😎🥶🤯",
      multibaseString:
        "fc3b7c3afc3bff09fa5b0c3b7c3afc3bff09f988ef09fa5b6f09fa4af",
    },
  ],
  base58btc: [
    {
      encoding: "utf8",
      inputString: "÷ïÿ",
      multibaseString: "z2gTnNVSBg",
    },
    {
      encoding: "utf8",
      inputString: "÷ïÿ🥰÷ïÿ😎🥶🤯",
      multibaseString: "z31kmCPVCi3zGReVrkbcUbPSXtMTxWfNUkQFLgSJ",
    },
  ],
  base64: [
    {
      encoding: "utf8",
      inputString: "÷ïÿ",
      multibaseString: "mw7fDr8O/",
    },
    {
      encoding: "utf8",
      inputString: "÷ïÿ🥰÷ïÿ😎🥶🤯",
      multibaseString: "mw7fDr8O/8J+lsMO3w6/Dv/CfmI7wn6W28J+krw",
    },
  ],
  base64url: [
    {
      encoding: "utf8",
      inputString: "÷ïÿ",
      multibaseString: "uw7fDr8O_",
    },
    {
      encoding: "utf8",
      inputString: "÷ïÿ🥰÷ïÿ😎🥶🤯",
      multibaseString: "uw7fDr8O_8J-lsMO3w6_Dv_CfmI7wn6W28J-krw",
    },
  ],
};

describe("multibase", () => {
  describe.each(Object.keys(bases) as (keyof typeof bases)[])("%s", (base) => {
    describe("decode", () => {
      it("should throw an error if we provide an invalid input", () => {
        expect.assertions(1);

        expect(() => multibase[base].decode("test")).toThrow(
          new Error(
            `Unable to decode multibase string "test", ${base} decoder only supports inputs prefixed with ${multibase[base].prefix}`,
          ),
        );
      });
    });

    const dataset = bases[base];

    describe.each(Object.keys(dataset))("Test case #%i", (i) => {
      const data = dataset[Number.parseInt(i, 10)]!;

      describe("encode", () => {
        it("should produce the expected result", () => {
          expect.assertions(1);

          expect(
            multibase[base].encode(
              Buffer.from(data.inputString, data.encoding),
            ),
          ).toStrictEqual(data.multibaseString);
        });
      });

      describe("decode", () => {
        it("should produce the expected result", () => {
          expect.assertions(1);

          expect(
            Buffer.from(multibase[base].decode(data.multibaseString)).toString(
              data.encoding,
            ),
          ).toStrictEqual(data.inputString);
        });
      });
    });
  });
});
