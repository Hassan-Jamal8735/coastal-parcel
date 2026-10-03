import "server-only";
import { put } from "@vercel/blob";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class UploadError extends Error {}

/**
 * Stores an uploaded image in Vercel Blob and returns its public URL — the
 * database only ever stores this URL, never the file itself. Returns null
 * when no file was chosen.
 */
export async function uploadImage(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) throw new UploadError("Please upload a JPG, PNG, WebP or GIF image.");
  if (file.size > MAX_BYTES) throw new UploadError("Images must be 2 MB or smaller.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new UploadError("File uploads aren't set up yet (missing Vercel Blob token). Please continue without the file for now.");
  }
  const blob = await put(`${folder}/${file.name}`, file, { access: "public", addRandomSuffix: true });
  return blob.url;
}
