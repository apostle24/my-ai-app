import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Heart, MessageCircle, UserPlus, DollarSign, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store';

export default function Notifications() {
  const { user } = useAuth();
  const { setAuthModalOpen } = useAppStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(notif => {
        batch.update(doc(db, 'notifications', notif.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'follow': return <UserPlus className="w-5 h-5 text-indigo-500" />;
      case 'payment': return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'ai_result': return <Sparkles className="w-5 h-5 text-purple-500" />;
      default: return <Bell className="w-5 h-5 text-zinc-400" />;
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 bg-zinc-900 rounded-2xl animate-pulse">
            <div className="w-12 h-12 bg-zinc-800 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-zinc-800 rounded"></div>
              <div className="w-1/2 h-3 bg-zinc-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] px-4 text-center">
        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-2">Sign in to view notifications</h2>
          <p className="text-zinc-400 mb-6">You need to be signed in to see your alerts and updates.</p>
          <button 
            onClick={() => setAuthModalOpen(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-zinc-900 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notifications
        </h1>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={markAllAsRead}
            className="text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      <div className="divide-y divide-zinc-900/50">
        {notifications.length > 0 ? (
          notifications.map(notif => (
            <Link 
              key={notif.id}
              to={notif.link || '#'}
              onClick={() => !notif.isRead && markAsRead(notif.id)}
              className={`flex items-start gap-4 p-4 transition-colors hover:bg-zinc-900/50 ${!notif.isRead ? 'bg-indigo-500/5' : ''}`}
            >
              <div className="relative flex-shrink-0 mt-1">
                <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                  {getIcon(notif.type)}
                </div>
                {!notif.isRead && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full border-2 border-black"></div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug">
                  <span className="font-semibold">{notif.title}</span>{' '}
                  <span className="text-zinc-300">{notif.message}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {notif.createdAt ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }) : 'just now'}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No notifications yet</h3>
            <p className="text-zinc-500 max-w-sm">
              When you get likes, comments, or new followers, they'll show up here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
