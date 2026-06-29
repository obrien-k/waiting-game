import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Re-mounts the boundary when this changes, so reopening/resetting clears a caught error. */
  resetKey?: unknown;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Stops a throwing plugin from blanking the whole game window. A plugin render
 * that dereferences malformed state (e.g. a corrupted save) is contained here
 * and shown as a recoverable message instead of an uncaught exception.
 */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Game plugin crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center text-white/60">
          <div className="text-3xl">⚠️</div>
          <div className="text-sm font-medium text-white/80">This game hit an error</div>
          <div className="text-xs font-mono text-white/40 break-all max-w-full">
            {this.state.error.message}
          </div>
          <div className="text-xs text-white/30">
            Closing and reopening the window usually clears it.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
