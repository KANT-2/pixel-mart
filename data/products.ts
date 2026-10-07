import type { Product } from "@/types/product";

// 이미지는 public/images/ 안의 SVG를 사용합니다. (외부 링크 깨짐·저작권 걱정 없음)
// 화면에서는 <img src={product.imageUrl} /> 로 바로 쓸 수 있습니다.
export const products: Product[] = [
  {
    id: 1,
    name: "HP 하트 키캡",
    price: 9900,
    category: "키캡",
    imageUrl: "/images/heart-keycap.svg",
    description: "작은 하트가 주는 큰 만족. 체리 프로파일 호환 반투명 레진 키캡",
  },
  {
    id: 2,
    name: "코인 키캡 세트",
    price: 12900,
    category: "키캡",
    imageUrl: "/images/coin-keycap-set.svg",
    description: "누를 때마다 코인 획득! 골드 코인 키캡 3종 세트",
    isNew: true,
  },
  {
    id: 3,
    name: "던전 맵 장패드",
    price: 24900,
    category: "데스크매트",
    imageUrl: "/images/dungeon-deskmat.svg",
    description: "책상 위, 새로운 모험의 시작. 800×300mm 방수 코팅 원단",
    isNew: true,
  },
  {
    id: 4,
    name: "인베이더 장패드",
    price: 22900,
    category: "데스크매트",
    imageUrl: "/images/invader-deskmat.svg",
    description: "고전 아케이드 감성 그대로. 900×400mm 미끄럼 방지 고무 바닥",
  },
  {
    id: 5,
    name: "슬라임 아크릴 키링",
    price: 7900,
    category: "키링·스티커",
    imageUrl: "/images/slime-keyring.svg",
    description: "언제나 함께하는 귀여운 동료. 양면 UV 인쇄 아크릴, 5cm",
  },
  {
    id: 6,
    name: "픽셀 스티커 팩",
    price: 4500,
    category: "키링·스티커",
    imageUrl: "/images/sticker-pack.svg",
    description: "하트, 슬라임, 보석, 코인 4종. 어디든 붙였다 떼는 리무버블 재질",
    isNew: true,
  },
  {
    id: 7,
    name: "보물상자 소품함",
    price: 12900,
    category: "데스크 소품",
    imageUrl: "/images/treasure-box.svg",
    description: "자잘한 아이템은 여기에 보관. 원목 MDF 뚜껑형 수납함",
  },
  {
    id: 8,
    name: "인베이더 LED 무드등",
    price: 29900,
    category: "데스크 소품",
    imageUrl: "/images/invader-lamp.svg",
    description: "밤이 되면 깨어나는 침략자. USB-C 전원, 밝기 3단계 조절",
    isNew: true,
  },
];
