import re
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


def strip_html_tags(text: str) -> str:
    cleaned = re.sub(r"<[^>]*>", "", text or "")
    return cleaned.strip()


class BuildingSchema(BaseModel):
    id: str
    code: str
    name: str
    category: str
    floors_count: int
    lat: float
    lon: float
    entrance_node_id: str
    entrance_name: str
    entrance_lat: float
    entrance_lon: float
    secondary_entrance_node_id: Optional[str] = None
    secondary_entrance_name: Optional[str] = None
    secondary_entrance_lat: Optional[float] = None
    secondary_entrance_lon: Optional[float] = None
    polygon_coords: list[Any]
    description: Optional[str] = None
    free_rooms_count: int = 0
    total_rooms_count: int = 0

    model_config = {"from_attributes": True}


class BuildingEntranceUpdate(BaseModel):
    entrance_lat: float
    entrance_lon: float
    entrance_name: Optional[str] = None
    entrance_slot: int = 1  # 1 = primary entrance, 2 = secondary entrance
    clear_secondary: bool = False


class BuildingCreateOrUpdate(BaseModel):
    id: str = Field(..., min_length=2, max_length=50)
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=3, max_length=150)
    category: str = Field(default="academic")
    floors_count: int = Field(default=3, ge=1, le=15)
    lat: float
    lon: float
    entrance_lat: Optional[float] = None
    entrance_lon: Optional[float] = None
    entrance_name: Optional[str] = None
    polygon_coords: Optional[list[Any]] = None
    osm_way_ids: Optional[list[int]] = None
    description: Optional[str] = None

    @field_validator("code", "name")
    @classmethod
    def sanitize_b_fields(cls, v: str) -> str:
        return strip_html_tags(v)


class CourseScheduleSchema(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    course_code: str
    course_name: str
    instructor: Optional[str] = None

    model_config = {"from_attributes": True}


class ClassroomStatusSchema(BaseModel):
    id: str
    building_id: str
    name: str
    floor: int
    capacity: int
    room_type: str
    has_outlets: bool
    is_currently_free: bool
    free_until: Optional[str] = None
    current_course_code: Optional[str] = None
    current_course_name: Optional[str] = None
    current_course_ends_at: Optional[str] = None
    next_course_code: Optional[str] = None
    next_course_starts_at: Optional[str] = None
    is_crowd_busy: bool = False
    crowd_busy_reason: Optional[str] = None
    crowd_report_count: int = 0
    schedules: list[CourseScheduleSchema] = []


class BuildingRoomsResponse(BaseModel):
    building: BuildingSchema
    query_day: int
    query_time: str
    rooms: list[ClassroomStatusSchema]


class SearchResultItem(BaseModel):
    result_type: str  # "building" | "course" | "classroom"
    title: str
    subtitle: str
    building_id: str
    building_code: str
    building_name: str
    classroom_id: Optional[str] = None
    entrance_lat: float
    entrance_lon: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]


class MapAlertCreate(BaseModel):
    alert_type: str = Field(..., min_length=2, max_length=40)
    title: Optional[str] = Field(default=None, max_length=140)
    edge_id: Optional[str] = None
    blocks_route: bool = False
    lat: float
    lon: float
    is_admin_verified: bool = False

    @field_validator("title")
    @classmethod
    def sanitize_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return strip_html_tags(v)


class MapAlertVoteRequest(BaseModel):
    vote: str = Field(..., pattern="^(up|down)$")
    voter_id: Optional[str] = Field(default="anon_client", max_length=80)


class MapAlertSchema(BaseModel):
    id: int
    alert_type: str
    title: str
    edge_id: Optional[str] = None
    blocks_route: bool
    lat: float
    lon: float
    upvotes: int
    downvotes: int
    is_admin_verified: bool
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WrittenTicketCreate(BaseModel):
    reporter_email: str = Field(default="ogrenci@gtu.edu.tr", max_length=120)
    building_id: Optional[str] = None
    classroom_id: Optional[str] = None
    category: str = Field(..., min_length=2, max_length=40)
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field(..., min_length=5, max_length=1500)
    lat: Optional[float] = None
    lon: Optional[float] = None

    @field_validator("title", "description", "reporter_email")
    @classmethod
    def sanitize_text_fields(cls, v: str) -> str:
        cleaned = strip_html_tags(v)
        if not cleaned:
            raise ValueError("Metin alanı boş bırakılamaz.")
        return cleaned


class WrittenTicketUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|in_progress|resolved|rejected)$")
    admin_note: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("admin_note")
    @classmethod
    def sanitize_note(cls, v: Optional[str]) -> Optional[str]:
        return strip_html_tags(v) if v else None


class WrittenTicketSchema(BaseModel):
    id: int
    reporter_email: str
    building_id: Optional[str] = None
    classroom_id: Optional[str] = None
    category: str
    title: str
    description: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    ai_department: str
    ai_urgency_score: int
    ai_priority_label: str
    ai_is_spam: bool
    status: str
    admin_note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=140)
    message: str = Field(..., min_length=5, max_length=1000)
    severity: str = Field(default="info", pattern="^(info|warning|urgent)$")

    @field_validator("title", "message")
    @classmethod
    def sanitize_announcement(cls, v: str) -> str:
        return strip_html_tags(v)


class AnnouncementSchema(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    target_building_id: Optional[str] = None
    target_lat: Optional[float] = None
    target_lon: Optional[float] = None


class RouteResponse(BaseModel):
    coordinates: list[list[float]]
    distance_m: float
    duration_min: int
    used_edge_ids: list[str]
    avoided_closures: int
    fallback_used: bool
    target_entrance_name: str
    start_node_id: str
    target_node_id: str


class EdgeToggleRequest(BaseModel):
    edge_id: str
    closed: bool
    reason: Optional[str] = "Yol Çalışması / Geçici Kapatma"


class CustomEdgeCreate(BaseModel):
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float
    name: str = Field(default="Kampüs Yürüyüş Patikası", max_length=100)


class BusyReportRequest(BaseModel):
    reason: str = Field(default="Öğrenci bildirimi: İçeride etkinlik / yoğunluk var", max_length=200)

    @field_validator("reason")
    @classmethod
    def sanitize_reason(cls, v: str) -> str:
        return strip_html_tags(v) or "Öğrenci bildirimi: İçeride yoğunluk var"


class AuthLoginRequest(BaseModel):
    email: str = Field(default="ogrenci@gtu.edu.tr")
    role: Optional[str] = Field(default=None)
    admin_key: Optional[str] = Field(default=None)


class BootstrapResponse(BaseModel):
    buildings: list[BuildingSchema]
    walk_graph: dict[str, Any]
    active_alerts: list[MapAlertSchema]
    blocked_edge_ids: list[str]
    announcements: list[AnnouncementSchema]
