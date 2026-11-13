/** Browser file download helpers shared by the app and the Lab pages. */
export function downloadText(
  name: string,
  text: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Revoke after the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pretty-printed JSON download. `terminator` is appended to the file text. */
export function downloadJson(name: string, data: unknown, terminator = '') {
  downloadText(name, JSON.stringify(data, null, 2) + terminator);
}
