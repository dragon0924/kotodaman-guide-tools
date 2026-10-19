import { copyFile, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type JsonFileWrite = {
  path: string;
  value: unknown;
  validate?: (value: unknown) => void;
};

export type JsonTransactionOptions = {
  beforeReplace?: (targetPath: string, index: number) => void | Promise<void>;
};

type PreparedFile = {
  targetPath: string;
  tempPath: string;
  backupPath: string;
  original: Buffer | null;
  validate?: (value: unknown) => void;
};

function parseAndValidate(content: string, validate?: (value: unknown) => void) {
  const parsed = JSON.parse(content) as unknown;
  validate?.(parsed);
}

async function readExisting(filePath: string) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeSynced(filePath: string, content: string | Buffer) {
  const handle = await open(filePath, "wx");
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function removeIfPresent(filePath: string) {
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

function isReplaceUnsupported(error: unknown) {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EPERM" || code === "EEXIST" || code === "ENOTEMPTY";
}

async function renameReplacing(sourcePath: string, targetPath: string) {
  try {
    await rename(sourcePath, targetPath);
  } catch (error) {
    if (!isReplaceUnsupported(error)) throw error;
    await removeIfPresent(targetPath);
    try {
      await rename(sourcePath, targetPath);
    } catch (fallbackError) {
      if (!isReplaceUnsupported(fallbackError)) throw fallbackError;
      await copyFile(sourcePath, targetPath);
      const targetHandle = await open(targetPath, "r+");
      try {
        await targetHandle.sync();
      } finally {
        await targetHandle.close();
      }
      await removeIfPresent(sourcePath);
    }
  }
}

async function restorePreparedFile(file: PreparedFile) {
  if (file.original === null) {
    await removeIfPresent(file.targetPath);
    return;
  }
  const restorePath = `${file.targetPath}.${randomUUID()}.restore.tmp`;
  await writeSynced(restorePath, file.original);
  await renameReplacing(restorePath, file.targetPath);
}

export async function writeJsonFilesSafely(
  writes: JsonFileWrite[],
  options: JsonTransactionOptions = {},
) {
  if (!writes.length) return;
  const uniquePaths = new Set(writes.map((entry) => path.resolve(entry.path)));
  if (uniquePaths.size !== writes.length) {
    throw new Error("A JSON transaction cannot contain the same target path twice.");
  }

  const transactionId = randomUUID();
  const prepared: PreparedFile[] = [];
  const committed: PreparedFile[] = [];

  try {
    for (const entry of writes) {
      const targetPath = path.resolve(entry.path);
      const content = `${JSON.stringify(entry.value, null, 2)}\n`;
      parseAndValidate(content, entry.validate);
      const tempPath = `${targetPath}.${transactionId}.tmp`;
      const backupPath = `${targetPath}.${transactionId}.bak`;
      const original = await readExisting(targetPath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      const file: PreparedFile = {
        targetPath,
        tempPath,
        backupPath,
        original,
        validate: entry.validate,
      };
      prepared.push(file);
      await writeSynced(tempPath, content);
      parseAndValidate(await readFile(tempPath, "utf8"), entry.validate);
      if (original !== null) {
        await writeSynced(backupPath, original);
      }
    }

    for (const [index, file] of prepared.entries()) {
      await options.beforeReplace?.(file.targetPath, index);
      committed.push(file);
      await renameReplacing(file.tempPath, file.targetPath);
      parseAndValidate(await readFile(file.targetPath, "utf8"), file.validate);
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const file of [...committed].reverse()) {
      try {
        await restorePreparedFile(file);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const file of prepared) {
      await removeIfPresent(file.tempPath).catch(() => undefined);
    }
    if (rollbackErrors.length) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `JSON transaction failed and rollback was incomplete. Recovery backups: ${prepared
          .filter((file) => file.original !== null)
          .map((file) => file.backupPath)
          .join(", ")}`,
      );
    }
    for (const file of prepared) {
      await removeIfPresent(file.backupPath).catch(() => undefined);
    }
    throw error;
  }

  for (const file of prepared) {
    await removeIfPresent(file.backupPath).catch(() => undefined);
    await removeIfPresent(file.tempPath).catch(() => undefined);
  }
}
