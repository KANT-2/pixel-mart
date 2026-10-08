from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """API JSON은 프론트(TypeScript)와 같은 camelCase, 파이썬 코드 안에서는 snake_case"""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class Page[T](CamelModel):
    items: list[T]
    total: int
    page: int
    size: int
    total_pages: int


class Message(CamelModel):
    message: str
