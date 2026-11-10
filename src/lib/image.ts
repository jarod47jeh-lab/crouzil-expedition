/** Réduit une photo de téléphone (souvent 4 à 8 Mo) à 1600 px en JPEG avant l'envoi */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const img = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}
