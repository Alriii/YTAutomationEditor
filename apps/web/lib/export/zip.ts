import { PassThrough } from "node:stream";
import { ZipArchive } from "archiver";

export async function createZip(
  files: Array<{ name: string; bytes: Buffer }>,
): Promise<Buffer> {
  const archive = new ZipArchive({ zlib: { level: 8 } });
  const output = new PassThrough();
  const chunks: Buffer[] = [];

  output.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

  const complete = new Promise<Buffer>((resolve, reject) => {
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(output);
  for (const file of files) {
    archive.append(file.bytes, { name: file.name });
  }
  await archive.finalize();
  return complete;
}
