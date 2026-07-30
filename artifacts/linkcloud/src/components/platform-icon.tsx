import { Linkedin, Users } from "lucide-react";
import {
  SiWhatsapp,
  SiTelegram,
  SiDiscord,
  SiFacebook,
  SiInstagram,
  SiX,
  SiYoutube,
  SiReddit,
} from "react-icons/si";

export const PLATFORM_COLORS: Record<string, string> = {
  WhatsApp: "text-green-500",
  Telegram: "text-blue-400",
  Discord: "text-indigo-500",
  "Facebook Groups": "text-blue-600",
  "Instagram Broadcast": "text-pink-500",
  "X Communities": "text-foreground",
  "LinkedIn Groups": "text-blue-700",
  "YouTube Channels": "text-red-500",
  Reddit: "text-orange-500",
};

export const PLATFORM_BG_COLORS: Record<string, string> = {
  WhatsApp: "bg-green-500/10",
  Telegram: "bg-blue-400/10",
  Discord: "bg-indigo-500/10",
  "Facebook Groups": "bg-blue-600/10",
  "Instagram Broadcast": "bg-pink-500/10",
  "X Communities": "bg-foreground/10",
  "LinkedIn Groups": "bg-blue-700/10",
  "YouTube Channels": "bg-red-500/10",
  Reddit: "bg-orange-500/10",
};

interface PlatformIconProps {
  platform: string;
  className?: string;
}

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  switch (platform) {
    case "WhatsApp":
      return <SiWhatsapp className={className} />;
    case "Telegram":
      return <SiTelegram className={className} />;
    case "Discord":
      return <SiDiscord className={className} />;
    case "Facebook Groups":
      return <SiFacebook className={className} />;
    case "Instagram Broadcast":
      return <SiInstagram className={className} />;
    case "X Communities":
      return <SiX className={className} />;
    case "LinkedIn Groups":
      return <Linkedin className={className} />;
    case "YouTube Channels":
      return <SiYoutube className={className} />;
    case "Reddit":
      return <SiReddit className={className} />;
    default:
      return <Users className={className} />;
  }
}
