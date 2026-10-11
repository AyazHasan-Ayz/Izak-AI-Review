export class PublicError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function publicFailure(error: unknown) {
  const status = error instanceof PublicError ? error.status : 503;
  const message =
    error instanceof PublicError
      ? error.message
      : 'Review tools are temporarily unavailable. You can still open Google directly.';
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(status === 429 ? { 'Retry-After': '60' } : {}),
      },
    },
  );
}
