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

  const validationError =
    checkIn && checkOut && nights <= 0 ? "La fecha de check-out debe ser posterior al check-in." : "";

  useEffect(() => {
    (async () => {
      const online = await checkApiHealth();
      setApiOnline(online);
      const [avail, activeBookings] = await Promise.all([
        fetchAvailability({ checkIn, checkOut, guests }),
        fetchBookings(),
      ]);
      if (avail.length) setRooms(avail);
      setBookings(activeBookings);
    })();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (nights <= 0) return;
    setLoading(true);
    setFeedback(null);
    try {
      const data = await fetchAvailability({ checkIn, checkOut, guests });
      setRooms(data.length ? data : FALLBACK_ROOMS);
      setFeedback({
        type: "info",
        text: apiOnline
          ? "Disponibilidad actualizada desde el backend."
          : "Disponibilidad actualizada en modo demostración.",
      });
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
      setRooms((prev) =>
        prev.map((r) => (r.id === payload.habitacion_id ? { ...r, disponible: false } : r))
      );
      setSelectedRoom(null);
      setFeedback({
        type: "success",
        text: apiOnline
          ? "Reserva creada correctamente en el servidor."
          : "Reserva registrada en la demo interactiva (guardada en tu navegador).",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOne = async (id) => {
    setDeletingId(id);
    try {
      await deleteBooking(id);
      const removed = bookings.find((b) => b.id === id);
      setBookings((prev) => prev.filter((b) => b.id !== id));
      if (removed) {
        setRooms((prev) =>
          prev.map((r) => (r.id === removed.habitacion_id ? { ...r, disponible: true } : r))
        );
      }
      setFeedback({ type: "info", text: "Reserva eliminada correctamente." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    setFeedback(null);
    try {
      await resetDemoBookings();
      setBookings([]);
      const refreshed = await fetchAvailability({ checkIn, checkOut, guests });
      setRooms(refreshed.length ? refreshed : FALLBACK_ROOMS);
      setFeedback({ type: "success", text: "Datos de demostración reiniciados con éxito." });
    } finally {
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
        <BookingsPanel
          bookings={bookings}
          onDeleteOne={handleDeleteOne}
          onResetAll={handleResetDemo}
          deletingId={deletingId}
        />
      </main>
      <BookingModal
        room={selectedRoom} checkIn={checkIn} checkOut={checkOut} nights={nights}
        guests={guests} submitting={submitting}
        onClose={() => setSelectedRoom(null)} onConfirm={handleCreateBooking}
      />
    </div>
  );
}
