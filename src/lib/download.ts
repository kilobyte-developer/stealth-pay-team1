/**
 * Triggers a client-side file download.
 *
 * The content never leaves the browser — no upload, no API round trip. Used
 * for the encrypted vault backup, whose plaintext must never touch a network.
 */
export function downloadTextFile(
  filename: string,
  contents: string,
  mimeType = "application/json",
): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    // Revoke on the next tick so the click has started the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}
