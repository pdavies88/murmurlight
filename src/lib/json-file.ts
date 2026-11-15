import { File, Paths } from 'expo-file-system';

/** Reads a small JSON file from the app's documents. Returns null when it's missing or unreadable. */
export function readJsonFile(name: string): unknown {
  try {
    const file = new File(Paths.document, name);
    if (!file.exists) return null;
    return JSON.parse(file.textSync());
  } catch {
    return null;
  }
}

/** Writes a small JSON file to the app's documents. A failed write is ignored: saving is a convenience. */
export function writeJsonFile(name: string, data: unknown): void {
  try {
    const file = new File(Paths.document, name);
    if (!file.exists) file.create();
    file.writeSync(JSON.stringify(data));
  } catch {
    // No file storage, for example on the web.
  }
}
