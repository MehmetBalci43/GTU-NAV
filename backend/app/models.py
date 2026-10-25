from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False, default="GTÜ Öğrencisi")
    role = Column(String(32), nullable=False, default="student")  # student | admin
    is_banned = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Building(Base):
    __tablename__ = "buildings"

    id = Column(String(50), primary_key=True, index=True)  # bmb, elmb, tbb, ibf, kut, ymk, rek, mar
    code = Column(String(20), nullable=False, unique=True, index=True)  # BMB, ELMB, TBB, IBF, KUT, YMK, REK, MAR
    name = Column(String(150), nullable=False)
    category = Column(String(40), nullable=False, default="academic")  # academic | dining | library | admin | transit
    floors_count = Column(Integer, nullable=False, default=3)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    entrance_node_id = Column(String(64), nullable=False)
    entrance_name = Column(String(100), nullable=False, default="Ana Giriş Kapısı")
    entrance_lat = Column(Float, nullable=False)
    entrance_lon = Column(Float, nullable=False)
    polygon_coords = Column(JSON, nullable=False, default=list)  # [[[lon, lat], ...]]
    description = Column(Text, nullable=True)

    classrooms = relationship("Classroom", back_populates="building", cascade="all, delete-orphan")


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(String(64), primary_key=True, index=True)  # bmb_amfi_1, bmb_z23
    building_id = Column(String(50), ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    floor = Column(Integer, nullable=False, default=0)
    capacity = Column(Integer, nullable=False, default=80)
    room_type = Column(String(40), nullable=False, default="classroom")  # amphitheater | classroom | lab
    has_outlets = Column(Boolean, nullable=False, default=True)
    crowd_busy_until = Column(DateTime(timezone=True), nullable=True)
    crowd_busy_reason = Column(String(200), nullable=True)
    crowd_report_count = Column(Integer, nullable=False, default=0)

    building = relationship("Building", back_populates="classrooms")
    schedules = relationship("CourseSchedule", back_populates="classroom", cascade="all, delete-orphan")


class CourseSchedule(Base):
    __tablename__ = "course_schedules"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(String(64), ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False, index=True)  # 1=Pzt ... 5=Cum
    start_time = Column(String(8), nullable=False)  # "09:30"
    end_time = Column(String(8), nullable=False)  # "12:20"
    course_code = Column(String(32), nullable=False, index=True)  # "CSE 101"
    course_name = Column(String(160), nullable=False)
    instructor = Column(String(120), nullable=True)

    classroom = relationship("Classroom", back_populates="schedules")


class MapAlert(Base):
    __tablename__ = "map_alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(40), nullable=False)  # road_work | puddle_ice | lighting_fault | event_stand | custom_poi
    title = Column(String(140), nullable=False)
    edge_id = Column(String(64), nullable=True, index=True)
    blocks_route = Column(Boolean, nullable=False, default=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    upvotes = Column(Integer, nullable=False, default=1)
    downvotes = Column(Integer, nullable=False, default=0)
    is_admin_verified = Column(Boolean, nullable=False, default=False)
    status = Column(String(32), nullable=False, default="active")  # active | resolved
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class WrittenTicket(Base):
    __tablename__ = "written_tickets"

    id = Column(Integer, primary_key=True, index=True)
    reporter_email = Column(String(120), nullable=False, index=True)
    building_id = Column(String(50), ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True)
    classroom_id = Column(String(64), ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(40), nullable=False)  # technical | cleaning | security | infrastructure | suggestion
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    ai_department = Column(String(100), nullable=False, default="Yapı İşleri ve Teknik Daire")
    ai_urgency_score = Column(Integer, nullable=False, default=50)
    ai_priority_label = Column(String(32), nullable=False, default="medium")  # low | medium | high | critical
    ai_is_spam = Column(Boolean, nullable=False, default=False)
    status = Column(String(32), nullable=False, default="pending")  # pending | in_progress | resolved | rejected
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class CampusAnnouncement(Base):
    __tablename__ = "campus_announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(140), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False, default="info")  # info | warning | urgent
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
