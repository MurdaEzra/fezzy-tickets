import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

const LOGO_URL = "https://res.cloudinary.com/dgfmhyebp/image/upload/v1781945211/logo_2_-Photoroom_ibnhk5.png";

// Format functions from send-ticket-email
function formatTicketDate(d: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

function formatTicketTime(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

type Ticket = {
  id: string;
  holder_name: string;
  holder_email: string;
  qr_token: string;
  ticket_tiers?: {
    name: string;
  } | null;
};

type Order = {
  id: string;
  ref: string | null;
  payment_ref: string | null;
  created_at: string;
  events: {
    id: string;
    title: string;
    city: string | null;
    cover_image_url: string | null;
    poster_url: string | null;
    image_url: string | null;
    starts_at: string;
    ends_at: string | null;
    venue_name: string | null;
    country: string | null;
  };
  tickets: Ticket[];
};


interface TicketCardProps {
  eventTitle: string;
  eventCity: string;
  posterUrl: string | null;
  startDate: Date;
  endDate: Date | null;
  venueLine: string;
  venueName: string;
  orderedOn: string;
  ref: string;
  holderName: string;
  tierName: string;
  ticketId: string;
  qrImageUrl: string;
}

const TicketCard = ({
  eventTitle,
  eventCity,
  posterUrl,
  startDate,
  endDate,
  venueLine,
  venueName,
  orderedOn,
  ref,
  holderName,
  tierName,
  ticketId,
  qrImageUrl,
}: TicketCardProps) => {
  const dateStr = formatTicketDate(startDate);
  const timeStr = formatTicketTime(startDate);

  // Fezzy Brand Greens
  const greenPrimary = "#10B981";
  const greenLight = "#34D399";
  const greenDark = "#047857";
  const darkBg = "#0b0b0d";
  const darkBg2 = "#171821";

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05)",
      margin: "0 auto 32px",
      maxWidth: "680px",
      fontFamily: "'Inter', 'Montserrat', ui-sans-serif, system-ui, sans-serif",
      fontFeatureSettings: "'ss01', 'cv11'",
      WebkitFontSmoothing: "antialiased"
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }} cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
          
            <td valign="top" style={{ verticalAlign: "top" }}>
            {/* Dark hero header with cover_image_url backdrop */}
            <div style={{
              position: "relative",
              background: darkBg,
              padding: "40px 30px",
              color: "#ffffff",
              textAlign: "center"
            }}>
              {posterUrl && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: `url('${posterUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: 0.35
                }} />
              )}

              <div style={{ position: "relative" }}>
                {/* ADMIT ONE Header */}
                <div style={{
                  fontFamily: "'Anton', 'Arial Narrow', ui-sans-serif, sans-serif",
                  color: greenPrimary,
                  paddingBottom: "10px",
                  fontSize: "18px",
                  letterSpacing: "0",
                  fontWeight: "400",
                  textTransform: "uppercase",
                  borderBottom: `2px solid ${greenPrimary}`,
                  display: "inline-block",
                  marginBottom: "24px"
                }}>ADMIT ONE</div>

                {/* Artist / Event name */}
                <div style={{
                  fontFamily: "'Anton', 'Arial Narrow', ui-sans-serif, sans-serif",
                  fontSize: "42px",
                  fontWeight: "400",
                  lineHeight: "1",
                  letterSpacing: "0",
                  color: "#ffffff",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  textShadow: "0 3px 10px rgba(0,0,0,0.8)"
                }}>{eventTitle}</div>

                {eventCity && (
                  <div style={{
                    fontFamily: "'Jost', 'Montserrat', ui-sans-serif, sans-serif",
                    fontSize: "14px",
                    letterSpacing: "-0.035em",
                    lineHeight: "1",
                    color: greenLight,
                    textTransform: "uppercase",
                    fontWeight: "700"
                  }}>{eventCity} · Live Tour</div>
                )}
              </div>
            </div>

            {/* INFO GRID — 4 columns: Date / Time / Venue / Section */}
            <table width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse", background: "#ffffff" }}>
              <tbody>
                <tr>
                 <td width="25%" valign="top" style={{ padding: "18px 10px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>Date</div>
                  <div style={{ fontFamily: "'Jost', 'Montserrat', sans-serif", fontSize: "16px", color: "#0f172a", fontWeight: "700", letterSpacing: "-0.035em", lineHeight: "1" }}>{dateStr}</div>
                 </td>
                 <td width="20%" valign="top" style={{ padding: "18px 10px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>Time</div>
                  <div style={{ fontFamily: "'Jost', 'Montserrat', sans-serif", fontSize: "16px", color: "#0f172a", fontWeight: "700", letterSpacing: "-0.035em", lineHeight: "1" }}>{timeStr}</div>
                 </td>
                 <td width="30%" valign="top" style={{ padding: "18px 10px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>Venue</div>
                  <div style={{ fontFamily: "'Jost', 'Montserrat', sans-serif", fontSize: "15px", color: "#0f172a", fontWeight: "700", letterSpacing: "-0.035em", lineHeight: "1", marginBottom: "3px" }}>{venueName || "TBA"}</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "#64748b", letterSpacing: "0.05em" }}>{venueLine}</div>
                 </td>
                 <td width="25%" valign="top" style={{ padding: "18px 10px", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>Section</div>
                  <div style={{ fontFamily: "'Jost', 'Montserrat', sans-serif", fontSize: "16px", color: greenDark, fontWeight: "700", letterSpacing: "-0.035em", lineHeight: "1" }}>{tierName}</div>
                 </td>
              </tbody>
            </table>
            
            {/* Order info strip */}
            <div style={{
              background: "#f8fafc",
              padding: "12px 30px",
              textAlign: "center",
              borderTop: "1px dashed #cbd5e1"
            }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Holder: <strong style={{ color: "#0f172a" }}>{holderName}</strong>
                &nbsp;&nbsp;·&nbsp;&nbsp; 
                Order Ref: <strong style={{ color: "#0f172a" }}>{ref}</strong>
                &nbsp;&nbsp;·&nbsp;&nbsp; 
                Ordered: <strong style={{ color: "#0f172a" }}>{orderedOn}</strong>
              </span>
            </div>

          </td>

          {/* ── PERFORATED DIVIDER ── */}
          <td width="1" style={{
            background: `repeating-linear-gradient(
              to bottom,
              #cbd5e1 0,
              #cbd5e1 4px,
              transparent 4px,
              transparent 10px
            )`,
            width: "2px",
            padding: "0"
          }} />

          {/* ── TICKET STUB ── */}
          <td width="180" valign="top" style={{
            verticalAlign: "top",
            background: `linear-gradient(180deg,${darkBg} 0%,${darkBg2} 100%)`,
            padding: "25px 15px",
            textAlign: "center",
            color: "#ffffff"
          }}>
            <div style={{ fontFamily: "'Great Vibes', 'Brittany Signature', cursive", fontSize: "28px", color: greenLight, fontWeight: "400", lineHeight: "0.9", marginBottom: "5px" }}>Fezzy</div>
            <div style={{ fontFamily: "'Anton', 'Arial Narrow', sans-serif", fontSize: "12px", letterSpacing: "0.2em", color: greenPrimary, textTransform: "uppercase", marginBottom: "20px", fontWeight: "400" }}>ADMIT ONE</div>
            
            {/* QR Code */}
            <div style={{
              background: "#ffffff",
              padding: "8px",
              borderRadius: "4px",
              display: "inline-block",
              marginBottom: "12px"
            }}>
              <img src={qrImageUrl} width="110" height="110" alt="Scan at gate" style={{ display: "block", margin: "0 auto" }} />
            </div>

            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "9px",
              letterSpacing: "0.15em",
              color: "#a9a3a0",
              textTransform: "uppercase",
              marginBottom: "15px",
              fontWeight: "600"
            }}>Scan at gate</div>

            {/* Ticket ID */}
            <div style={{
              fontSize: "9px",
              color: "#f1f5f9",
              letterSpacing: "0.05em",
              wordBreak: "break-all",
              lineHeight: "1.4",
              fontFamily: "'Courier New', monospace",
              marginBottom: "15px"
            }}>{ticketId}</div>

            {/* Mini date repeat */}
            <div style={{
              marginTop: "10px",
              paddingTop: "10px",
              borderTop: "1px dashed #334155"
            }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", color: "#94a3b8", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: "600" }}>Date</div>
              <div style={{ fontFamily: "'Jost', 'Montserrat', sans-serif", fontSize: "14px", color: greenPrimary, letterSpacing: "-0.035em", fontWeight: "700", marginTop: "3px", lineHeight: "1" }}>{dateStr}</div>
            </div>
          </td>
         </tr>
        </tbody>
      </table>

      {/* Footer notice */}
      <div style={{
        background: darkBg,
        padding: "10px 24px",
        textAlign: "center",
        fontSize: "9px",
        color: "#a9a3a0",
        letterSpacing: "0.15em",
        textTransform: "uppercase"
      }}>
        Fully Valid Ticket · {event.title}
      </div>
    </div>
  );
};

const TicketViewer = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setError("Order ID is required");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            id,
            ref,
            payment_ref,
            created_at,
            events(*),
            tickets(*, ticket_tiers(*))
          `)
          .eq("id", orderId)
          .single();

        if (error || !data) {
          setError(error?.message || "Order not found");
          setLoading(false);
          return;
        }

        setOrder(data as Order);

        // Generate QR codes
        const qrMap: Record<string, string> = {};
        for (const ticket of data.tickets) {
          const dataUrl = await QRCode.toDataURL(ticket.qr_token, {
            type: "image/png",
            width: 300,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
          });
          qrMap[ticket.id] = dataUrl;
        }
        setQrUrls(qrMap);
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Failed to load tickets");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-600">{error || "Something went wrong"}</p>
        </div>
      </div>
    );
  }

  const event = order.events;
  const ref = order.payment_ref || order.ref || `FZ-${order.id.slice(0, 8).toUpperCase()}`;
  const startDate = new Date(event.starts_at);
  const endDate = event.ends_at ? new Date(event.ends_at) : null;
  const orderedOn = new Date(order.created_at).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const venueName = event.venue_name || "";
  const venueLine = [event.city, event.country].filter(Boolean).join(", ") || "TBA";
  const posterUrl = event.cover_image_url ?? event.poster_url ?? event.image_url ?? null;

  if (!order.events) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      Event not found
    </div>
  );
}

  return (
    <div className="min-h-screen bg-[#f4ede0] py-8 px-4">
      {/* Header */}
      <div style={{
        maxWidth: "700px",
        margin: "0 auto 24px"
      }}>
        <div style={{
          background: "linear-gradient(135deg, #0b0b0d 0%, #171821 55%, #0b0b0d 100%)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 30px 80px -30px rgba(0,0,0,.55)"
        }}>
          <div style={{
            height: "2px",
            background: "linear-gradient(90deg, transparent 0%, #10B981 20%, #34D399 50%, #10B981 80%, transparent 100%)"
          }} />
          <div style={{ padding: "34px 32px 30px", textAlign: "center" }}>
            <img
              src={LOGO_URL}
              alt="Fezzy"
              width="130"
              style={{
                maxWidth: "130px",
                height: "auto",
                display: "block",
                margin: "0 auto 20px",
                filter: "brightness(0) invert(1)"
              }}
            />
            <div style={{
              fontFamily: "'Great Vibes', cursive",
              fontSize: "34px",
              color: "#34D399",
              lineHeight: "0.9",
              marginBottom: "8px"
            }}>
              Fezzy
            </div>
            <div style={{
              fontFamily: "'Anton', 'Arial Narrow', 'Impact', sans-serif",
              fontSize: "14px",
              letterSpacing: "0.42em",
              color: "#10B981",
              textTransform: "uppercase",
              marginBottom: "14px"
            }}>
              Admit One · Confirmed
            </div>
            <h1 style={{
              margin: "0 0 8px",
              fontFamily: "'Anton', 'Arial Narrow', 'Impact', sans-serif",
              fontSize: "32px",
              fontWeight: "400",
              color: "#ffffff",
              textTransform: "uppercase",
              lineHeight: "1"
            }}>
              Your tickets are ready.
            </h1>
            <p style={{
              margin: "0",
              fontSize: "13px",
              color: "#a9a3a0",
              lineHeight: "1.6"
            }}>
              Booking reference <strong style={{ color: "#10B981", letterSpacing: "0.05em" }}>{ref}</strong>
            </p>
          </div>
          <div style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, #1e293b, transparent)"
          }} />
          <div style={{ padding: "14px 28px 22px", textAlign: "center" }}>
            <span style={{
              display: "inline-block",
              padding: "6px 12px",
              margin: "0 4px 6px",
              border: "1px solid #1e293b",
              borderRadius: "999px",
              fontSize: "10px",
              letterSpacing: "0.18em",
              color: "#10B981",
              textTransform: "uppercase",
              fontWeight: "700"
            }}>
              M-Pesa
            </span>
            <span style={{
              display: "inline-block",
              padding: "6px 12px",
              margin: "0 4px 6px",
              border: "1px solid #1e293b",
              borderRadius: "999px",
              fontSize: "10px",
              letterSpacing: "0.18em",
              color: "#10B981",
              textTransform: "uppercase",
              fontWeight: "700"
            }}>
              Visa
            </span>
            <span style={{
              display: "inline-block",
              padding: "6px 12px",
              margin: "0 4px 6px",
              border: "1px solid #1e293b",
              borderRadius: "999px",
              fontSize: "10px",
              letterSpacing: "0.18em",
              color: "#10B981",
              textTransform: "uppercase",
              fontWeight: "700"
            }}>
              Paystack Secured
            </span>
          </div>
        </div>
      </div>

      {/* Tickets */}
      {order.tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          eventTitle={event.title}
          eventCity={event.city || ""}
          posterUrl={posterUrl}
          startDate={startDate}
          endDate={endDate}
          venueLine={venueLine}
          venueName={venueName}
          orderedOn={orderedOn}
          ref={ref}
          holderName={ticket.holder_name}
          tierName={ticket.ticket_tiers.name}
          ticketId={ticket.id}
          qrImageUrl={qrUrls[ticket.id] || ""}
        />
      ))}

      {/* Download button */}
      <div className="max-w-[680px] mx-auto text-center">
        <Button
          variant="acacia"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Download className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>
    </div>
  );
};

export default TicketViewer;
