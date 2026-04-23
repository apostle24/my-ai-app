import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, Plus, Hash } from 'lucide-react';
import { toast } from 'sonner';

export default function Communities() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', isPublic: true });

  useEffect(() => {
    const q = query(collection(db, 'communities'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      setCommunities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error('Check login to create group');
    if (!newGroup.name.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'communities'), {
        name: newGroup.name,
        description: newGroup.description,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        isPublic: newGroup.isPublic,
        imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(newGroup.name)}&background=random`
      });

      await addDoc(collection(db, 'communityMembers'), {
        communityId: docRef.id,
        userId: user.uid,
        role: 'admin',
        joinedAt: new Date().toISOString()
      });

      toast.success('Group created!');
      setIsCreating(false);
      navigate(`/communities/${docRef.id}`);
    } catch (err) {
      toast.error('Could not create community.');
      console.error(err);
    }
  };

  const filtered = communities.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex-1 w-full bg-black min-h-0 overflow-y-auto pb-20 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users className="w-8 h-8 text-indigo-500" />
              Communities Hub
            </h1>
            <p className="text-zinc-400 mt-1">Discover groups, join discussions, and follow topics.</p>
          </div>
          <button 
            onClick={() => setIsCreating(!isCreating)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isCreating ? 'Cancel' : <><Plus className="w-5 h-5"/> Create Group</>}
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-lg font-bold text-white mb-4">Initialize New Group</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Group Name</label>
                <input 
                  type="text" 
                  value={newGroup.name}
                  onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Design Enthusiasts"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
                <textarea 
                  value={newGroup.description}
                  onChange={e => setNewGroup({...newGroup, description: e.target.value})}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 h-24 resize-none"
                  placeholder="What is this group about?"
                  maxLength={500}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors"
                disabled={!newGroup.name.trim()}
              >
                Launch Community
              </button>
            </div>
          </form>
        )}

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(community => (
            <Link 
              to={`/communities/${community.id}`} 
              key={community.id}
              className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl hover:border-indigo-500/50 transition-all group flex flex-col h-full"
            >
              <div className="flex items-start gap-4 mb-3">
                <img referrerPolicy="no-referrer" src={community.imageUrl} alt={community.name} className="w-16 h-16 rounded-2xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-white truncate group-hover:text-indigo-400 transition-colors">
                    {community.name}
                  </h3>
                  <div className="flex items-center text-xs text-zinc-500 mt-1">
                    <Users className="w-3.5 h-3.5 mr-1" />
                    {community.memberCount || 1} members
                  </div>
                </div>
              </div>
              <p className="text-sm text-zinc-400 line-clamp-2 mb-4 flex-1">
                {community.description || 'No description available.'}
              </p>
              <div className="pt-4 border-t border-zinc-800/50 mt-auto flex items-center justify-between">
                <span className="text-indigo-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  Join Group &rarr;
                </span>
                <Hash className="w-4 h-4 text-zinc-600" />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-500">
              No communities found. Why not create one?
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
