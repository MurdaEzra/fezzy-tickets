import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const TABS = [
  { id: "events", label: "Events" },
  { id: "withdraw", label: "Withdraw" },
  { id: "poster", label: "Edit Poster" },
  { id: "qr", label: "Scan QR" },
];

export default function OrganizerDashboardTabs() {
  const [tab, setTab] = useState("events");

  return (
    <div className="mt-12">
      <div className="flex gap-2 border-b border-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 font-semibold border-b-2 transition-all ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "events" && (
        <div>
          <h2 className="font-display text-xl font-bold mb-4">Create Event</h2>
          {/* Event creation form placeholder */}
          <form onSubmit={e => { e.preventDefault(); toast.success("Event created (placeholder)"); }} className="space-y-4 max-w-lg">
            <Input placeholder="Event title" required />
            <Textarea placeholder="Event description" required />
            <Button type="submit" variant="acacia">Create event</Button>
          </form>
        </div>
      )}
      {tab === "withdraw" && (
        <div>
          <h2 className="font-display text-xl font-bold mb-4">Withdraw Funds</h2>
          <p>Withdrawals are available after all tickets are sold and fees are applied.</p>
          <Button variant="acacia" className="mt-4" onClick={() => toast.success("Withdrawal requested (placeholder)")}>Request Withdrawal</Button>
        </div>
      )}
      {tab === "poster" && (
        <div>
          <h2 className="font-display text-xl font-bold mb-4">Edit Poster</h2>
          <p>Upload a new poster and select a font for your event.</p>
          <Input type="file" accept="image/*" className="mb-4" />
          <select className="mb-4 block w-full border rounded p-2">
            <option>Montserrat</option>
            <option>Roboto</option>
            <option>Playfair Display</option>
            <option>Poppins</option>
            <option>Oswald</option>
          </select>
          <Button variant="acacia">Save Poster</Button>
        </div>
      )}
      {tab === "qr" && (
        <div>
          <h2 className="font-display text-xl font-bold mb-4">Scan QR Codes</h2>
          <p>Scan attendee tickets on event day. (Scanner integration placeholder)</p>
          <Button variant="acacia" className="mt-4" onClick={() => toast.info("QR scanner coming soon")}>Open Scanner</Button>
        </div>
      )}
    </div>
  );
}
