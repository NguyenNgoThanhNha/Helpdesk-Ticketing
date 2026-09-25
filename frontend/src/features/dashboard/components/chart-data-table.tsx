/**
 * Text alternative for a chart: a visually hidden table with the plotted values, read by screen readers
 * (the chart itself carries a one-sentence summary as its `aria-label`).
 */
export function ChartDataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: readonly [string, string];
  rows: readonly (readonly [string, string | number])[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{headers[0]}</th>
          <th scope="col">{headers[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
