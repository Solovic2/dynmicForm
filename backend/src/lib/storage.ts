import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

const credentials = {
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
};

/** Client used for server-side operations (put/delete), on the internal endpoint. */
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

/**
 * Separate client bound to the browser-reachable endpoint, used ONLY to sign
 * download URLs. Under Docker the backend reaches MinIO at `minio:9000`, but a
 * URL handed to the browser must use `localhost:9000`.
 */
const s3Public = new S3Client({
  endpoint: env.S3_PUBLIC_ENDPOINT,
  region: env.S3_REGION,
  credentials,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

/**
 * Create the configured bucket if it doesn't already exist. Called at boot.
 * Retries briefly so it tolerates the object store still starting up (common
 * under docker-compose where MinIO and the backend boot together).
 */
export async function ensureBucket(retries = 10, delayMs = 1000): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
      } catch {
        await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      }
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** Upload an object. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Generate a short-lived presigned GET URL reachable from the browser.
 * `disposition: 'inline'` lets the browser render the file (PDF/image preview);
 * `'attachment'` (default) forces a download with the original filename.
 */
export function presignGetUrl(
  key: string,
  filename: string,
  opts: { ttlSeconds?: number; disposition?: 'inline' | 'attachment' } = {},
): Promise<string> {
  const { ttlSeconds = 300, disposition = 'attachment' } = opts;
  return getSignedUrl(
    s3Public,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: `${disposition}; filename="${filename.replace(/"/g, '')}"`,
    }),
    { expiresIn: ttlSeconds },
  );
}

/** Best-effort delete (used to clean up orphaned uploads on failed submissions). */
export async function deleteObject(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch {
    // best-effort — ignore
  }
}
