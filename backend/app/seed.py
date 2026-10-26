import json
from pathlib import Path
from sqlalchemy.orm import Session
from app.models import Building, CampusAnnouncement, Classroom, CourseSchedule, MapAlert, User, WrittenTicket

DATA_DIR = Path(__file__).parent / "data"
GRAPH_PATH = DATA_DIR / "gtu_walk_graph.json"
BUILDINGS_PATH = DATA_DIR / "gtu_buildings.json"

_WALK_GRAPH_CACHE: dict | None = None


def load_walk_graph() -> dict:
    global _WALK_GRAPH_CACHE
    if _WALK_GRAPH_CACHE is None:
        with open(GRAPH_PATH, "r", encoding="utf-8") as f:
            _WALK_GRAPH_CACHE = json.load(f)
    return _WALK_GRAPH_CACHE


def save_walk_graph(graph: dict) -> None:
    global _WALK_GRAPH_CACHE
    _WALK_GRAPH_CACHE = graph
    GRAPH_PATH.write_text(
        json.dumps(graph, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_buildings_data() -> list[dict]:
    with open(BUILDINGS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def sync_buildings_to_json(db: Session) -> None:
    """
    Persists current SQLite Building records back to gtu_buildings.json
    while preserving osm_way_id metadata from existing records.
    """
    existing_way_ids: dict[str, int] = {}
    if BUILDINGS_PATH.exists():
        try:
            for item in load_buildings_data():
                if "id" in item and "osm_way_id" in item:
                    existing_way_ids[item["id"]] = item["osm_way_id"]
        except Exception:
            pass

    all_buildings = db.query(Building).all()
    serialized: list[dict] = []
    for b in all_buildings:
        entry: dict = {
            "id": b.id,
            "code": b.code,
            "name": b.name,
            "category": b.category,
            "floors_count": b.floors_count,
        }
        if b.id in existing_way_ids:
            entry["osm_way_id"] = existing_way_ids[b.id]
        entry.update(
            {
                "entrance_name": b.entrance_name,
                "description": b.description,
                "lat": b.lat,
                "lon": b.lon,
                "polygon_coords": b.polygon_coords,
                "entrance_node_id": b.entrance_node_id,
                "entrance_lat": b.entrance_lat,
                "entrance_lon": b.entrance_lon,
                "secondary_entrance_node_id": b.secondary_entrance_node_id,
                "secondary_entrance_name": b.secondary_entrance_name,
                "secondary_entrance_lat": b.secondary_entrance_lat,
                "secondary_entrance_lon": b.secondary_entrance_lon,
            }
        )
        serialized.append(entry)

    BUILDINGS_PATH.write_text(
        json.dumps(serialized, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def seed_database(db: Session) -> None:
    raw_buildings = load_buildings_data()
    if db.query(Building).count() > 0:
        existing_ids = {row[0] for row in db.query(Building.id).all()}
        added_any = False
        for b in raw_buildings:
            if b["id"] not in existing_ids:
                db.add(
                    Building(
                        id=b["id"],
                        code=b["code"],
                        name=b["name"],
                        category=b["category"],
                        floors_count=b["floors_count"],
                        lat=b["lat"],
                        lon=b["lon"],
                        entrance_node_id=b["entrance_node_id"],
                        entrance_name=b["entrance_name"],
                        entrance_lat=b["entrance_lat"],
                        entrance_lon=b["entrance_lon"],
                        secondary_entrance_node_id=b.get("secondary_entrance_node_id"),
                        secondary_entrance_name=b.get("secondary_entrance_name"),
                        secondary_entrance_lat=b.get("secondary_entrance_lat"),
                        secondary_entrance_lon=b.get("secondary_entrance_lon"),
                        polygon_coords=b["polygon_coords"],
                        description=b.get("description", ""),
                    )
                )
                added_any = True
        if added_any:
            db.commit()
        return

    # 1. Demo Kullanıcılar
    db.add_all([
        User(email="ogrenci@gtu.edu.tr", full_name="Ahmet Yılmaz (Demo Öğrenci)", role="student"),
        User(email="admin@gtu.edu.tr", full_name="GTÜ Kampüs İdare (Demo Admin)", role="admin"),
    ])

    # 2. GTÜ Kampüs Binaları
    buildings = [
        Building(
            id=b["id"],
            code=b["code"],
            name=b["name"],
            category=b["category"],
            floors_count=b["floors_count"],
            lat=b["lat"],
            lon=b["lon"],
            entrance_node_id=b["entrance_node_id"],
            entrance_name=b["entrance_name"],
            entrance_lat=b["entrance_lat"],
            entrance_lon=b["entrance_lon"],
            secondary_entrance_node_id=b.get("secondary_entrance_node_id"),
            secondary_entrance_name=b.get("secondary_entrance_name"),
            secondary_entrance_lat=b.get("secondary_entrance_lat"),
            secondary_entrance_lon=b.get("secondary_entrance_lon"),
            polygon_coords=b["polygon_coords"],
            description=b["description"],
        )
        for b in raw_buildings
    ]
    db.add_all(buildings)
    db.flush()

    # 3. Derslikler ve Amfiler
    classrooms = [
        # Bilgisayar Mühendisliği (BMB)
        Classroom(id="bmb_amfi_1", building_id="bmb", name="BMB Amfi 1", floor=0, capacity=140, room_type="amphitheater", has_outlets=True),
        Classroom(id="bmb_amfi_2", building_id="bmb", name="BMB Amfi 2", floor=0, capacity=120, room_type="amphitheater", has_outlets=True),
        Classroom(id="bmb_z23", building_id="bmb", name="Derslik Z-23", floor=0, capacity=65, room_type="classroom", has_outlets=True),
        Classroom(id="bmb_104", building_id="bmb", name="Derslik B-104", floor=1, capacity=60, room_type="classroom", has_outlets=False),
        Classroom(id="bmb_lab_1", building_id="bmb", name="Yazılım Lab 1", floor=2, capacity=50, room_type="lab", has_outlets=True),
        # Elektronik Mühendisliği (ELMB)
        Classroom(id="elmb_amfi_1", building_id="elmb", name="ELMB Büyük Amfi", floor=0, capacity=150, room_type="amphitheater", has_outlets=True),
        Classroom(id="elmb_101", building_id="elmb", name="Derslik E-101", floor=1, capacity=75, room_type="classroom", has_outlets=True),
        Classroom(id="elmb_202", building_id="elmb", name="Derslik E-202", floor=2, capacity=70, room_type="classroom", has_outlets=False),
        # Temel Bilimler (TBB)
        Classroom(id="tbb_amfi_a", building_id="tbb", name="Temel Bilimler Amfi A", floor=0, capacity=180, room_type="amphitheater", has_outlets=True),
        Classroom(id="tbb_amfi_b", building_id="tbb", name="Temel Bilimler Amfi B", floor=0, capacity=180, room_type="amphitheater", has_outlets=True),
        Classroom(id="tbb_105", building_id="tbb", name="Derslik T-105", floor=1, capacity=80, room_type="classroom", has_outlets=True),
        # Merkezi Derslik ve Amfi Binası (MAB)
        Classroom(id="mab_amfi_1", building_id="mab", name="Merkezi Büyük Amfi 1", floor=0, capacity=220, room_type="amphitheater", has_outlets=True),
        Classroom(id="mab_amfi_2", building_id="mab", name="Merkezi Büyük Amfi 2", floor=0, capacity=200, room_type="amphitheater", has_outlets=True),
        # İşletme Fakültesi (IBF)
        Classroom(id="ibf_amfi_1", building_id="ibf", name="İşletme Amfi 1", floor=0, capacity=130, room_type="amphitheater", has_outlets=True),
        Classroom(id="ibf_201", building_id="ibf", name="Seminer Salonu 201", floor=2, capacity=60, room_type="classroom", has_outlets=True),
        # Kütüphane (KUT)
        Classroom(id="kut_salon_1", building_id="kut", name="Zemin Kat 7/24 Sessiz Çalışma Salonu", floor=0, capacity=200, room_type="classroom", has_outlets=True),
        Classroom(id="kut_grup_a", building_id="kut", name="1. Kat Grup Çalışma Odası A", floor=1, capacity=24, room_type="classroom", has_outlets=True),
    ]
    db.add_all(classrooms)
    db.flush()

    # 4. Haftalık Örnek Ders Programları (Pazartesi=1 ... Cuma=5)
    schedules = []
    for day in [1, 2, 3, 4, 5]:
        schedules.extend([
            CourseSchedule(classroom_id="bmb_amfi_1", day_of_week=day, start_time="09:00", end_time="11:50", course_code="CSE 101", course_name="Bilgisayar Mühendisliğine Giriş", instructor="Prof. Dr. H. Arslan"),
            CourseSchedule(classroom_id="bmb_amfi_1", day_of_week=day, start_time="14:30", end_time="16:20", course_code="CSE 344", course_name="Sistem Programlama", instructor="Doç. Dr. E. Kaya"),
            CourseSchedule(classroom_id="bmb_amfi_2", day_of_week=day, start_time="13:30", end_time="15:20", course_code="CSE 222", course_name="Veri Yapıları ve Algoritmalar", instructor="Doç. Dr. S. Demir"),
            CourseSchedule(classroom_id="bmb_z23", day_of_week=day, start_time="10:30", end_time="13:20", course_code="CSE 241", course_name="Nesne Yönelimli Programlama", instructor="Dr. Öğr. Üyesi M. Çelik"),
            CourseSchedule(classroom_id="bmb_104", day_of_week=day, start_time="15:00", end_time="17:30", course_code="CSE 312", course_name="İşletim Sistemleri", instructor="Prof. Dr. A. Öztürk"),
            CourseSchedule(classroom_id="elmb_amfi_1", day_of_week=day, start_time="09:30", end_time="12:20", course_code="ELEC 201", course_name="Devre Analizi I", instructor="Prof. Dr. T. Yıldız"),
            CourseSchedule(classroom_id="elmb_101", day_of_week=day, start_time="13:30", end_time="16:20", course_code="ELEC 304", course_name="Sinyaller ve Sistemler", instructor="Doç. Dr. K. Aydın"),
            CourseSchedule(classroom_id="tbb_amfi_a", day_of_week=day, start_time="09:00", end_time="11:50", course_code="MATH 101", course_name="Genel Matematik I (Calculus)", instructor="Prof. Dr. N. Şahin"),
            CourseSchedule(classroom_id="tbb_amfi_b", day_of_week=day, start_time="13:00", end_time="15:50", course_code="PHYS 101", course_name="Genel Fizik I", instructor="Prof. Dr. C. Aksoy"),
            CourseSchedule(classroom_id="mab_amfi_1", day_of_week=day, start_time="10:00", end_time="12:50", course_code="MATH 102", course_name="Genel Matematik II", instructor="Prof. Dr. N. Şahin"),
            CourseSchedule(classroom_id="ibf_amfi_1", day_of_week=day, start_time="10:00", end_time="12:50", course_code="ECON 101", course_name="İktisada Giriş", instructor="Doç. Dr. Z. Polat"),
        ])
    db.add_all(schedules)

    # 5. Örnek Aktif Kampüs Uyarıları (Gerçek OSM Yürüyüş Yolu Koordinatlarında)
    db.add_all([
        MapAlert(
            alert_type="puddle_ice",
            title="Su Birikintisi / Kaygan Zemin",
            edge_id=None,
            blocks_route=False,
            lat=40.80695,
            lon=29.35912,
            upvotes=4,
            downvotes=0,
            is_admin_verified=False,
            status="active",
        ),
        MapAlert(
            alert_type="event_stand",
            title="IEEE & Bilgisayar Topluluğu Tanıtım Standı",
            edge_id=None,
            blocks_route=False,
            lat=40.80755,
            lon=29.35935,
            upvotes=9,
            downvotes=0,
            is_admin_verified=True,
            status="active",
        ),
    ])

    # 6. Örnek Yazılı İdare Ticketları
    db.add_all([
        WrittenTicket(
            reporter_email="2101040040@gtu.edu.tr",
            building_id="bmb",
            classroom_id="bmb_amfi_1",
            category="technical",
            title="BMB Amfi 1 projeksiyon cihazı bağlantı kesiyor",
            description="Ders esnasında HDMI kablosu temassızlık yapıyor ve projeksiyon sürekli kapanıyor, incelenmesini rica ederiz.",
            lat=40.808034,
            lon=29.356135,
            ai_department="Bilgi İşlem Dairesi",
            ai_urgency_score=68,
            ai_priority_label="high",
            ai_is_spam=False,
            status="in_progress",
            admin_note="Teknik ekip yönlendirildi, yeni HDMI dönüştürücü takılacak.",
        ),
        WrittenTicket(
            reporter_email="2201020015@gtu.edu.tr",
            building_id="elmb",
            classroom_id=None,
            category="infrastructure",
            title="Zemin kat koridorunda su sızıntısı ve kaygan zemin",
            description="Elektronik mühendisliği giriş katındaki su sebili yanından koridora su sızıyor, yürürken kayma tehlikesi var.",
            lat=40.806535,
            lon=29.355608,
            ai_department="Yapı İşleri ve Teknik Daire",
            ai_urgency_score=91,
            ai_priority_label="critical",
            ai_is_spam=False,
            status="pending",
            admin_note=None,
        ),
    ])

    # 7. Kampüs Geneli Canlı Duyuru
    db.add(
        CampusAnnouncement(
            title="Bahar Dönemi 7/24 Kütüphane ve Boş Amfi Radarı Aktif",
            message="Sınav haftası boyunca Merkez Kütüphane 7/24 açıktır. Fakülte binalarındaki anlık boş amfileri haritadan takip edebilirsiniz.",
            severity="info",
            is_active=True,
        )
    )

    db.commit()
