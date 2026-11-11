interface WaveformProps {
  duty: number;
  periodSeconds: number;
}

export default function Waveform({ duty, periodSeconds }: WaveformProps) {
  const periods = 3;
  const xStart = 36;
  const periodWidth = 244;
  const yHigh = 50;
  const yLow = 128;
  const points: string[] = ["M " + xStart + " " + (duty > 0 ? yHigh : yLow)];
  for (let i = 0; i < periods; i += 1) {
    const x0 = xStart + i * periodWidth;
    const x1 = x0 + periodWidth;
    if (duty === 0) {
      points.push("L " + x1 + " " + yLow);
    } else if (duty === 1) {
      points.push("L " + x1 + " " + yHigh);
    } else {
      const edge = x0 + duty * periodWidth;
      points.push("L " + edge + " " + yHigh);
      points.push("L " + edge + " " + yLow);
      points.push("L " + x1 + " " + yLow);
      if (i < periods - 1) points.push("L " + x1 + " " + yHigh);
    }
  }

  return (
    <svg className="waveform" viewBox="0 0 790 174" role="img" aria-label={"PWM-Signal mit " + (duty * 100).toFixed(1) + " Prozent aktivem Tastverhältnis"}>
      <line x1="36" y1={yHigh} x2="768" y2={yHigh} className="wave-guide"/>
      <line x1="36" y1={yLow} x2="768" y2={yLow} className="wave-guide"/>
      {Array.from({ length: periods + 1 }, (_, i) => (
        <g key={i}>
          <line x1={xStart + i * periodWidth} y1="22" x2={xStart + i * periodWidth} y2="148" className="wave-grid"/>
          {i < periods && <text x={xStart + i * periodWidth + periodWidth / 2} y="167" className="wave-label" textAnchor="middle">T = {(periodSeconds * 1000).toLocaleString("de-DE", { maximumFractionDigits: 3 })} ms</text>}
        </g>
      ))}
      <text x="5" y="54" className="wave-label">1</text>
      <text x="5" y="133" className="wave-label">0</text>
      <path d={points.join(" ")} className="wave-signal"/>
    </svg>
  );
}
