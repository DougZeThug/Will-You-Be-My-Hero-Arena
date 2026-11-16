/** Lowercase hex SHA-256 of the given bytes. */
export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}

/** Fetch one asset and require its SHA-256 to equal `expected`. */
export async function verifyAssetHash(
  url: string,
  expected: string | undefined,
  errors: { load: string; mismatch: string },
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw Error(errors.load);
  if ((await sha256Hex(await response.arrayBuffer())) !== expected)
    throw Error(errors.mismatch);
}
