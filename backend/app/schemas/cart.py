from datetime import datetime
from typing import Annotated

from pydantic import Field

from app.models.cart import CartItem
from app.schemas.common import CamelModel
from app.schemas.product import ProductOut

MAX_QUANTITY = 99

Quantity = Annotated[int, Field(ge=1, le=MAX_QUANTITY)]


class CartItemIn(CamelModel):
    product_id: int
    quantity: Quantity = 1


class CartItemUpdate(CamelModel):
    quantity: Quantity


class CartItemOut(CamelModel):
    product: ProductOut
    quantity: int
    subtotal: int
    added_at: datetime

    @classmethod
    def from_model(cls, item: CartItem) -> "CartItemOut":
        return cls(
            product=ProductOut.from_model(item.product),
            quantity=item.quantity,
            subtotal=item.product.price * item.quantity,
            added_at=item.added_at,
        )


class CartOut(CamelModel):
    items: list[CartItemOut]
    total_quantity: int
    total_price: int
