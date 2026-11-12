import { useEffect, useState } from "react";
import TimerPwmDemo from "../demos/timer-pwm/TimerPwmDemo";

function currentRoute(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

function Home() {
  return (
    <main id="inhalt" className="container">
      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> PRAKTIKUM EINGEBETTETE SYSTEME</div>
        <h1>Interaktive Experimente zur STM32F429-Hardware</h1>
        <p className="hero-text">Entdecken und besser verstehen, was im Controller passiert.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#/timer-pwm">Timer &amp; PWM öffnen</a>
        </div>
      </section>
      <section className="section" aria-labelledby="demos-title">
        <div className="section-heading">
          <h2 id="demos-title">Experiment</h2>
        </div>
        <div className="cards home-cards">
          <a href="#/timer-pwm" className="demo-card">
            <div className="card-visual" aria-hidden="true">
              <svg viewBox="0 0 360 112" role="presentation">
                <path d="M0 94H360 M0 56H360 M0 18H360" stroke="#26394e" strokeDasharray="4 7"/>
                <path d="M12 91V22H75V91H139V22H202V91H266V22H328V91H348" stroke="#42d5c4" strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="card-body">
              <div className="card-meta"><span className="chip">STM32F429</span></div>
              <h3>Timer &amp; PWM</h3>
              <p>Taktbaum, Prescaler, ARR, CCR2 und PWM-Modus 1.</p>
            </div>
          </a>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <div className="site">
      <a className="skip-link" href="#inhalt" onClick={(event) => { event.preventDefault(); const main = document.getElementById("inhalt"); if (main) { main.setAttribute("tabindex", "-1"); main.focus(); } }}>Zum Inhalt springen</a>
      <header className="site-header">
        <div className="container nav">
          <a className="brand" href="#/" aria-label="PES-Demos Startseite"><span className="brand-mark">∿</span><span>PES<span className="brand-light">-Demos</span></span></a>
          <nav aria-label="Hauptnavigation">
            <a href="#/" aria-current={route === "/" ? "page" : undefined}>Übersicht</a>
            <a href="#/timer-pwm" aria-current={route === "/timer-pwm" ? "page" : undefined}>Timer &amp; PWM</a>
          </nav>
        </div>
      </header>
      {route === "/timer-pwm" ? <TimerPwmDemo /> : <Home />}
      <footer className="site-footer"><div className="container">PES-Demos · Praktikum Eingebettete Systeme</div></footer>
    </div>
  );
}
