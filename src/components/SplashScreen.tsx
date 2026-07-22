import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'logo' | 'loading' | 'exit'>('logo');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('loading'), 600);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== 'loading') return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setPhase('exit');
          setTimeout(onComplete, 400);
          return 100;
        }
        return p + Math.random() * 18 + 7;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [phase, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-400 ${
        phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(160deg, #FFFFFF 0%, #F8F8F8 40%, #F0F0F0 100%)',
      }}
    >
      <div className="absolute top-[-80px] sm:top-[-120px] right-[-60px] sm:right-[-80px] w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] rounded-full bg-accent/5 blur-3xl" />
      <div className="absolute bottom-[-60px] sm:bottom-[-100px] left-[-40px] sm:left-[-60px] w-[180px] sm:w-[250px] h-[180px] sm:h-[250px] rounded-full bg-surface-muted/8 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center">
        <div
          className={`transition-all duration-700 ease-out ${
            phase === 'logo'
              ? 'opacity-0 scale-75 translate-y-4'
              : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center shadow-lg mb-5 mx-auto">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="12" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="16" y2="18" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-text tracking-[0.08em] text-center">
            ONE
          </h1>
          <p className="text-xs text-text-tertiary tracking-[0.2em] uppercase mt-1 text-center">
            lifestyle
          </p>
        </div>

        <div
          className={`mt-10 w-48 transition-all duration-500 ${
            phase === 'logo' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="h-[3px] bg-surface-inset rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200 ease-out bg-accent"
              style={{
                width: `${Math.min(progress, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <p
        className={`absolute bottom-10 text-[11px] text-text-tertiary transition-opacity duration-500 ${
          phase === 'logo' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        ONE v1.0
      </p>
    </div>
  );
};
