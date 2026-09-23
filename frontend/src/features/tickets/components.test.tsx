import { render, screen } from '@testing-library/react';
import { PriorityTag, SlaBadge, StatusTag } from './components';

describe('StatusTag / PriorityTag / SlaBadge', () => {
  it('renders status labels with a status-specific color', () => {
    render(
      <>
        <StatusTag status="InProgress" />
        <StatusTag status="Resolved" />
      </>,
    );
    const tags = screen.getAllByTestId('status-tag');
    expect(tags[0]).toHaveTextContent('In Progress');
    expect(tags[0].className).toMatch(/geekblue/);
    expect(tags[1]).toHaveTextContent('Resolved');
    expect(tags[1].className).toMatch(/green/);
  });

  it('colors Urgent red, Medium gold and Low default', () => {
    render(
      <>
        <PriorityTag priority="Urgent" />
        <PriorityTag priority="Medium" />
        <PriorityTag priority="Low" />
      </>,
    );
    const [urgent, medium, low] = screen.getAllByTestId('priority-tag');
    expect(urgent).toHaveTextContent('Urgent');
    expect(urgent.className).toMatch(/ant-tag-red/);
    expect(medium.className).toMatch(/ant-tag-gold/);
    expect(low.className).not.toMatch(/ant-tag-(red|gold|volcano)/);
  });

  it('renders an accessible SLA icon per state, with optional countdown text', () => {
    render(
      <>
        <SlaBadge state="OnTrack" />
        <SlaBadge state="AtRisk" text="còn 2h" />
        <SlaBadge state="Breached" />
        <SlaBadge state="Met" />
      </>,
    );
    expect(screen.getByLabelText('SLA OnTrack')).toHaveStyle({ color: '#52c41a' });
    const atRisk = screen.getByLabelText('SLA AtRisk');
    expect(atRisk).toHaveTextContent('còn 2h');
    expect(atRisk).toHaveStyle({ color: '#fa8c16' });
    expect(screen.getByLabelText('SLA Breached')).toHaveStyle({ color: '#f5222d' });
    expect(screen.getByLabelText('SLA Met')).toHaveStyle({ color: '#8c8c8c' });
  });
});
