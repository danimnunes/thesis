import { glob } from "glob";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { readPackage } from "read-pkg";
import spdxLicenseList from "spdx-license-list/full.js";
import { parse } from "yaml";

const licenseBasenames = [
  /^LICENSE$/,
  /^LICENSE-\w+$/, // e.g. LICENSE-MIT
  /^LICENCE$/,
  /^LICENCE-\w+$/,
];

/**
 * Find the package directory
 * @param {string} root
 * @param {string} moduleEntry
 * @returns Package directory
 */
const getModuleDir = (root, moduleEntry) => {
  const packageName = moduleEntry.includes("/")
    ? moduleEntry.startsWith("@")
      ? moduleEntry.split("/").slice(0, 2).join("/")
      : moduleEntry.split("/")[0]
    : moduleEntry;

  if (!packageName) return;

  const require = createRequire(root);
  const paths = require.resolve.paths(moduleEntry);

  if (!paths) return;

  const lookupPaths = paths.map((p) => path.join(p, packageName));

  return lookupPaths.find((p) => fs.existsSync(p));
};

const { packages } = parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, "../pnpm-workspace.yaml"),
    "utf8",
  ),
);

if (!packages || !Array.isArray(packages)) {
  throw new Error("No packages found");
}

// Get dependencies of each workspace
for (const workspace of packages) {
  const projects = await glob(workspace);

  for (const project of projects) {
    const pkg = await readPackage({ cwd: project });

    const projectLicense = fs.readFileSync(
      path.resolve(project, "LICENSE.txt"),
      "utf8",
    );

    let notice = `EBSI

========================================================================================
Copyright (C) ${new Date().getFullYear()} European Union

${projectLicense}
`;
    if (!pkg.dependencies || Object.keys(pkg.dependencies).length === 0) {
      // Print LICENSES.txt
      fs.writeFileSync(path.join(project, "LICENSES.txt"), notice);
      continue;
    }

    notice += `
-------------------------

This product makes use of software developed by third parties.
`;

    for (const [name, version] of Object.entries(pkg.dependencies)) {
      const dir = getModuleDir(path.resolve(project) + "/", name);

      if (!dir) {
        throw new Error(
          `No directory found for ${name}@${version} in ${project}`,
        );
      }

      const { license, name: packageName } = await readPackage({ cwd: dir });

      if (packageName.startsWith("@ebsiint-")) {
        continue;
      }

      if (!license) {
        console.warn(`No license found for ${name}@${version}`);
        continue;
      }

      notice += `
========================================================================================
- ${name}@${version}
------------------------------
This project is licensed under ${license}.
`;

      // Remove parentheses and split by " AND " or " OR "
      const licenses = license
        .replace(/\(/, "")
        .replace(/\)/, "")
        .split(/ AND | OR /);

      for (const l of licenses) {
        const spdxLicense = spdxLicenseList[l];

        if (!spdxLicense) {
          // In case the license defined in package.json is not a valid SPDX license
          throw new Error(`No SPDX license found for ${l}`);
        }

        notice += `\n${spdxLicense.name}: ${spdxLicense.url}`;
      }

      notice += `\n`;

      const files = fs.readdirSync(dir).filter((file) => {
        // Ignore extension and case sensitivity
        const basename = path.basename(file, path.extname(file)).toUpperCase();
        return licenseBasenames.some((re) => re.test(basename));
      });

      if (files.length === 0) {
        // Sometimes there's simply no LICENSE file, e.g. uint8arrays
        console.warn(
          `No license file found for ${name}@${version} in ${dir}. Using default license text...`,
        );

        for (const l of licenses) {
          const licenseText = spdxLicenseList[l]?.licenseText;
          notice += `\n${licenseText}\n`;
        }

        continue;
      }

      if (licenses.length !== files.length) {
        // Sometimes, the package is supposed to have multiple licenses (as defined in package.json) but there's only one license file, e.g. pako
        console.warn(
          `Number of license files (${files.length}) does not match number of licenses (${licenses.length}) for ${name}@${version} in ${dir}`,
        );
      }

      for (const file of files) {
        const licenseFile = path.join(dir, file);
        const licenseText = fs
          .readFileSync(licenseFile, "utf8")
          .replace(/^\s*(?:\r\n?|\n)|\s*(?:\r\n?|\n)$/, "");

        notice += `\n--\n\n${licenseText}\n`;
      }
    }

    // Print LICENSES.txt
    fs.writeFileSync(path.join(project, "LICENSES.txt"), notice);
    console.log(`Created LICENSES.txt for ${project}`);
  }
}
