export const MAX_ROOM_CODE_POINTS = 64;

function validateRoom(room: string): string | null {
  if (!room || room === '.' || room === '..') return null;
  if ([...room].length > MAX_ROOM_CODE_POINTS) return null;
  if (room.includes('/') || room.includes('\0')) return null;
  return room;
}

export function parseApiRoom(rawSegment: string): string | null {
  try {
    return validateRoom(decodeURIComponent(rawSegment));
  } catch {
    return null;
  }
}

export function parsePageRoom(pathname: string): string | null {
  if (pathname === '/') return 'default';
  if (!pathname.startsWith('/')) return null;

  const rawSegment = pathname.slice(1);
  if (!rawSegment || rawSegment.includes('/')) return null;
  return parseApiRoom(rawSegment);
}
