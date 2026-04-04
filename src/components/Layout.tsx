import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Sparkles, Bell, User, PlusCircle, ShoppingBag, MessageCircle, HelpCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { db } from "../firebase";
import AuthModal from "./AuthModal";
import OnboardingModal from "./OnboardingModal";
import { useAppStore } from "../store";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Discover", path: "/discover" },
  { icon: Sparkles, label: "AI Studio", path: "/ai-studio" },
  { icon: ShoppingBag, label: "Market", path: "/marketplace" },
  { icon: MessageCircle, label: "Messages", path: "/messages" },
  { icon: Bell, label: "Alerts", path: "/notifications", badge: true },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signInWithGoogle } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAuthModalOpen, setAuthModalOpen } = useAppStore();
  const [runGlobalTour, setRunGlobalTour] = useState(false);

  const globalTourSteps: Step[] = [
    {
      target: '.tour-nav-ai-studio',
      content: 'Welcome to NEXUS! Check out the AI Studio to generate amazing content like ebooks, business plans, and images.',
      disableBeacon: true,
    },
    {
      target: '.tour-nav-market',
      content: 'Browse the Marketplace to buy and sell digital products created by the community.',
    },
    {
      target: '.tour-nav-create',
      content: 'Click here to create a new post and share your thoughts or creations with your followers.',
    },
    {
      target: '.tour-nav-profile',
      content: 'Visit your profile to customize your avatar, bio, and manage your content.',
    }
  ];

  const handleGlobalJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(status)) {
      setRunGlobalTour(false);
      localStorage.setItem('hasSeenGlobalTour', 'true');
    }
  };

  useEffect(() => {
    const hasSeenGlobalTour = localStorage.getItem('hasSeenGlobalTour');
    if (!hasSeenGlobalTour && location.pathname === '/') {
      setTimeout(() => setRunGlobalTour(true), 1500);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('isRead', '==', false),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });
    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-black text-white p-4 font-sans">
        <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-3xl max-w-md w-full flex flex-col items-center text-center shadow-2xl">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to NEXUS</h1>
          <p className="text-zinc-400 mb-8">Join the next-generation social platform for creators and AI enthusiasts.</p>
          
          <button 
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
          >
            <User className="w-6 h-6" />
            Sign In to Continue
          </button>
        </div>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans">
      <Joyride
        steps={globalTourSteps}
        run={runGlobalTour}
        continuous
        showProgress
        showSkipButton
        callback={handleGlobalJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#6366f1',
            backgroundColor: '#18181b',
            textColor: '#fff',
            arrowColor: '#18181b',
            zIndex: 1000,
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonNext: {
            backgroundColor: '#6366f1',
          },
          buttonBack: {
            color: '#a1a1aa',
          }
        }}
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-zinc-950 border-r border-zinc-900 z-20 shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            NEXUS
          </h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            
            // Add tour classes
            let tourClass = '';
            if (item.path === '/ai-studio') tourClass = 'tour-nav-ai-studio';
            if (item.path === '/marketplace') tourClass = 'tour-nav-market';
            if (item.path === '/profile') tourClass = 'tour-nav-profile';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 font-medium text-lg relative",
                  isActive 
                    ? "bg-zinc-900 text-white font-semibold" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/50",
                  tourClass
                )}
              >
                <div className="relative">
                  <Icon className={cn("w-6 h-6", isActive && "text-indigo-400")} />
                  {item.badge && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          
          <button 
            onClick={() => navigate('/', { state: { focusCreate: true } })}
            className="w-full mt-6 bg-white text-black hover:bg-zinc-200 font-semibold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition-colors tour-nav-create"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Create</span>
          </button>
        </nav>

        <div className="p-4 border-t border-zinc-900 space-y-2">
          <button
            onClick={() => setRunGlobalTour(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-sm font-semibold">App Tour</span>
          </button>
          
          {user ? (
            <NavLink to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-900 transition-colors">
              <img referrerPolicy="no-referrer" 
                src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName || 'User'}&background=random`} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover border border-zinc-800"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{userProfile?.displayName || 'Guest'}</p>
                <p className="text-xs text-zinc-500 truncate">@{userProfile?.username || 'user'}</p>
              </div>
            </NavLink>
          ) : (
            <button 
              onClick={() => setAuthModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold transition-colors"
            >
              <User className="w-5 h-5" />
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex flex-col flex-1 h-full relative overflow-hidden bg-black">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-black/90 backdrop-blur-md z-10 shrink-0">
          <h1 className="text-xl font-bold tracking-tight">
            NEXUS
          </h1>
          <div className="flex items-center gap-3">
            {!user ? (
              <button 
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-medium transition-colors"
              >
                Sign In
              </button>
            ) : (
              <button 
                onClick={() => navigate('/', { state: { focusCreate: true } })}
                className="p-2 bg-zinc-900 rounded-full text-white"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto scroll-smooth relative w-full">
          <div className="max-w-3xl mx-auto w-full h-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden border-t border-zinc-900 bg-black/95 backdrop-blur-lg pb-safe pt-2 px-2 z-20 shrink-0">
          <div className="flex justify-around items-center pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 relative",
                    isActive 
                      ? "text-white" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <div className="relative">
                    <Icon className={cn("w-6 h-6 mb-1 transition-transform", isActive && "scale-110 text-indigo-400")} />
                    {item.badge && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500 border border-black"></span>
                      </span>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
      <OnboardingModal />
    </div>
  );
}
