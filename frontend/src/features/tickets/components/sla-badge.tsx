import { AlarmClock, CircleAlert, CircleCheck, CircleCheckBig } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SlaState } from '@/types';
import { SLA_META } from './ticket-meta';

const SLA_ICON: Record<SlaState, LucideIcon> = {
  OnTrack: CircleCheck,
  AtRisk: AlarmClock,
  Breached: CircleAlert,
  Met: CircleCheckBig,
};

/** SLA icon (on track / at risk / breached / met) with a tooltip and optional countdown text. */
export function SlaBadge({ state, text, hint }: { state: SlaState; text?: string | null; hint?: string | null }) {
  const meta = SLA_META[state];
  if (!meta) return null;
  const Icon = SLA_ICON[state];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={[`SLA: ${meta.label}`, text ?? hint].filter(Boolean).join(', ')}
          data-sla-state={state}
          className={cn('inline-flex items-center gap-1.5 text-sm', meta.className)}
        >
          <Icon className="size-4" />
          {text && <span>{text}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {meta.label}
        {hint ? ` · ${hint}` : ''}
      </TooltipContent>
    </Tooltip>
  );
}
