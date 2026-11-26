# Reserva de Cabañas — MVP

Prototipo funcional de catálogo visual y flujo de reservas para cabañas, desarrollado como **MVP de portafolio** con foco en una interfaz clara, consulta de disponibilidad y persistencia en base de datos sin sobreingeniería.

## Alcance del MVP

- **Catálogo visual:** Listado de cabañas con fotos, precios, capacidad/huéspedes y selección de fechas de check-in y check-out.
- **Flujo de reserva:** Modal interactivo para registrar reservas y opción para reiniciar o probar el estado de demostración.
- **Respaldo de datos:** Soporta datos de prueba en frontend para visualizar la interfaz si el backend no está activo.
- **Persistencia:** Conexión entre la interfaz web, una API en FastAPI y una base de datos relacional en MySQL.

## Stack tecnológico

- **Frontend:** React + Vite
- **Backend:** FastAPI + Uvicorn (Python)
- **Base de datos:** MySQL
- **Control de versiones:** Git / GitHub

## Captura de pantalla

![Captura del MVP](docs/captura.png)

## Cómo ejecutarlo en local

### 1. Base de datos (MySQL)
- Asegúrate de tener el servicio de MySQL activo y creada la base de datos configurada para el proyecto.

### 2. Backend (FastAPI)
```bash
cd backend
uvicorn main:app --reload
