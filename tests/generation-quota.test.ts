import { beforeEach, it, expect, vi } from 'vitest';
import { PublicError } from '../src/lib/public-error';
const mock = vi.hoisted(() => ({ resolve: vi.fn(), reserve: vi.fn(), generate: vi.fn() }));
vi.mock('../src/lib/businesses', () => ({ resolveClient: mock.resolve }));
vi.mock('../src/lib/usage', () => ({ reserveGeneration: mock.reserve }));
vi.mock('../src/lib/request', () => ({
  readReviewRequest: async () => ({
    rating: 2,
    experience: 'The service was slow but the tea was good.',
    language: 'English',
  }),
}));
vi.mock('../src/lib/ai', () => ({ generateReview: mock.generate }));
import { POST } from '../src/app/api/review/[token]/generate/route';
const context = { params: Promise.resolve({ token: 'a'.repeat(43) }) };
beforeEach(() => {
  vi.clearAllMocks();
  mock.resolve.mockResolvedValue({
    token_hash: 'b'.repeat(64),
    products: [],
    review_length: 'short',
  });
  mock.reserve.mockResolvedValue(undefined);
  mock.generate.mockResolvedValue({ content: 'A genuine draft.' });
});
it.each([429, 503])('never calls Groq after reservation fails with %s', async (status) => {
  mock.reserve.mockRejectedValue(new PublicError('Denied', status));
  const response = await POST(new Request('https://izak-ai.vercel.app'), context);
  expect(response.status).toBe(status);
  expect(mock.generate).not.toHaveBeenCalled();
});
it('reserves before Groq and revalidates after generation', async () => {
  const response = await POST(new Request('https://izak-ai.vercel.app'), context);
  expect(response.status).toBe(200);
  expect(mock.resolve).toHaveBeenCalledTimes(2);
  expect(mock.reserve.mock.invocationCallOrder[0]).toBeLessThan(
    mock.generate.mock.invocationCallOrder[0],
  );
});
