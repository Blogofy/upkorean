// packages/shared lives outside this folder, so Metro has to be told about it twice: once to watch the
// files (or an edit there never reaches a running bundler) and once to look for modules in the repo's
// node_modules, where npm put the @upkorean/shared link.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.join(repoRoot, "packages", "shared")];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(repoRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  "@upkorean/shared": path.join(repoRoot, "packages", "shared"),
};

module.exports = config;
