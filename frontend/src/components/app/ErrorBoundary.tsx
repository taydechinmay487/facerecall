import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "../ui/empty-state";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log the message only: never profile data or biometric values.
    console.error("FaceRecall UI error:", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-grid py-16">
          <ErrorState
            title="The interface hit an unexpected problem"
            description="Your stored profiles are unaffected. Reload the page to continue."
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
