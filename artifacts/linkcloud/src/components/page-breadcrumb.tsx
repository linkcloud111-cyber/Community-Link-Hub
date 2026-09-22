import React from "react";
import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItemData {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItemData[];
  className?: string;
}

export function PageBreadcrumb({ items, className = "" }: PageBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-xs text-muted-foreground overflow-x-auto py-2 scrollbar-none ${className}`}
    >
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        <li className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40"
            title="LinkCloud Home"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only sm:not-sr-only sm:inline font-medium">Home</span>
          </Link>
        </li>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={idx} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
              {isLast || !item.href ? (
                <span
                  aria-current="page"
                  className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[320px]"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors font-medium p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
