"use client";
import { Children, useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Reveals its children one by one (fade + rise) the first time the group scrolls into view.
 * Renders a wrapper with `className` (e.g. a grid) and wraps each child.
 */
export function RevealGroup({
  children,
  className,
  itemClassName,
  as: Tag = "div",
  step = 110,
}: {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
  as?: "div" | "ol" | "ul";
  step?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Item = Tag === "div" ? "div" : "li";
  return (
    <Tag ref={ref as never} className={className}>
      {Children.toArray(children).map((child, i) => (
        <Item
          key={i}
          className={clsx("transition-all duration-700 ease-out", shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", itemClassName)}
          style={{ transitionDelay: shown ? `${i * step}ms` : "0ms" }}
        >
          {child}
        </Item>
      ))}
    </Tag>
  );
}
