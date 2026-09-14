export const MAX_CONTENT_BYTES = 1024 * 1024;

export function utf8Size(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}
