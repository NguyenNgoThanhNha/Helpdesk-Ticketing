import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PriorityBadge } from './priority-badge';
import { SlaBadge } from './sla-badge';
import { StatusBadge } from './status-badge';

describe('StatusBadge / PriorityBadge / SlaBadge', () => {
  it('renders status labels with a status-specific color', () => {
    render(
      <>
        <StatusBadge status="InProgress" />
        <StatusBadge status="Resolved" />
      </>,
    );
    const [inProgress, resolved] = screen.getAllByTestId('status-badge');
    expect(inProgress).toHaveTextContent('In Progress');
    expect(inProgress.className).toMatch(/bg-indigo-50/);
    expect(resolved).toHaveTextContent('Resolved');
    expect(resolved.className).toMatch(/bg-emerald-50/);
  });

  it('colors Urgent red, High orange, Medium amber and Low neutral', () => {
    render(
      <>
        <PriorityBadge priority="Urgent" />
        <PriorityBadge priority="High" />
        <PriorityBadge priority="Medium" />
        <PriorityBadge priority="Low" />
      </>,
    );
    const [urgent, high, medium, low] = screen.getAllByTestId('priority-badge');
    expect(urgent).toHaveTextContent('Urgent');
    expect(urgent.className).toMatch(/text-red-700/);
    expect(high.className).toMatch(/text-orange-700/);
    expect(medium.className).toMatch(/text-amber-700/);
    expect(low.className).not.toMatch(/(red|orange|amber)-/);
  });

  it('renders an accessible SLA icon per state, with optional countdown text', () => {
    render(
      <TooltipProvider>
        <SlaBadge state="OnTrack" />
        <SlaBadge state="AtRisk" text="còn 2h" />
        <SlaBadge state="Breached" />
        <SlaBadge state="Met" />
      </TooltipProvider>,
    );
    expect(screen.getByLabelText('SLA: Còn hạn (On track)').className).toMatch(/text-emerald-700/);
    const atRisk = screen.getByLabelText('SLA: Sắp hết hạn (At risk), còn 2h');
    expect(atRisk).toHaveTextContent('còn 2h');
    expect(atRisk.className).toMatch(/text-orange-700/);
    expect(screen.getByLabelText('SLA: Quá hạn (Breached)').className).toMatch(/text-red-600/);
    expect(screen.getByLabelText('SLA: Đạt SLA (Met)').className).toMatch(/text-muted-foreground/);
    // each state has its own icon
    expect(screen.getByLabelText('SLA: Quá hạn (Breached)').querySelector('svg')).toBeInTheDocument();
  });
});
