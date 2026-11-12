import type { TimerId } from "../model/timer";

interface DotSignalPathProps {
  timer: TimerId;
  cnt: number;
  arr: number;
  psc: number;
  ccr: number;
  /** Der Zustand stammt aus dem gemeinsamen pwmActive-Modell des Parents. */
  oc2refActive: boolean;
}

export default function DotSignalPath({
  timer, cnt, arr, psc, ccr, oc2refActive,
}: DotSignalPathProps) {
  const connected = timer === "TIM1";
  // Die Ausgangspolarität LOW invertiert den logischen OC2REF-Zustand.
  // PE11 und DOT werden nur bei TIM1 unter den dokumentierten Annahmen modelliert.
  const pe11Level = !connected ? "nicht verbunden" : oc2refActive ? "LOW (0)" : "HIGH (1)";
  const dotState = !connected ? "nicht verbunden" : oc2refActive ? "AN" : "AUS";

  return (
    <details className="dot-signal-path" data-testid="dot-signal-path">
      <summary>
        <span>
          <strong>Signalweg verstehen</strong>
          <small>Warum leuchtet DOT bei OC2REF = 1?</small>
        </span>
        <span className="dot-signal-path-toggle" aria-hidden="true">⌄</span>
      </summary>
      <div className="dot-signal-path-body">
        <p>
          Das Zeitdiagramm zeigt <strong>OC2REF – ein internes logisches Signal</strong>,
          nicht den elektrischen Pegel an PE11. Im dargestellten PWM-Modus 1 gilt
          OC2REF = 1 bei CNT &lt; CCR2.
        </p>

        <div className="dot-path-source">
          <strong>Timer-Taktweg</strong>
          <span>{timer}CLK → PSC = {psc.toLocaleString("de-DE")} (÷{(psc + 1).toLocaleString("de-DE")}) → CNT = {cnt.toLocaleString("de-DE")} (0 … {arr.toLocaleString("de-DE")})</span>
        </div>

        <div className="dot-path-stages" aria-label="PWM-Signalweg vom Vergleich bis zum DOT-Segment">
          <div className="dot-path-stage" data-testid="path-oc2ref">
            <span className="dot-path-stage-label">1 · PWM-Vergleich</span>
            <strong>OC2REF = {oc2refActive ? "1" : "0"}</strong>
            <small>CNT = {cnt.toLocaleString("de-DE")} · CCR2 = {ccr.toLocaleString("de-DE")}</small>
            <span className="dot-path-stage-description">{oc2refActive ? "intern aktiv" : "intern inaktiv"}</span>
          </div>
          <span className="dot-path-arrow" aria-hidden="true">→</span>
          <div className="dot-path-stage">
            <span className="dot-path-stage-label">2 · Ausgangsstufe</span>
            <strong>OCPolarity LOW</strong>
            <small>Invertiert den OC2REF-Pegel</small>
            <span className="dot-path-stage-description">{connected ? "CC2E und MOE für TIM1 als freigegeben angenommen" : "Interner TIM2-Kanal; kein PE11-Ausgang"}</span>
          </div>
          <span className="dot-path-arrow" aria-hidden="true">→</span>
          <div className={"dot-path-stage" + (connected ? "" : " dot-path-disconnected")} data-testid="path-pe11">
            <span className="dot-path-stage-label">3 · {connected ? "TIM1_CH2 / AF1" : "PE11-Anschluss"}</span>
            <strong>PE11: {pe11Level}</strong>
            <small>{connected ? "physikalischer Pinpegel im Modell" : "TIM2_CH2 liegt nicht auf PE11"}</small>
          </div>
          <span className="dot-path-arrow" aria-hidden="true">→</span>
          <div className={"dot-path-stage" + (connected && oc2refActive ? " dot-path-lit" : "")} data-testid="path-dot">
            <span className="dot-path-stage-label">4 · low-aktive Last</span>
            <strong>DOT: {dotState}</strong>
            <small>{connected ? "Segment leuchtet bei PE11 = LOW" : "kein DOT-Signalpfad über PE11"}</small>
          </div>
        </div>

        <div className="dot-path-current" data-testid="path-current-state">
          {connected ? (
            <>Aktuell: <strong>OC2REF = {oc2refActive ? "1" : "0"}</strong> →{" "}
              <strong>PE11 = {pe11Level}</strong> → <strong>DOT {dotState}</strong>.</>
          ) : (
            <>Aktuell: <strong>OC2REF = {oc2refActive ? "1" : "0"}</strong> für TIM2,
              aber <strong>keine Verbindung von TIM2_CH2 zum DOT an PE11</strong>.</>
          )}
        </div>

        <div className="dot-path-table-wrap">
          <table className="dot-path-table">
            <caption>Signalzustände für TIM1_CH2 mit Ausgangspolarität LOW und aktivierter DOT-Anzeigenstelle</caption>
            <thead>
              <tr>
                <th scope="col">OC2REF (intern)</th>
                <th scope="col">PE11 (Pin)</th>
                <th scope="col">DOT (low-aktiv)</th>
                <th scope="col">Zustand</th>
              </tr>
            </thead>
            <tbody>
              <tr className={connected && oc2refActive ? "dot-path-row-active" : ""}>
                <th scope="row">1 · aktiv</th>
                <td>LOW (0)</td>
                <td>AN</td>
                <td>{connected && oc2refActive ? "← aktuell" : "–"}</td>
              </tr>
              <tr className={connected && !oc2refActive ? "dot-path-row-active" : ""}>
                <th scope="row">0 · inaktiv</th>
                <td>HIGH (1)</td>
                <td>AUS</td>
                <td>{connected && !oc2refActive ? "← aktuell" : "–"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="dot-path-explanation">
          <strong>Warum zwei Umkehrungen?</strong> Ausgangspolarität LOW erzeugt bei
          OC2REF = 1 einen LOW-Pegel an PE11. Die low-aktive DOT-Beschaltung
          interpretiert gerade diesen LOW-Pegel als „Segment AN“. Das sind zwei
          logische Zuordnungen – <strong>keine Behauptung über zwei reale Inverterbausteine</strong>.
        </p>
        <p className="dot-path-assumptions">
          <strong>Modellannahmen:</strong> TIM1_CH2 ist über AF1 auf PE11 geschaltet,
          der Timer-Ausgang ist freigegeben (CC2E/MOE), und eine DOT-Anzeigenstelle
          wird über CNTL1…CNTL4 aktiviert. Diese Freigaben und der reale
          Treiber-/Multiplex-Strompfad werden hier nicht simuliert. Dies ist ein
          didaktisches Blockschaltbild, <strong>kein verifizierter elektrischer Schaltplan</strong>.
          Bei TIM2 bleibt die virtuelle PE11-Verbindung unterbrochen.
        </p>
      </div>
    </details>
  );
}
