import '@ton/test-utils';

export const ONE_HOUR_IN_SECS = 60 * 60;

export function abs(n: bigint) {
  return n < 0n ? -n : n;
}

export function expectBigNumberEquals(expected: bigint, actual: bigint) {
  const equals = abs(expected - actual) <= abs(expected) * 8n / 10000n;
  if (!equals) {
    console.log(`BigNumber does not equal. expected: ${expected.toString()}, actual: ${actual.toString()}`);
  }
  expect(equals).toBeTruthy();
}