#!/usr/bin/env node
/**
 * Mass-scope every monorepo package to @waldner-laboreinrichtungen/*.
 *
 *   - packages/<name>/package.json .name       → @waldner-laboreinrichtungen/<name>
 *   - dependencies / devDependencies / peerDependencies: every key that is a
 *     monorepo package gets rewritten to its scoped counterpart, value preserved.
 *   - version is set to TARGET_VERSION everywhere.
 *
 * Idempotent: re-running on already-scoped packages is a no-op.
 */
const fs = require("fs");
const path = require("path");

const SCOPE = "@waldner-laboreinrichtungen";
const TARGET_VERSION = "2.169.0-ievent.1";

const packagesDir = path.join(__dirname, "packages");
const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

// Pass 1: build a mapping `unscopedName → scopedName` for every monorepo package.
// We register BOTH `pkg.name` (may already be scoped from a prior run) AND the
// directory name (always unscoped canonical form) so re-runs stay idempotent
// and still rewrite dependency keys that reference packages by their original
// unscoped name.
const rename = new Map();
for (const dir of dirs) {
    const pkgPath = path.join(packagesDir, dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const originalName = pkg.name;
    if (!originalName) continue;
    const unscopedName = originalName.replace(/^@[^/]+\//, "");
    const scopedName = `${SCOPE}/${unscopedName}`;
    rename.set(originalName, scopedName);   // current form → scoped
    rename.set(scopedName, scopedName);     // scoped → scoped (idempotent)
    rename.set(unscopedName, scopedName);   // directory/original name → scoped (covers re-runs)
    rename.set(dir, scopedName);            // defensive: also by dir-name in case of mismatch
}

console.log(`Discovered ${rename.size / 2} monorepo packages to scope.`);

function rewriteDeps(depBlock) {
    if (!depBlock) return depBlock;
    const out = {};
    for (const [k, v] of Object.entries(depBlock)) {
        const scoped = rename.get(k);
        if (scoped && !k.startsWith(SCOPE + "/")) {
            // Keep the unscoped key so existing `import ... from "node-opcua-XXX"` source code
            // continues to resolve. Point the value at the scoped package via npm: alias so
            // the resolver transparently loads the published scoped version.
            out[k] = `npm:${scoped}@${TARGET_VERSION}`;
        } else if (scoped) {
            // Already scoped key — keep scoped, pin version
            out[k] = TARGET_VERSION;
        } else {
            // External dep — leave untouched
            out[k] = v;
        }
    }
    return out;
}

// Pass 2: rewrite each package.json
let touched = 0;
for (const dir of dirs) {
    const pkgPath = path.join(packagesDir, dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;

    const before = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(before);

    const scopedName = rename.get(pkg.name);
    if (scopedName) pkg.name = scopedName;
    pkg.version = TARGET_VERSION;
    pkg.dependencies = rewriteDeps(pkg.dependencies);
    pkg.devDependencies = rewriteDeps(pkg.devDependencies);
    pkg.peerDependencies = rewriteDeps(pkg.peerDependencies);

    // Publishing config: make sure GitHub Packages registry is selected for this scope.
    pkg.publishConfig = pkg.publishConfig || {};
    pkg.publishConfig.registry = "https://npm.pkg.github.com";
    pkg.publishConfig.access = "restricted";

    const after = JSON.stringify(pkg, null, 2) + "\n";
    if (after !== before) {
        fs.writeFileSync(pkgPath, after);
        touched++;
    }
}

// Also bump the root package.json version for lerna consistency.
const rootPkgPath = path.join(__dirname, "package.json");
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
rootPkg.version = TARGET_VERSION;
fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");

console.log(`Touched ${touched} package.json files (out of ${dirs.length}).`);
console.log(`Scope: ${SCOPE} — Version: ${TARGET_VERSION}`);
