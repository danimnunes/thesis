import fs from "node:fs";
import path from "node:path";

/**
 * Post-install script to fix the dependencies of the subgraphs.
 * Matchstick will fail to compile the subgraph if the dependencies listed below are not copied to the node_modules folder.
 * With Yarn, we used to declare these dependencies in the "nohoist" section of the package.json file.
 */

const packagesToFix = ["subgraphs/core-services", "subgraphs/estat"];

const dependenciesToDereference = [
  "@graphprotocol/graph-ts",
  "assemblyscript",
  "binaryen",
  "matchstick-as",
];

for (const packageToFix of packagesToFix) {
  const nodeModules = `${packageToFix}/node_modules`;
  for (const dependency of dependenciesToDereference) {
    const dependencyPath = path.resolve(
      import.meta.dirname,
      `../${nodeModules}/${dependency}`,
    );

    if (!fs.lstatSync(dependencyPath).isSymbolicLink()) {
      continue;
    }

    const realpath = fs.realpathSync(dependencyPath);

    fs.unlinkSync(dependencyPath);
    fs.cpSync(realpath, dependencyPath, {
      recursive: true,
    });
  }
}
