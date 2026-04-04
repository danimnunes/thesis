// https://vitest.dev/config/#globalsetup

export function setup() {
  // Define environment variables to be used in unit tests only
  // These values override what is defined in .env* files.
  process.env.LOCAL_ORIGIN = "http://api.local";
}
