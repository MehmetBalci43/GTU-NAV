import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import Building, CampusAnnouncement, Classroom, CourseSchedule, MapAlert
from app.schemas import AnnouncementSchema, BootstrapResponse, BuildingSchema, MapAlertSchema
from app.seed import load_walk_graph, seed_database


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="GTÜ-NAV Kampüs Navigasyon ve Akıllı Yaşam API",
    description="Gebze Teknik Üniversitesi Yaya Navigasyonu, Boş Amfi Radarı ve Yerel AI Destekli Kampüs Bildirim Sistemi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def is_room_currently_free(room: Classroom, day: int, time_str: str, now_utc: datetime) -> bool:
    if room.crowd_busy_until:
        busy_until = room.crowd_busy_until
        if busy_until.tzinfo is None:
            busy_until = busy_until.replace(tzinfo=timezone.utc)
        if busy_until > now_utc:
            return False

    if day in (6, 7):
        return True

    for sched in room.schedules:
        if sched.day_of_week == day and sched.start_time <= time_str < sched.end_time:
            return False
    return True


@app.get("/health")
def health_check() -> dict:
    init_db()
    model_exists = os.path.exists(settings.ai_model_path)
    return {
        "status": "healthy",
        "service": "gtu-nav-backend",
        "database": "connected",
        "ai_model_loaded": model_exists,
        "version": "1.0.0",
    }


@app.get("/api/campus/bootstrap", response_model=BootstrapResponse)
def get_campus_bootstrap(
    day: int | None = None,
    time: str | None = None,
    db: Session = Depends(get_db),
) -> BootstrapResponse:
    init_db()
    now_utc = datetime.now(timezone.utc)
    query_day = day if day is not None else now_utc.isoweekday()
    query_time = time if time is not None else now_utc.strftime("%H:%M")

    buildings = db.query(Building).all()
    building_schemas: list[BuildingSchema] = []

    for b in buildings:
        total_rooms = len(b.classrooms)
        free_rooms = sum(
            1 for r in b.classrooms if is_room_currently_free(r, query_day, query_time, now_utc)
        )
        b_schema = BuildingSchema.model_validate(b)
        b_schema.total_rooms_count = total_rooms
        b_schema.free_rooms_count = free_rooms
        building_schemas.append(b_schema)

    active_alerts = (
        db.query(MapAlert)
        .filter(MapAlert.status == "active")
        .order_by(MapAlert.created_at.desc())
        .all()
    )
    blocked_edge_ids = [
        a.edge_id for a in active_alerts if a.blocks_route and a.edge_id is not None
    ]

    announcements = (
        db.query(CampusAnnouncement)
        .filter(CampusAnnouncement.is_active == True)  # noqa: E712
        .order_by(CampusAnnouncement.created_at.desc())
        .all()
    )

    return BootstrapResponse(
        buildings=building_schemas,
        walk_graph=load_walk_graph(),
        active_alerts=[MapAlertSchema.model_validate(a) for a in active_alerts],
        blocked_edge_ids=blocked_edge_ids,
        announcements=[AnnouncementSchema.model_validate(an) for an in announcements],
    )
