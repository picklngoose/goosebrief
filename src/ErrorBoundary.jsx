import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("goosebrief crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            width: "100%",
            background: "#14161a",
            color: "#edeae3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>something went wrong</h1>
            <p style={{ color: "#8b909b", fontSize: 13, marginBottom: 16 }}>
              goosebrief hit an error loading the case list. reloading usually fixes it.
              if it keeps happening, tell whoever maintains the app what you were doing
              right before this showed up.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#20242b",
                border: "1px solid #2a2e36",
                color: "#edeae3",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
