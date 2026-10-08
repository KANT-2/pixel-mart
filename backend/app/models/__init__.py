# 새 모델을 만들면 여기에 import 해야 Alembic이 테이블을 인식합니다.
from app.models.cancel_request import CancelRequest
from app.models.cart import CartItem
from app.models.faq import Faq
from app.models.local import Interest, Region, UserInterest
from app.models.order import Order, OrderItem, OrderStatusHistory
from app.models.product import Category, Product
from app.models.user import User
from app.models.wishlist import Wishlist

__all__ = [
    "CancelRequest",
    "CartItem",
    "Category",
    "Faq",
    "Interest",
    "Order",
    "OrderItem",
    "OrderStatusHistory",
    "Product",
    "Region",
    "User",
    "UserInterest",
    "Wishlist",
]
