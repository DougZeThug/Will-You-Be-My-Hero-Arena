import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

export const sha256File = async (file) => sha256(await readFile(file));
