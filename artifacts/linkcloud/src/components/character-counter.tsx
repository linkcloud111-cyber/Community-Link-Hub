import React from "react";

interface CharacterCounterProps {
  current: number;
  max: number;
  min?: number;
  className?: string;
}

export function CharacterCounter({ current, max, min, className = "" }: CharacterCounterProps) {
  const isOver = current > max;
  const isUnder = min ? current < min && current > 0 : false;

  return (
    <div className={`flex items-center justify-between text-[11px] pt-1 ${className}`}>
      {min ? (
        <span className={isUnder ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
          {min && current > 0 && current < min ? `Min. ${min} characters required` : ""}
        </span>
      ) : (
        <span />
      )}
      <span
        className={`font-mono transition-colors ${
          isOver
            ? "text-rose-600 dark:text-rose-400 font-bold"
            : current >= max * 0.9
            ? "text-amber-600 dark:text-amber-400 font-semibold"
            : "text-muted-foreground"
        }`}
      >
        {current}/{max}
      </span>
    </div>
  );
}
