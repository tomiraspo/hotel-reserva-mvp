const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const STORAGE_KEY = "cabanas_mvp_reservas_v2";
const LOCK_MINUTES = 15;
export const DEPOSIT_PERCENT = 0.3;

export const CABINS_CATALOG = [
  {
    id: 1,
    name: "Cabaña del Bosque",
    category: "Parejas",
    capacity: 2,
    price_per_night: 65000,
    description: "Monoambiente cálido en madera rodeado de pinos, galería privada y desayuno seco incluido.",
    amenities: ["2 huéspedes", "Wi-Fi fibra", "Parrilla individual", "Estacionamiento"],
    image: "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    name: "Cabaña del Lago",
    category: "Confort",
    capacity: 4,
    price_per_night: 92000,
    description: "Dos ambientes luminosos con deck panorámico hacia el espejo de agua y cocina equipada.",
    amenities: ["Hasta 4 huéspedes", "Deck con vista", "Cocina completa", "Aire frío/calor"],
    image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    name: "Cabaña Familiar Panorámica",
    category: "Grupos y Familias",
    capacity: 6,
    price_per_night: 128000,
    description: "Dos dormitorios independientes, amplio estar con hogar a leña, quincho y cochera cubierta.",
    amenities: ["Hasta 6 huéspedes", "2 dormitorios", "Quincho privado", "Cochera cubierta"],
    image: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    name: "Cabaña Premium Hidromasaje",
    category: "Experiencia Superior",
    capacity: 2,
    price_per_night: 145000,
    description: "Suite exclusiva con hidromasaje doble, vista abierta a las sierras y late check-out sujeto a disponibilidad.",
    amenities: ["2 huéspedes", "Hidromasaje doble", "Desayuno artesanal", "Ropa blanca premium"],
    image: "https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=900&q=80",
  },
];

function getTodayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

const INITIAL_DEMO_BOOKINGS = [
  {
    id: 101,
    room_id: 2,
    room_name: "Cabaña del Lago",
    guest_name: "Lucía Fernández",
    guest_email: "lucia.fernandez@ejemplo.com",
    guest_phone: "+54 9 3492 551122",
    check_in: getTodayOffset(3),
    check_out: getTodayOffset(6),
    guests: 3,
    nights: 3,
    total_price: 276000,
    deposit_amount: 82800,
    balance_amount: 193200,
    status: "CONFIRMADA",
    accepted_terms: true,
    created_at: new Date().toISOString(),
  },
];

function readLocalBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_BOOKINGS));
      return [...INITIAL_DEMO_BOOKINGS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

// Limpia bloqueos temporales vencidos (RN-03)
export function cleanExpiredLocks() {
  const now = Date.now();
  const bookings = readLocalBookings();
  const filtered = bookings.filter((b) => {
    if (b.status !== "BLOQUEADA_TEMPORAL") return true;
    return b.expires_at && new Date(b.expires_at).getTime() > now;
  });
  if (filtered.length !== bookings.length) {
    saveLocalBookings(filtered);
  }
  return filtered;
}

export function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

// RN-01 y RN-02: Verifica solapamiento estricto permitiendo turnaround (checkOut === checkIn)
export function hasDateOverlap(roomId, checkIn, checkOut, ignoreBookingId = null) {
  const activeBookings = cleanExpiredLocks().filter(
    (b) =>
      b.room_id === Number(roomId) &&
      b.id !== ignoreBookingId &&
      ["BLOQUEADA_TEMPORAL", "PENDIENTE_SENA", "CONFIRMADA"].includes(b.status)
  );

  return activeBookings.some((b) => checkIn < b.check_out && checkOut > b.check_in);
}

export async function getAvailability(checkIn, checkOut, guests = 1) {
  const nights = calculateNights(checkIn, checkOut);
  if (nights <= 0) {
    throw new Error("La fecha de salida debe ser posterior a la de ingreso.");
  }

  try {
    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
    });
    const res = await fetch(`${API_BASE}/rooms/availability?${params.toString()}`);
    if (!res.ok) throw new Error("API no disponible");
    const data = await res.json();
    return { items: data, isDemo: false };
  } catch {
    cleanExpiredLocks();
    const items = CABINS_CATALOG.map((cabin) => {
      const fitsGuests = cabin.capacity >= Number(guests);
      const isOccupied = hasDateOverlap(cabin.id, checkIn, checkOut);
      const totalPrice = cabin.price_per_night * nights;
      const depositAmount = Math.round(totalPrice * DEPOSIT_PERCENT);

      return {
        ...cabin,
        available: fitsGuests && !isOccupied,
        unavailable_reason: !fitsGuests
          ? `Capacidad máxima: ${cabin.capacity} huéspedes`
          : isOccupied
          ? "Ocupada o en proceso de reserva para estas fechas"
          : null,
        nights,
        total_price: totalPrice,
        deposit_amount: depositAmount,
        balance_amount: totalPrice - depositAmount,
      };
    });

    return { items, isDemo: true };
  }
}

