import type { ApiConnectionRequest, ApiUser } from '@/lib/types/api'

export function getConnectionPeer(
  connection: ApiConnectionRequest,
  currentUserId: string
): ApiUser | undefined {
  return String(connection.sender_id) === String(currentUserId)
    ? connection.receiver
    : connection.sender
}

export function getConnectedUserIds(
  connections: ApiConnectionRequest[],
  currentUserId: string
): Set<string> {
  const ids = new Set<string>()
  for (const connection of connections) {
    const peer = getConnectionPeer(connection, currentUserId)
    if (peer?.id) ids.add(String(peer.id))
  }
  return ids
}
