import { assert } from "matchstick-as";

export function assertArrayContainsAllValues<T>(
  array: T[],
  values: T[],
  message: string,
): void {
  for (let i = 0, k = values.length; i < k; ++i) {
    assert.booleanEquals(true, array.includes(values[i]) as boolean, message);
  }
}
