import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { extname, isAbsolute, parse, relative, resolve, sep, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { expectedCatalogIds, loadBlueprint } from "./costume-blueprint.mjs";
import { acceptedCandidatePath, validateCandidate } from "./costume-normalize-candidates.mjs";
import { readPngRgba } from "./lib/png-rgba.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const rarities = ["common", "rare", "epic", "legendary", "special"];

function assertPathInsideWith(pathApi, root, path, label) {
  if (!pathApi.isAbsolute(root) || !pathApi.isAbsolute(path)) {
    throw new Error(`${label}: root and candidate paths must be absolute`);
  }
  const normalizedRoot = pathApi.resolve(root);
  const normalizedPath = pathApi.resolve(path);
  const relativePath = pathApi.relative(normalizedRoot, normalizedPath);
  if (
    relativePath === ""
    || isAbsolute(relativePath)
    || relativePath === ".."
    || relativePath.startsWith(`..${sep}`)
    || relativePath.startsWith("../")
    || relativePath.startsWith("..\\")
  ) {
    throw new Error(`${label}: path escapes its approved directory`);
  }
  return normalizedPath;
}

export function assertPathInside(root, path, label = "path") {
  return assertPathInsideWith({ isAbsolute, resolve, relative, sep }, root, path, label);
}

export function assertWindowsPathInside(root, path, label = "path") {
  return assertPathInsideWith(win32, root, path, label);
}

function sameCanonicalPath(left, right) {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

export async function authorizePromotionRoot(root = repositoryRoot) {
  if (!isAbsolute(root)) throw new Error("promotion root must be absolute");
  const lexicalRoot = resolve(root);
  const rootStat = await lstat(lexicalRoot).catch((error) => {
    if (error?.code === "ENOENT") throw new Error("promotion root must be an existing real directory");
    throw error;
  });
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("promotion root must be an existing real directory");
  }
  const rootPath = parse(lexicalRoot).root;
  let current = rootPath;
  for (const segment of relative(rootPath, lexicalRoot).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`promotion root has a symlink or non-directory ancestor: ${current}`);
    }
    const canonical = await realpath(current);
    if (!sameCanonicalPath(canonical, current)) {
      throw new Error(`promotion root has a redirected ancestor: ${current}`);
    }
  }
  const canonicalRoot = await realpath(lexicalRoot);
  if (!sameCanonicalPath(canonicalRoot, lexicalRoot)) {
    throw new Error("promotion root resolves through a symlink or junction");
  }
  return canonicalRoot;
}

async function verifiedDirectory(root, directory, label) {
  const canonicalRoot = await authorizePromotionRoot(root);
  const lexicalDirectory = assertPathInside(canonicalRoot, resolve(directory), label);
  let current = canonicalRoot;
  for (const segment of relative(canonicalRoot, lexicalDirectory).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`${label}: parent directory is not a real directory`);
    }
    const canonical = await realpath(current);
    if (!sameCanonicalPath(canonical, current)) {
      throw new Error(`${label}: parent directory resolves through a symlink or junction`);
    }
  }
  return { canonicalRoot, canonicalDirectory: current };
}

