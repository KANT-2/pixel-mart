import styles from "./PixelAvatar.module.css";

interface PixelAvatarProps {
  src: string;
  alt?: string;
  className?: string;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
}

/** 테두리 없이 원본 비율 그대로, 보간 없이 도트를 또렷하게 보여 준다 */
export default function PixelAvatar({ src, alt = "", className = "", onError, onLoad }: PixelAvatarProps) {
  // eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 만든 작은 PNG를 보간 없이 확대
  return <img src={src} alt={alt} onError={onError} onLoad={onLoad} className={`${styles.image} ${className}`} />;
}
