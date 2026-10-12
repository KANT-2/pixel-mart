from app.models import Product
from app.schemas.common import CamelModel
from app.services.rarity import Rarity, rarity_of


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
    rarity: Rarity  # 가격대 아이템 등급 (common/uncommon/rare/epic)

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
            rarity=rarity_of(product.price),
        )


class ProductWithWishOut(ProductOut):
    """상품 목록·상세 응답 — 로그인 사용자가 찜했는지 함께 (비로그인은 항상 false)"""

    is_wished: bool = False


class RarityOut(CamelModel):
    """등급별 카테고리 한 칸 — 가격 범위와 상품 개수"""

    key: Rarity
    label: str
    min_price: int
    max_price: int | None  # 미포함, EPIC은 상한 없음
    count: int