async function verifiedRegularFile(path, parent, label, { allowMissing = false } = {}) {
  const stat = await lstat(path).catch((error) => {
    if (allowMissing && error?.code === "ENOENT") return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label}: file must be a regular non-symlink file`);
  }
  const canonicalPath = await realpath(path);
  assertPathInside(parent.canonicalDirectory, canonicalPath, label);
  return stat;
}

function candidateRecord(key, entry) {
  if (entry && typeof entry === "object" && !(entry instanceof Uint8Array)) {
    return {
      id: entry.id ?? key,
      rarity: entry.rarity,
      sourcePath: entry.sourcePath,
      bytes: entry.bytes,
      decoded: entry.decoded,
      invalid: entry.invalid,
    };
  }
  return { id: key, bytes: entry };
}

function candidatePaths(root, item) {
  const sourcePath = acceptedCandidatePath(item, root);
  const sourceParent = resolve(root, "pack", "qa", "accepted", item.rarity);
  const destinationParent = resolve(root, "pack", item.rarity);
  const targetPath = resolve(destinationParent, `${item.id}.png`);
  return { sourcePath, sourceParent, destinationParent, targetPath };
}

async function verifyAcceptedSource(root, item, sourcePath) {
  const { sourcePath: expectedSource, sourceParent } = candidatePaths(root, item);
  if (resolve(sourcePath) !== expectedSource) {
    throw new Error(`${item.id}: accepted candidate path does not match its approved rarity directory`);
  }
  const acceptedRoot = resolve(root, "pack", "qa", "accepted");
  const parent = await verifiedDirectory(acceptedRoot, sourceParent, item.id);
  assertPathInside(parent.canonicalDirectory, await realpath(sourcePath), item.id);
  await verifiedRegularFile(sourcePath, parent, item.id);
  return sourcePath;
}

async function verifyDestination(root, item) {
  const { destinationParent, targetPath } = candidatePaths(root, item);
  const packRoot = resolve(root, "pack");
  const parent = await verifiedDirectory(packRoot, destinationParent, item.id);
  assertPathInside(parent.canonicalDirectory, targetPath, item.id);
  await verifiedRegularFile(targetPath, parent, item.id, { allowMissing: true });
  return { parent, targetPath };
}

export async function loadAcceptedCandidates(root = repositoryRoot) {
  root = await authorizePromotionRoot(root);
  const acceptedRoot = resolve(root, "pack", "qa", "accepted");
  const candidates = new Map();
  let rarityEntries;
  try {
    const stat = await lstat(acceptedRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("accepted candidate root is not a real directory");
    }
    rarityEntries = await readdir(acceptedRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return candidates;
    throw error;
  }

  for (const directory of rarityEntries) {
    if (!directory.isDirectory() || !rarities.includes(directory.name)) {
      candidates.set(`__accepted_path_${directory.name}`, {
        id: directory.name,
        invalid: `unexpected accepted path ${directory.name}`,
      });
      continue;
    }
    const rarity = directory.name;
    const directoryPath = resolve(acceptedRoot, rarity);
    let parent;
    try {
      parent = await verifiedDirectory(acceptedRoot, directoryPath, rarity);
    } catch (error) {
      candidates.set(`__accepted_path_${rarity}`, { id: rarity, invalid: error.message });
      continue;
    }
    const files = await readdir(directoryPath, { withFileTypes: true });
    for (const file of files) {
      const sourcePath = resolve(directoryPath, file.name);
      if (!file.isFile() || extname(file.name).toLowerCase() !== ".png") {
        candidates.set(`__accepted_path_${rarity}_${file.name}`, {
          id: `${rarity}/${file.name}`,
          invalid: `unexpected accepted candidate path ${rarity}/${file.name}`,
        });
        continue;
      }
      const id = file.name.slice(0, -4);
      const key = candidates.has(id) ? `${id}#duplicate-${rarity}` : id;
      try {
        assertPathInside(parent.canonicalDirectory, sourcePath, id);
        await verifiedRegularFile(sourcePath, parent, id);
        candidates.set(key, { id, rarity, sourcePath, bytes: await readFile(sourcePath) });
      } catch (error) {
        candidates.set(key, { id, rarity, invalid: error.message });
      }
    }
  }
  return candidates;
}

