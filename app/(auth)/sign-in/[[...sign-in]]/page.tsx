import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      background: 'var(--bg-void)',
      padding: '24px',
    }}>
      <div className="wordmark" style={{ fontSize: '22px' }}>ViralOS<span> AI</span></div>
      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#7c3aed',
            colorBackground: '#161b24',
            colorInputBackground: '#1e2533',
            colorInputText: '#f0f4ff',
            colorText: '#f0f4ff',
            colorTextSecondary: '#8892a4',
            borderRadius: '10px',
          },
          elements: {
            card: { border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'none' },
            headerTitle: { fontFamily: 'Space Grotesk, sans-serif', fontWeight: '700' },
          }
        }}
      />
    </div>
  )
}
