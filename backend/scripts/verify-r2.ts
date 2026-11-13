/**
 * Live R2 verification — exercises the real Cloudflare R2 bucket with the
 * credentials from the backend .env file.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

async function main() {
  const env = loadEnv(process.argv[2]);

  const client = new S3Client({
    region: env.R2_REGION || 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const bucket = env.R2_BUCKET_NAME;
  const key = `profile-picture/verify-test/avatar.png`;
  const body = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x08, 0x06, 0x00, 0x00, 0x00,
  ]);

  const results: Record<string, unknown> = {
    bucket,
    endpoint: env.R2_ENDPOINT,
  };

  // 1. Upload
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/png',
    }),
  );
  results.upload = 'OK';

  // 2. Metadata / head
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  results.head = {
    contentLength: head.ContentLength,
    contentType: head.ContentType,
    etag: head.ETag,
  };

  // 3. Download round-trip
  const got = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const bytes = Buffer.from(await got.Body!.transformToByteArray());
  results.downloadBytes = bytes.length;
  results.downloadMatches = bytes.equals(body);

  // 4. Signed URL
  const signed = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 900 },
  );
  results.signedUrlHost = new URL(signed).host;
  results.signedUrlHasSignature = signed.includes('X-Amz-Signature');

  // 5. Signed PUT URL
  const putUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: 'image/png',
    }),
    { expiresIn: 900 },
  );
  results.signedPutHost = new URL(putUrl).host;

  // 6. Delete + verify gone
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  let gone = false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    gone = true;
  }
  results.deletedAndGone = gone;

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('R2_VERIFY_FAILED:', err.name, '-', err.message);
  process.exit(1);
});
