import React, { useState } from "react";

export default function BookingModal({ room, checkIn, checkOut, nights, guests, submitting, onClose, onConfirm }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  if (!room) return null;

  const total = room.precio_noche * nights;
  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      habitacion_id: room.id,
      habitacion_nombre: room.nombre,
      cliente_nombre: nombre.trim(),
      cliente_email: email.trim(),
      check_in: checkIn,
      check_out: checkOut,
      huespedes: guests,
      total,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirmar reserva de prueba</h3>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-summary">
          <p><strong>Unidad:</strong> {room.nombre}</p>
          <p><strong>Estadía:</strong> {checkIn} al {checkOut} ({nights} {nights === 1 ? "noche" : "noches"})</p>
          <p><strong>Huéspedes:</strong> {guests}</p>
          <p className="modal-total">Total estimado: ${total} USD</p>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="field">
            <label htmlFor="guestName">Nombre y apellido</label>
            <input id="guestName" type="text" placeholder="Ej. Ana García" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="guestEmail">Email de contacto</label>
            <input id="guestEmail" type="email" placeholder="ana@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Guardando..." : "Confirmar reserva"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
