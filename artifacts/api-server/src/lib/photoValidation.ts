import { RequestUploadUrlBody } from "@workspace/api-zod";

// Use the canonical upload contract for both reservations and stored objects.
// A client can misreport a reservation's size/type, so inspect the object too.
export function validStoredPhoto(
  reservation: { size: number; contentType: string },
  metadata: { size?: string | number; contentType?: string },
): boolean {
  const actualSize = Number(metadata.size);
  return RequestUploadUrlBody.safeParse({
    name: "photo",
    size: actualSize,
    contentType: metadata.contentType,
  }).success &&
    actualSize === reservation.size &&
    metadata.contentType === reservation.contentType;
}
