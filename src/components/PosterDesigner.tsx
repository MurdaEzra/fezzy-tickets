import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  date: string;
  venue: string;
  city: string;
  imageUrl: string | null;
  accent: string;
  onUpload: (file: File) => void;
}

const PosterDesigner = ({ title, date, venue, city, imageUrl, accent, onUpload }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-secondary shadow-soft">
        {imageUrl ? (
          <img src={imageUrl} alt="Poster" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8" />
              <p className="mt-2 text-sm">Upload a background image</p>
            </div>
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(13,27,42,0.05) 0%, rgba(13,27,42,0.55) 55%, rgba(13,27,42,0.92) 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <span className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ background: accent, color: "#0d1b2a" }}>
            {date || "Date"}
          </span>
          <h3 className="mt-3 font-display text-3xl font-bold leading-tight">{title || "Your event title"}</h3>
          <p className="script mt-1 text-2xl" style={{ color: accent }}>{venue || "Venue"}</p>
          <p className="text-sm opacity-90">{city || "City"}</p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.3em] opacity-80">Tickets on Fezzy</p>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
             onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
      <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4" /> {imageUrl ? "Change image" : "Upload background"}
      </Button>
    </div>
  );
};

export default PosterDesigner;
