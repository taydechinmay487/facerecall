"""Threshold + ambiguity-margin matching.

Pure functions only: no database, no model. That makes the safety-critical
logic exhaustively testable with synthetic vectors.

Scores are cosine similarities in [-1, 1]. They are *not* probabilities and the
API never presents them as percentages.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.recognition.engine_base import to_float32_vector

ACCEPTED = "accepted_match"
UNKNOWN = "unknown_person"
NOT_CONFIDENT = "not_confident"


@dataclass(frozen=True)
class EnrolledVector:
    person_id: int
    vector: np.ndarray
    enrollment_id: int | None = None


@dataclass(frozen=True)
class Decision:
    decision: str
    matched_person_id: int | None
    explanation: str
    best_score: float | None
    second_best_score: float | None
    best_minus_second: float | None
    candidates_considered: int


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two embeddings, dimension-checked."""
    left = np.asarray(a, dtype=np.float32).reshape(-1)
    right = np.asarray(b, dtype=np.float32).reshape(-1)
    if left.size != right.size:
        raise ValueError("Cannot compare embeddings with different dimensions.")
    left_norm = float(np.linalg.norm(left))
    right_norm = float(np.linalg.norm(right))
    if left_norm <= 1e-8 or right_norm <= 1e-8:
        raise ValueError("Cannot compare a zero-magnitude embedding.")
    return float(np.dot(left, right) / (left_norm * right_norm))


def rank_candidates(
    query: np.ndarray,
    enrolled: list[EnrolledVector],
) -> list[tuple[int, float]]:
    """Return (person_id, best_score) sorted by score desc, then person_id asc.

    Deterministic tie-breaking matters: two identical scores must always
    resolve the same way, and a tie inside the ambiguity margin is rejected.
    """
    scores: dict[int, float] = {}
    for item in enrolled:
        similarity = cosine_similarity(query, item.vector)
        current = scores.get(item.person_id)
        if current is None or similarity > current:
            scores[item.person_id] = similarity
    ranked = sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))
    return ranked


def decide(
    query: np.ndarray,
    enrolled: list[EnrolledVector],
    threshold: float,
    ambiguity_margin: float = 0.0,
) -> Decision:
    """Apply the acceptance threshold and optional ambiguity margin."""
    if not 0.0 <= ambiguity_margin <= 0.5:
        raise ValueError("Ambiguity margin must be between 0 and 0.5.")

    ranked = rank_candidates(query, enrolled)
    considered = len(ranked)
    if not ranked:
        return Decision(
            decision=UNKNOWN,
            matched_person_id=None,
            explanation="Nobody is enrolled yet, so there is nothing to compare with.",
            best_score=None,
            second_best_score=None,
            best_minus_second=None,
            candidates_considered=0,
        )

    best_person, best_score = ranked[0]
    second_score = ranked[1][1] if considered > 1 else None
    difference = None if second_score is None else best_score - second_score

    if best_score < threshold:
        return Decision(
            decision=UNKNOWN,
            matched_person_id=None,
            explanation=(
                "Not confident enough to identify this person. "
                "The closest enrolled face did not meet your acceptance threshold."
            ),
            best_score=best_score,
            second_best_score=second_score,
            best_minus_second=difference,
            candidates_considered=considered,
        )

    # The margin is applied only when a genuine runner-up exists. With a single
    # enrolled candidate there is no ambiguity to measure.
    if ambiguity_margin > 0 and second_score is not None and difference is not None:
        if difference < ambiguity_margin:
            return Decision(
                decision=NOT_CONFIDENT,
                matched_person_id=None,
                explanation=(
                    "Two enrolled people look similarly close to this face, so FaceRecall "
                    "will not guess. Try again with a clearer, front-facing view."
                ),
                best_score=best_score,
                second_best_score=second_score,
                best_minus_second=difference,
                candidates_considered=considered,
            )

    return Decision(
        decision=ACCEPTED,
        matched_person_id=best_person,
        explanation=(
            "Match accepted: this face met your acceptance threshold and no other "
            "enrolled person was nearly as close."
        ),
        best_score=best_score,
        second_best_score=second_score,
        best_minus_second=difference,
        candidates_considered=considered,
    )
