# 새 모델을 만들면 여기에 import 해야 Alembic이 테이블을 인식합니다.
from app.models.activity import ActivityPoint
from app.models.cancel_request import CancelRequest
from app.models.cart import CartItem
from app.models.compat import Keyboard, KeycapSpec
from app.models.faq import Faq
from app.models.gift import Gift
from app.models.local import FandomSample, Interest, Region, TradePost, UserInterest, WishSample
from app.models.notification import Notification
from app.models.order import Order, OrderItem, OrderStatusHistory
from app.models.product import Category, Product
from app.models.question import ProductQuestion
from app.models.review import Review
from app.models.trade_request import TradeRequest
from app.models.user import User
from app.models.wishlist import Wishlist

__all__ = [
    "ActivityPoint",
    "CancelRequest",
    "CartItem",
    "Category",
    "FandomSample",
    "Faq",
    "Gift",
    "Interest",
    "Keyboard",
    "KeycapSpec",
    "Notification",
    "Order",
    "OrderItem",
    "OrderStatusHistory",
    "Product",
    "ProductQuestion",
    "Region",
    "Review",
    "TradePost",
    "TradeRequest",
    "User",
    "UserInterest",
    "Wishlist",
    "WishSample",
]
