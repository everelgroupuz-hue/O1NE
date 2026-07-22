interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'full' | 'text';
  className?: string;
}

const sizes = {
  sm: { icon: 28, text: 'text-sm', sub: false },
  md: { icon: 36, text: 'text-base', sub: true },
  lg: { icon: 48, text: 'text-xl', sub: true },
  xl: { icon: 64, text: 'text-2xl', sub: true },
};

export const Logo = ({ size = 'md', variant = 'full', className = '' }: LogoProps) => {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="bg-accent rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ width: s.icon, height: s.icon }}
      >
        <svg
          width={s.icon * 0.52}
          height={s.icon * 0.52}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-on-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="12" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="16" y2="18" />
        </svg>
      </div>
      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
          <span className={`font-bold tracking-[0.08em] text-text ${s.text}`}>
            ONE
          </span>
          {s.sub && (
            <span className="text-2xs font-medium text-text-tertiary tracking-[0.15em] uppercase mt-0.5">
              lifestyle
            </span>
          )}
        </div>
      )}
    </div>
  );
};
