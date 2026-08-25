import React from 'react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand={false}
      duration={4000}
      visibleToasts={4}
      icons={{
        success: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />,
        info: <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />,
        error: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />,
        loading: <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin flex-shrink-0" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast font-sans rounded-2xl border shadow-xl text-sm max-w-[calc(100vw-24px)] p-4 transition-all',
          title: 'font-semibold text-sm',
          description: 'text-xs mt-0.5 opacity-90',
          actionButton:
            'bg-purple-600 text-white hover:bg-purple-700 rounded-xl text-xs font-bold px-3.5 py-2',
          cancelButton:
            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold px-3.5 py-2',
          closeButton:
            'rounded-lg border border-transparent hover:bg-black/5 dark:hover:bg-white/10 transition !min-w-[28px] !min-h-[28px] !flex !items-center !justify-center',
          success:
            '!bg-emerald-50 !text-emerald-950 !border-emerald-300 dark:!bg-emerald-950 dark:!text-emerald-50 dark:!border-emerald-800 shadow-emerald-500/10',
          error:
            '!bg-rose-50 !text-rose-950 !border-rose-300 dark:!bg-rose-950 dark:!text-rose-50 dark:!border-rose-800 shadow-rose-500/10',
          warning:
            '!bg-amber-50 !text-amber-950 !border-amber-300 dark:!bg-amber-950 dark:!text-amber-50 dark:!border-amber-800 shadow-amber-500/10',
          info:
            '!bg-amber-50 !text-amber-950 !border-amber-300 dark:!bg-amber-950 dark:!text-amber-50 dark:!border-amber-800 shadow-amber-500/10',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };


