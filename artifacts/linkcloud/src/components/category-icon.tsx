import React from "react";
import { Folder, type LucideIcon } from "lucide-react";
import { getCategoryVisual, ICON_REGISTRY } from "@/lib/taxonomy-visuals";

export interface CategoryIconProps {
  icon?: string | null;
  name?: string | null;
  className?: string;
  fallbackIcon?: LucideIcon;
  color?: string | null;
  style?: React.CSSProperties;
}

export function CategoryIcon({
  icon,
  name,
  className = "w-4 h-4",
  fallbackIcon,
  color,
  style,
}: CategoryIconProps) {
  const visual = getCategoryVisual(name, color, icon);
  const IconComponent = visual.IconComponent || fallbackIcon || Folder;
  const hasTextColor = /\btext-/.test(className);
  const mergedStyle = hasTextColor ? style : { color: visual.color, ...style };

  return <IconComponent className={className} style={mergedStyle} />;
}

export { ICON_REGISTRY };
export default CategoryIcon;
