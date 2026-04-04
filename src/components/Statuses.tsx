import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Status {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string;
  content: string;
  bgColor: string;
  createdAt: string;
  expiresAt: string;
}

const BG_COLORS = [
  'bg-indigo-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-blue-500',
];

export default function Statuses() {
  const { user, userProfile } = useAuth();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newStatusText, setNewStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
  
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingIndex, setViewingIndex] = useState(0);

  useEffect(() => {
    // Fetch active statuses (expiresAt > now)
    const now = new Date().toISOString();
    const q = query(
      collection(db, 'statuses'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStatuses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Status));
      // Sort by createdAt desc
      fetchedStatuses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setStatuses(fetchedStatuses);
    }, (error) => {
      console.error("Error fetching statuses:", error);
    });

    return () => unsubscribe();
  }, []);

  // Group statuses by user
  const groupedStatuses = statuses.reduce((acc, status) => {
    if (!acc[status.userId]) {
      acc[status.userId] = [];
    }
    acc[status.userId].push(status);
    return acc;
  }, {} as Record<string, Status[]>);

  // Get unique users who have active statuses
  const usersWithStatuses = Object.keys(groupedStatuses).map(userId => {
    const userStatuses = groupedStatuses[userId];
    return {
      userId,
      userDisplayName: userStatuses[0].userDisplayName,
      userPhotoURL: userStatuses[0].userPhotoURL,
      statuses: userStatuses,
      hasUnseen: true // Simplified for now
    };
  });

  // Put current user first if they have statuses
  const sortedUsers = [...usersWithStatuses].sort((a, b) => {
    if (a.userId === user?.uid) return -1;
    if (b.userId === user?.uid) return 1;
    return 0;
  });

  const handleCreateStatus = async () => {
    if (!newStatusText.trim() || !user || !userProfile) return;

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      await addDoc(collection(db, 'statuses'), {
        userId: user.uid,
        userDisplayName: userProfile.displayName || 'User',
        userPhotoURL: userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.displayName || 'User'}`,
        content: newStatusText,
        bgColor: selectedBg,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      setIsCreating(false);
      setNewStatusText('');
      toast.success('Status updated!');
    } catch (error) {
      console.error("Error creating status:", error);
      toast.error('Failed to update status');
    }
  };

  const openViewer = (userId: string) => {
    setViewingUserId(userId);
    setViewingIndex(0);
  };

  const closeViewer = () => {
    setViewingUserId(null);
    setViewingIndex(0);
  };

  const nextStatus = () => {
    if (!viewingUserId) return;
    const userStatuses = groupedStatuses[viewingUserId];
    if (viewingIndex < userStatuses.length - 1) {
      setViewingIndex(prev => prev + 1);
    } else {
      // Move to next user
      const currentUserIdx = sortedUsers.findIndex(u => u.userId === viewingUserId);
      if (currentUserIdx < sortedUsers.length - 1) {
        setViewingUserId(sortedUsers[currentUserIdx + 1].userId);
        setViewingIndex(0);
      } else {
        closeViewer();
      }
    }
  };

  const prevStatus = () => {
    if (!viewingUserId) return;
    if (viewingIndex > 0) {
      setViewingIndex(prev => prev - 1);
    } else {
      // Move to prev user
      const currentUserIdx = sortedUsers.findIndex(u => u.userId === viewingUserId);
      if (currentUserIdx > 0) {
        const prevUser = sortedUsers[currentUserIdx - 1];
        setViewingUserId(prevUser.userId);
        setViewingIndex(prevUser.statuses.length - 1);
      } else {
        closeViewer();
      }
    }
  };

  // Auto-advance status viewer
  useEffect(() => {
    if (!viewingUserId) return;
    const timer = setTimeout(() => {
      nextStatus();
    }, 5000); // 5 seconds per status
    return () => clearTimeout(timer);
  }, [viewingUserId, viewingIndex]);

  const viewingUserStatuses = viewingUserId ? groupedStatuses[viewingUserId] : [];
  const currentStatus = viewingUserStatuses[viewingIndex];

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { current } = scrollContainerRef;
      const scrollAmount = direction === 'left' ? -200 : 200;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group">
      {/* Scroll Left Button */}
      <button 
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>

      {/* Status List */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
      >
        {/* Add Status Button */}
        <div className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer" onClick={() => setIsCreating(true)}>
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-zinc-800 p-0.5">
              <img referrerPolicy="no-referrer" 
                src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName || 'User'}`} 
                alt="Your Status" 
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-black">
              <Plus className="w-3 h-3 text-white" />
            </div>
          </div>
          <span className="text-xs text-zinc-400 font-medium truncate w-full text-center">Add Status</span>
        </div>

        {/* User Statuses */}
        {sortedUsers.map(u => (
          <div key={u.userId} className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer" onClick={() => openViewer(u.userId)}>
            <div className={`w-16 h-16 rounded-full p-0.5 border-2 ${u.hasUnseen ? 'border-indigo-500' : 'border-zinc-600'}`}>
              <img referrerPolicy="no-referrer" 
                src={u.userPhotoURL} 
                alt={u.userDisplayName} 
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <span className="text-xs text-zinc-400 font-medium truncate w-full text-center">
              {u.userId === user?.uid ? 'My Status' : u.userDisplayName.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Scroll Right Button */}
      <button 
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>

      {/* Create Status Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <div className={`w-full max-w-md h-[80vh] rounded-3xl flex flex-col relative overflow-hidden ${selectedBg}`}>
            <button onClick={() => setIsCreating(false)} className="absolute top-4 left-4 p-2 bg-black/20 rounded-full text-white hover:bg-black/40 transition">
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex-1 flex items-center justify-center p-8">
              <textarea
                value={newStatusText}
                onChange={(e) => setNewStatusText(e.target.value)}
                placeholder="Type a status..."
                className="w-full bg-transparent text-white text-3xl font-bold text-center resize-none outline-none placeholder-white/50"
                rows={5}
                autoFocus
              />
            </div>

            <div className="p-4 bg-black/20 flex items-center justify-between">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {BG_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedBg(color)}
                    className={`w-8 h-8 rounded-full flex-shrink-0 ${color} ${selectedBg === color ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                  />
                ))}
              </div>
              <button 
                onClick={handleCreateStatus}
                disabled={!newStatusText.trim()}
                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Viewer Modal */}
      {viewingUserId && currentStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
          <div className={`w-full max-w-md h-full md:h-[90vh] md:rounded-3xl flex flex-col relative overflow-hidden ${currentStatus.bgColor}`}>
            
            {/* Progress Bars */}
            <div className="absolute top-4 left-0 right-0 px-4 flex gap-1 z-10">
              {viewingUserStatuses.map((s, i) => (
                <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-100 ease-linear"
                    style={{ 
                      width: i < viewingIndex ? '100%' : i === viewingIndex ? '100%' : '0%',
                      transitionDuration: i === viewingIndex ? '5000ms' : '0ms'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-8 left-0 right-0 px-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <img referrerPolicy="no-referrer" src={currentStatus.userPhotoURL} alt="" className="w-10 h-10 rounded-full border border-white/20" />
                <div>
                  <h3 className="text-white font-semibold text-sm">{currentStatus.userDisplayName}</h3>
                  <p className="text-white/70 text-xs">
                    {new Date(currentStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <button onClick={closeViewer} className="p-2 text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex items-center justify-center p-8 relative">
              {/* Click areas for navigation */}
              <div className="absolute inset-y-0 left-0 w-1/3 z-0" onClick={prevStatus} />
              <div className="absolute inset-y-0 right-0 w-2/3 z-0" onClick={nextStatus} />
              
              <p className="text-white text-3xl font-bold text-center z-10 pointer-events-none">
                {currentStatus.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