export async function planPromotion(blueprint, acceptedCandidates, { root = repositoryRoot } = {}) {
  root = await authorizePromotionRoot(root);
  const errors = [];
  const expected = expectedCatalogIds();
  const blueprintById = new Map();
  if (!Array.isArray(blueprint)) {
    errors.push("blueprint: expected an array of 185 rows");
  } else {
    if (blueprint.length !== expected.size) errors.push(`expected 185 blueprint rows, got ${blueprint.length}`);
    for (const item of blueprint) {
      const id = typeof item?.id === "string" ? item.id : "<blueprint row>";
      if (blueprintById.has(id)) {
        errors.push(`${id}: duplicate blueprint row`);
        continue;
      }
      blueprintById.set(id, item);
      const expectedRarity = expected.get(id);
      if (!expectedRarity) {
        errors.push(`${id}: unexpected blueprint ID`);
        continue;
      }
      if (item.rarity !== expectedRarity) errors.push(`${id}: blueprint rarity mismatch (got ${item.rarity}, expected ${expectedRarity})`);
      if (item.qaState !== "accepted") errors.push(`${id}: qaState must be accepted (got ${item.qaState})`);
    }
    for (const id of expected.keys()) if (!blueprintById.has(id)) errors.push(`${id}: missing blueprint row`);
  }

  const candidates = acceptedCandidates instanceof Map ? acceptedCandidates : new Map();
  if (!(acceptedCandidates instanceof Map)) errors.push("accepted candidates: expected a Map keyed by costume ID");
  if (candidates.size !== expected.size) errors.push(`expected 185 accepted candidates, got ${candidates.size}`);
  const candidateIds = new Set();
  for (const [key, entry] of candidates) {
    const candidate = candidateRecord(key, entry);
    const id = candidate.id;
    if (candidate.invalid) {
      errors.push(`${id}: ${candidate.invalid}`);
      continue;
    }
    if (candidateIds.has(id)) {
      errors.push(`${id}: duplicate accepted candidate`);
      continue;
    }
    candidateIds.add(id);
    if (key !== id) errors.push(`${key}: accepted candidate key mismatch for ${id}`);
    const expectedRarity = expected.get(id);
    const item = blueprintById.get(id);
    if (!expectedRarity || !item) {
      errors.push(`${id}: unexpected accepted candidate`);
      continue;
    }
    if (candidate.rarity && candidate.rarity !== expectedRarity) {
      errors.push(`${id}: accepted candidate rarity mismatch (got ${candidate.rarity}, expected ${expectedRarity})`);
    }
    if (!(candidate.bytes instanceof Uint8Array) || candidate.bytes.length === 0) {
      errors.push(`${id}: accepted candidate PNG is missing or empty`);
    }
    let decoded = candidate.decoded;
    if (candidate.sourcePath) {
      try {
        await verifyAcceptedSource(root, item, candidate.sourcePath);
        decoded = await readPngRgba(candidate.sourcePath);
      } catch (error) {
        errors.push(`${id}: invalid accepted candidate PNG: ${error.message}`);
      }
    }
    if (decoded) errors.push(...validateCandidate(item, decoded));
    else if (item.qaState === "accepted" && !candidate.sourcePath) {
      errors.push(`${id}: accepted candidate has no decoded PNG for validation`);
    }
  }

  for (const [id, rarity] of expected) {
    const item = blueprintById.get(id);
    if (item?.qaState === "accepted" && !candidateIds.has(id)) errors.push(`${id}: missing accepted candidate`);
    if (item?.rarity === rarity && item?.qaState === "accepted" && candidateIds.has(id)) {
      try {
        await verifyDestination(root, item);
      } catch (error) {
        errors.push(`${id}: invalid promotion destination: ${error.message}`);
      }
    }
  }

  if (errors.length) return { root, errors, copies: [] };
  const copies = [...expected].map(([id, rarity]) => {
    const item = blueprintById.get(id);
    const candidate = candidateRecord(id, candidates.get(id));
    const paths = candidatePaths(root, item);
    return Object.freeze({
      id,
      rarity,
      sourcePath: candidate.sourcePath ?? paths.sourcePath,
      targetPath: paths.targetPath,
      png: candidate.bytes,
    });
  });
  return Object.freeze({ root, errors: Object.freeze([]), copies: Object.freeze(copies) });
}

function temporaryPath(parent, id, kind) {
  return resolve(parent, `.${id}.${randomUUID()}.${kind}`);
}

async function rereadForStaging(root, copy) {
  const item = { id: copy.id, rarity: copy.rarity };
  const sourcePath = await verifyAcceptedSource(root, item, copy.sourcePath);
  const decoded = await readPngRgba(sourcePath);
  const errors = validateCandidate(item, decoded);
  if (errors.length) throw new Error(errors.join("\n"));
  const destination = await verifyDestination(root, item);
  return { ...copy, sourcePath, ...destination, bytes: await readFile(sourcePath) };
}

function runFailureHook(failureHook, currentPhase, index, record) {
  failureHook?.({ currentPhase, index, id: record.id });
}

async function rollback(staged, failureHook) {
  const rollbackErrors = [];
  for (let index = staged.length - 1; index >= 0; index -= 1) {
    const copy = staged[index];
    try {
      if (copy.committed) {
        runFailureHook(failureHook, "before-remove-committed", index, copy);
        await rm(copy.targetPath, { force: true });
        copy.committed = false;
        runFailureHook(failureHook, "after-remove-committed", index, copy);
      }
    } catch (error) {
      rollbackErrors.push(error);
    }
    try {
      if (copy.backupPath) {
        const backup = copy.backupPath;
        runFailureHook(failureHook, "before-restore-rename", index, copy);
        await rename(backup, copy.targetPath);
        copy.backupPath = null;
        runFailureHook(failureHook, "after-restore-rename", index, copy);
      }
    } catch (error) {
      rollbackErrors.push(new Error(
        `${copy.id}: restore failed; backup preserved at ${copy.backupPath}: ${error.message}`,
        { cause: error },
      ));
    }
    try {
      runFailureHook(failureHook, "before-temp-cleanup", index, copy);
      await rm(copy.temporaryPath, { force: true });
      runFailureHook(failureHook, "after-temp-cleanup", index, copy);
    } catch (error) {
      rollbackErrors.push(error);
    }
  }
  return rollbackErrors;
}

