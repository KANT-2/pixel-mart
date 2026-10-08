from app.schemas.common import CamelModel


class FaqOut(CamelModel):
    id: int
    category: str
    question: str
    answer: str
