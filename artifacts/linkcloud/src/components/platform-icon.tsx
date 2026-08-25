import React from "react";
import { getPlatformVisual } from "@/lib/taxonomy-visuals";

// Backward-compatible color objects
export const PLATFORM_COLORS: Record<string, string> = {
  WhatsApp: "text-[#25D366]",
  Telegram: "text-[#229ED9]",
  Discord: "text-[#5865F2]",
  "Facebook Groups": "text-[#1877F2]",
  "Instagram Broadcast": "text-[#E4405F]",
  "X Communities": "text-[#111111]",
  "LinkedIn Groups": "text-[#0A66C2]",
  "YouTube Channels": "text-[#FF0000]",
  Reddit: "text-[#FF4500]",
};

export const PLATFORM_BG_COLORS: Record<string, string> = {
  WhatsApp: "bg-[#25D366]/10",
  Telegram: "bg-[#229ED9]/10",
  Discord: "bg-[#5865F2]/10",
  "Facebook Groups": "bg-[#1877F2]/10",
  "Instagram Broadcast": "bg-[#E4405F]/10",
  "X Communities": "bg-[#111111]/10",
  "LinkedIn Groups": "bg-[#0A66C2]/10",
  "YouTube Channels": "bg-[#FF0000]/10",
  Reddit: "bg-[#FF4500]/10",
};

interface PlatformIconProps {
  platform: string;
  className?: string;
  color?: string;
  icon?: string;
  style?: React.CSSProperties;
}

export function PlatformIcon({ platform, className = "", color, icon, style }: PlatformIconProps) {
  const visual = getPlatformVisual(platform, color, icon);
  const IconComp = visual.IconComponent;
  const hasTextColor = /\btext-/.test(className);
  const mergedStyle = hasTextColor ? style : { color: visual.color, ...style };
  return <IconComp className={className} style={mergedStyle} />;
}

export default PlatformIcon;
