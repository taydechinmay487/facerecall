from __future__ import annotations

import numpy as np
import pytest

from app.recognition.matching import (
    ACCEPTED,
    NOT_CONFIDENT,
    UNKNOWN,
    EnrolledVector,
    cosine_similarity,
    decide,
    rank_candidates,
)


def vec(index: int, dim: int = 128) -> np.ndarray:
    vector = np.zeros(dim, dtype=np.float32)
    vector[index] = 1.0
    return vector


def blended(a: np.ndarray, b: np.ndarray, weight: float) -> np.ndarray:
    return (a * weight + b * (1 - weight)).astype(np.float32)


def test_cosine_identical_is_one():
    assert cosine_similarity(vec(0), vec(0)) == pytest.approx(1.0, abs=1e-6)


def test_cosine_orthogonal_is_zero():
    assert cosine_similarity(vec(0), vec(1)) == pytest.approx(0.0, abs=1e-6)


def test_cosine_rejects_dimension_mismatch():
    with pytest.raises(ValueError):
        cosine_similarity(np.ones(4), np.ones(8))


def test_cosine_rejects_zero_vector():
    with pytest.raises(ValueError):
        cosine_similarity(np.zeros(8), np.ones(8))


def test_unknown_when_no_enrolments():
    result = decide(vec(0), [], threshold=0.45, ambiguity_margin=0.05)
    assert result.decision == UNKNOWN
    assert result.matched_person_id is None
    assert result.explanation


def test_threshold_rejection_is_unknown_not_a_guess():
    enrolled = [EnrolledVector(person_id=1, vector=vec(1))]
    result = decide(vec(0), enrolled, threshold=0.45)
    assert result.decision == UNKNOWN
    assert result.matched_person_id is None
    # The score is available for diagnostics but no person is attached.
    assert result.best_score is not None


def test_accepts_clear_match():
    enrolled = [EnrolledVector(person_id=7, vector=vec(0))]
    result = decide(vec(0), enrolled, threshold=0.45, ambiguity_margin=0.05)
    assert result.decision == ACCEPTED
    assert result.matched_person_id == 7
    assert result.best_score == pytest.approx(1.0)


def test_ambiguity_margin_rejects_close_call():
    a = vec(0)
    b = blended(vec(0), vec(1), 0.9995)
    enrolled = [EnrolledVector(person_id=1, vector=a), EnrolledVector(person_id=2, vector=b)]
    result = decide(vec(0), enrolled, threshold=0.45, ambiguity_margin=0.05)
    assert result.decision == NOT_CONFIDENT
    assert result.matched_person_id is None
    assert result.best_minus_second is not None
    assert result.best_minus_second < 0.05


def test_margin_disabled_still_accepts_best():
    a = vec(0)
    b = blended(vec(0), vec(1), 0.9995)
    enrolled = [EnrolledVector(person_id=1, vector=a), EnrolledVector(person_id=2, vector=b)]
    result = decide(vec(0), enrolled, threshold=0.45, ambiguity_margin=0.0)
    assert result.decision == ACCEPTED
    assert result.matched_person_id == 1


def test_single_candidate_ignores_margin():
    enrolled = [EnrolledVector(person_id=3, vector=vec(0))]
    result = decide(vec(0), enrolled, threshold=0.45, ambiguity_margin=0.2)
    assert result.decision == ACCEPTED
    assert result.matched_person_id == 3
    assert result.second_best_score is None


def test_exact_tie_is_deterministic_and_rejected():
    enrolled = [EnrolledVector(person_id=9, vector=vec(0)), EnrolledVector(person_id=4, vector=vec(0))]
    ranked = rank_candidates(vec(0), enrolled)
    assert [person for person, _ in ranked] == [4, 9]
    result = decide(vec(0), enrolled, threshold=0.45, ambiguity_margin=0.01)
    assert result.decision == NOT_CONFIDENT
    assert result.matched_person_id is None


def test_multiple_enrolments_use_best_per_person():
    enrolled = [
        EnrolledVector(person_id=5, vector=vec(0), enrollment_id=1),
        EnrolledVector(person_id=5, vector=vec(1), enrollment_id=2),
        EnrolledVector(person_id=6, vector=vec(2), enrollment_id=3),
    ]
    result = decide(vec(0), enrolled, threshold=0.45, ambiguity_margin=0.05)
    assert result.decision == ACCEPTED
    assert result.matched_person_id == 5
    assert result.candidates_considered == 2


def test_invalid_margin_rejected():
    with pytest.raises(ValueError):
        decide(vec(0), [EnrolledVector(person_id=1, vector=vec(0))], 0.45, 0.9)
