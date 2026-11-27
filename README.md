# Hotel Reserva & Automatización — MVP

MVP web para consulta de disponibilidad y gestión de reservas de alojamientos, construido con **React + Vite**, **FastAPI** y **MySQL**, pensado para demostraciones de producto y automatización de flujos.

## Demo interactiva

* **Aplicación en vivo (Modo Demo):** [https://hotel-reserva-mvp.vercel.app/](https://hotel-reserva-mvp.vercel.app/)
* **Persistencia sin servidor en la demo:** Cuando el backend local no está activo (como en el despliegue estático de Vercel), la aplicación opera en modo demostración usando `localStorage` del navegador. Las reservas creadas se conservan al recargar la página y pueden limpiarse con el botón **Reiniciar demo**.

## Arquitectura y stack

* **Frontend:** React, Vite, CSS modular.
* **Backend:** FastAPI (endpoints de disponibilidad, listado, creación y eliminación de reservas).
* **Base de datos:** MySQL (entorno local).
* **Automatización:** Integración planificada con `n8n` para notificaciones y flujos operativos.

## Ejecución local completa (Frontend + Backend + MySQL)

1. Levantar la base de datos MySQL y configurar las variables de entorno del backend.
2. Iniciar el servidor FastAPI (por defecto en `http://localhost:8000`).
3. En `frontend/`, ejecutar:
   ```bash
   npm install
   npm run dev
