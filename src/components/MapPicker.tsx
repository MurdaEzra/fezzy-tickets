import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Fix default marker icons (Leaflet's defaults rely on bundler-resolved paths)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number, address?: string) => void;
}

const Recenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
};

const ClickHandler = ({ onPick }: { onPick: (lat: number, lng: number) => void }) => {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
};

const MapPicker = ({ lat, lng, onChange }: Props) => {
  const initial: [number, number] = [lat ?? -1.2921, lng ?? 36.8219]; // Nairobi default
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const j = await res.json();
      if (j[0]) {
        onChange(parseFloat(j[0].lat), parseFloat(j[0].lon), j[0].display_name);
      }
    } finally { setSearching(false); }
  };

  const reverseGeocode = async (la: number, ln: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${la}&lon=${ln}`);
      const j = await res.json();
      onChange(la, ln, j.display_name);
    } catch { onChange(la, ln); }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search venue or address…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={searching}>{searching ? "Searching…" : "Search"}</Button>
      </form>
      <div className="h-72 overflow-hidden rounded-2xl border border-border">
        <MapContainer center={initial} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {lat !== null && lng !== null && <Marker position={[lat, lng]} icon={icon} />}
          <ClickHandler onPick={reverseGeocode} />
          {lat !== null && lng !== null && <Recenter lat={lat} lng={lng} />}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        {lat !== null && lng !== null
          ? <>Pinned at <span className="font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span> — click anywhere to move.</>
          : "Click on the map to drop a pin, or search for a venue above."}
      </p>
    </div>
  );
};

export default MapPicker;
