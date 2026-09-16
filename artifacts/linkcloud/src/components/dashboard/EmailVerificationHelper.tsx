import { useState } from "react";
import { Info, Mail, HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmailVerificationTooltipProps {
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  buttonLabel?: string;
}

/**
 * Tooltip/Popover that explains the email verification requirement in profile settings.
 */
export function EmailVerificationTooltip({
  side = "top",
  className = "",
  buttonLabel = "Why is verification required?",
}: EmailVerificationTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id="lc_email_verification_tooltip_trigger"
          className={`inline-flex items-center gap-1 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 rounded-full p-0.5 transition cursor-help ${className}`}
          aria-label={buttonLabel}
          title={buttonLabel}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id="lc_email_verification_tooltip_content"
        side={side}
        align="start"
        className="w-80 p-3.5 bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 shadow-xl rounded-xl text-left space-y-2 z-50 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center gap-1.5 font-bold text-xs text-purple-300">
          <Mail className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          <span>Email Change Verification</span>
        </div>
        <p className="text-[11px] text-slate-200 leading-relaxed">
          Changing your email requires a verification step for account security:
        </p>
        <ul className="text-[11px] text-slate-300 space-y-1.5 pl-1">
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 font-bold">1.</span>
            <span>A verification link will be sent to the new Gmail inbox.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 font-bold">2.</span>
            <span>The request stays <strong>Pending</strong> until you click the link.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 font-bold">3.</span>
            <span>Click <strong>Refresh Status</strong> to finish updating without logging out.</span>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

interface EmailVerificationHelperTextProps {
  className?: string;
  variant?: "inline" | "box" | "compact";
}

/**
 * Clean helper text component displayed near the email input in profile settings & modal.
 */
export function EmailVerificationHelperText({
  className = "",
  variant = "inline",
}: EmailVerificationHelperTextProps) {
  if (variant === "compact") {
    return (
      <div
        id="lc_email_verification_helper_compact"
        className={`flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 ${className}`}
      >
        <Info className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
        <span>
          A verification link will be sent to this email. You must click it to finalize the change.
        </span>
      </div>
    );
  }

  if (variant === "box") {
    return (
      <div
        id="lc_email_verification_helper_box"
        className={`p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 text-slate-700 dark:text-slate-300 space-y-1.5 text-xs ${className}`}
      >
        <div className="flex items-center gap-1.5 font-bold text-purple-800 dark:text-purple-300">
          <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <span>Verification Step Required</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
          To protect your account, your email address is not updated immediately. We will send a confirmation link to your new Gmail inbox. Your email change will remain <strong>Pending</strong> until you open that link and click <strong>Refresh Verification Status</strong>.
        </p>
      </div>
    );
  }

  return (
    <p
      id="lc_email_verification_helper_inline"
      className={`text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 leading-relaxed mt-1.5 ${className}`}
    >
      <Info className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 flex-shrink-0 mt-0.5" />
      <span>
        <strong>Verification Required:</strong> A verification link will be sent to this Gmail address. The email won't change until you click that link.
      </span>
    </p>
  );
}
