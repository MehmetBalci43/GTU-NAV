from collections import defaultdict
import json
import math
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, text
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.ai.ticket_classifier import analyze_written_ticket, get_or_load_model
from app.config import settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import Building, CampusAnnouncement, Classroom, CourseSchedule, MapAlert, User, WrittenTicket
from app.routing.astar import compute_pedestrian_route, find_nearest_edge, find_nearest_node, haversine_m
from app.schemas import (
    AnnouncementCreate,
    AnnouncementSchema,
    AuthLoginRequest,
    BootstrapResponse,
    BuildingCreateOrUpdate,
    BuildingEntranceUpdate,
    BuildingRoomsResponse,
    BuildingSchema,
    BusyReportRequest,
    ClassroomStatusSchema,
    CourseScheduleSchema,
    CustomEdgeCreate,
    EdgeToggleRequest,
    FootprintDeleteRequest,
    FootprintUpdateRequest,
    MapAlertCreate,
    MapAlertSchema,
    MapAlertVoteRequest,
    RouteRequest,
    RouteResponse,
    SearchResponse,
    SearchResultItem,
    TicketAnalyzeRequest,
    TicketAnalyzeResponse,
    WrittenTicketCreate,
    WrittenTicketSchema,
    WrittenTicketUpdate,
)
from app.seed import load_walk_graph, save_walk_graph, seed_database, sync_buildings_to_json

_DB_INITIALIZED: bool = False


def init_db() -> None:
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for col_sql in (
            "ALTER TABLE buildings ADD COLUMN secondary_entrance_node_id VARCHAR(64)",
            "ALTER TABLE buildings ADD COLUMN secondary_entrance_name VARCHAR(100)",
            "ALTER TABLE buildings ADD COLUMN secondary_entrance_lat FLOAT",
            "ALTER TABLE buildings ADD COLUMN secondary_entrance_lon FLOAT",
        ):
            try:
                conn.execute(text(col_sql))
            except Exception:
                pass
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    get_or_load_model()
    _DB_INITIALIZED = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


TR_TZ = timezone(timedelta(hours=3))
_ALERT_VOTERS: dict[int, set[str]] = defaultdict(set)


def verify_admin_key(x_admin_key: str | None = Header(default=None)) -> str:
    if not x_admin_key or x_admin_key != settings.admin_secret_key:
        raise HTTPException(
            status_code=403,
            detail="Bu işlem için geçerli yönetici anahtarı (X-Admin-Key) gereklidir.",
        )
    return x_admin_key


