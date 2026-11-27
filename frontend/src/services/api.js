const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const STORAGE_KEY = "cabanas_mvp_reservas_v2";
export const DEPOSIT_PERCENT = 0.3;
export const LOCK_MINUTES = 15;
const LOCK_MS = LOCK_MINUTES * 60 * 1000;

export const CABINS_CATALOG = [
  {
    id: 1,
    name: "Cabaña del Bosque",
    category: "Parejas",
    capacity: 2,
    price_per_night: 65000,
    image: "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    name: "Cabaña del Lago",
    category: "Confort",
    capacity: 4,
    price_per_night: 92000,
    image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    name: "Cabaña Familiar Panorámica",
    category: "Grupos",
    capacity: 6,
    price_per_night: 128000,
    image: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    name: "Cabaña Premium Hidromasaje",
    category: "Premium",
    capacity: 2,
    price_per_night: 145000,
    image: "https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=900&q=80",
  },
];

function getTodayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const INITIAL_BOOKINGS = [
  {
    id: 101,
    room_id: 2,
    room_name: "Cabaña del Lago",
    guest_name: "Lucía Fernández",
    guest_phone: "+54 9 3492 551122",
    check_in: getTodayOffset(3),
    check_out: getTodayOffset(6),
    guests: 3,
    nights: 3,
    total_price: 276000,
    deposit_amount: 82800,
    balance_amount: 193200,
    status: "CONFIRMADA",
  },
];

function readBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BOOKINGS));
      return [...INITIAL_BOOKINGS];
    }
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeBookings(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function cleanExpiredLocks() {
  const now = Date.now();
  const list = readBookings();
  const valid = list.filter((b) => {
    if (b.status !== "BLOQUEADA_TEMPORAL") return true;
    return b.expires_at && new Date(b.expires_at).getTime() > now;
  });
  if (valid.length !== list.length) writeBookings(valid);
  return valid;
}

export function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const days = Math.round((end - start) / 86400000);
  return days > 0 ? days : 0;
}

export function hasDateOverlap(roomId, checkIn, checkOut, ignoreId = null) {
  const active = cleanExpiredLocks().filter(
    (b) =>
      b.room_id === Number(roomId) &&
      b.id !== ignoreId &&
      ["BLOQUEADA_TEMPORAL", "PENDIENTE_SENA", "CONFIRMADA"].includes(b.status)
  );
  return active.some((b) => checkIn < b.check_out && checkOut > b.check_in);
}

export async function getAvailability(checkIn, checkOut, guests = 1) {
  const nights = calculateNights(checkIn, checkOut);
  if (nights <= 0) throw new Error("La fecha de salida debe ser posterior a la de ingreso.");

  try {
    const params = new URLSearchParams({ check_in: checkIn, check_out: checkOut, guests: String(guests) });
    const res = await fetch(`${API_BASE}/rooms/availability?${params.toString()}`);
    if (!res.ok) throw new Error("Sin backend");
    return { items: await res.json(), isDemo: false };
  } catch {
    const items = CABINS_CATALOG.map((cabin) => {
      const fits = cabin.capacity >= Number(guests);
      const occupied = hasDateOverlap(cabin.id, checkIn, checkOut);
      const total = cabin.price_per_night * nights;
      const deposit = Math.round(total * DEPOSIT_PERCENT);

      return {
        ...cabin,
        available: fits && !occupied,
        reason: !fits ? `Máx. ${cabin.capacity} huéspedes` : occupied ? "Ocupada en esas fechas" : null,
        nights,
        total_price: total,
        deposit_amount: deposit,
        balance_amount: total - deposit,
      };
    });
    return { items, isDemo: true };
  }
}

export async function getBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    if (!res.ok) throw new Error("Sin backend");
    return { items: await res.json(), isDemo: false };
  } catch {
    return { items: cleanExpiredLocks(), isDemo: true };
  }
}

export function createTemporaryHold({ room_id, check_in, check_out, guests }) {
  const nights = calculateNights(check_in, check_out);
  const cabin = CABINS_CATALOG.find((c) => c.id === Number(room_id));
  if (!cabin || nights <= 0) throw new Error("Datos de reserva inválidos.");
  if (Number(guests) > cabin.capacity) throw new Error(`Máximo ${cabin.capacity} huéspedes.`);
  if (hasDateOverlap(cabin.id, check_in, check_out)) {
    throw new Error("Esa cabaña acaba de ser tomada para esas fechas.");
  }

  const total = cabin.price_per_night * nights;
  const deposit = Math.round(total * DEPOSIT_PERCENT);

  const hold = {
    id: Date.now(),
    room_id: cabin.id,
    room_name: cabin.name,
    guest_name: "Reservando...",
    guest_phone: "",
    check_in,
    check_out,
    guests: Number(guests),
    nights,
    total_price: total,
    deposit_amount: deposit,
    balance_amount: total - deposit,
    status: "BLOQUEADA_TEMPORAL",
    expires_at: new Date(Date.now() + LOCK_MS).toISOString(),
  };

  writeBookings([hold, ...cleanExpiredLocks()]);
  return hold;
}

export async function confirmBookingFromHold(holdId, payload) {
  if (!payload.accepted_terms) {
    throw new Error("Debes aceptar las condiciones de reserva y privacidad.");
  }

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Sin backend");
    return { item: await res.json(), isDemo: false };
  } catch {
    const list = cleanExpiredLocks();
    const idx = list.findIndex((b) => b.id === holdId);
    if (idx === -1) throw new Error("El bloqueo de 15 minutos expiró.");

    const current = list[idx];
    if (hasDateOverlap(current.room_id, current.check_in, current.check_out, holdId)) {
      throw new Error("Las fechas ya no están disponibles.");
    }

    const updated = {
      ...current,
      guest_name: payload.guest_name.trim(),
      guest_phone: payload.guest_phone.trim(),
      status: "PENDIENTE_SENA",
      expires_at: null,
    };
    list[idx] = updated;
    writeBookings(list);
    return { item: updated, isDemo: true };
  }
}

export function updateBookingStatus(id, status) {
  const list = cleanExpiredLocks().map((b) => (b.id === id ? { ...b, status, expires_at: null } : b));
  writeBookings(list);
  return list;
}

export async function deleteBooking(id) {
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Sin backend");
    return { isDemo: false };
  } catch {
    writeBookings(cleanExpiredLocks().filter((b) => b.id !== id));
    return { isDemo: true };
  }
}

export function resetDemoBookings() {
  writeBookings([...INITIAL_BOOKINGS]);
  return [...INITIAL_BOOKINGS];
}

export function getBookingSummary() {
  const bookings = cleanExpiredLocks();
  return bookings.reduce(
    (acc, booking) => {
      acc.totalCount += 1;
      if (booking.status === "CONFIRMADA") {
        acc.confirmedCount += 1;
        acc.confirmedRevenue += Number(booking.total_price || 0);
      } else if (booking.status === "PENDIENTE_SENA") {
        acc.pendingDepositCount += 1;
        acc.pendingDepositAmount += Number(booking.deposit_amount || 0);
      }
      return acc;
    },
    {
      totalCount: 0,
      confirmedCount: 0,
      confirmedRevenue: 0,
      pendingDepositCount: 0,
      pendingDepositAmount: 0,
    }
  );
}
