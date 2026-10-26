import pytest
from fastapi import HTTPException
from app.config import settings
from app.database import SessionLocal
from app.main import (
    create_map_alert,
    create_written_ticket,
    init_db,
    list_written_tickets,
    login_user,
    preview_analyze_ticket,
    update_written_ticket_status,
    verify_admin_key,
    vote_map_alert,
)
from app.schemas import (
    AuthLoginRequest,
    MapAlertCreate,
    MapAlertVoteRequest,
    TicketAnalyzeRequest,
    WrittenTicketCreate,
    WrittenTicketUpdate,
)


def test_written_ticket_ai_urgent_water_leak() -> None:
    init_db()
    db = SessionLocal()
    try:
        res = create_written_ticket(
            WrittenTicketCreate(
                reporter_email="ogrenci@gtu.edu.tr",
                building_id="bmb",
                classroom_id="bmb_amfi_1",
                category="infrastructure",
                title="Koridorda su borusu patladı ve elektrik panosuna akıyor",
                description="Zemin katta ciddi su sızıntısı var, yerler çok kaygan ve tehlikeli.",
            ),
            db=db,
        )
        assert res.ai_urgency_score >= 80
        assert res.ai_priority_label == "critical"
        assert res.ai_department == "Yapı İşleri ve Teknik Daire"
        assert res.ai_is_spam is False
    finally:
        db.close()


def test_written_ticket_xss_sanitization_and_spam_detection() -> None:
    init_db()
    db = SessionLocal()
    try:
        res = create_written_ticket(
            WrittenTicketCreate(
                reporter_email="test@gtu.edu.tr",
                category="suggestion",
                title="<script>alert(1)</script> asdfghjkl",
                description="<b>asdfghjkl</b> qwerty 123456 deneme deneme",
            ),
            db=db,
        )
        assert "<script>" not in res.title
        assert "<b>" not in res.description
        assert res.ai_is_spam is True
        assert res.ai_urgency_score <= 15

        # Check content moderation filter (e.g. gambling/spam words)
        troll_res = create_written_ticket(
            WrittenTicketCreate(
                reporter_email="test@gtu.edu.tr",
                category="technical",
                title="canli kumar ve bahis",
                description="burada kumar oynamak istiyoruz link",
            ),
            db=db,
        )
        assert troll_res.ai_is_spam is True
        assert troll_res.ai_department == "Spam / Geçersiz"
        assert troll_res.ai_urgency_score <= 10
    finally:
        db.close()


def test_preview_analyze_ticket_and_mismatch() -> None:
    # User selected 'technical' (Bilgi İşlem), but text is clearly about water pipe bursting (Yapı İşleri)
    preview = preview_analyze_ticket(
        TicketAnalyzeRequest(
            title="Tuvalette su borusu patladı",
            description="Yerleri su bastı, elektrik panosuna akıyor acil tesisatçı",
            category="technical",
        )
    )
    assert preview.ai_department == "Yapı İşleri ve Teknik Daire"
    assert preview.user_department == "Bilgi İşlem Dairesi"
    assert preview.is_mismatch is True
    assert preview.suggested_category == "infrastructure"
    assert preview.ai_urgency_score >= 80

    init_db()
    db = SessionLocal()
    try:
        # If user overrides and confirms their own department:
        overridden = create_written_ticket(
            WrittenTicketCreate(
                reporter_email="test@gtu.edu.tr",
                category="technical",
                title="Tuvalette su borusu patladı",
                description="Yerleri su bastı, elektrik panosuna akıyor acil tesisatçı",
                confirmed_department="Bilgi İşlem Dairesi",
            ),
            db=db,
        )
        assert overridden.ai_department == "Bilgi İşlem Dairesi"
    finally:
        db.close()


def test_admin_ticket_update_and_alert_voting() -> None:
    init_db()
    db = SessionLocal()
    try:
        tickets = list_written_tickets(db=db)
        assert len(tickets) >= 2
        updated = update_written_ticket_status(
            ticket_id=tickets[0].id,
            req=WrittenTicketUpdate(status="resolved", admin_note="Sorun teknik ekipçe giderildi."),
            db=db,
            _=settings.admin_secret_key,
        )
        assert updated.status == "resolved"
        assert updated.admin_note == "Sorun teknik ekipçe giderildi."

        alert = create_map_alert(
            MapAlertCreate(
                alert_type="road_work",
                lat=40.8080,
                lon=29.3575,
                blocks_route=True,
            ),
            db=db,
        )
        assert alert.blocks_route is True
        voted = vote_map_alert(
            alert_id=alert.id,
            req=MapAlertVoteRequest(vote="up", voter_id="voter_alpha_1"),
            db=db,
        )
        assert voted.upvotes == 2

        # Duplicate vote from same voter_id must not increment count again
        voted_dup = vote_map_alert(
            alert_id=alert.id,
            req=MapAlertVoteRequest(vote="up", voter_id="voter_alpha_1"),
            db=db,
        )
        assert voted_dup.upvotes == 2
    finally:
        db.close()


def test_unauthorized_admin_action_rejected() -> None:
    with pytest.raises(HTTPException) as exc_info:
        verify_admin_key(x_admin_key="gecersiz_anahtar_123")
    assert exc_info.value.status_code == 403

    with pytest.raises(HTTPException) as exc_none:
        verify_admin_key(x_admin_key=None)
    assert exc_none.value.status_code == 403

    assert verify_admin_key(x_admin_key=settings.admin_secret_key) == settings.admin_secret_key

    init_db()
    db = SessionLocal()
    try:
        with pytest.raises(HTTPException) as login_exc:
            login_user(
                AuthLoginRequest(email="admin@gtu.edu.tr", role="admin", admin_key="yanlis"),
                db=db,
            )
        assert login_exc.value.status_code == 403

        valid_login = login_user(
            AuthLoginRequest(
                email="admin@gtu.edu.tr",
                role="admin",
                admin_key=settings.admin_secret_key,
            ),
            db=db,
        )
        assert valid_login["role"] == "admin"
        assert valid_login["admin_key"] == settings.admin_secret_key
    finally:
        db.close()

