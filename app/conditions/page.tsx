import Link from "next/link";
import { Radio, ArrowLeft, Info } from "lucide-react";
export default function Conditions() {
  return (
    <main id="main">
      <Link className="text-link" href="/">
        <ArrowLeft size={16} /> Back to your journey
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEMO & FACILITIES VIEW</p>
          <h1>Live conditions</h1>
          <p className="subtitle">
            One sensor. One lobby. A clearer picture of local activity.
          </p>
        </div>
        <span className="demo-pill">NOT CONNECTED</span>
      </div>
      <div className="notice">
        <Info size={18} />
        <p>
          No hardware readings have been received. Unknown activity does not
          mean a clear lobby.
        </p>
      </div>
      <div className="condition-grid">
        <section className="panel condition-device">
          <Radio size={32} />
          <p className="eyebrow">PLANNED DEVICE · BEACON-A</p>
          <h2>Elevator A lobby</h2>
          <p>Floor 1 · elevator-a-lobby</p>
          <div className="sensor-note">
            <span className="status-dot" /> Awaiting hardware integration
          </div>
          <p className="muted">
            The ultrasonic sensor will estimate sustained presence in a fixed
            miniature zone. It cannot identify people, count a crowd, or confirm
            elevator operation.
          </p>
        </section>
        <section className="panel readings">
          <h2>Current readings</h2>
          <dl>
            <div>
              <dt>Raw distance</dt>
              <dd>Unknown</dd>
            </div>
            <div>
              <dt>Estimated zone activity</dt>
              <dd>Unknown</dd>
            </div>
            <div>
              <dt>Last received</dt>
              <dd>No readings</dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>Not available</dd>
            </div>
            <div>
              <dt>Source mode</dt>
              <dd>Not connected</dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="panel integration">
        <h2>Ready for the next connection</h2>
        <p>
          The app is scoped for one ultrasonic sensor over a USB serial bridge.
          Additional map locations do not require additional devices.
        </p>
        <ol>
          <li>Confirm the board and ultrasonic module model.</li>
          <li>
            Implement authenticated ingestion, filtering and five-second stale
            detection.
          </li>
          <li>
            Connect the USB bridge and verify a real reading before enabling
            live route updates.
          </li>
        </ol>
        <p className="small muted">
          Hardware, AI calls and two-way commands are not enabled. Try the
          labeled activity simulation in the journey planner.
        </p>
      </section>
    </main>
  );
}
