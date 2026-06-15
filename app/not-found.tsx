export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06080d', color: '#f0f4ff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '64px', fontWeight: '700', color: '#8b5cf6', marginBottom: '12px' }}>404</div>
        <div style={{ fontSize: '18px', marginBottom: '24px' }}>Page not found</div>
        <a href="/">Go home</a>
      </div>
    </div>
  )
}
