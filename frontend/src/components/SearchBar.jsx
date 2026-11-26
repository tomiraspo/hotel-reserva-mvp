import React from "react";

export default function SearchBar({
  checkIn, checkOut, guests, nights, validationError, loading,
  onChangeCheckIn, onChangeCheckOut, onChangeGuests, onSearch,
}) {
  return (
    <section className="search-card">
      <form className="search-form" onSubmit={onSearch}>
        <div className="field">
          <label htmlFor="checkIn">Check-in</label>
          <input id="checkIn" type="date" value={checkIn} onChange={(e) => onChangeCheckIn(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="checkOut">Check-out</label>
          <input id="checkOut" type="date" value={checkOut} onChange={(e) => onChangeCheckOut(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="guests">Huéspedes</label>
          <select id="guests" value={guests} onChange={(e) => onChangeGuests(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "huésped" : "huéspedes"}</option>
            ))}
          </select>
        </div>
        <div className="search-summary">
          <span className="nights-badge">{nights > 0 ? `${nights} ${nights === 1 ? "noche" : "noches"}` : "Fechas inválidas"}</span>
          <button type="submit" className="btn btn-primary" disabled={loading || nights <= 0}>
            {loading ? "Consultando..." : "Consultar disponibilidad"}
          </button>
        </div>
      </form>
      {validationError && <p className="error-inline">{validationError}</p>}
    </section>
  );
}
