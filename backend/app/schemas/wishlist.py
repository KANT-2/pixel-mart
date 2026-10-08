from datetime import datetime

from app.models.wishlist import Wishlist
from app.schemas.common import CamelModel
from app.schemas.product import ProductOut


class WishlistItemOut(CamelModel):
    product: ProductOut
    created_at: datetime

    @classmethod
    def from_model(cls, item: Wishlist) -> "WishlistItemOut":
        return cls(product=ProductOut.from_model(item.product), created_at=item.created_at)
