import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function ProtectedRoute() {
  const { session, isAdminUser, loading } = useAdminAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !isAdminUser) {
    return <Navigate to="/admin/login" replace />
  }

  return <Outlet />
}
