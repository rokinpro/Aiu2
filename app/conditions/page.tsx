import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ConditionsPanel from "@/components/conditions-panel";
export default function Conditions() {
  return (
    <main id="main">
      <Link href="/" className="text-link">
        <ArrowLeft size={16} />
        Back to your journey
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LOCAL CONDITIONS</p>
          <h1>A clearer view of your next stop.</h1>
          <p className="subtitle">Recent readings from the sensor zones.</p>
        </div>
      </div>
      <ConditionsPanel />
      <section className="panel integration">
        <h2>Local readings, useful context.</h2>
        <p>
          The connected ultrasonic sensor measures distance near Elevator A. A rolling
          window estimates local presence; it does not identify people or count
          a crowd.
        </p>
        <p className="muted">
          Unknown activity means there is not enough reliable recent data. Your
          route stays in place until you accept a suggested change.
        </p>
      </section>
    </main>
  );
}
