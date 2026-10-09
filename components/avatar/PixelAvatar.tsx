import styles from "./PixelAvatar.module.css";

interface PixelAvatarProps {
  src: string;
  alt?: string;
  className?: string;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

export default function PixelAvatar({ src, alt = "", className = "", onError }: PixelAvatarProps) {
  return <span className={`${styles.frame} ${className}`}>
    <span className={styles.inner}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 만든 작은 PNG를 보간 없이 확대 */}
      <img src={src} alt={alt} onError={onError} className={styles.image} />
    </span>
  </span>;
}
