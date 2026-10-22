import denrLogo from '../../assets/denr-logo-512.png';

const SIZES = {
  sm: 'denr-logo-sm',
  md: 'denr-logo-md',
  lg: 'denr-logo-lg',
  xl: 'denr-logo-xl',
};

interface DenrLogoProps {
  size?: keyof typeof SIZES;
  className?: string;
  /** Disables the pulsing halo, for dense layouts. */
  glow?: boolean;
  /** Adds the slow rotation used on the sign-in screen. */
  spin?: boolean;
}

export function DenrLogo({
  size = 'md',
  className = '',
  glow = true,
  spin = false,
}: DenrLogoProps) {
  return (
    <span className={`denr-logo ${SIZES[size]} ${className}`.trim()}>
      {glow ? <span className="denr-logo-halo" aria-hidden="true" /> : null}
      <span
        className={`denr-logo-ring${spin ? ' is-spinning' : ''}`}
        aria-hidden="true"
      >
        <img
          src={denrLogo}
          alt="DENR — Department of Environment and Natural Resources"
          draggable={false}
          className="denr-logo-img"
        />
        <span className="denr-logo-sheen" />
      </span>
    </span>
  );
}
