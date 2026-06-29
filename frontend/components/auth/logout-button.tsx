'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/lib/hooks/use-logout'

interface LogoutButtonProps {
  showLabel?: boolean
}

export function LogoutButton({ showLabel = false }: LogoutButtonProps) {
  const logout = useLogout()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={showLabel ? 'text-destructive hover:text-destructive gap-2' : 'text-destructive hover:text-destructive'}
      onClick={() => logout()}
    >
      <LogOut className="w-4 h-4" />
      {showLabel && 'Log out'}
    </Button>
  )
}
