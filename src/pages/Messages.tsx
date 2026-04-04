import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, Search, User as UserIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sendPushNotificationToUser } from '../utils/pushNotifications';
import { useAppStore } from '../store';

interface Chat {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  updatedAt: string;
  otherUser?: {
    uid: string;
    displayName: string;
    photoURL: string;
  };
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export default function Messages() {
  const { user, userProfile } = useAuth();
  const { setAuthModalOpen } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Parse chatId from URL if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('chatId');
    if (chatId) {
      setActiveChatId(chatId);
    }
  }, [location]);

  // Fetch chats
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatPromises = snapshot.docs.map(async (chatDoc) => {
        const data = chatDoc.data();
        const otherUserId = data.participantIds.find((id: string) => id !== user.uid);
        
        let otherUser = null;
        if (otherUserId) {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            otherUser = {
              uid: userData.uid,
              displayName: userData.displayName || 'Unknown User',
              photoURL: userData.photoURL || ''
            };
          }
        }

        return {
          id: chatDoc.id,
          ...data,
          otherUser
        } as Chat;
      });

      const resolvedChats = await Promise.all(chatPromises);
      setChats(resolvedChats);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch messages for active chat
  useEffect(() => {
    if (!user || !activeChatId) return;

    const q = query(
      collection(db, `chats/${activeChatId}/messages`),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      setMessages(fetchedMessages.reverse());
      
      // Mark unread messages as read
      fetchedMessages.forEach(msg => {
        if (!msg.read && msg.senderId !== user.uid) {
          updateDoc(doc(db, `chats/${activeChatId}/messages`, msg.id), {
            read: true
          });
        }
      });
    });

    return () => unsubscribe();
  }, [activeChatId, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatId || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    const now = new Date().toISOString();

    try {
      // Add message
      await addDoc(collection(db, `chats/${activeChatId}/messages`), {
        chatId: activeChatId,
        senderId: user.uid,
        text: messageText,
        createdAt: now,
        read: false
      });

      // Update chat last message
      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: messageText,
        lastMessageTime: now,
        updatedAt: now
      });

      // Send push notification to the other participant
      const activeChat = chats.find(c => c.id === activeChatId);
      const recipientId = activeChat?.participantIds.find(id => id !== user.uid);
      if (recipientId) {
        sendPushNotificationToUser(recipientId, {
          title: `New message from ${userProfile?.displayName || 'Someone'}`,
          body: messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
          url: `/messages?chatId=${activeChatId}`,
          icon: userProfile?.photoURL || '/vite.svg'
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const filteredChats = chats.filter(chat => 
    chat.otherUser?.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] px-4 text-center">
        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-2">Sign in to view messages</h2>
          <p className="text-zinc-400 mb-6">You need to be signed in to view your conversations.</p>
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
    <div className="flex h-[calc(100vh-64px)] md:h-screen bg-black">
      {/* Chats List Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-zinc-900 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-zinc-900">
          <h1 className="text-xl font-bold text-white mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No conversations yet.
            </div>
          ) : (
            filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  navigate(`/messages?chatId=${chat.id}`);
                }}
                className={`w-full p-4 flex items-center gap-3 hover:bg-zinc-900 transition-colors border-b border-zinc-900/50 ${activeChatId === chat.id ? 'bg-zinc-900' : ''}`}
              >
                {chat.otherUser?.photoURL ? (
                  <img referrerPolicy="no-referrer" src={chat.otherUser.photoURL} alt={chat.otherUser.displayName} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-zinc-400" />
                  </div>
                )}
                <div className="flex-1 text-left truncate">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-medium text-white truncate">{chat.otherUser?.displayName}</h3>
                    {chat.lastMessageTime && (
                      <span className="text-xs text-zinc-500 flex-shrink-0 ml-2">
                        {new Date(chat.lastMessageTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 truncate">
                    {chat.lastMessage || 'Started a conversation'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Active Chat Area */}
      <div className={`flex-1 flex flex-col ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
        {activeChatId && activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-zinc-900 flex items-center gap-3 bg-black/50 backdrop-blur-md sticky top-0 z-10">
              <button 
                onClick={() => {
                  setActiveChatId(null);
                  navigate('/messages');
                }}
                className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/profile/${activeChat.otherUser?.uid}`)}
              >
                {activeChat.otherUser?.photoURL ? (
                  <img referrerPolicy="no-referrer" src={activeChat.otherUser.photoURL} alt={activeChat.otherUser.displayName} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
                <h2 className="font-semibold text-white">{activeChat.otherUser?.displayName}</h2>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => {
                const isMine = msg.senderId === user.uid;
                const showAvatar = !isMine && (index === 0 || messages[index - 1].senderId !== msg.senderId);
                
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2`}>
                    {!isMine && (
                      <div className="w-8 flex-shrink-0">
                        {showAvatar && activeChat.otherUser?.photoURL && (
                          <img referrerPolicy="no-referrer" src={activeChat.otherUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                        )}
                      </div>
                    )}
                    
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isMine 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      <span className={`text-[10px] mt-1 block ${isMine ? 'text-indigo-200' : 'text-zinc-500'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-zinc-900 bg-black">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-full transition-colors flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <Send className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium text-zinc-400">Your Messages</p>
            <p className="text-sm mt-1">Select a conversation or start a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
