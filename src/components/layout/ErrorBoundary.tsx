import { Component, type ErrorInfo, type ReactNode } from 'react';
import './layout.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a bug in one screen never leaves a blank page.
 * Recovering resets the boundary; reloading is offered as the last resort.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Winter Arc crashed while rendering:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  private reload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fatal" role="alert">
        <h1>Something went wrong</h1>
        <p>
          A screen failed to render. Your saved progress is untouched, so returning to the dashboard is
          usually enough.
        </p>
        <pre>{error.message}</pre>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={this.reset}>
            Try again
          </button>
          <button type="button" className="btn btn--secondary" onClick={this.reload}>
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
