// Minimal gold line icons for services (consistent stroke, no clip-art).
const P: Record<string, React.ReactNode> = {
  scissors: (
    <>
      <circle cx="7" cy="17" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M9 15 L17 3 M15 15 L7 3" />
    </>
  ),
  fade: (
    <>
      <path d="M4 20 C4 10 8 4 12 4 C16 4 20 10 20 20" />
      <path d="M6 16 H18 M6.8 12.5 H17.2 M8.5 9 H15.5" strokeDasharray="1.5 2" />
    </>
  ),
  beard: (
    <>
      <path d="M5 8 C5 16 8 21 12 21 C16 21 19 16 19 8" />
      <path d="M9 13 C10.5 12 13.5 12 15 13 M12 16.5 V18" />
    </>
  ),
  crown: <path d="M4 18 L3 7 L8.5 11 L12 4 L15.5 11 L21 7 L20 18 Z M5 21 H19" />,
  sparkles: <path d="M12 3 L13.6 9.4 L20 11 L13.6 12.6 L12 19 L10.4 12.6 L4 11 L10.4 9.4 Z M19 17 L19.6 19.4 L22 20 L19.6 20.6 L19 23 L18.4 20.6 L16 20 L18.4 19.4 Z" />,
  razor: (
    <>
      <path d="M3 9 L14 9 L16 12 L3 12 Z" />
      <path d="M16 12 L21 19 M14 9 L19 15" />
    </>
  ),
  child: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M6 21 C6 15 8.5 12.5 12 12.5 C15.5 12.5 18 15 18 21" />
    </>
  ),
  comb: (
    <>
      <path d="M3 9 H21 V12 H3 Z" />
      <path d="M5 12 V18 M8 12 V18 M11 12 V18 M14 12 V18 M17 12 V18 M20 12 V16" />
    </>
  ),
  brush: (
    <>
      <rect x="9" y="2.5" width="6" height="10" rx="3" />
      <path d="M10.5 5.5 V9.5 M13.5 5.5 V9.5 M12 12.5 V21.5" />
    </>
  ),
  bottle: (
    <>
      <path d="M10 2.5 H14 V6 L16.5 9 V20.5 H7.5 V9 L10 6 Z" />
      <path d="M12 12.5 C10.8 14.2 10.6 15 12 16.3 C13.4 15 13.2 14.2 12 12.5 Z" />
    </>
  ),
  bowl: (
    <>
      <path d="M3.5 11 H20.5 C20.5 16 16.7 19.5 12 19.5 C7.3 19.5 3.5 16 3.5 11 Z" />
      <path d="M14 11 L19 3.5" />
    </>
  ),
  iron: (
    <>
      <path d="M3 20 L12.5 8.5 M6 21 L15 10" />
      <path d="M12.5 8.5 L15.5 5 L19 8.5 L15 10 Z" />
    </>
  ),
  highlight: (
    <>
      <path d="M5 20 C5 11 8 5 12 4 C16 5 19 11 19 20" />
      <path d="M9 19 C9 13 10.2 9 12 7.5 M15 19 C15 13 13.8 9 12 7.5" strokeDasharray="2 1.6" />
    </>
  ),
};

export function ServiceIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[name] ?? P.scissors}
    </svg>
  );
}
