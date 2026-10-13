"""검색어를 LIKE에 넣을 때 쓰는 도우미 — 사용자가 친 %·_·\는 와일드카드가 아니라 글자 그대로 찾는다"""

LIKE_ESCAPE = "\\"


def escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\%").replace("_", "\_")


def like_pattern(text: str) -> str:
    """부분 일치 패턴 — ilike(like_pattern(q), escape=LIKE_ESCAPE)로 쓴다"""
    return f"%{escape_like(text)}%"
