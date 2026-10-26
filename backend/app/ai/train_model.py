import math
import re
from collections import Counter, defaultdict
from pathlib import Path
import joblib

from app.ai.dataset import TRAINING_SAMPLES


def _tokenize_ngrams(text: str) -> list[str]:
    words = re.findall(r"[a-zçğıöşü0-9]+", text.lower())
    tokens = list(words)
    for i in range(len(words) - 1):
        tokens.append(f"{words[i]} {words[i + 1]}")
    return tokens


class TrainedTfidfDepartmentClassifier:
    """
    Lightweight CPU TF-IDF + Regularized Log-Linear / Multinomial Classifier
    trained on GTÜ Turkish campus ticket corpus and serialized via joblib.
    """

    def __init__(self, alpha: float = 0.45):
        self.alpha = alpha
        self.classes_: list[str] = []
        self.idf_: dict[str, float] = {}
        self.class_log_prior_: dict[str, float] = {}
        self.feature_log_prob_: dict[str, dict[str, float]] = {}
        self.default_log_prob_: dict[str, float] = {}

    def fit(self, texts: list[str], labels: list[str]) -> "TrainedTfidfDepartmentClassifier":
        n_docs = len(texts)
        df_counts: Counter[str] = Counter()
        tokenized_docs: list[list[str]] = []

        for txt in texts:
            toks = _tokenize_ngrams(txt)
            tokenized_docs.append(toks)
            for unique_tok in set(toks):
                df_counts[unique_tok] += 1

        self.idf_ = {
            tok: math.log((1.0 + n_docs) / (1.0 + df)) + 1.0
            for tok, df in df_counts.items()
        }

        classes = sorted(set(labels))
        self.classes_ = classes
        class_counts = Counter(labels)
        for c in classes:
            self.class_log_prior_[c] = math.log(class_counts[c] / n_docs)

        vocab_size = max(1, len(self.idf_))
        class_token_tfidf: dict[str, Counter[str]] = defaultdict(Counter)
        class_total_weight: Counter[str] = Counter()

        for toks, label in zip(tokenized_docs, labels):
            tf_counts = Counter(toks)
            weights: dict[str, float] = {}
            norm_sq = 0.0
            for tok, count in tf_counts.items():
                w = (1.0 + math.log(count)) * self.idf_.get(tok, 1.0)
                weights[tok] = w
                norm_sq += w * w
            norm = math.sqrt(norm_sq) if norm_sq > 0 else 1.0
            for tok, w in weights.items():
                nw = w / norm
                class_token_tfidf[label][tok] += nw
                class_total_weight[label] += nw

        self.feature_log_prob_ = {}
        self.default_log_prob_ = {}
        for c in classes:
            denom = class_total_weight[c] + self.alpha * vocab_size
            self.default_log_prob_[c] = math.log(self.alpha / denom)
            self.feature_log_prob_[c] = {
                tok: math.log((w + self.alpha) / denom)
                for tok, w in class_token_tfidf[c].items()
            }

        return self

    def predict_proba(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        for txt in texts:
            toks = _tokenize_ngrams(txt)
            tf_counts = Counter(toks)
            log_scores: list[float] = []
            for c in self.classes_:
                score = self.class_log_prior_[c]
                f_map = self.feature_log_prob_[c]
                def_lp = self.default_log_prob_[c]
                for tok, count in tf_counts.items():
                    if tok in self.idf_:
                        tf_val = 1.0 + math.log(count)
                        score += tf_val * f_map.get(tok, def_lp)
                log_scores.append(score)

            max_s = max(log_scores)
            exps = [math.exp(s - max_s) for s in log_scores]
            total = sum(exps) or 1.0
            results.append([e / total for e in exps])
        return results

    def predict(self, texts: list[str]) -> list[str]:
        probs_batch = self.predict_proba(texts)
        preds: list[str] = []
        for probs in probs_batch:
            best_idx = max(range(len(probs)), key=lambda i: probs[i])
            preds.append(self.classes_[best_idx])
        return preds


class TrainedTfidfUrgencyRegressor:
    """
    Lightweight CPU TF-IDF Urgency Regressor (1-100 scale)
    trained on GTÜ Turkish campus ticket corpus.
    """

    def __init__(self):
        self.global_mean_: float = 50.0
        self.token_weights_: dict[str, float] = {}
        self.idf_: dict[str, float] = {}

    def fit(self, texts: list[str], urgencies: list[float]) -> "TrainedTfidfUrgencyRegressor":
        n_docs = len(texts)
        self.global_mean_ = sum(urgencies) / max(1, n_docs)

        df_counts: Counter[str] = Counter()
        tok_docs: list[list[str]] = []
        for txt in texts:
            toks = _tokenize_ngrams(txt)
            tok_docs.append(toks)
            for ut in set(toks):
                df_counts[ut] += 1

        self.idf_ = {
            tok: math.log((1.0 + n_docs) / (1.0 + df)) + 1.0
            for tok, df in df_counts.items()
        }

        num_sum: Counter[str] = Counter()
        den_sum: Counter[str] = Counter()

        for toks, target in zip(tok_docs, urgencies):
            for tok in set(toks):
                w = self.idf_.get(tok, 1.0)
                num_sum[tok] += w * (target - self.global_mean_)
                den_sum[tok] += w

        ridge_lambda = 1.25
        self.token_weights_ = {
            tok: num_sum[tok] / (den_sum[tok] + ridge_lambda)
            for tok in num_sum
        }
        return self

    def predict(self, texts: list[str]) -> list[float]:
        preds: list[float] = []
        for txt in texts:
            toks = set(_tokenize_ngrams(txt))
            matched_deltas = [
                self.token_weights_[t] for t in toks if t in self.token_weights_
            ]
            if not matched_deltas:
                preds.append(30.0)
            else:
                avg_delta = sum(matched_deltas) / len(matched_deltas)
                peak_delta = max(matched_deltas, key=lambda x: abs(x))
                score = self.global_mean_ + 0.55 * avg_delta + 0.65 * peak_delta
                preds.append(max(5.0, min(98.0, score)))
        return preds


def train_and_save_model(output_path: str | Path) -> dict:
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    texts = [t[0].lower() for t in TRAINING_SAMPLES]
    departments = [d for _, d, _ in TRAINING_SAMPLES]
    urgencies = [float(u) for _, _, u in TRAINING_SAMPLES]

    dept_pipeline = TrainedTfidfDepartmentClassifier(alpha=0.4)
    dept_pipeline.fit(texts, departments)

    urgency_pipeline = TrainedTfidfUrgencyRegressor()
    urgency_pipeline.fit(texts, urgencies)

    bundle = {
        "dept_pipeline": dept_pipeline,
        "urgency_pipeline": urgency_pipeline,
        "version": "1.1.0",
    }
    joblib.dump(bundle, out_file)
    return bundle


if __name__ == "__main__":
    from app.ai.train_model import train_and_save_model as _train_as_module

    default_out = Path(__file__).parent.parent.parent / "weights" / "ticket_ai_model.joblib"
    _train_as_module(default_out)
    print(f"Trained and saved CPU NLP model to {default_out}")
