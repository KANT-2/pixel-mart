from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.models.cancel_request import CancelRequest
from app.schemas.common import CamelModel

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]

# 화면에 보여 줄 한글 이름
CANCEL_STATUS_LABELS = {
    "requested": "취소 요청중",
    "approved": "취소 승인",
    "rejected": "취소 거절",
}


class CancelRequestIn(CamelModel):
    reason: Reason


class CancelRequestOut(CamelModel):
    id: int
    order_id: int
    reason: str
    status: str
    status_label: str
    created_at: datetime

    @classmethod
    def from_model(cls, request: CancelRequest) -> "CancelRequestOut":
        return cls(
            id=request.id,
            order_id=request.order_id,
            reason=request.reason,
            status=request.status,
            status_label=CANCEL_STATUS_LABELS[request.status],
            created_at=request.created_at,
        )
