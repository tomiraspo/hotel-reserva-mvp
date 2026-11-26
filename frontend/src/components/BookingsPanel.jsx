import React from "react";

export default function BookingsPanel({ bookings, onDeleteOne, onResetAll, deletingId }) {
  return (
    <section className="bookings-section">
      <div className="section-header">
        <div>
          <h2>Reservas registradas en el entorno de prueba ({bookings.length})</h2>
          <p className="muted">Cancela reservas individuales o limpia todas para volver a probar disponibilidad.</p>
        </div>
        {bookings.length > 0 && (
          <button type="button" className="btn btn-danger-outline" onClick={onResetAll}>Borrar todas las reservas</button>
        )}
      </div>
      {bookings.length === 0 ? (
        <div className="empty-box">No hay reservas activas en este momento. Todas las unidades están libres para probar.</div>
      ) : (
        <div className="bookings-list">
          {bookings.map((b) => (
            <div key={b.id} className="booking-item">
              <div>
                <strong>{b.habitacion_nombre || `Unidad #${b.habitacion_id}`}</strong>
                <p className="booking-meta">{b.cliente_nombre} ({b.cliente_email}) · {b.check_in} → {b.check_out}</p>
              </div>
              <div className="booking-right">
                {b.total !== undefined && <span className="booking-price">${b.total} USD</span>}
                <button type="button" className="btn btn-small-danger" disabled={deletingId === b.id} onClick={() => onDeleteOne(b.id)}>
                  {deletingId === b.id ? "Borrando..." : "Cancelar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
