
import { useNavigation } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function PageLoader() {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
        <p className="text-sm font-medium text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