app = FastAPI(
    title="GTÜ-NAV Kampüs Navigasyon ve Akıllı Yaşam API",
    description="Gebze Teknik Üniversitesi Yaya Navigasyonu, Boş Amfi Radarı ve Yerel AI Destekli Kampüs Bildirim Sistemi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def is_room_crowd_busy(room: Classroom, now_utc: datetime) -> bool:
    if not room.crowd_busy_until:
        return False
    busy_until = room.crowd_busy_until
    if busy_until.tzinfo is None:
        busy_until = busy_until.replace(tzinfo=timezone.utc)
    return busy_until > now_utc


def evaluate_room_status(room: Classroom, day: int, time_str: str, now_utc: datetime) -> ClassroomStatusSchema:
    crowd_busy = is_room_crowd_busy(room, now_utc)
    day_schedules = sorted(
        [s for s in room.schedules if s.day_of_week == day],
        key=lambda x: x.start_time,
    )

    current_course: CourseSchedule | None = None
    next_course: CourseSchedule | None = None

    if day in (1, 2, 3, 4, 5):
        for s in day_schedules:
            if s.start_time <= time_str < s.end_time:
                current_course = s
            elif s.start_time > time_str and next_course is None:
                next_course = s

    is_free = (current_course is None) and (not crowd_busy)
    free_until = None
    if is_free:
        free_until = next_course.start_time if next_course else "Gün Boyu Boş"

    return ClassroomStatusSchema(
        id=room.id,
        building_id=room.building_id,
        name=room.name,
        floor=room.floor,
        capacity=room.capacity,
        room_type=room.room_type,
        has_outlets=room.has_outlets,
        is_currently_free=is_free,
        free_until=free_until,
        current_course_code=current_course.course_code if current_course else None,
        current_course_name=current_course.course_name if current_course else None,
        current_course_ends_at=current_course.end_time if current_course else None,
        next_course_code=next_course.course_code if next_course else None,
        next_course_starts_at=next_course.start_time if next_course else None,
        is_crowd_busy=crowd_busy,
        crowd_busy_reason=room.crowd_busy_reason if crowd_busy else None,
        crowd_report_count=room.crowd_report_count if crowd_busy else 0,
        schedules=[CourseScheduleSchema.model_validate(s) for s in room.schedules],
    )


@app.get("/health")
def health_check() -> dict:
    init_db()
    bundle = get_or_load_model()
    return {
        "status": "healthy",
        "service": "gtu-nav-backend",
        "database": "connected",
        "ai_model_loaded": bundle is not None,
        "version": "1.0.0",
    }


@app.post("/api/auth/login")
def login_user(req: AuthLoginRequest, db: Session = Depends(get_db)) -> dict:
    init_db()
    email = (req.email or "ogrenci@gtu.edu.tr").strip().lower()
    if not (email.endswith("@gtu.edu.tr") or email.endswith("@ogrenci.gtu.edu.tr")):
        raise HTTPException(
            status_code=403,
            detail="Sadece @gtu.edu.tr uzantılı kurumsal e-posta adresleri kabul edilmektedir.",
        )

    role = req.role if req.role in ("student", "admin") else ("admin" if email.startswith("admin") else "student")
    if role == "admin":
        if req.admin_key != settings.admin_secret_key:
            raise HTTPException(
                status_code=403,
                detail="Yönetici (LiveOps) girişi için geçerli yönetici anahtarı gereklidir.",
            )

    user = db.query(User).filter(User.email == email).first()
    if user and user.is_banned:
        raise HTTPException(
            status_code=403,
            detail="Bu hesap kampüs bildirim kurallarını ihlal ettiği için kısıtlanmıştır.",
        )

    if not user:
        user = User(
            email=email,
            full_name="GTÜ Kampüs Yöneticisi" if role == "admin" else "GTÜ Öğrencisi",
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif req.role in ("student", "admin"):
        user.role = req.role
        db.commit()

    payload = {
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "token": f"gtunav_demo_token_{user.role}",
    }
    if user.role == "admin":
        payload["admin_key"] = settings.admin_secret_key
    return payload


@app.get("/api/campus/bootstrap", response_model=BootstrapResponse)
def get_campus_bootstrap(
    day: int | None = None,
    time: str | None = None,
    db: Session = Depends(get_db),
) -> BootstrapResponse:
    init_db()
    now_tr = datetime.now(TR_TZ)
    now_utc = now_tr.astimezone(timezone.utc)
    query_day = day if day is not None else now_tr.isoweekday()
    query_time = time if time is not None else now_tr.strftime("%H:%M")

    buildings = db.query(Building).all()
    building_schemas: list[BuildingSchema] = []

    for b in buildings:
        total_rooms = len(b.classrooms)
        free_rooms = sum(
            1 for r in b.classrooms if evaluate_room_status(r, query_day, query_time, now_utc).is_currently_free
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


def _extract_building_rings(polygon_coords: list | None) -> list[list[list[float]]]:
    if not polygon_coords or not isinstance(polygon_coords, list):
        return []
    try:
        first = polygon_coords[0][0][0]
        if isinstance(first, (int, float)):
            return polygon_coords  # Polygon: [ring, ...]
        if isinstance(first, list):
            return [ring for poly in polygon_coords if isinstance(poly, list) for ring in poly]
    except (IndexError, TypeError):
        pass
    return []


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = float(ring[i][0]), float(ring[i][1])
        xj, yj = float(ring[j][0]), float(ring[j][1])
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def _find_containing_building(
    db: Session, lat: float, lon: float, exclude_building_id: str | None = None
) -> Building | None:
    buildings = db.query(Building).all()
    # 1. Exact polygon footprint containment check
    for b in buildings:
        if exclude_building_id and b.id == exclude_building_id:
            continue
        for ring in _extract_building_rings(b.polygon_coords):
            if _point_in_ring(lon, lat, ring):
                return b

    # 2. Indoor GPS drift proximity tolerance (within 25m of building center)
    nearest_b = None
    min_dist = float("inf")
    for b in buildings:
        if exclude_building_id and b.id == exclude_building_id:
            continue
        dist = haversine_m(lat, lon, b.lat, b.lon)
        if dist < min_dist:
            min_dist = dist
            nearest_b = b

    if nearest_b is not None and min_dist <= 25.0:
        return nearest_b

    return None


@app.post("/api/route", response_model=RouteResponse)
def calculate_route(req: RouteRequest, db: Session = Depends(get_db)) -> RouteResponse:
    init_db()
    graph = load_walk_graph()

    active_closures = (
        db.query(MapAlert)
        .filter(MapAlert.status == "active", MapAlert.blocks_route == True)  # noqa: E712
        .all()
    )
    blocked_edges = {a.edge_id for a in active_closures if a.edge_id}

    # If the user starts inside a building polygon, snap start to that building's exit door(s)
    # so routes never cut through closed walls where there is no exit door.
    start_b = _find_containing_building(db, req.start_lat, req.start_lon, req.target_building_id)
    start_doors: list[tuple[float, float]] = [(req.start_lat, req.start_lon)]
    if start_b is not None:
        start_doors = [(start_b.entrance_lat, start_b.entrance_lon)]
        if start_b.secondary_entrance_lat is not None and start_b.secondary_entrance_lon is not None:
            start_doors.append((start_b.secondary_entrance_lat, start_b.secondary_entrance_lon))

    def _run_with_start_door(
        s_lat: float,
        s_lon: float,
        t_lat: float,
        t_lon: float,
        t_node_id: str | None,
        t_name: str,
    ) -> dict:
        res = compute_pedestrian_route(
            graph=graph,
            start_lat=s_lat,
            start_lon=s_lon,
            target_lat=t_lat,
            target_lon=t_lon,
            blocked_edges=blocked_edges,
            target_node_id=t_node_id,
            target_entrance_name=t_name,
        )
        if start_b is not None and res["coordinates"]:
            first_lon, first_lat = res["coordinates"][0]
            if haversine_m(s_lat, s_lon, first_lat, first_lon) > 1.0:
                res["coordinates"] = [[round(s_lon, 6), round(s_lat, 6)]] + res["coordinates"]
        return res

    if req.target_building_id:
        b = db.query(Building).filter(Building.id == req.target_building_id).first()
        if not b:
            raise HTTPException(status_code=404, detail="Hedef bina bulunamadı.")

        target_doors: list[tuple[float, float, str | None, str]] = [
            (b.entrance_lat, b.entrance_lon, b.entrance_node_id, b.entrance_name)
        ]
        if b.secondary_entrance_lat is not None and b.secondary_entrance_lon is not None:
            target_doors.append(
                (
                    b.secondary_entrance_lat,
                    b.secondary_entrance_lon,
                    b.secondary_entrance_node_id,
                    b.secondary_entrance_name or f"{b.code} 2. Giriş Kapısı",
                )
            )

        best_res: dict | None = None
        for s_lat, s_lon in start_doors:
            for t_lat, t_lon, t_node_id, t_name in target_doors:
                cand = _run_with_start_door(s_lat, s_lon, t_lat, t_lon, t_node_id, t_name)
                if best_res is None or cand["distance_m"] < best_res["distance_m"]:
                    best_res = cand

        if start_b is not None and best_res is not None and best_res.get("coordinates"):
            first_lon, first_lat = best_res["coordinates"][0]
            dist_to_door = haversine_m(req.start_lat, req.start_lon, first_lat, first_lon)
            if dist_to_door > 1.2:
                best_res["coordinates"] = [[round(req.start_lon, 6), round(req.start_lat, 6)]] + best_res["coordinates"]
                best_res["distance_m"] = round(best_res["distance_m"] + dist_to_door, 1)
                best_res["duration_min"] = max(1, math.ceil(best_res["distance_m"] / 80.0))

        return RouteResponse(**best_res)

    if req.target_lat is None or req.target_lon is None:
        raise HTTPException(status_code=422, detail="Hedef bina veya koordinat belirtilmelidir.")

    best_custom: dict | None = None
    for s_lat, s_lon in start_doors:
        cand = _run_with_start_door(
            s_lat, s_lon, req.target_lat, req.target_lon, None, "Seçilen Kampüs Noktası"
        )
        if best_custom is None or cand["distance_m"] < best_custom["distance_m"]:
            best_custom = cand

    if start_b is not None and best_custom is not None and best_custom.get("coordinates"):
        first_lon, first_lat = best_custom["coordinates"][0]
        dist_to_door = haversine_m(req.start_lat, req.start_lon, first_lat, first_lon)
        if dist_to_door > 1.2:
            best_custom["coordinates"] = [[round(req.start_lon, 6), round(req.start_lat, 6)]] + best_custom["coordinates"]
            best_custom["distance_m"] = round(best_custom["distance_m"] + dist_to_door, 1)
            best_custom["duration_min"] = max(1, math.ceil(best_custom["distance_m"] / 80.0))

    return RouteResponse(**best_custom)


@app.post("/api/alerts", response_model=MapAlertSchema)
def create_map_alert(req: MapAlertCreate, db: Session = Depends(get_db)) -> MapAlertSchema:
    init_db()
    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}

    edge_id = req.edge_id
    blocks_route = req.blocks_route or (req.alert_type == "road_work")

    # If road_work is reported without an explicit edge_id, snap to nearest walkway edge via orthogonal projection
    if blocks_route and not edge_id:
        edge_id = find_nearest_edge(graph, req.lat, req.lon)

    default_titles = {
        "road_work": "Yol Çalışması / Geçici Kapalı Patika",
        "puddle_ice": "Su Birikintisi / Kaygan Zemin",
        "lighting_fault": "Aydınlatma Arızası / Karanlık Yol",
        "event_stand": "Kampüs Etkinliği / Topluluk Standı",
        "custom_poi": "Kampüs Bilgi Noktası",
    }
    title = req.title or default_titles.get(req.alert_type, "Kampüs Harita Uyarısı")

    alert = MapAlert(
        alert_type=req.alert_type,
        title=title,
        edge_id=edge_id,
        blocks_route=blocks_route,
        lat=req.lat,
        lon=req.lon,
        upvotes=1,
        downvotes=0,
        is_admin_verified=req.is_admin_verified,
        status="active",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return MapAlertSchema.model_validate(alert)


@app.post("/api/alerts/{alert_id}/vote", response_model=MapAlertSchema)
def vote_map_alert(alert_id: int, req: MapAlertVoteRequest, db: Session = Depends(get_db)) -> MapAlertSchema:
    init_db()
    alert = db.query(MapAlert).filter(MapAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Harita uyarısı bulunamadı.")

    voter_key = (req.voter_id or "anon_client").strip()
    if voter_key in _ALERT_VOTERS[alert_id]:
        return MapAlertSchema.model_validate(alert)
    _ALERT_VOTERS[alert_id].add(voter_key)

    if req.vote == "up":
        alert.upvotes += 1
    else:
        alert.downvotes += 1
        if alert.downvotes >= 3 and not alert.is_admin_verified:
            alert.status = "resolved"

    db.commit()
    db.refresh(alert)
    return MapAlertSchema.model_validate(alert)


@app.delete("/api/admin/alerts/{alert_id}")
def delete_map_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> dict:
    init_db()
    alert = db.query(MapAlert).filter(MapAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Harita uyarısı bulunamadı.")
    alert.status = "resolved"
    db.commit()
    return {"id": alert_id, "status": "resolved"}


@app.post("/api/tickets/analyze", response_model=TicketAnalyzeResponse)
def preview_analyze_ticket(req: TicketAnalyzeRequest) -> TicketAnalyzeResponse:
    res = analyze_written_ticket(
        title=req.title,
        description=req.description,
        category=req.category,
    )
    return TicketAnalyzeResponse(**res)


@app.post("/api/tickets", response_model=WrittenTicketSchema)
def create_written_ticket(req: WrittenTicketCreate, db: Session = Depends(get_db)) -> WrittenTicketSchema:
    init_db()
    ai_res = analyze_written_ticket(
        title=req.title,
        description=req.description,
        category=req.category,
    )

    assigned_department = ai_res["ai_department"]
    if req.confirmed_department and not ai_res["ai_is_spam"]:
        assigned_department = req.confirmed_department

    lat = req.lat
    lon = req.lon
    if (lat is None or lon is None) and req.building_id:
        b = db.query(Building).filter(Building.id == req.building_id).first()
        if b:
            lat = b.lat
            lon = b.lon

    ticket = WrittenTicket(
        reporter_email=req.reporter_email,
        building_id=req.building_id,
        classroom_id=req.classroom_id,
        category=req.category,
        title=req.title,
        description=req.description,
        lat=lat,
        lon=lon,
        ai_department=assigned_department,
        ai_urgency_score=ai_res["ai_urgency_score"],
        ai_priority_label=ai_res["ai_priority_label"],
        ai_is_spam=ai_res["ai_is_spam"],
        status="pending",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return WrittenTicketSchema.model_validate(ticket)


@app.get("/api/tickets", response_model=list[WrittenTicketSchema])
def list_written_tickets(
    reporter_email: str | None = None,
    include_spam: bool = True,
    db: Session = Depends(get_db),
) -> list[WrittenTicketSchema]:
    init_db()
    q = db.query(WrittenTicket)
    if reporter_email:
        q = q.filter(WrittenTicket.reporter_email == reporter_email)
    if not include_spam:
        q = q.filter(WrittenTicket.ai_is_spam == False)  # noqa: E712

    tickets = q.order_by(WrittenTicket.ai_urgency_score.desc(), WrittenTicket.created_at.desc()).all()
    return [WrittenTicketSchema.model_validate(t) for t in tickets]


@app.patch("/api/admin/tickets/{ticket_id}", response_model=WrittenTicketSchema)
def update_written_ticket_status(
    ticket_id: int,
    req: WrittenTicketUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> WrittenTicketSchema:
    init_db()
    ticket = db.query(WrittenTicket).filter(WrittenTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket bulunamadı.")

    ticket.status = req.status
    if req.admin_note is not None:
        ticket.admin_note = req.admin_note
    db.commit()
    db.refresh(ticket)
    return WrittenTicketSchema.model_validate(ticket)


@app.post("/api/admin/edges/toggle")
def toggle_walkway_edge(
    req: EdgeToggleRequest,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> dict:
    init_db()
    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}
    edge_obj = next((e for e in graph.get("edges", []) if e["id"] == req.edge_id), None)
    if not edge_obj:
        raise HTTPException(status_code=404, detail="Yürüyüş yolu kenarı bulunamadı.")

    existing = (
        db.query(MapAlert)
        .filter(MapAlert.edge_id == req.edge_id, MapAlert.status == "active", MapAlert.blocks_route == True)  # noqa: E712
        .first()
    )

    if req.closed:
        if not existing:
            u_node = nodes_map.get(edge_obj["from_node"], {"lat": 40.808, "lon": 29.359})
            v_node = nodes_map.get(edge_obj["to_node"], {"lat": 40.808, "lon": 29.359})
            mid_lat = round((u_node["lat"] + v_node["lat"]) / 2, 6)
            mid_lon = round((u_node["lon"] + v_node["lon"]) / 2, 6)
            alert = MapAlert(
                alert_type="road_work",
                title=req.reason or "Yol Çalışması / Geçişe Kapalı",
                edge_id=req.edge_id,
                blocks_route=True,
                lat=mid_lat,
                lon=mid_lon,
                upvotes=5,
                downvotes=0,
                is_admin_verified=True,
                status="active",
            )
            db.add(alert)
            db.commit()
    else:
        if existing:
            existing.status = "resolved"
            db.commit()

    return {"edge_id": req.edge_id, "closed": req.closed}


@app.put("/api/admin/buildings/{building_id}/entrance", response_model=BuildingSchema)
def update_building_entrance(
    building_id: str,
    req: BuildingEntranceUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> BuildingSchema:
    init_db()
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bina bulunamadı.")

    if req.clear_secondary:
        b.secondary_entrance_node_id = None
        b.secondary_entrance_name = None
        b.secondary_entrance_lat = None
        b.secondary_entrance_lon = None
        db.commit()
        db.refresh(b)
        sync_buildings_to_json(db)
        return BuildingSchema.model_validate(b)

    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}
    nearest_nid = find_nearest_node(nodes_map, req.entrance_lat, req.entrance_lon)

    if req.entrance_slot == 2:
        b.secondary_entrance_node_id = nearest_nid
        b.secondary_entrance_lat = round(req.entrance_lat, 6)
        b.secondary_entrance_lon = round(req.entrance_lon, 6)
        b.secondary_entrance_name = req.entrance_name or f"{b.code} 2. Giriş Kapısı"
    else:
        b.entrance_node_id = nearest_nid
        b.entrance_lat = round(req.entrance_lat, 6)
        b.entrance_lon = round(req.entrance_lon, 6)
        if req.entrance_name:
            b.entrance_name = req.entrance_name

    db.commit()
    db.refresh(b)
    sync_buildings_to_json(db)
    return BuildingSchema.model_validate(b)


@app.post("/api/admin/buildings", response_model=BuildingSchema)
def create_or_update_building(
    req: BuildingCreateOrUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> BuildingSchema:
    init_db()
    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}
    ent_lat = round(req.entrance_lat if req.entrance_lat is not None else req.lat, 6)
    ent_lon = round(req.entrance_lon if req.entrance_lon is not None else req.lon, 6)
    nearest_nid = find_nearest_node(nodes_map, ent_lat, ent_lon)

    sec_nid = None
    sec_lat = None
    sec_lon = None
    sec_name = None
    if req.secondary_entrance_lat is not None and req.secondary_entrance_lon is not None:
        sec_nid = find_nearest_node(nodes_map, req.secondary_entrance_lat, req.secondary_entrance_lon)
        sec_lat = round(req.secondary_entrance_lat, 6)
        sec_lon = round(req.secondary_entrance_lon, 6)
        sec_name = req.secondary_entrance_name or f"{req.code} 2. Giriş Kapısı"

    d = 0.00024
    default_poly = [[[req.lon - d, req.lat - d], [req.lon + d, req.lat - d], [req.lon + d, req.lat + d], [req.lon - d, req.lat + d], [req.lon - d, req.lat - d]]]

    b = db.query(Building).filter(or_(Building.id == req.id, Building.code == req.code)).first()
    if b:
        b.code = req.code
        b.name = req.name
        b.category = req.category
        b.floors_count = req.floors_count
        b.lat = req.lat
        b.lon = req.lon
        b.entrance_node_id = nearest_nid
        b.entrance_lat = ent_lat
        b.entrance_lon = ent_lon
        b.entrance_name = req.entrance_name or f"{req.code} Ana Giriş Kapısı"
        if sec_nid is not None:
            b.secondary_entrance_node_id = sec_nid
            b.secondary_entrance_lat = sec_lat
            b.secondary_entrance_lon = sec_lon
            b.secondary_entrance_name = sec_name
        if req.polygon_coords:
            b.polygon_coords = req.polygon_coords
            flag_modified(b, "polygon_coords")
        if req.description is not None:
            b.description = req.description
    else:
        b = Building(
            id=req.id,
            code=req.code,
            name=req.name,
            category=req.category,
            floors_count=req.floors_count,
            lat=req.lat,
            lon=req.lon,
            entrance_node_id=nearest_nid,
            entrance_name=req.entrance_name or f"{req.code} Ana Giriş Kapısı",
            entrance_lat=ent_lat,
            entrance_lon=ent_lon,
            secondary_entrance_node_id=sec_nid,
            secondary_entrance_name=sec_name,
            secondary_entrance_lat=sec_lat,
            secondary_entrance_lon=sec_lon,
            polygon_coords=req.polygon_coords or default_poly,
            description=req.description or f"{req.name} kampüs binası.",
        )
        db.add(b)
    db.commit()
    db.refresh(b)
    sync_buildings_to_json(db)

    # Clean up chosen OSM footprints from walk graph to prevent double-rendering
    if req.osm_way_ids:
        way_id_set = set(req.osm_way_ids)
        if "extra_building_footprints" in graph:
            orig_len = len(graph["extra_building_footprints"])
            graph["extra_building_footprints"] = [
                fp for fp in graph["extra_building_footprints"]
                if fp.get("osm_way_id") not in way_id_set
            ]
            if len(graph["extra_building_footprints"]) != orig_len:
                save_walk_graph(graph)

    return BuildingSchema.model_validate(b)


@app.delete("/api/admin/buildings/{building_id}")
def delete_building(
    building_id: str,
    keep_footprint: bool = False,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> dict:
    init_db()
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bina bulunamadı.")

    # Restore building polygon blocks back to extra_building_footprints only if keep_footprint is requested
    try:
        poly = b.polygon_coords
        if keep_footprint and not building_id.startswith("test_") and poly and isinstance(poly, list) and len(poly) > 0:
            graph = load_walk_graph()
            extra_fps = graph.get("extra_building_footprints", [])
            is_multi = isinstance(poly[0][0][0], list)
            rings = [p[0] for p in poly if p and len(p) > 0] if is_multi else [poly[0]]
            base_way_id = int(datetime.now(timezone.utc).timestamp() * 100) % 900000000 + 100000000
            for idx, ring in enumerate(rings):
                if isinstance(ring, list) and len(ring) >= 3:
                    avg_lon = round(sum(pt[0] for pt in ring) / len(ring), 6)
                    avg_lat = round(sum(pt[1] for pt in ring) / len(ring), 6)
                    extra_fps.append({
                        "osm_way_id": base_way_id + idx,
                        "name": b.name or "Kampüs Ek Bina / Laboratuvar",
                        "coords": ring,
                        "lat": avg_lat,
                        "lon": avg_lon,
                    })
            graph["extra_building_footprints"] = extra_fps
            save_walk_graph(graph)
    except Exception:
        pass

    db.delete(b)
    db.commit()
    sync_buildings_to_json(db)
    return {"id": building_id, "deleted": True}


@app.post("/api/admin/footprints/delete")
def delete_extra_footprints(
    req: FootprintDeleteRequest,
    _: str = Depends(verify_admin_key),
) -> dict:
    init_db()
    graph = load_walk_graph()
    way_id_set = set(req.osm_way_ids)
    extra_fps = graph.get("extra_building_footprints", [])
    before_count = len(extra_fps)
    graph["extra_building_footprints"] = [
        fp for fp in extra_fps if fp.get("osm_way_id") not in way_id_set
    ]
    deleted_count = before_count - len(graph["extra_building_footprints"])
    if deleted_count > 0:
        save_walk_graph(graph)
    return {"deleted_count": deleted_count, "osm_way_ids": req.osm_way_ids}


@app.post("/api/admin/footprints/update")
def update_extra_footprints(
    req: FootprintUpdateRequest,
    _: str = Depends(verify_admin_key),
) -> dict:
    init_db()
    graph = load_walk_graph()
    extra_fps = graph.get("extra_building_footprints", [])
    fp_map = {fp.get("osm_way_id"): fp for fp in extra_fps if fp.get("osm_way_id") is not None}
    updated_count = 0

    for item in req.footprints:
        if not item.coords or len(item.coords) < 3:
            continue
        ring = item.coords
        n = len(ring) - 1 if (len(ring) > 3 and ring[0] == ring[-1]) else len(ring)
        avg_lon = round(sum(pt[0] for pt in ring[:n]) / max(1, n), 6)
        avg_lat = round(sum(pt[1] for pt in ring[:n]) / max(1, n), 6)

        if item.osm_way_id in fp_map:
            target = fp_map[item.osm_way_id]
            target["coords"] = ring
            target["lat"] = avg_lat
            target["lon"] = avg_lon
            if item.name:
                target["name"] = item.name
            updated_count += 1
        else:
            new_fp = {
                "osm_way_id": item.osm_way_id,
                "name": item.name or "Kampüs Ek Bina / Laboratuvar",
                "coords": ring,
                "lat": avg_lat,
                "lon": avg_lon,
            }
            extra_fps.append(new_fp)
            fp_map[item.osm_way_id] = new_fp
            updated_count += 1

    if updated_count > 0:
        graph["extra_building_footprints"] = extra_fps
        save_walk_graph(graph)

    return {
        "updated_count": updated_count,
        "osm_way_ids": [f.osm_way_id for f in req.footprints],
    }


@app.post("/api/admin/poi", response_model=MapAlertSchema)
def create_admin_poi(
    req: MapAlertCreate,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> MapAlertSchema:
    req.is_admin_verified = True
    return create_map_alert(req=req, db=db)


@app.post("/api/admin/edges")
def create_custom_walkway_edge(
    req: CustomEdgeCreate,
    _: str = Depends(verify_admin_key),
) -> dict:
    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}

    def _resolve_or_create_node(lat: float, lon: float, suffix: str) -> dict:
        nearest_id = find_nearest_node(nodes_map, lat, lon)
        nearest_node = nodes_map[nearest_id]
        dist_m = haversine_m(lat, lon, nearest_node["lat"], nearest_node["lon"])
        if dist_m <= 12.0:
            return nearest_node
        custom_id = f"osm_custom_{len(graph['nodes']) + 1}_{suffix}"
        new_node = {
            "id": custom_id,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "type": "walkway",
            "label": req.name,
        }
        graph["nodes"].append(new_node)
        nodes_map[custom_id] = new_node
        # Connect new custom node to nearest existing graph node so it's reachable in A*
        connector_len = round(dist_m, 1)
        graph["edges"].append(
            {
                "id": f"e_conn_{len(graph['edges']) + 1}",
                "name": f"{req.name} Bağlantısı",
                "highway": "footway",
                "from_node": nearest_id,
                "to_node": custom_id,
                "length_m": connector_len,
            }
        )
        return new_node

    u_node = _resolve_or_create_node(req.from_lat, req.from_lon, "a")
    v_node = _resolve_or_create_node(req.to_lat, req.to_lon, "b")
    if u_node["id"] == v_node["id"]:
        raise HTTPException(status_code=422, detail="Başlangıç ve bitiş düğümü aynı olamaz.")

    length_m = round(haversine_m(u_node["lat"], u_node["lon"], v_node["lat"], v_node["lon"]), 1)
    new_edge_id = f"e_custom_{len(graph['edges']) + 1}"
    new_edge = {
        "id": new_edge_id,
        "name": req.name,
        "highway": "footway",
        "from_node": u_node["id"],
        "to_node": v_node["id"],
        "length_m": length_m,
    }
    graph["edges"].append(new_edge)
    save_walk_graph(graph)
    return new_edge


@app.post("/api/admin/announcements", response_model=AnnouncementSchema)
def create_announcement(
    req: AnnouncementCreate,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> AnnouncementSchema:
    init_db()
    ann = CampusAnnouncement(
        title=req.title,
        message=req.message,
        severity=req.severity,
        is_active=True,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return AnnouncementSchema.model_validate(ann)


@app.delete("/api/admin/announcements/{announcement_id}")
def deactivate_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> dict:
    init_db()
    ann = db.query(CampusAnnouncement).filter(CampusAnnouncement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Duyuru bulunamadı.")
    ann.is_active = False
    db.commit()
    return {"id": announcement_id, "is_active": False}


@app.get("/api/buildings/{building_id}/rooms", response_model=BuildingRoomsResponse)
def get_building_rooms(
    building_id: str,
    day: int | None = None,
    time: str | None = None,
    db: Session = Depends(get_db),
) -> BuildingRoomsResponse:
    init_db()
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bina bulunamadı.")

    now_tr = datetime.now(TR_TZ)
    now_utc = now_tr.astimezone(timezone.utc)
    query_day = day if day is not None else now_tr.isoweekday()
    query_time = time if time is not None else now_tr.strftime("%H:%M")

    room_statuses = [
        evaluate_room_status(r, query_day, query_time, now_utc)
        for r in b.classrooms
    ]
    room_statuses.sort(key=lambda r: (not r.is_currently_free, r.floor, r.name))

    b_schema = BuildingSchema.model_validate(b)
    b_schema.total_rooms_count = len(room_statuses)
    b_schema.free_rooms_count = sum(1 for r in room_statuses if r.is_currently_free)

    return BuildingRoomsResponse(
        building=b_schema,
        query_day=query_day,
        query_time=query_time,
        rooms=room_statuses,
    )


@app.post("/api/classrooms/{classroom_id}/report-busy", response_model=ClassroomStatusSchema)
def report_classroom_busy(
    classroom_id: str,
    req: BusyReportRequest,
    db: Session = Depends(get_db),
) -> ClassroomStatusSchema:
    init_db()
    room = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Derslik/amfi bulunamadı.")

    now_tr = datetime.now(TR_TZ)
    now_utc = now_tr.astimezone(timezone.utc)
    room.crowd_busy_until = now_utc + timedelta(minutes=90)
    room.crowd_busy_reason = req.reason
    room.crowd_report_count = (room.crowd_report_count or 0) + 1
    db.commit()
    db.refresh(room)

    return evaluate_room_status(room, now_tr.isoweekday(), now_tr.strftime("%H:%M"), now_utc)


@app.post("/api/classrooms/{classroom_id}/clear-busy", response_model=ClassroomStatusSchema)
def clear_classroom_busy(
    classroom_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key),
) -> ClassroomStatusSchema:
    init_db()
    room = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Derslik/amfi bulunamadı.")

    now_tr = datetime.now(TR_TZ)
    now_utc = now_tr.astimezone(timezone.utc)
    room.crowd_busy_until = None
    room.crowd_busy_reason = None
    room.crowd_report_count = 0
    db.commit()
    db.refresh(room)

    return evaluate_room_status(room, now_tr.isoweekday(), now_tr.strftime("%H:%M"), now_utc)


@app.get("/api/search", response_model=SearchResponse)
def search_campus(q: str = "", db: Session = Depends(get_db)) -> SearchResponse:
    init_db()
    query_clean = (q or "").strip()
    if not query_clean:
        return SearchResponse(query="", results=[])

    pattern = f"%{query_clean}%"
    results: list[SearchResultItem] = []
    seen_keys: set[str] = set()

    schedules = (
        db.query(CourseSchedule)
        .filter(
            or_(
                CourseSchedule.course_code.ilike(pattern),
                CourseSchedule.course_name.ilike(pattern),
            )
        )
        .limit(20)
        .all()
    )
    for s in schedules:
        room = s.classroom
        bld = room.building
        key = f"course_{s.course_code}_{room.id}"
        if key in seen_keys:
            continue
        seen_keys.add(key)
        results.append(
            SearchResultItem(
                result_type="course",
                title=f"{s.course_code} — {s.course_name}",
                subtitle=f"{bld.name} • {room.name} ({s.start_time}-{s.end_time})",
                building_id=bld.id,
                building_code=bld.code,
                building_name=bld.name,
                classroom_id=room.id,
                entrance_lat=bld.entrance_lat,
                entrance_lon=bld.entrance_lon,
            )
        )

    buildings = (
        db.query(Building)
        .filter(
            or_(
                Building.code.ilike(pattern),
                Building.name.ilike(pattern),
                Building.description.ilike(pattern),
            )
        )
        .limit(15)
        .all()
    )
    for b in buildings:
        results.append(
            SearchResultItem(
                result_type="building",
                title=f"{b.code} — {b.name}",
                subtitle=b.entrance_name,
                building_id=b.id,
                building_code=b.code,
                building_name=b.name,
                classroom_id=None,
                entrance_lat=b.entrance_lat,
                entrance_lon=b.entrance_lon,
            )
        )

    classrooms = (
        db.query(Classroom)
        .filter(Classroom.name.ilike(pattern))
        .limit(15)
        .all()
    )
    for r in classrooms:
        b = r.building
        results.append(
            SearchResultItem(
                result_type="classroom",
                title=f"{r.name} ({b.code})",
                subtitle=f"{b.name} • Kat {r.floor} • {r.capacity} Kişilik",
                building_id=b.id,
                building_code=b.code,
                building_name=b.name,
                classroom_id=r.id,
                entrance_lat=b.entrance_lat,
                entrance_lon=b.entrance_lon,
            )
        )

    return SearchResponse(query=query_clean, results=results[:15])
