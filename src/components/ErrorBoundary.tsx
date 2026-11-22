import { Component, type ErrorInfo, type ReactNode } from "react";

interface State { error: Error | null }

/** Shows a readable message instead of a blank screen when something throws while rendering. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("App crashed:", error, info.componentStack); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: "#07070a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</p>
        <p style={{ maxWidth: 420, fontSize: 13, opacity: 0.7, wordBreak: "break-word" }}>{error.message}</p>
        <button onClick={() => window.location.reload()} style={{ background: "#e11d48", color: "#fff", border: 0, borderRadius: 999, padding: "10px 24px", fontWeight: 700 }}>Reload</button>
      </div>
    );
  }
}
