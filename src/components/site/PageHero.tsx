import { Ornament } from "@/components/brand/Logo";

export function PageHero({ eyebrow, title, text, children }: { eyebrow: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <section className="marble border-b border-hair px-4 pb-16 pt-32 text-center sm:px-6 md:pb-20 md:pt-40">
      <div className="container-x animate-rise">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-medium leading-[1.05] sm:text-6xl">{title}</h1>
        <Ornament className="mt-6" />
        {text && <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ivory-muted sm:text-lg">{text}</p>}
        {children}
      </div>
    </section>
  );
}
