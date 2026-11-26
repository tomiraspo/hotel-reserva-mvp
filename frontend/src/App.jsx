import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import SearchBar from "./components/SearchBar";
import RoomCard from "./components/RoomCard";
import BookingModal from "./components/BookingModal";
import BookingsPanel from "./components/BookingsPanel";
import {
  FALLBACK_ROOMS, checkApiHealth, createBooking, deleteBooking,
  fetchAvailability, fetchBookings, resetDemoBookings,
} from "./services/api";

function getDefaultDates() {
  const today = new Date();
  const inDate = new Date(today);
  inDate.setDate(today.getDate() + 1);
  const outDate = new Date(today);
  outDate.setDate(today.getDate() + 4);
  return {
    checkIn: inDate.toISOString().split("T")[0],
    checkOut: outDate.toISOString().split("T")[0],
  };
}

export default function App() {
  const defaults = useMemo(() => getDefaultDates(), []);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [guests, setGuests] = useState(2);

  const [apiOnline, setApiOnline] = useState(false);
  const [rooms, setRooms] = useState(FALLBACK_ROOMS);
  const [bookings, setBookings] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const diff = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [checkIn, checkOut]);

  const validationError = checkIn && checkOut && nights <= 0 ? "La fecha de check-out debe ser posterior al check-in." : "";

  useEffect(() => {
    (async () => {
      const online = await checkApiHealth();
      setApiOnline(online);
      if (!online) return;
      try {
        const [avail, activeBookings] = await Promise.all([
          fetchAvailability({ checkIn, checkOut, guests }).catch(() => FALLBACK_ROOMS),
          fetchBookings().catch(() => []),
        ]);
        if (avail.length) setRooms(avail);
        setBookings(activeBookings);
      } catch {}
    })();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (nights <= 0) return;
    setLoading(true);
    setFeedback(null);
    try {
      const data = await fetchAvailability({ checkIn, checkOut, guests });
      setApiOnline(true);
      setRooms(data.length ? data : FALLBACK_ROOMS);
      setFeedback({ type: "info", text: "Disponibilidad actualizada desde el backend." });
    } catch (err) {
      setFeedback({ type: "warn", text: `No se pudo consultar el backend (${err.message}). Mostrando catálogo de vista previa.` });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async (payload) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const created = await createBooking(payload);
      const newRecord = created?.id ? created : { id: Date.now(), ...payload };
      setBookings((prev) => [newRecord, ...prev]);
      setRooms((prev) => prev.map((r) => (r.id === payload.habitacion_id ? { ...r, disponible: false } : r)));
      setSelectedRoom(null);
      setFeedback({ type: "success", text: "Reserva creada correctamente en el entorno." });
    } catch (err) {
      const simulated = { id: Date.now(), ...payload };
      setBookings((prev) => [simulated, ...prev]);
      setRooms((prev) => prev.map((r) => (r.id === payload.habitacion_id ? { ...r, disponible: false } : r)));
      setSelectedRoom(null);
      setFeedback({ type: "warn", text: `Reserva registrada en sesión local (backend: ${err.message}).` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOne = async (id) => {
    setDeletingId(id);
    try {
      await deleteBooking(id);
      setFeedback({ type: "info", text: "Reserva eliminada de la base de datos." });
    } catch {
      setFeedback({ type: "info", text: "Reserva eliminada de la vista de prueba." });
    } finally {
      const removed = bookings.find((b) => b.id === id);
      setBookings((prev) => prev.filter((b) => b.id !== id));
      if (removed) {
        setRooms((prev) => prev.map((r) => (r.id === removed.habitacion_id ? { ...r, disponible: true } : r)));
      }
      setDeletingId(null);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    setFeedback(null);
    try {
      await resetDemoBookings();
      setFeedback({ type: "success", text: "Base de demostración reiniciada con éxito." });
    } catch (err) {
      setFeedback({ type: "info", text: `Estado visual reiniciado (endpoint DELETE /reservas/demo: ${err.message}).` });
    } finally {
      setBookings([]);
      setRooms((prev) => prev.map((r) => ({ ...r, disponible: true })));
      setResetting(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar apiOnline={apiOnline} onResetDemo={handleResetDemo} resetting={resetting} />
      <main className="container">
        <SearchBar
          checkIn={checkIn} checkOut={checkOut} guests={guests} nights={nights}
          validationError={validationError} loading={loading}
          onChangeCheckIn={setCheckIn} onChangeCheckOut={setCheckOut}
          onChangeGuests={setGuests} onSearch={handleSearch}
        />
        {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}
        <section>
          <div className="section-header">
            <h2>Alojamientos disponibles para demostración</h2>
            <span className="muted">{rooms.length} unidades configuradas</span>
          </div>
          <div className="rooms-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} nights={nights} guests={guests} onSelect={setSelectedRoom} />
            ))}
          </div>
        </section>
        <BookingsPanel bookings={bookings} onDeleteOne={handleDeleteOne} onResetAll={handleResetDemo} deletingId={deletingId} />
      </main>
      <BookingModal
        room={selectedRoom} checkIn={checkIn} checkOut={checkOut} nights={nights}
        guests={guests} submitting={submitting} onClose={() => setSelectedRoom(null)} onConfirm={handleCreateBooking}
      />
    </div>
  );
}
