'use client'

import { UserPlus, UserCheck, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { connectionsAPI } from '@/services/api'
import {
  connectionKeys,
  useConnectionStatus,
  useSendConnectionRequest,
  useAcceptConnection,
  useRejectConnection,
  useRemoveConnection,
} from '@/lib/hooks/api/use-connections'

interface ConnectButtonProps {
  userId: string
  size?: 'sm' | 'default'
}

export function ConnectButton({ userId, size = 'default' }: ConnectButtonProps) {
  const qc = useQueryClient()
  const { data: status, isLoading } = useConnectionStatus(userId)
  const sendRequest = useSendConnectionRequest()
  const accept = useAcceptConnection()
  const reject = useRejectConnection()
  const remove = useRemoveConnection()

  const handleConnect = async () => {
    try {
      await sendRequest.mutateAsync(userId)
      toast.success('Connection request sent')
    } catch {
      toast.error('Could not send request')
    }
  }

  const handleAccept = async () => {
    if (!status?.connection_id) return
    try {
      await accept.mutateAsync(status.connection_id)
      toast.success('Connection accepted')
      qc.invalidateQueries({ queryKey: connectionKeys.status(userId) })
    } catch {
      toast.error('Could not accept request')
    }
  }

  const handleReject = async () => {
    if (!status?.connection_id) return
    try {
      await reject.mutateAsync(status.connection_id)
      toast.success('Request declined')
      qc.invalidateQueries({ queryKey: connectionKeys.status(userId) })
    } catch {
      toast.error('Could not decline request')
    }
  }

  const handleCancel = async () => {
    if (!status?.connection_id) return
    try {
      await connectionsAPI.cancel(status.connection_id)
      toast.success('Request cancelled')
      qc.invalidateQueries({ queryKey: connectionKeys.status(userId) })
    } catch {
      toast.error('Could not cancel request')
    }
  }

  const handleRemove = async () => {
    if (!status?.connection_id) return
    try {
      await remove.mutateAsync(status.connection_id)
      toast.success('Connection removed')
      qc.invalidateQueries({ queryKey: connectionKeys.status(userId) })
    } catch {
      toast.error('Could not remove connection')
    }
  }

  if (isLoading) {
    return (
      <Button size={size} variant="outline" disabled>
        ...
      </Button>
    )
  }

  const s = status?.status || 'none'

  if (s === 'accepted') {
    return (
      <Button size={size} variant="outline" onClick={handleRemove}>
        <UserCheck className="w-4 h-4 mr-2" />
        Connected
      </Button>
    )
  }

  if (s === 'pending' && status?.is_sender) {
    return (
      <Button size={size} variant="outline" onClick={handleCancel}>
        <Clock className="w-4 h-4 mr-2" />
        Pending
      </Button>
    )
  }

  if (s === 'pending' && !status?.is_sender) {
    return (
      <div className="flex gap-2">
        <Button size={size} className="glow-primary" onClick={handleAccept} disabled={accept.isPending}>
          Accept
        </Button>
        <Button size={size} variant="outline" onClick={handleReject} disabled={reject.isPending}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <Button size={size} className="glow-primary" onClick={handleConnect} disabled={sendRequest.isPending}>
      <UserPlus className="w-4 h-4 mr-2" />
      Connect
    </Button>
  )
}
