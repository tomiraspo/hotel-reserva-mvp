import React, { useState } from "react";

export default function RoomCard({ room, nights, guests, onSelect }) {
  const [currentImg, setCurrentImg] = useState(0);
  const images = room.imagenes || [];

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const fitsGuests = room.capacidad >= guests;
  const isAvailable = room.disponible && fitsGuests;
  const subtotal = nights > 0 ? room.precio_noche * nights : room.precio_noche;

  return (
    <article className={`room-card ${!isAvailable ? "room-unavailable" : ""}`}>
      <div className="carousel">
        <img src={images[currentImg]} alt={`${room.nombre} - foto ${currentImg + 1}`} loading="lazy" />
        <span className={`availability-tag ${isAvailable ? "tag-ok" : "tag-busy"}`}>
          {!fitsGuests ? `Capacidad máx: ${room.capacidad}` : room.disponible ? "Disponible" : "Ocupada en estas fechas"}
        </span>
        {images.length > 1 && (
          <>
            <button type="button" className="carousel-btn prev" onClick={prevImage} aria-label="Foto anterior">‹</button>
            <button type="button" className="carousel-btn next" onClick={nextImage} aria-label="Foto siguiente">›</button>
            <div className="carousel-dots">
              {images.map((_, idx) => (
                <button key={idx} type="button" className={`dot ${idx === currentImg ? "active" : ""}`} onClick={() => setCurrentImg(idx)} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="room-body">
        <div className="room-header">
          <h3>{room.nombre}</h3>
          <span className="capacity-pill">Hasta {room.capacidad} pers.</span>
        </div>
        <p className="room-desc">{room.descripcion}</p>
        <div className="room-footer">
          <div className="price-block">
            <span className="price-unit">${room.precio_noche} USD / noche</span>
            {nights > 0 && <strong className="price-total">Total ({nights} {nights === 1 ? "noche" : "noches"}): ${subtotal} USD</strong>}
          </div>
          <button type="button" className="btn btn-primary" disabled={!isAvailable || nights <= 0} onClick={() => onSelect(room)}>
            {isAvailable ? "Reservar" : "No disponible"}
          </button>
        </div>
      </div>
    </article>
  );
}
