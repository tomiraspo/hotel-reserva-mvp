import os
from datetime import date
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pymysql
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Hotel Reserva API")


def get_conn():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "hotel_mvp"),
        cursorclass=pymysql.cursors.DictCursor,
    )


class ReservaCreate(BaseModel):
    habitacion_id: int
    huesped_nombre: str
    huesped_whatsapp: str
    fecha_checkin: date
    fecha_checkout: date


def habitacion_disponible(conn, habitacion_id: int, checkin: date, checkout: date) -> bool:
    if checkout <= checkin:
        return False
    sql = """
        SELECT COUNT(*) AS choque
        FROM reservas
        WHERE habitacion_id = %s
          AND estado != 'cancelada'
          AND fecha_checkin < %s
          AND fecha_checkout > %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (habitacion_id, checkout, checkin))
        row = cur.fetchone()
        return row["choque"] == 0


@app.get("/disponibilidad")
def consultar_disponibilidad(checkin: date, checkout: date):
    if checkout <= checkin:
        raise HTTPException(status_code=400, detail="El check-out debe ser posterior al check-in")

    noches = (checkout - checkin).days
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM habitaciones WHERE activa = TRUE")
            habitaciones = cur.fetchall()

        libres = []
        for hab in habitaciones:
            if habitacion_disponible(conn, hab["id"], checkin, checkout):
                hab["noches"] = noches
                hab["total_estimado"] = round(float(hab["precio_noche"]) * noches, 2)
                libres.append(hab)

        return {"checkin": str(checkin), "checkout": str(checkout), "noches": noches, "disponibles": libres}
    finally:
        conn.close()


@app.post("/reservas")
def crear_reserva(datos: ReservaCreate):
    noches = (datos.fecha_checkout - datos.fecha_checkin).days
    if noches <= 0:
        raise HTTPException(status_code=400, detail="Rango de fechas inválido")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM habitaciones WHERE id = %s AND activa = TRUE", (datos.habitacion_id,))
            hab = cur.fetchone()
            if not hab:
                raise HTTPException(status_code=404, detail="Habitación no encontrada")

        if not habitacion_disponible(conn, datos.habitacion_id, datos.fecha_checkin, datos.fecha_checkout):
            raise HTTPException(status_code=409, detail="La habitación ya está reservada en esas fechas")

        total = round(float(hab["precio_noche"]) * noches, 2)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reservas
                (habitacion_id, huesped_nombre, huesped_whatsapp, fecha_checkin, fecha_checkout, total_estimado, estado)
                VALUES (%s, %s, %s, %s, %s, %s, 'confirmada')
                """,
                (
                    datos.habitacion_id,
                    datos.huesped_nombre,
                    datos.huesped_whatsapp,
                    datos.fecha_checkin,
                    datos.fecha_checkout,
                    total,
                ),
            )
            conn.commit()
            reserva_id = cur.lastrowid

        return {
            "id": reserva_id,
            "habitacion": hab["nombre"],
            "noches": noches,
            "total_estimado": total,
            "estado": "confirmada",
        }
    finally:
        conn.close()