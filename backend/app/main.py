import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import Building, CampusAnnouncement, Classroom, CourseSchedule, MapAlert
from app.routing.astar import compute_pedestrian_route, find_nearest_node, haversine_m
from app.schemas import (
    AnnouncementSchema,
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
    MapAlertSchema,
    RouteRequest,
    RouteResponse,
    SearchResponse,
    SearchResultItem,
)
from app.seed import GRAPH_PATH, load_walk_graph, seed_database
import json


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


@app.post("/api/route", response_model=RouteResponse)
def calculate_route(req: RouteRequest, db: Session = Depends(get_db)) -> RouteResponse:
    init_db()
    graph = load_walk_graph()

    target_lat = req.target_lat
    target_lon = req.target_lon
    target_node_id = None
    target_entrance_name = "Seçilen Kampüs Noktası"

    if req.target_building_id:
        b = db.query(Building).filter(Building.id == req.target_building_id).first()
        if not b:
            raise HTTPException(status_code=404, detail="Hedef bina bulunamadı.")
        target_lat = b.entrance_lat
        target_lon = b.entrance_lon
        target_node_id = b.entrance_node_id
        target_entrance_name = b.entrance_name

    if target_lat is None or target_lon is None:
        raise HTTPException(status_code=422, detail="Hedef bina veya koordinat belirtilmelidir.")

    active_closures = (
        db.query(MapAlert)
        .filter(MapAlert.status == "active", MapAlert.blocks_route == True)  # noqa: E712
        .all()
    )
    blocked_edges = {a.edge_id for a in active_closures if a.edge_id}

    result = compute_pedestrian_route(
        graph=graph,
        start_lat=req.start_lat,
        start_lon=req.start_lon,
        target_lat=target_lat,
        target_lon=target_lon,
        blocked_edges=blocked_edges,
        target_node_id=target_node_id,
        target_entrance_name=target_entrance_name,
    )
    return RouteResponse(**result)


@app.post("/api/admin/edges/toggle")
def toggle_walkway_edge(req: EdgeToggleRequest, db: Session = Depends(get_db)) -> dict:
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
) -> BuildingSchema:
    init_db()
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bina bulunamadı.")

    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}
    nearest_nid = find_nearest_node(nodes_map, req.entrance_lat, req.entrance_lon)
    snapped_node = nodes_map[nearest_nid]

    b.entrance_node_id = nearest_nid
    b.entrance_lat = snapped_node["lat"]
    b.entrance_lon = snapped_node["lon"]
    if req.entrance_name:
        b.entrance_name = req.entrance_name
    db.commit()
    db.refresh(b)
    return BuildingSchema.model_validate(b)


@app.post("/api/admin/buildings", response_model=BuildingSchema)
def create_or_update_building(req: BuildingCreateOrUpdate, db: Session = Depends(get_db)) -> BuildingSchema:
    init_db()
    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}
    ent_lat = req.entrance_lat if req.entrance_lat is not None else req.lat
    ent_lon = req.entrance_lon if req.entrance_lon is not None else req.lon
    nearest_nid = find_nearest_node(nodes_map, ent_lat, ent_lon)
    snapped_node = nodes_map[nearest_nid]

    d = 0.00024
    default_poly = [[[req.lon - d, req.lat - d], [req.lon + d, req.lat - d], [req.lon + d, req.lat + d], [req.lon - d, req.lat + d], [req.lon - d, req.lat - d]]]

    b = db.query(Building).filter(Building.id == req.id).first()
    if b:
        b.code = req.code
        b.name = req.name
        b.category = req.category
        b.floors_count = req.floors_count
        b.lat = req.lat
        b.lon = req.lon
        b.entrance_node_id = nearest_nid
        b.entrance_lat = snapped_node["lat"]
        b.entrance_lon = snapped_node["lon"]
        b.entrance_name = req.entrance_name or f"{req.code} Ana Giriş Kapısı"
        if req.polygon_coords:
            b.polygon_coords = req.polygon_coords
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
            entrance_lat=snapped_node["lat"],
            entrance_lon=snapped_node["lon"],
            polygon_coords=req.polygon_coords or default_poly,
            description=req.description or f"{req.name} kampüs binası.",
        )
        db.add(b)
    db.commit()
    db.refresh(b)
    return BuildingSchema.model_validate(b)


@app.post("/api/admin/edges")
def create_custom_walkway_edge(req: CustomEdgeCreate) -> dict:
    graph = load_walk_graph()
    nodes_map = {n["id"]: n for n in graph.get("nodes", [])}
    u_id = find_nearest_node(nodes_map, req.from_lat, req.from_lon)
    v_id = find_nearest_node(nodes_map, req.to_lat, req.to_lon)
    if u_id == v_id:
        raise HTTPException(status_code=422, detail="Başlangıç ve bitiş düğümü aynı olamaz.")
    u_node, v_node = nodes_map[u_id], nodes_map[v_id]
    length_m = round(haversine_m(u_node["lat"], u_node["lon"], v_node["lat"], v_node["lon"]), 1)
    new_edge_id = f"e_custom_{len(graph['edges']) + 1}"
    new_edge = {
        "id": new_edge_id,
        "name": req.name,
        "highway": "footway",
        "from_node": u_id,
        "to_node": v_id,
        "length_m": length_m,
    }
    graph["edges"].append(new_edge)
    GRAPH_PATH.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    return new_edge


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

    now_utc = datetime.now(timezone.utc)
    query_day = day if day is not None else now_utc.isoweekday()
    query_time = time if time is not None else now_utc.strftime("%H:%M")

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

    now_utc = datetime.now(timezone.utc)
    room.crowd_busy_until = now_utc + timedelta(minutes=90)
    room.crowd_busy_reason = req.reason
    room.crowd_report_count = (room.crowd_report_count or 0) + 1
    db.commit()
    db.refresh(room)

    return evaluate_room_status(room, now_utc.isoweekday(), now_utc.strftime("%H:%M"), now_utc)


@app.post("/api/classrooms/{classroom_id}/clear-busy", response_model=ClassroomStatusSchema)
def clear_classroom_busy(classroom_id: str, db: Session = Depends(get_db)) -> ClassroomStatusSchema:
    init_db()
    room = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Derslik/amfi bulunamadı.")

    now_utc = datetime.now(timezone.utc)
    room.crowd_busy_until = None
    room.crowd_busy_reason = None
    room.crowd_report_count = 0
    db.commit()
    db.refresh(room)

    return evaluate_room_status(room, now_utc.isoweekday(), now_utc.strftime("%H:%M"), now_utc)


@app.get("/api/search", response_model=SearchResponse)
def search_campus(q: str = "", db: Session = Depends(get_db)) -> SearchResponse:
    init_db()
    query_clean = (q or "").strip()
    if not query_clean:
        return SearchResponse(query="", results=[])

    q_lower = query_clean.lower()
    results: list[SearchResultItem] = []
    seen_keys: set[str] = set()

    # 1. Search by Course Code / Course Name (e.g. "CSE 101", "MATH 101")
    schedules = db.query(CourseSchedule).all()
    for s in schedules:
        if q_lower in s.course_code.lower() or q_lower in s.course_name.lower():
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

    # 2. Search by Building Code / Name
    buildings = db.query(Building).all()
    for b in buildings:
        if q_lower in b.code.lower() or q_lower in b.name.lower() or (b.description and q_lower in b.description.lower()):
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

    # 3. Search by Classroom / Amphitheater Name
    classrooms = db.query(Classroom).all()
    for r in classrooms:
        if q_lower in r.name.lower():
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
