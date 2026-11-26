import React from "react";

export default function Navbar({ apiOnline, onResetDemo, resetting }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <span className="brand-badge">PORTFOLIO MVP</span>
          <div>
            <h1>Hotel Reserva &amp; Automatización</h1>
            <p className="brand-sub">FastAPI · MySQL · n8n · React</p>
          </div>
        </div>
        <div className="navbar-actions">
          <div className={`status-pill ${apiOnline ? "online" : "offline"}`}>
            <span className="status-dot" />
            {apiOnline ? "API Conectada" : "API Offline (Modo Vista)"}
          </div>
          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={onResetDemo}
            disabled={resetting}
          >
            {resetting ? "Reiniciando..." : "Reiniciar demo"}
          </button>
        </div>
      </div>
      <div className="demo-banner">
        Entorno interactivo de demostración con base acotada. Consulta fechas, crea reservas de prueba y reinicia los datos en un clic.
      </div>
    </header>
  );
}
