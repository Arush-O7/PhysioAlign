import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps a render crash from leaving the user with a blank white page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[PhysioAlign] Screen crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="screen dots-bg"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}
      >
        <div className="plush popin" style={{ background: 'var(--surface)', padding: 28, maxWidth: 460, textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              margin: '0 auto 14px',
              borderRadius: '50%',
              border: '2.5px solid var(--line)',
              background: 'var(--rose)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--plush-tiny)',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>This screen hit a problem</h2>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 18 }}>
            Your saved sessions are safe. Reloading usually clears it.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-plush primary tap" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <button
              className="btn-plush ghost tap"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Go home
            </button>
          </div>
          <details style={{ marginTop: 16, textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: 'var(--ink-soft)' }}>
              Technical details
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 10,
                background: 'var(--cream)',
                border: '2px solid var(--line)',
                borderRadius: 10,
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                maxHeight: 160,
                overflow: 'auto',
              }}
            >
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
