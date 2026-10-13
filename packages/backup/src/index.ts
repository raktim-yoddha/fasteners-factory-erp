import { z } from 'zod';
import { DomainError } from '@fasteners/contracts';
const MAX_BYTES = 100 * 1024 * 1024;
const ITERATIONS = 600_000;
const headerSchema = z
  .object({
    format: z.literal('FFERP-DATABASE'),
    version: z.literal(1),
    schemaVersion: z.literal(1),
    createdAt: z.string().datetime(),
    scope: z.literal('all-device-solo-workspaces'),
    iterations: z.number().int().min(ITERATIONS).max(1_000_000),
    salt: z.string().regex(/^[0-9a-f]{32}$/),
    nonce: z.string().regex(/^[0-9a-f]{24}$/),
    databaseHash: z.string().regex(/^[0-9a-f]{64}$/),
    databaseBytes: z.number().int().min(100).max(MAX_BYTES),
  })
  .strict();
const envelopeSchema = z
  .object({
    header: headerSchema,
    ciphertext: z
      .string()
      .max((MAX_BYTES + 16) * 2)
      .regex(/^[0-9a-f]+$/),
  })
  .strict();
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
const unhex = (value: string) =>
  Uint8Array.from(value.match(/.{2}/g) ?? [], (entry) => Number.parseInt(entry, 16));
const bytes = (value: Uint8Array) => new Uint8Array(value).buffer;
async function derive(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  cryptoApi: Crypto,
): Promise<CryptoKey> {
  const material = await cryptoApi.subtle.importKey(
    'raw',
    bytes(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function encryptDatabase(
  database: Uint8Array,
  passphrase: string,
  cryptoApi: Crypto = crypto,
): Promise<Uint8Array> {
  if (passphrase.length < 12)
    throw new DomainError(
      'INVALID_INPUT',
      'Use a backup passphrase with at least 12 characters. Keep it separately; account recovery cannot decrypt this backup.',
    );
  if (database.length < 100 || database.length > MAX_BYTES)
    throw new DomainError('BACKUP_INVALID', 'Database size is outside supported backup bounds.');
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const nonce = cryptoApi.getRandomValues(new Uint8Array(12));
  const header = headerSchema.parse({
    format: 'FFERP-DATABASE',
    version: 1,
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    scope: 'all-device-solo-workspaces',
    iterations: ITERATIONS,
    salt: hex(salt),
    nonce: hex(nonce),
    databaseHash: hex(new Uint8Array(await cryptoApi.subtle.digest('SHA-256', bytes(database)))),
    databaseBytes: database.length,
  });
  const key = await derive(passphrase, salt, ITERATIONS, cryptoApi);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: bytes(nonce), additionalData: bytes(encode(header)), tagLength: 128 },
    key,
    bytes(database),
  );
  return encode({ header, ciphertext: hex(new Uint8Array(encrypted)) });
}
export async function decryptDatabase(
  envelopeBytes: Uint8Array,
  passphrase: string,
  cryptoApi: Crypto = crypto,
): Promise<{ database: Uint8Array; header: z.infer<typeof headerSchema> }> {
  try {
    if (envelopeBytes.length > MAX_BYTES * 2 + 4096) throw new Error('Backup exceeds limit.');
    const envelope = envelopeSchema.parse(JSON.parse(new TextDecoder().decode(envelopeBytes)));
    if (
      envelope.ciphertext.length % 2 !== 0 ||
      envelope.ciphertext.length !== 2 * (envelope.header.databaseBytes + 16)
    )
      throw new Error('Invalid encrypted length.');
    const key = await derive(
      passphrase,
      unhex(envelope.header.salt),
      envelope.header.iterations,
      cryptoApi,
    );
    const database = new Uint8Array(
      await cryptoApi.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: bytes(unhex(envelope.header.nonce)),
          additionalData: bytes(encode(envelope.header)),
          tagLength: 128,
        },
        key,
        bytes(unhex(envelope.ciphertext)),
      ),
    );
    const hash = hex(new Uint8Array(await cryptoApi.subtle.digest('SHA-256', bytes(database))));
    if (
      hash !== envelope.header.databaseHash ||
      database.length !== envelope.header.databaseBytes ||
      new TextDecoder().decode(database.slice(0, 16)) !== 'SQLite format 3\u0000'
    )
      throw new Error('Database validation failed.');
    return { database, header: envelope.header };
  } catch {
    throw new DomainError(
      'BACKUP_INVALID',
      'Backup authentication or format validation failed. The active workspace has not been replaced.',
    );
  }
}
