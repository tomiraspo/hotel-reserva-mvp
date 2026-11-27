# Sistema de Reservas para Complejo de Cabañas

Aplicación web para consultar disponibilidad, bloquear fechas temporalmente y gestionar reservas en un complejo de cabañas.

## Funcionalidades y reglas de negocio
- **Catálogo de cabañas:** 4 tipologías con capacidad máxima, categoría y tarifa por noche.
- **Control de disponibilidad:** validación de fechas (`check_in` / `check_out`), detección de solapamientos y filtro por cantidad de huéspedes.
- **Bloqueo temporal:** reserva transitoria de 15 minutos (`BLOQUEADA_TEMPORAL`) con limpieza automática de bloqueos vencidos.
- **Esquema financiero:** cálculo automático de noches, total de estadía, seña del 30% (`PENDIENTE_SENA`) y saldo restante.
- **Gestión de estados:** seguimiento de reservas confirmadas, pendientes de seña y cancelaciones/eliminaciones.

## Arquitectura
- **Frontend:** React + Vite.
- **Capa de servicios:** `frontend/src/services/api.js` (intenta consumir `VITE_API_URL` y usa persistencia local como respaldo de demostración).
- **Despliegue:** configurado para build de producción en Vercel.

## Ejecución local
```bash
cd frontend
npm install
npm run dev