export async function getBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    if (!res.ok) throw new Error("API no disponible");
    const data = await res.json();
    return { items: data, isDemo: false };
  } catch {
    return { items: cleanExpiredLocks(), isDemo: true };
  }
}

// RN-03: Inicia bloqueo temporal de 15 minutos antes de confirmar datos del huésped
export function createTemporaryHold({ room_id, check_in, check_out, guests }) {
  const nights = calculateNights(check_in, check_out);
  if (nights <= 0) {
    throw new Error("Rango de fechas inválido.");
  }

  const cabin = CABINS_CATALOG.find((c) => c.id === Number(room_id));
  if (!cabin) {
    throw new Error("La cabaña seleccionada no existe.");
  }

  if (Number(guests) > cabin.capacity) {
    throw new Error(`La ${cabin.name} admite hasta ${cabin.capacity} huéspedes.`);
  }

  if (hasDateOverlap(cabin.id, check_in, check_out)) {
    throw new Error("La cabaña acaba de ser tomada por otro usuario para esas fechas.");
  }

  const totalPrice = cabin.price_per_night * nights;
  const depositAmount = Math.round(totalPrice * DEPOSIT_PERCENT);
  const expiresAt = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();

  const holdRecord = {
    id: Date.now(),
    room_id: cabin.id,
    room_name: cabin.name,
    guest_name: "En proceso de reserva...",
    guest_email: "",
    guest_phone: "",
    check_in,
    check_out,
    guests: Number(guests),
    nights,
    total_price: totalPrice,
    deposit_amount: depositAmount,
    balance_amount: totalPrice - depositAmount,
    status: "BLOQUEADA_TEMPORAL",
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  const bookings = cleanExpiredLocks();
  saveLocalBookings([holdRecord, ...bookings]);
  return holdRecord;
}

export async function confirmBookingFromHold(holdId, payload) {
  if (!payload.accepted_terms) {
    throw new Error("Debes aceptar las políticas de reserva y privacidad de datos (Ley 25.326).");
  }

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("API no disponible");
    const data = await res.json();
    return { item: data, isDemo: false };
  } catch {
    const bookings = cleanExpiredLocks();
    const index = bookings.findIndex((b) => b.id === holdId);

    if (index === -1) {
      throw new Error("El tiempo de reserva (15 min) expiró. Vuelve a verificar disponibilidad.");
    }

    const current = bookings[index];
    if (hasDateOverlap(current.room_id, current.check_in, current.check_out, holdId)) {
      throw new Error("La disponibilidad cambió. Por favor selecciona otra fecha.");
    }

    const confirmed = {
      ...current,
      guest_name: payload.guest_name.trim(),
      guest_email: payload.guest_email.trim(),
      guest_phone: payload.guest_phone.trim(),
      notes: payload.notes?.trim() || "",
      accepted_terms: true,
      status: "PENDIENTE_SENA",
      expires_at: null,
    };

    bookings[index] = confirmed;
    saveLocalBookings(bookings);
    return { item: confirmed, isDemo: true };
  }
}

export function updateBookingStatus(bookingId, newStatus) {
  const bookings = cleanExpiredLocks();
  const updated = bookings.map((b) =>
    b.id === bookingId ? { ...b, status: newStatus, expires_at: null } : b
  );
  saveLocalBookings(updated);
  return updated;
}

export async function deleteBooking(bookingId) {
  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("API no disponible");
    return { isDemo: false };
  } catch {
    const bookings = cleanExpiredLocks().filter((b) => b.id !== bookingId);
    saveLocalBookings(bookings);
    return { isDemo: true };
  }
}

export function resetDemoBookings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_BOOKINGS));
  return [...INITIAL_DEMO_BOOKINGS];
}
