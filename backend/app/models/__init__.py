# 새 모델을 만들면 여기에 import 해야 Alembic이 테이블을 인식합니다.
from app.models.faq import Faq
from app.models.product import Category, Product
from app.models.user import User

__all__ = ["Category", "Faq", "Product", "User"]
