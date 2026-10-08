from app.models import Product
from app.schemas.common import CamelModel


class CategoryOut(CamelModel):
    slug: str
    name: str
    description: str


class ProductOut(CamelModel):
    """프론트 types/product.ts 의 Product와 같은 모양 + categorySlug"""

    id: int
    name: str
    price: int
    category: str  # 한글 카테고리 이름 (프론트 Product.category와 동일)
    category_slug: str
    image_url: str
    description: str
    is_new: bool

    @classmethod
    def from_model(cls, product: Product) -> "ProductOut":
        return cls(
            id=product.id,
            name=product.name,
            price=product.price,
            category=product.category.name,
            category_slug=product.category_slug,
            image_url=product.image_url,
            description=product.description,
            is_new=product.is_new,
        )
