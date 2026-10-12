export interface DeskTheme {
  slug: string;
  name: string;
  image: string;
  productIds: number[];
}

export const deskThemes: DeskTheme[] = [
  { slug: "cat", name: "픽셀 고양이", image: "/images/lookbook/cat.webp", productIds: [93, 94, 95, 96] },
  { slug: "cloud", name: "구름", image: "/images/lookbook/cloud.webp", productIds: [165, 166, 167, 168] },
  { slug: "levelup", name: "레벨업", image: "/images/lookbook/levelup.webp", productIds: [117, 118, 119, 120] },
  { slug: "mushroom", name: "산호 버섯", image: "/images/lookbook/mushroom.webp", productIds: [171, 172, 173, 174] },
];
