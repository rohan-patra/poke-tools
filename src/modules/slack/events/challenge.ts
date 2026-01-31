interface ChallengePayload {
  type: 'url_verification';
  token: string;
  challenge: string;
}

/**
 * Checks if the payload is a URL verification challenge and returns the challenge value.
 * Returns null if it's not a challenge request.
 */
export function handleChallenge(body: unknown): string | null {
  if (
    typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    (body as { type: string }).type === 'url_verification' &&
    'challenge' in body
  ) {
    return (body as ChallengePayload).challenge;
  }
  return null;
}
