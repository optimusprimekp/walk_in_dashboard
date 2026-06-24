import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";

export function FullscreenButton({ className = "" }: { className?: string }) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  return (
    <button
      onClick={toggle}
      title={isFs ? "Exit fullscreen" : "Go fullscreen"}
      className={`text-zinc-400 hover:text-white transition-colors ${className}`}
    >
      {isFs ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
    </button>
  );
}
