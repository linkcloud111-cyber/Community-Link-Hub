import React from "react";
import { getTaxonomyVisual, getPlatformVisual, getCategoryVisual, getContentTypeVisual, getLanguageVisual } from "@/lib/taxonomy-visuals";

interface TaxonomyBadgeProps {
  type: "platform" | "category" | "contentType" | "language";
  name: string;
  color?: string | null;
  icon?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  showIcon?: boolean;
}

export function TaxonomyBadge({
  type,
  name,
  color,
  icon,
  size = "md",
  className = "",
  onClick,
  showIcon = true,
}: TaxonomyBadgeProps) {
  const visual =
    type === "platform"
      ? getPlatformVisual(name, color, icon)
      : type === "category"
      ? getCategoryVisual(name, color, icon)
      : type === "contentType"
      ? getContentTypeVisual(name, color, icon)
      : getLanguageVisual(name, color, icon);

  const IconComp = visual.IconComponent;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1 rounded-md",
    md: "px-2.5 py-1 text-xs gap-1.5 rounded-lg",
    lg: "px-3 py-1.5 text-sm gap-2 rounded-xl",
  }[size];

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  }[size];

  return (
    <span
      onClick={onClick}
      style={visual.badgeStyle}
      className={`inline-flex items-center font-semibold border transition-all ${
        onClick ? "cursor-pointer hover:opacity-80" : ""
      } ${sizeClasses} ${className}`}
    >
      {showIcon && <IconComp className={`${iconSizes} shrink-0`} style={visual.iconStyle} />}
      <span className="truncate">{name}</span>
    </span>
  );
}

export function PlatformBadge({ name, color, icon, size = "md", className = "", onClick }: Omit<TaxonomyBadgeProps, "type">) {
  return <TaxonomyBadge type="platform" name={name} color={color} icon={icon} size={size} className={className} onClick={onClick} />;
}

export function CategoryBadge({ name, color, icon, size = "md", className = "", onClick }: Omit<TaxonomyBadgeProps, "type">) {
  return <TaxonomyBadge type="category" name={name} color={color} icon={icon} size={size} className={className} onClick={onClick} />;
}

export function ContentTypeBadge({ name, color, icon, size = "md", className = "", onClick }: Omit<TaxonomyBadgeProps, "type">) {
  return <TaxonomyBadge type="contentType" name={name} color={color} icon={icon} size={size} className={className} onClick={onClick} />;
}

export function LanguageBadge({ name, color, icon, size = "md", className = "", onClick }: Omit<TaxonomyBadgeProps, "type">) {
  return <TaxonomyBadge type="language" name={name} color={color} icon={icon} size={size} className={className} onClick={onClick} />;
}
