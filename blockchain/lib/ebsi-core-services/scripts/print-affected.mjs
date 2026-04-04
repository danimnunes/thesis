import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { EOL } from "node:os";

/**
 * The script below should prepare a list of affected (modified) services and apps managed through Docker containers.
 * Therefore, results should not contain SC or shared utilities which are not Dockerized.
 * Git commit hash values should be used consistently throughout the rest of the toolchain managing the manifested resources.
 */

const deprecatedServices = new Set([
  "@ebsiint-api/authorisation-api-v2",
  "@ebsiint-api/authorisation-api-v3",
  "@ebsiint-api/did-registry-api-v3",
  "@ebsiint-api/did-registry-api-v4",
  "@ebsiint-api/ledger-api-v3",
  "@ebsiint-api/timestamp-api-v3",
  "@ebsiint-api/trusted-apps-registry-api-v3",
  "@ebsiint-api/trusted-apps-registry-api-v4",
  "@ebsiint-api/trusted-issuers-registry-api-v3",
  "@ebsiint-api/trusted-issuers-registry-api-v4",
  "@ebsiint-api/trusted-policies-registry-api-v2",
  "@ebsiint-api/trusted-schemas-registry-api-v2",
  "@ebsiint-sc/bootstrap",
  "@ebsiint-sc/did-registry",
  "@ebsiint-sc/did-registry-v2",
  "@ebsiint-sc/timestamp",
  "@ebsiint-sc/trusted-apps-registry",
  "@ebsiint-sc/trusted-apps-registry-v3",
  "@ebsiint-sc/trusted-issuers-registry",
  "@ebsiint-sc/trusted-issuers-registry-v3",
  "@ebsiint-sc/trusted-policies-registry",
  "@ebsiint-sc/trusted-schemas-registry",
]);

// for the jenkins pipeline, read GIT_PREVIOUS_SUCCESSFUL_COMMIT so that the diff is done between last successful build and HEAD
// otherwise, if the variable is not present, make the diff with the previous commit
const baseCommit = process.env["GIT_PREVIOUS_SUCCESSFUL_COMMIT"] ?? "main~1";

console.log("Comparing HEAD to commit:", baseCommit);

const processResult = spawnSync("./node_modules/.bin/nx", [
  "show",
  "projects",
  "--affected",
  `--base=${baseCommit}`,
  "--head=main",
  "--json",
]);

try {
  const projects = JSON.parse(processResult.stdout.toString());
  const affected = projects
    // microservices and apps
    .filter(
      (project) =>
        project.startsWith("@ebsiint-api") ||
        project.startsWith("@ebsiint-app") ||
        project === "@ebsiint-subgraph/subgraphs-deployer",
    )
    // NOT service utilities
    .filter((project) => project !== "@ebsiint-api/shared")
    // Filter out deprecated services
    .filter((project) => !deprecatedServices.has(project))
    .map((project) => {
      const [_scope, packageName] = project.split("/");
      return packageName;
    });

  if (affected.length === 0) {
    console.log(
      "No affected packages. No need for new docker images or deployments",
    );
    // Theory says exit with non-zero code to communicate an error.
    // The idea is that this scripts communicates an error to prevent jenkins deployment steps from executing in vain.
    return process.exit(1);
  }

  console.log("affected services", affected);

  const updates = affected
    .map((pkg) => `version_tag::${pkg}: ${process.env["GIT_COMMIT"]}`)
    .join(EOL);

  writeFileSync("affected.yaml", updates);

  console.log("affected.yaml created successfully");
  console.log(updates);
} catch (error) {
  console.error("Could not parse results", error.message);
  console.log("The process result", processResult);
}
