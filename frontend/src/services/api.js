const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const FALLBACK_ROOMS = [
  {
    id: 1,
    nombre: "Cabaña Bosque Nativo",
    descripcion: "Vista panorámica al bosque, deck privado, parrilla y hogar a leña.",
    capacidad: 4,
    precio_noche: 85,
    imagenes: [
      "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=900&q=80",
    ],
  },
  {
    id: 2,
    nombre: "Suite Lago Cristalino",
    descripcion: "Balcón privado frente al lago, hidromasaje y desayuno incluido.",
    capacidad: 2,
    precio_noche: 120,
    imagenes: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80",
    ],
  },
  {
    id: 3,
    nombre: "Loft Montaña & Piedra",
    descripcion: "Diseño moderno en dos plantas, cocina equipada y acceso directo a senderos.",
    capacidad: 6,
    precio_noche: 150,
    imagenes: [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=80",
    ],
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `Error HTTP ${response.status}`);
  }
  return data;
}

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/`);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function fetchAvailability({ checkIn, checkOut, guests }) {
  const params = new URLSearchParams({
    check_in: checkIn,
    check_out: checkOut,
    huespedes: String(guests),
  });
  const data = await request(`/disponibilidad?${params.toString()}`);
  const items = Array.isArray(data) ? data : data?.habitaciones || data?.disponibles || [];
  return items.map((item, idx) => {
    const fallback = FALLBACK_ROOMS[idx % FALLBACK_ROOMS.length];
    return {
      id: item.id ?? item.habitacion_id ?? fallback.id,
      nombre: item.nombre ?? item.tipo ?? fallback.nombre,
      descripcion: item.descripcion ?? fallback.descripcion,
      capacidad: item.capacidad ?? fallback.capacidad,
      precio_noche: Number(item.precio_noche ?? item.precio ?? fallback.precio_noche),
      disponible: item.disponible !== undefined ? Boolean(item.disponible) : true,
      imagenes: item.imagenes?.length ? item.imagenes : fallback.imagenes,
    };
  });
}

export async function fetchBookings() {
  const data = await request("/reservas");
  return Array.isArray(data) ? data : data?.reservas || [];
}

export async function createBooking(payload) {
  return await request("/reservas", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteBooking(bookingId) {
  return await request(`/reservas/${bookingId}`, { method: "DELETE" });
}

export async function resetDemoBookings() {
  return await request("/reservas/demo", { method: "DELETE" });
}