export async function applyPromotion(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new Error("applyPromotion expects authoritative options");
  }
  if ("copies" in options || "errors" in options || "plan" in options) {
    throw new Error("applyPromotion does not accept a caller-supplied plan");
  }
  let { root = repositoryRoot, failureHook, beforeCommit } = options;
  root = await authorizePromotionRoot(root);
  const buildPlan = async () => planPromotion(
    await loadBlueprint(root),
    await loadAcceptedCandidates(root),
    { root },
  );
  const firstPlan = await buildPlan();
  if (firstPlan.errors.length) throw new Error(firstPlan.errors.join("\n"));
  const plan = await buildPlan();
  if (plan.errors.length) throw new Error(plan.errors.join("\n"));

  const staged = [];
  let committed = false;
  try {
    for (let index = 0; index < plan.copies.length; index += 1) {
      const copy = await rereadForStaging(root, plan.copies[index]);
      const temporary = temporaryPath(copy.parent.canonicalDirectory, copy.id, "promote.tmp");
      assertPathInside(copy.parent.canonicalDirectory, temporary, copy.id);
      const record = { ...copy, temporaryPath: temporary, backupPath: null, committed: false };
      staged.push(record);
      await writeFile(temporary, copy.bytes, { flag: "wx" });
      const stagedDecoded = await readPngRgba(temporary);
      const errors = validateCandidate({ id: copy.id, rarity: copy.rarity }, stagedDecoded);
      if (errors.length) throw new Error(errors.join("\n"));
      runFailureHook(failureHook, "stage", index, record);
    }
    await beforeCommit?.(Object.freeze({ root, copies: plan.copies }));
    for (let index = 0; index < staged.length; index += 1) {
      const record = staged[index];
      await verifiedRegularFile(record.targetPath, record.parent, record.id, { allowMissing: true });
      const existing = await lstat(record.targetPath).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
      if (existing) {
        const backupPath = temporaryPath(record.parent.canonicalDirectory, record.id, "promote.bak");
        assertPathInside(record.parent.canonicalDirectory, backupPath, record.id);
        runFailureHook(failureHook, "before-backup-rename", index, record);
        await rename(record.targetPath, backupPath);
        record.backupPath = backupPath;
        runFailureHook(failureHook, "after-backup-rename", index, record);
      }
    }
    for (let index = 0; index < staged.length; index += 1) {
      const record = staged[index];
      runFailureHook(failureHook, "before-commit-rename", index, record);
      await rename(record.temporaryPath, record.targetPath);
      record.committed = true;
      runFailureHook(failureHook, "after-commit-rename", index, record);
    }
    committed = true;
    const cleanupErrors = [];
    for (let index = 0; index < staged.length; index += 1) {
      const record = staged[index];
      if (!record.backupPath) continue;
      try {
        runFailureHook(failureHook, "before-backup-cleanup", index, record);
        await rm(record.backupPath, { force: true });
        record.backupPath = null;
        runFailureHook(failureHook, "after-backup-cleanup", index, record);
      } catch (error) {
        cleanupErrors.push(new Error(
          `${record.id}: promotion committed but backup cleanup incomplete at ${record.backupPath}: ${error.message}`,
          { cause: error },
        ));
      }
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "promotion committed but cleanup incomplete");
    return staged.length;
  } catch (error) {
    if (committed) throw error;
    const rollbackErrors = await rollback(staged, failureHook);
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], "promotion failed and rollback was incomplete");
    }
    throw error;
  }
}

async function main() {
  const apply = process.argv.slice(2);
  if (apply.length > 1 || (apply.length === 1 && apply[0] !== "--apply")) {
    throw new Error("usage: node scripts/costume-promote-candidates.mjs [--apply]");
  }
  const plan = await planPromotion(
    await loadBlueprint(repositoryRoot),
    await loadAcceptedCandidates(repositoryRoot),
  );
  if (plan.errors.length) throw new Error(plan.errors.join("\n"));
  if (apply[0] === "--apply") console.log(`promoted=${await applyPromotion()}`);
  else console.log(`validated=${plan.copies.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
