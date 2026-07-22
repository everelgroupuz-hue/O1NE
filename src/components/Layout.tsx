import { ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { expandApp, readyApp, showBackButton, hideBackButton, isTelegramWebApp } from '../lib/telegram';

interface LayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
}

export const Layout = ({ children, showHeader = true, showBottomNav = true }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    expandApp();
    readyApp();
  }, []);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/home') {
      hideBackButton();
    } else {
      showBackButton(() => navigate(-1));
    }

    return () => {
      hideBackButton();
    };
  }, [location, navigate]);

  useEffect(() => {
    if (!isTelegramWebApp()) return;
    const vp = window.visualViewport;
    if (!vp) return;

    const onResize = () => {
      const keyboardOpen = vp.height < window.innerHeight * 0.75;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
    };

    vp.addEventListener('resize', onResize);
    vp.addEventListener('scroll', onResize);
    onResize();

    return () => {
      vp.removeEventListener('resize', onResize);
      vp.removeEventListener('scroll', onResize);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return (
    <div className="min-h-screen bg flex flex-col">
      {showHeader && <Header />}

      <main
        className="flex-1 layout-main"
        style={showBottomNav ? { paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
};
