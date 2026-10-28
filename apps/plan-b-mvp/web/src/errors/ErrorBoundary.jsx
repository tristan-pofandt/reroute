// Catches a render error anywhere below it, reports it (consent permitting) and shows a calm, recoverable screen in the app's own style.
import { Component } from "react";
import { report } from "./report.js";
import "./errors.css";

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { report(error, "react"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="crash" role="alert" aria-labelledby="crash-title">
        <p className="eyebrow">Reroute</p>
        <h1 className="large-title" id="crash-title">Something went wrong</h1>
        <p className="subtitle">Nothing you saved on this device was lost. Reloading usually fixes it.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
      </section>
    );
  }
}
