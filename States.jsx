import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react'

export function LoadingState({ label = 'Loading data' }) {
  return (
    <div className="state-card" role="status">
      <LoaderCircle className="spin" size={18} aria-hidden="true" />
      <span>{label}…</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card error-state" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button className="text-button" onClick={onRetry} type="button">
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  )
}
