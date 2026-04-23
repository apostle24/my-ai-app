import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, FileText, Settings, Video, Image, Send, ArrowLeft, MoreHorizontal, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../store';

export default function CommunityDetail() {
  const { communityId } = useParams();
  const { user, userProfile } = useAuth();
  const { setAuthModalOpen } = useAppStore();
  const navigate = useNavigate();
  
  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newPostText, setNewPostText] = useState('');

  useEffect(() => {
    if (!communityId) return;
    
    // Listen to Community Data
    const unsubCommunity = onSnapshot(doc(db, 'communities', communityId), (doc) => {
      if (doc.exists()) {
        setCommunity({ id: doc.id, ...doc.data() });
      } else {
        toast.error('Community not found');
        navigate('/communities');
      }
    });

    // Fetch Posts
    const qPosts = query(collection(db, 'communityPosts'), where('communityId', '==', communityId), orderBy('createdAt', 'desc'));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      setPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return () => {
      unsubCommunity();
      unsubPosts();
    };
  }, [communityId, navigate]);

  // Check membership explicitly via members collection
  useEffect(() => {
    if (!user || !communityId) return;
    const qMember = query(collection(db, 'communityMembers'), where('communityId', '==', communityId), where('userId', '==', user.uid));
    const unsubMember = onSnapshot(qMember, (snapshot) => {
      setIsMember(!snapshot.empty);
      setLoading(false);
    });
    return () => unsubMember();
  }, [user, communityId]);

  const handleJoinToggle = async () => {
    if (!user) return setAuthModalOpen(true);
    
    // For now we just mock real time member join for UX demonstration, to implement robustly would require transaction/CF
    if (isMember) {
      toast.info('Leaving group...');
      // find their member doc and delete
      const snap = await getDoc(doc(db, 'communities', communityId!)); // mock check
      setIsMember(false);
    } else {
      await addDoc(collection(db, 'communityMembers'), {
        communityId,
        userId: user.uid,
        role: 'member',
        joinedAt: new Date().toISOString()
      });
      toast.success(`Joined ${community?.name}!`);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setAuthModalOpen(true);
    if (!isMember) return toast.error('You must join to post.');
    if (!newPostText.trim()) return;

    try {
      await addDoc(collection(db, 'communityPosts'), {
        communityId,
        authorId: user.uid,
        authorName: userProfile?.displayName || 'User',
        authorPhoto: userProfile?.photoURL || '',
        content: newPostText,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString()
      });
      setNewPostText('');
      toast.success('Posted!');
    } catch (err) {
      toast.error('Failed to post');
      console.error(err);
    }
  };

  if (!community) return <div className="p-8 text-center text-white">Loading...</div>;

  return (
    <div className="flex-1 w-full bg-black min-h-0 overflow-y-auto pb-20 md:pb-0 relative">
      
      {/* Cover / Header */}
      <div className="h-48 md:h-64 bg-zinc-900 border-b border-zinc-800 relative w-full overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
        <button onClick={() => navigate('/communities')} className="absolute top-4 left-4 z-20 p-2 bg-black/50 hover:bg-black text-white rounded-full transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-20 -mt-16 md:-mt-20">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row gap-6 items-center md:items-end mb-8">
          <img referrerPolicy="no-referrer" src={community.imageUrl} alt={community.name} className="w-32 h-32 rounded-2xl border-4 border-zinc-950 bg-zinc-800 object-cover shrink-0" />
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-white">{community.name}</h1>
            <p className="text-zinc-400 mt-1 flex items-center justify-center md:justify-start gap-3">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {community.memberCount || 1} members</span>
              <span>•</span>
              <span>{community.isPublic ? 'Public Group' : 'Private Group'}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto shrink-0 mt-4 md:mt-0">
            <button 
              onClick={handleJoinToggle}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-full font-bold transition-all ${isMember ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
            >
              {isMember ? 'Joined' : 'Join Group'}
            </button>
            {isMember && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate(`/call/community_${communityId}?mode=audio`)}
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors"
                  title="Start Voice Call"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => navigate(`/call/community_${communityId}?mode=video`)}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors"
                  title="Start Group Video Call"
                >
                  <Video className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 space-y-6">
            
            {/* Create Post */}
            {isMember && (
              <form onSubmit={handleCreatePost} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 flex gap-3">
                <img referrerPolicy="no-referrer" src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName}`} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1">
                  <textarea 
                    value={newPostText}
                    onChange={(e) => setNewPostText(e.target.value)}
                    placeholder="Write something to the group..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-700 resize-none min-h-[80px]"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <button type="button" className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"><Image className="w-5 h-5"/></button>
                    <button type="submit" disabled={!newPostText.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-full font-medium transition-colors flex items-center gap-2">
                      <Send className="w-4 h-4"/> Post
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Posts Feed */}
            {posts.length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/50 rounded-3xl border border-zinc-800/50 border-dashed">
                <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No recent activity. Be the first to post!</p>
              </div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img referrerPolicy="no-referrer" src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-white text-sm">{post.authorName}</p>
                        <p className="text-xs text-zinc-500">{new Date(post.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button className="text-zinc-500 hover:text-white"><MoreHorizontal className="w-5 h-5"/></button>
                  </div>
                  <p className="text-zinc-300 whitespace-pre-wrap">{post.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="md:col-span-1 space-y-6 hidden md:block">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="font-bold text-white mb-3">About Group</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {community.description || 'Welcome to this community! Here you can connect, share ideas, and jump into instant group video calls with other members.'}
              </p>
            </div>
            {isMember && (
              <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-3xl p-6 text-center">
                <Video className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                <h3 className="font-bold text-white mb-2">Live Group Room</h3>
                <p className="text-sm text-indigo-200/70 mb-4">Jump straight into a voice or video call with anyone active in the group right now.</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => navigate(`/call/community_${communityId}?mode=audio`)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white flex justify-center items-center py-2.5 rounded-xl font-bold transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => navigate(`/call/community_${communityId}?mode=video`)}
                    className="flex-[2] bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl font-bold transition-colors"
                  >
                    Enter Room
                  </button>
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
