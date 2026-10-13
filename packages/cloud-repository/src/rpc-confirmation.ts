import { DomainError, type ErrorCode } from '@fasteners/contracts';
import type { CloudClient } from './index';

export async function verifiedToken(client: CloudClient, expectedActorId: string): Promise<string> {
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session.session)
    throw new DomainError('AUTH_REQUIRED', 'A verified account is required for this request.');
  const token = session.session.access_token;
  const { data: identity, error } = await client.auth.getUser(token);
  if (error || identity.user?.id !== expectedActorId || !identity.user?.email_confirmed_at)
    throw new DomainError('AUTH_REQUIRED', 'This request requires its original verified account.');
  return token;
}
export function checkRpcConfirmation(
  response: { error: { code: string; message: string } | null; status: number },
  label: string,
): void {
  const codes: readonly ErrorCode[] = [
    'AUTH_REQUIRED',
    'PERMISSION_DENIED',
    'INVALID_INPUT',
    'IDEMPOTENCY_KEY_REUSED',
  ];
  if (response.error) {
    if (
      response.status === 400 &&
      response.error.code === 'P0001' &&
      codes.includes(response.error.message as ErrorCode)
    )
      throw new DomainError(
        response.error.message as ErrorCode,
        `${label} was rejected by the authority.`,
      );
    throw new DomainError(
      'CONFIRMATION_UNKNOWN',
      `${label} confirmation unknown. Preserve the original request key.`,
    );
  }
  if (response.status < 200 || response.status >= 300)
    throw new DomainError(
      'CONFIRMATION_UNKNOWN',
      `${label} confirmation unknown. Preserve the original request key.`,
    );
}
