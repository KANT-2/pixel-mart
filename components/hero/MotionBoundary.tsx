"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./HeroStage.module.css";

interface MotionBoundaryProps {
  children: ReactNode;
  className?: string;
}

export default function MotionBoundary({ children, className = "" }: MotionBoundaryProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let inView = false;
    const update = () => {
      element.dataset.motionState = inView && !document.hidden ? "running" : "paused";
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={container} className={`${styles.motionBoundary} ${className}`} data-motion-state="paused">
      {children}
    </div>
  );
}
