export default function Brand({ compact = false }) {
  return (
    <div className={`vandi-brand ${compact ? 'vandi-brand-compact' : ''}`}>
      <img src="/vandi-logo.png?v=3" alt="Verdant Fleet logo" />
      <span className="vandi-brand-copy">
        <strong>Verdant Fleet</strong>
        <small>Fleet Management &amp; Operations</small>
      </span>
    </div>
  )
}
