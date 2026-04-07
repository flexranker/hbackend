import { randomUUID } from "node:crypto";
import { getFirebaseAdmin } from "./firebase.js";
import { getStorage } from "firebase-admin/storage";

export async function generateUploadUrl(
  uid: string,
  fileName: string,
  fileType: string,
  fileSizeBytes: number
): Promise<{ uploadUrl: string; storagePath: string }> {
  const bucket = getStorage(getFirebaseAdmin()).bucket();
  const ext = fileName.split(".").pop() ?? "bin";
  const storagePath = `uploads/${uid}/${randomUUID()}.${ext}`;

  const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15-minute window
    contentType: fileType,
    extensionHeaders: {
      "x-goog-content-length-range": `0,${fileSizeBytes}`,
    },
  });

  return { uploadUrl, storagePath };
}
