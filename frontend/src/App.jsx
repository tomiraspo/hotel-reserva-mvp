import { useEffect, useMemo, useState } from "react";
import {
  CABINS_CATALOG,
  DEPOSIT_PERCENT,
  cleanExpiredLocks,
  confirmBookingFromHold,
  createTemporaryHold,
  deleteBooking,
  getAvailability,
  getBookings,
  resetDemoBookings,
  updateBookingStatus,
} from "./service/api";

function getDefaultDates() {
  const inDate = new Date();
  inDate.setDate(inDate.getDate() + 1);
  const outDate = new Date();
  outDate.setDate(outDate.getDate() + 4);
  return {
    checkIn: inDate.toISOString().split("T")[0],
    checkOut: outDate.toISOString().split("T")[0],
  };
}

function formatARS(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const STATUS_BADGES = {
  BLOQUEADA_TEMPORAL: { label: "Bloqueada (15 min)", bg: "#fef3c7", color: "#92400e" },
  PENDIENTE_SENA: { label: "Pendiente de seña (30%)", bg: "#dbeafe", color: "#1e40af" },
  CONFIRMADA: { label: "Confirmada", bg: "#dcfce7", color: "#166534" },
  CANCELADA: { label: "Cancelada", bg: "#fee2e2", color: "#991b1b" },
};

export default function App() {
  const defaults = useMemo(() => getDefaultDates(), []);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [guests, setGuests] = useState(2);

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  // Estado para el bloqueo temporal (Soft Lock)
  const [activeHold, setActiveHold] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Formulario del huésped
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const loadAll = async (ci = checkIn, co = checkOut, g = guests) => {
    setLoading(true);
    try {
      const [availRes, bookRes] = await Promise.all([
        getAvailability(ci, co, g),
        getBookings(),
      ]);
      setRooms(availRes.items);
      setBookings(bookRes.items);
      setIsDemoMode(availRes.isDemo || bookRes.isDemo);
    } catch (err) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Contador regresivo del bloqueo temporal de 15 minutos
  useEffect(() => {
    if (!activeHold?.expires_at) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(activeHold.expires_at).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diff);

      if (diff === 0) {
        cleanExpiredLocks();
        setActiveHold(null);
        setFeedback({
          type: "error",
          text: "El tiempo de bloqueo (15 min) venció y la cabaña volvió a quedar disponible.",
        });
        loadAll();
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeHold]);

  const handleSearch = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", text: "" });
    await loadAll(checkIn, checkOut, guests);
  };

  const handleStartHold = async (room) => {
    setFeedback({ type: "", text: "" });
    try {
      // Si ya tenía un bloqueo anterior sin confirmar, lo libera primero
      if (activeHold) {
        await deleteBooking(activeHold.id);
      }
      const hold = createTemporaryHold({
        room_id: room.id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
      });
      setActiveHold(hold);
      setAcceptedTerms(false);
      await loadAll();
    } catch (err) {
      setFeedback({ type: "error", text: err.message });
      await loadAll();
    }
  };

  const handleCancelHold = async () => {
    if (!activeHold) return;
    await deleteBooking(activeHold.id);
    setActiveHold(null);
    setFeedback({ type: "info", text: "Pre-reserva liberada. La cabaña vuelve a estar disponible." });
    await loadAll();
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!activeHold) return;
    setFeedback({ type: "", text: "" });

    try {
      const res = await confirmBookingFromHold(activeHold.id, {
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        notes,
        accepted_terms: acceptedTerms,
      });

      setActiveHold(null);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setNotes("");
      setAcceptedTerms(false);

      setFeedback({
        type: "success",
        text: `Pre-reserva registrada para ${res.item.room_name}. Seña requerida (${
          DEPOSIT_PERCENT * 100
        }%): ${formatARS(res.item.deposit_amount)}.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  const handleStatusChange = async (id, status) => {
    updateBookingStatus(id, status);
    await loadAll();
  };

  const handleDelete = async (id) => {
    await deleteBooking(id);
    if (activeHold?.id === id) setActiveHold(null);
    await loadAll();
  };

  const handleResetDemo = async () => {
    resetDemoBookings();
    setActiveHold(null);
    setFeedback({ type: "info", text: "Datos de demostración restablecidos." });
    await loadAll();
  };

  const buildWhatsAppLink = (booking) => {
    const message = [
      `Hola! Quiero confirmar mi reserva en *${booking.room_name}*:`,
      `• Huésped: ${booking.guest_name}`,
      `• Check-in: ${booking.check_in} (14:00 hs)`,
      `• Check-out: ${booking.check_out} (10:00 hs)`,
      `• Huéspedes: ${booking.guests} (${booking.nights} noches)`,
      `• Total estadía: ${formatARS(booking.total_price)}`,
      `• Seña (30%): ${formatARS(booking.deposit_amount)}`,
      `• Saldo al ingresar: ${formatARS(booking.balance_amount)}`,
      `• Estado: ${STATUS_BADGES[booking.status]?.label || booking.status}`,
    ].join("\n");

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const formatTimer = (totalSec) => {
    const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  };

  // Indicadores rápidos (BI operativo)
  const kpis = useMemo(() => {
    const active = bookings.filter((b) => ["PENDIENTE_SENA", "CONFIRMADA"].includes(b.status));
    const confirmedRevenue = bookings
      .filter((b) => b.status === "CONFIRMADA")
      .reduce((acc, b) => acc + (b.total_price || 0), 0);
    const pendingDeposits = bookings
      .filter((b) => b.status === "PENDIENTE_SENA")
      .reduce((acc, b) => acc + (b.deposit_amount || 0), 0);

    return {
      totalCabins: CABINS_CATALOG.length,
      activeBookings: active.length,
      confirmedRevenue,
      pendingDeposits,
    };
  }, [bookings]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Sistema de Gestión & Reservas Directas</span>
          <h1 style={styles.title}>Complejo de Cabañas — Motor de Reservas MVP</h1>
          <p style={styles.subtitle}>
            Control de disponibilidad sin solapamiento, bloqueo temporal de 15 minutos, gestión de señas (30%) y cierre por WhatsApp.
          </p>
        </div>

        {isDemoMode && (
          <div style={styles.demoBanner}>
            <span>
              <strong>Modo Demo Interactivo:</strong> Persistencia local en navegador (<code>localStorage</code>) con reglas de negocio activas.
            </span>
            <button type="button" onClick={handleResetDemo} style={styles.secondaryBtn}>
              Reiniciar demo
            </button>
          </div>
        )}
      </header>

      {/* KPIs rápidos del complejo */}
      <section style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Unidades activas</span>
          <strong style={styles.kpiValue}>{kpis.totalCabins} cabañas</strong>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Reservas activas</span>
          <strong style={styles.kpiValue}>{kpis.activeBookings}</strong>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Señas por cobrar (30%)</span>
          <strong style={styles.kpiValue}>{formatARS(kpis.pendingDeposits)}</strong>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Facturación confirmada</span>
          <strong style={styles.kpiValue}>{formatARS(kpis.confirmedRevenue)}</strong>
        </div>
      </section>

      {/* Buscador de disponibilidad */}
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>1. Consultar disponibilidad y tarifas</h2>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <label style={styles.label}>
            Check-in (14:00 hs)
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              required
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Check-out (10:00 hs)
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              required
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Huéspedes
            <input
              type="number"
              min="1"
              max="8"
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              required
              style={styles.input}
            />
          </label>
          <button type="submit" disabled={loading} style={styles.primaryBtn}>
            {loading ? "Consultando..." : "Buscar disponibilidad"}
          </button>
        </form>

        {feedback.text && (
          <div
            style={{
              ...styles.alert,
              backgroundColor:
                feedback.type === "error"
                  ? "#fee2e2"
                  : feedback.type === "success"
                  ? "#dcfce7"
                  : "#e0f2fe",
              color:
                feedback.type === "error"
                  ? "#991b1b"
                  : feedback.type === "success"
                  ? "#166534"
                  : "#075985",
            }}
          >
            {feedback.text}
          </div>
        )}
      </section>

      {/* Catálogo de cabañas */}
      <section style={styles.roomsGrid}>
        {rooms.map((room) => (
          <article key={room.id} style={styles.roomCard}>
            <img src={room.image} alt={room.name} style={styles.roomImg} />
            <div style={styles.roomBody}>
              <div style={styles.roomTop}>
                <span style={styles.categoryTag}>{room.category}</span>
                <span
                  style={{
                    ...styles.statusPill,
                    backgroundColor: room.available ? "#dcfce7" : "#fee2e2",
                    color: room.available ? "#166534" : "#991b1b",
                  }}
                >
                  {room.available ? "Disponible" : "No disponible"}
                </span>
              </div>

              <h3 style={styles.roomTitle}>{room.name}</h3>
              <p style={styles.roomDesc}>{room.description}</p>

              <div style={styles.amenities}>
                {room.amenities?.map((item) => (
                  <span key={item} style={styles.amenityBadge}>
                    {item}
                  </span>
                ))}
              </div>

              <div style={styles.priceBox}>
                <div>
                  <span style={styles.priceNight}>{formatARS(room.price_per_night)} / noche</span>
                  <div style={styles.priceTotal}>
                    Total ({room.nights} noches): <strong>{formatARS(room.total_price)}</strong>
                  </div>
                  <div style={styles.priceDeposit}>
                    Seña 30%: <strong>{formatARS(room.deposit_amount)}</strong> · Saldo al ingreso:{" "}
                    {formatARS(room.balance_amount)}
                  </div>
                </div>
              </div>

              {room.available ? (
                <button
                  type="button"
                  onClick={() => handleStartHold(room)}
                  style={styles.primaryBtnFull}
                >
                  Bloquear y reservar (15 min)
                </button>
              ) : (
                <div style={styles.unavailableBox}>{room.unavailable_reason}</div>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Formulario de confirmación con bloqueo temporal activo */}
      {activeHold && (
        <section style={styles.holdCard}>
          <div style={styles.holdHeader}>
            <div>
              <h2 style={styles.sectionTitle}>2. Completar reserva: {activeHold.room_name}</h2>
              <p style={styles.subtitle}>
                Del <strong>{activeHold.check_in}</strong> al <strong>{activeHold.check_out}</strong> ({activeHold.nights} noches) · Total:{" "}
                <strong>{formatARS(activeHold.total_price)}</strong> · Seña (30%):{" "}
                <strong>{formatARS(activeHold.deposit_amount)}</strong>
              </p>
            </div>
            <div style={styles.timerBox}>
              <span>Tiempo reservado para operar</span>
              <strong style={styles.timerValue}>{formatTimer(secondsLeft)}</strong>
            </div>
          </div>

          <form onSubmit={handleConfirmBooking} style={styles.bookingForm}>
            <label style={styles.label}>
              Nombre y apellido del titular *
              <input
                type="text"
                required
                placeholder="Ej. Martín Gómez"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              WhatsApp de contacto *
              <input
                type="tel"
                required
                placeholder="Ej. +54 9 3492 656199"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Correo electrónico *
              <input
                type="email"
                required
                placeholder="cliente@email.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Observaciones (horario estimado, mascotas, cuna)
              <input
                type="text"
                placeholder="Opcional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
              />
              <span>
                Acepto las condiciones de reserva (seña del 30% dentro de las 24 hs, cancelación sin cargo hasta 15 días antes) y el tratamiento de mis datos personales según Ley 25.326.
              </span>
            </label>

            <div style={styles.holdActions}>
              <button type="submit" style={styles.primaryBtn}>
                Confirmar pre-reserva
              </button>
              <button type="button" onClick={handleCancelHold} style={styles.secondaryBtn}>
                Liberar cabaña
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Panel operativo de reservas */}
      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>3. Panel operativo de reservas y señas</h2>
        {bookings.length === 0 ? (
          <p style={styles.subtitle}>No hay reservas registradas todavía.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cabaña</th>
                  <th style={styles.th}>Huésped</th>
                  <th style={styles.th}>Estadía</th>
                  <th style={styles.th}>Total / Seña (30%)</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones comerciales</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const badge = STATUS_BADGES[b.status] || {
                    label: b.status,
                    bg: "#e5e7eb",
                    color: "#374151",
                  };
                  return (
                    <tr key={b.id}>
                      <td style={styles.td}>
                        <strong>{b.room_name}</strong>
                        <div style={styles.smallText}>{b.guests} huéspedes</div>
                      </td>
                      <td style={styles.td}>
                        <div>{b.guest_name}</div>
                        <div style={styles.smallText}>{b.guest_phone || b.guest_email}</div>
                      </td>
                      <td style={styles.td}>
                        {b.check_in} → {b.check_out}
                        <div style={styles.smallText}>{b.nights} noches</div>
                      </td>
                      <td style={styles.td}>
                        <strong>{formatARS(b.total_price)}</strong>
                        <div style={styles.smallText}>Seña: {formatARS(b.deposit_amount)}</div>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionGroup}>
                          {b.status === "PENDIENTE_SENA" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(b.id, "CONFIRMADA")}
                              style={styles.confirmSmallBtn}
                            >
                              Aprobar seña
                            </button>
                          )}
                          {b.status !== "BLOQUEADA_TEMPORAL" && (
                            <a
                              href={buildWhatsAppLink(b)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={styles.whatsappBtn}
                            >
                              WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id)}
                            style={styles.deleteBtn}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "1140px",
    margin: "0 auto",
    padding: "24px 16px 48px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1e293b",
    backgroundColor: "#f8fafc",
  },
  header: {
    marginBottom: "20px",
  },
  eyebrow: {
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#0f766e",
  },
  title: {
    margin: "4px 0 6px",
    fontSize: "28px",
    color: "#0f172a",
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
  },
  demoBanner: {
    marginTop: "14px",
    padding: "12px 16px",
    borderRadius: "10px",
    backgroundColor: "#ecfdf5",
    border: "1px solid #a7f3d0",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    fontSize: "13px",
    color: "#065f46",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  kpiCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  kpiLabel: {
    fontSize: "12px",
    color: "#64748b",
  },
  kpiValue: {
    fontSize: "20px",
    color: "#0f172a",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
  },
  sectionTitle: {
    margin: "0 0 12px",
    fontSize: "18px",
    color: "#0f172a",
  },
  searchForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    alignItems: "end",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
  },
  primaryBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "14px",
  },
  primaryBtnFull: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "14px",
    marginTop: "10px",
  },
  secondaryBtn: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#334155",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
  },
  alert: {
    marginTop: "12px",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 500,
  },
  roomsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  roomCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  roomImg: {
    width: "100%",
    height: "170px",
    objectFit: "cover",
  },
  roomBody: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  roomTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  categoryTag: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#0f766e",
    textTransform: "uppercase",
  },
  statusPill: {
    padding: "3px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
  },
  roomTitle: {
    margin: "0 0 6px",
    fontSize: "17px",
    color: "#0f172a",
  },
  roomDesc: {
    margin: "0 0 12px",
    fontSize: "13px",
    color: "#475569",
    lineHeight: 1.4,
  },
  amenities: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "12px",
  },
  amenityBadge: {
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "6px",
    backgroundColor: "#f1f5f9",
    color: "#334155",
  },
  priceBox: {
    marginTop: "auto",
    paddingTop: "10px",
    borderTop: "1px solid #f1f5f9",
  },
  priceNight: {
    fontSize: "13px",
    color: "#64748b",
  },
  priceTotal: {
    fontSize: "15px",
    color: "#0f172a",
    marginTop: "2px",
  },
  priceDeposit: {
    fontSize: "12px",
    color: "#0f766e",
    marginTop: "3px",
  },
  unavailableBox: {
    marginTop: "10px",
    padding: "8px 10px",
    borderRadius: "8px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: "12px",
    color: "#64748b",
    textAlign: "center",
  },
  holdCard: {
    backgroundColor: "#fffbeb",
    border: "2px solid #f59e0b",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
  },
  holdHeader: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  timerBox: {
    backgroundColor: "#fef3c7",
    border: "1px solid #f59e0b",
    borderRadius: "10px",
    padding: "8px 14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontSize: "12px",
    color: "#92400e",
  },
  timerValue: {
    fontSize: "20px",
    fontVariantNumeric: "tabular-nums",
  },
  bookingForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  checkboxRow: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "12px",
    color: "#334155",
    marginTop: "4px",
  },
  holdActions: {
    gridColumn: "1 / -1",
    display: "flex",
    gap: "10px",
    marginTop: "6px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "2px solid #e2e8f0",
    color: "#475569",
  },
  td: {
    padding: "10px 8px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },
  smallText: {
    fontSize: "12px",
    color: "#64748b",
  },
  actionGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  confirmSmallBtn: {
    padding: "5px 9px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#16a34a",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  whatsappBtn: {
    padding: "5px 9px",
    borderRadius: "6px",
    backgroundColor: "#0f766e",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: 600,
  },
  deleteBtn: {
    padding: "5px 9px",
    borderRadius: "6px",
    border: "1px solid #fecaca",
    backgroundColor: "#fff1f2",
    color: "#be123c",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
};
