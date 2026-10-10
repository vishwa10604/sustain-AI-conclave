const steps = ['REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED']

export default function StepTracker({ status }) {
  const activeIndex = steps.indexOf(status)
  return (
    <ol className="step-tracker" aria-label={`Trip status: ${status?.replaceAll('_', ' ') || 'unknown'}`}>
      {steps.map((step, index) => {
        const complete = activeIndex >= 0 && index < activeIndex
        const active = index === activeIndex
        return (
          <li key={step} className={`${complete ? 'complete' : ''} ${active ? 'current' : ''}`}>
            <span className="step-dot">{complete ? '✓' : index + 1}</span>
            <span className="step-label">{step.replaceAll('_', ' ')}</span>
          </li>
        )
      })}
    </ol>
  )
}
