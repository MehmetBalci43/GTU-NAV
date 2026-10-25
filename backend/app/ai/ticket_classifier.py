import re
from pathlib import Path
from typing import Any
import joblib

from app.ai.train_model import train_and_save_model
from app.config import settings

_MODEL_BUNDLE: dict[str, Any] | None = None

CRITICAL_KEYWORDS = {
    "patladı", "elektrik kaçağı", "kıvılcım", "yangın", "mahsur", "asansör", "su baskını",
    "tehlike", "acil", "çöktü", "kırık cam", "açık kablo", "şüpheli", "gaz kokusu",
}
HIGH_KEYWORDS = {
    "su sızıntısı", "kaygan", "karanlık", "yanmıyor", "bozuk", "çalışmıyor",
    "projeksiyon", "internet yok", "kapandı", "tıkanmış", "arıza",
}
SPAM_PATTERNS = [
    r"^(asdf|qwer|zxcv|test|deneme|1234|haha|sjsj|lol\b)",
    r"(.)\1{4,}",  # 5+ repeated identical characters like "aaaaaa"
]

CATEGORY_DEFAULT_DEPT = {
    "technical": "Bilgi İşlem Dairesi",
    "infrastructure": "Yapı İşleri ve Teknik Daire",
    "cleaning": "İdari ve Mali İşler (Temizlik)",
    "security": "Koruma ve Güvenlik Şube Müdürlüğü",
    "suggestion": "Öğrenci İşleri ve Kampüs Yaşam",
}


def get_or_load_model() -> dict[str, Any]:
    global _MODEL_BUNDLE
    if _MODEL_BUNDLE is not None:
        return _MODEL_BUNDLE

    model_path = Path(settings.ai_model_path)
    if not model_path.is_absolute():
        model_path = Path(__file__).parent.parent.parent / settings.ai_model_path

    if model_path.exists():
        _MODEL_BUNDLE = joblib.load(model_path)
    else:
        _MODEL_BUNDLE = train_and_save_model(model_path)

    return _MODEL_BUNDLE


def is_text_spam(combined_lower: str) -> bool:
    for pat in SPAM_PATTERNS:
        if re.search(pat, combined_lower):
            return True
    words = [w for w in re.findall(r"[a-zçğıöşü0-9]+", combined_lower) if len(w) >= 2]
    if len(words) < 2:
        return True
    if any(k in combined_lower for k in ("asdfgh", "qwerty", "deneme deneme", "test 123")):
        return True
    return False


def analyze_written_ticket(title: str, description: str, category: str = "technical") -> dict[str, Any]:
    bundle = get_or_load_model()
    combined = f"{title} {description}".strip().lower()

    if is_text_spam(combined):
        return {
            "ai_department": "Spam / Geçersiz",
            "ai_urgency_score": 5,
            "ai_priority_label": "low",
            "ai_is_spam": True,
        }

    dept_pipe = bundle["dept_pipeline"]
    urg_pipe = bundle["urgency_pipeline"]

    pred_dept = str(dept_pipe.predict([combined])[0])
    probs = dept_pipe.predict_proba([combined])[0]
    max_prob = float(max(probs))

    if pred_dept == "Spam / Geçersiz":
        return {
            "ai_department": "Spam / Geçersiz",
            "ai_urgency_score": 8,
            "ai_priority_label": "low",
            "ai_is_spam": True,
        }

    # If model confidence is modest, blend with category hint
    if max_prob < 0.38 and category in CATEGORY_DEFAULT_DEPT:
        pred_dept = CATEGORY_DEFAULT_DEPT[category]

    base_score = float(urg_pipe.predict([combined])[0])

    # Keyword boost for safety/infrastructure hazards
    if any(kw in combined for kw in CRITICAL_KEYWORDS):
        base_score = max(base_score + 18.0, 86.0)
    elif any(kw in combined for kw in HIGH_KEYWORDS):
        base_score = max(base_score + 10.0, 66.0)

    final_score = int(max(10, min(99, round(base_score))))

    if final_score >= 80:
        priority = "critical"
    elif final_score >= 60:
        priority = "high"
    elif final_score >= 38:
        priority = "medium"
    else:
        priority = "low"

    return {
        "ai_department": pred_dept,
        "ai_urgency_score": final_score,
        "ai_priority_label": priority,
        "ai_is_spam": False,
    }
