import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, collection, query, where, getDocs, orderBy, addDoc, getDoc, onSnapshot, serverTimestamp, limit, deleteDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, Edit3, Camera, MapPin, Link as LinkIcon, Calendar, Wallet, TrendingUp, Users, Image as ImageIcon, Video, FileText, Heart, MessageCircle, X, Sparkles, Zap, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';

const compressImage = (base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

export default function Profile() {
  const { userId } = useParams();
  const { user, userProfile: currentUserProfile } = useAuth();
  const navigate = useNavigate();
  const { setAuthModalOpen, setPremiumModalOpen } = useAppStore();
  const [userProfile, setUserProfile] = useState<any>(null);
  const isOwnProfile = !userId || (user && userId === user.uid);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    username: '',
    bio: '',
    website: '',
    location: ''
  });
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [userPurchases, setUserPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Product creation state
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    title: '',
    description: '',
    features: '',
    price: '',
    category: 'Digital',
  });
  const [imageBase64, setImageBase64] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string>('');

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'menu' | 'privacy' | 'terms' | 'support' | 'account'>('menu');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followListUsers, setFollowListUsers] = useState<any[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);

  const openFollowList = async (type: 'followers' | 'following') => {
    if (!userProfile) return;
    setFollowListType(type);
    setLoadingFollowList(true);
    setFollowListUsers([]);

    try {
      const q = query(
        collection(db, type === 'followers' ? 'follows' : 'follows'),
        where(type === 'followers' ? 'followingId' : 'followerId', '==', userProfile.id),
        limit(50)
      );
      const snap = await getDocs(q);
      const userIds = snap.docs.map(doc => type === 'followers' ? doc.data().followerId : doc.data().followingId);
      
      if (userIds.length > 0) {
        // Fetch user profiles in chunks of 10
        const users: any[] = [];
        for (let i = 0; i < userIds.length; i += 10) {
          const chunk = userIds.slice(i, i + 10);
          const usersQ = query(collection(db, 'users'), where('uid', 'in', chunk));
          const usersSnap = await getDocs(usersQ);
          users.push(...usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setFollowListUsers(users);
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      toast.error(`Failed to load ${type}`);
    } finally {
      setLoadingFollowList(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (isOwnProfile) {
        setUserProfile(currentUserProfile);
      } else if (userId) {
        try {
          const docRef = doc(db, 'users', userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile({ id: docSnap.id, ...docSnap.data() });
          } else {
            toast.error('User not found');
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
    };
    fetchProfile();
  }, [userId, isOwnProfile, currentUserProfile]);

  useEffect(() => {
    if (userProfile && isOwnProfile) {
      setEditForm({
        displayName: userProfile.displayName || '',
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        website: userProfile.website || '',
        location: userProfile.location || ''
      });
    }
  }, [userProfile, isOwnProfile]);

  useEffect(() => {
    const targetUserId = isOwnProfile ? user?.uid : userId;
    if (!targetUserId) return;

    const postsQ = query(collection(db, 'posts'), where('authorId', '==', targetUserId), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribePosts = onSnapshot(postsQ, (snapshot) => {
      setUserPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user posts:", error);
      setLoading(false);
    });

    const productsQ = query(collection(db, 'products'), where('creatorId', '==', targetUserId), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      setUserProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching user products:", error);
    });

    let unsubscribePurchases = () => {};
    let unsubscribeSaved = () => {};
    if (isOwnProfile) {
      const purchasesQ = query(collection(db, 'transactions'), where('userId', '==', targetUserId), where('type', '==', 'purchase'), orderBy('createdAt', 'desc'), limit(50));
      unsubscribePurchases = onSnapshot(purchasesQ, async (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const completedTxs = txs.filter((tx: any) => tx.status === 'completed');
        
        const purchasesWithProducts = await Promise.all(completedTxs.map(async (tx: any) => {
          if (tx.itemId) {
            try {
              const productDoc = await getDoc(doc(db, 'products', tx.itemId));
              if (productDoc.exists()) {
                return { ...tx, product: { id: productDoc.id, ...productDoc.data() } };
              }
            } catch (e) {
              console.error("Error fetching product for purchase:", e);
            }
          }
          return tx;
        }));
        setUserPurchases(purchasesWithProducts.filter(p => p.product));
      }, (error) => {
        console.error("Error fetching user purchases:", error);
      });

      const savedQ = query(collection(db, `users/${targetUserId}/savedPosts`), orderBy('savedAt', 'desc'), limit(50));
      unsubscribeSaved = onSnapshot(savedQ, async (snapshot) => {
        const savedRecords = snapshot.docs.map(doc => ({ id: doc.id, savedAt: doc.data().savedAt }));
        const populatedPosts = await Promise.all(savedRecords.map(async (record) => {
          try {
            const postDoc = await getDoc(doc(db, 'posts', record.id));
            if (postDoc.exists()) {
              return { ...postDoc.data(), id: postDoc.id, savedAt: record.savedAt };
            }
          } catch(e) {
             console.error("Error fetching saved post:", e);
          }
          return null;
        }));
        setSavedPosts(populatedPosts.filter(p => p !== null));
      }, (error) => {
        console.error("Error fetching saved posts:", error);
      });
    }

    return () => {
      unsubscribePosts();
      unsubscribeProducts();
      unsubscribePurchases();
      unsubscribeSaved();
    };
  }, [user, userId, isOwnProfile]);

  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (user && userProfile && !isOwnProfile) {
        const followDoc = await getDoc(doc(db, 'follows', `${user.uid}_${userProfile.id}`));
        setIsFollowing(followDoc.exists());
      }
    };
    checkFollowStatus();
  }, [user, userProfile, isOwnProfile]);

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow users');
      setAuthModalOpen(true);
      return;
    }

    if (!userProfile) return;

    const followId = `${user.uid}_${userProfile.id}`;
    const followRef = doc(db, 'follows', followId);
    const targetUserRef = doc(db, 'users', userProfile.id);
    const currentUserRef = doc(db, 'users', user.uid);

    try {
      if (isFollowing) {
        await deleteDoc(followRef);
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
        setIsFollowing(false);
        setUserProfile(prev => ({ ...prev, followersCount: Math.max(0, (prev.followersCount || 0) - 1) }));
        toast.success(`Unfollowed ${userProfile.displayName}`);
      } else {
        await setDoc(followRef, {
          followerId: user.uid,
          followingId: userProfile.id,
          createdAt: new Date().toISOString()
        });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        await updateDoc(currentUserRef, { followingCount: increment(1) });
        setIsFollowing(true);
        setUserProfile(prev => ({ ...prev, followersCount: (prev.followersCount || 0) + 1 }));
        toast.success(`You are now following ${userProfile.displayName}`);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error('Failed to update follow status');
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...editForm,
        updatedAt: new Date().toISOString()
      });
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error('Failed to update profile');
    }
  };

  const [isGeneratingBio, setIsGeneratingBio] = useState(false);

  const handleGenerateAIBio = async () => {
    if (!user || !userProfile) return;

    if (!userProfile.isPro) {
      setPremiumModalOpen(true);
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      toast.error('Gemini API Key is missing. Please configure it in your environment variables.');
      return;
    }

    setIsGeneratingBio(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Task: Write a short, professional, and catchy bio for a social media profile. The user's name is ${editForm.displayName || userProfile.displayName}. ${editForm.location ? `They are located in ${editForm.location}.` : ''} Keep it under 150 characters. DO NOT repeat this prompt. Start directly with the bio.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setEditForm({ ...editForm, bio: response.text.trim() });
        toast.success('Bio generated successfully!');
      }
    } catch (error) {
      console.error("Error generating bio:", error);
      toast.error("Failed to generate bio. Please try again.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const [isGeneratingProductDesc, setIsGeneratingProductDesc] = useState(false);

  const handleGenerateAIProductDesc = async () => {
    if (!user || !userProfile) return;

    if (!userProfile.isPro) {
      setPremiumModalOpen(true);
      return;
    }

    if (!productForm.title) {
      toast.error('Please enter a product title first to generate a description.');
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      toast.error('Gemini API Key is missing. Please configure it in your environment variables.');
      return;
    }

    setIsGeneratingProductDesc(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Task: Write a compelling and professional product description for a digital product. The product title is "${productForm.title}". The category is "${productForm.category}". Make it engaging, highlight potential benefits, and keep it under 300 words. DO NOT repeat this prompt. Start directly with the description.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setProductForm({ ...productForm, description: response.text.trim() });
        toast.success('Product description generated successfully!');
      }
    } catch (error) {
      console.error("Error generating product description:", error);
      toast.error("Failed to generate product description. Please try again.");
    } finally {
      setIsGeneratingProductDesc(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    
    if (!productForm.title || !productForm.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'products'), {
        creatorId: user.uid,
        creatorName: userProfile.displayName || 'Creator',
        creatorPhoto: userProfile.photoURL || '',
        title: productForm.title,
        description: productForm.description,
        features: productForm.features.split('\n').filter(f => f.trim() !== ''),
        price: Number(productForm.price),
        category: productForm.category,
        imageUrl: imageBase64 || `https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80`,
        content: pdfBase64 || '',
        createdAt: new Date().toISOString()
      });
      
      toast.success('Product created successfully!');
      setIsCreatingProduct(false);
      setProductForm({ title: '', description: '', features: '', price: '', category: 'Digital' });
      setImageBase64('');
      setPdfBase64('');
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error('Failed to create product');
    }
  };

  const handleMessage = async () => {
    if (!user || !userProfile) return;

    try {
      // Check if chat already exists
      const q = query(
        collection(db, 'chats'),
        where('participantIds', 'array-contains', user.uid),
        limit(50)
      );
      const snapshot = await getDocs(q);
      
      let existingChatId = null;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.participantIds.includes(userProfile.uid)) {
          existingChatId = doc.id;
        }
      });

      if (existingChatId) {
        navigate(`/messages?chatId=${existingChatId}`);
      } else {
        // Create new chat
        const now = new Date().toISOString();
        const chatRef = await addDoc(collection(db, 'chats'), {
          participantIds: [user.uid, userProfile.uid],
          updatedAt: now
        });
        navigate(`/messages?chatId=${chatRef.id}`);
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      toast.error('Failed to start conversation');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit before compression
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Image = reader.result as string;
        // Compress the image before uploading to save space in Firestore
        const compressedImage = await compressImage(base64Image, 400, 0.8);
        
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: compressedImage,
          updatedAt: new Date().toISOString()
        });
        toast.success('Profile photo updated!');
      } catch (error) {
        console.error("Error updating photo:", error);
        toast.error('Failed to update photo');
      }
    };
    reader.readAsDataURL(file);
  };

  if (!userProfile) {
    if (!user && isOwnProfile) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh] px-4 text-center">
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-2">Sign in to view profile</h2>
            <p className="text-zinc-400 mb-6">You need to be signed in to view your profile and manage your account.</p>
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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-4xl mx-auto">
      {/* Header / Cover Photo */}
      <div className="h-48 md:h-64 bg-zinc-900 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
        {isEditing && (
          <button className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
            <Camera className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 md:px-8 relative -mt-20">
        <div className="flex justify-between items-end mb-4">
          <div className="relative group">
            <img referrerPolicy="no-referrer" 
              src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.displayName || 'User'}&size=128`} 
              alt={userProfile.displayName} 
              className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-black object-cover bg-zinc-900"
            />
            {isEditing && (
              <>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-8 h-8 text-white" />
                </button>
              </>
            )}
          </div>
          
          <div className="flex gap-3 pb-4">
            {isOwnProfile ? (
              isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-full font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveProfile}
                    className="px-6 py-2 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-colors"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full font-medium border border-zinc-800 transition-colors flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" /> Edit Profile
                  </button>
                  {!userProfile.isPro && (
                    <button 
                      onClick={() => setPremiumModalOpen(true)}
                      className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full font-medium transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      <Zap className="w-4 h-4" /> Upgrade to Pro
                    </button>
                  )}
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full border border-zinc-800 transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </>
              )
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleFollow}
                  className={`px-6 py-2 rounded-full font-bold transition-colors ${
                    isFollowing 
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button 
                  onClick={handleMessage}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full border border-zinc-800 transition-colors"
                  title="Message"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {isOwnProfile && isEditing ? (
          <div className="space-y-4 max-w-xl animate-in fade-in duration-300">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Display Name</label>
              <input 
                type="text" 
                value={editForm.displayName}
                onChange={e => setEditForm({...editForm, displayName: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-2.5 text-zinc-500">@</span>
                <input 
                  type="text" 
                  value={editForm.username}
                  onChange={e => setEditForm({...editForm, username: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Bio</label>
                <button
                  type="button"
                  onClick={handleGenerateAIBio}
                  disabled={isGeneratingBio}
                  className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                >
                  <Sparkles className={`w-3 h-3 ${isGeneratingBio ? 'animate-pulse' : ''}`} />
                  {isGeneratingBio ? 'Generating...' : 'AI Generate'}
                </button>
              </div>
              <textarea 
                value={editForm.bio}
                onChange={e => setEditForm({...editForm, bio: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-24"
                placeholder="Tell the world about yourself..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Location</label>
                <input 
                  type="text" 
                  value={editForm.location}
                  onChange={e => setEditForm({...editForm, location: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="City, Country"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Website</label>
                <input 
                  type="url" 
                  value={editForm.website}
                  onChange={e => setEditForm({...editForm, website: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {userProfile.displayName}
              {userProfile.isCreator && (
                <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-wider font-semibold">
                  Creator
                </span>
              )}
            </h1>
            <p className="text-zinc-400 mb-4">@{userProfile.username || user.uid.slice(0, 8)}</p>
            
            <p className="text-zinc-200 whitespace-pre-wrap max-w-2xl mb-4">
              {userProfile.bio || 'No bio yet. Click Edit Profile to add one.'}
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-zinc-400 mb-6">
              {userProfile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {userProfile.location}
                </div>
              )}
              {userProfile.website && (
                <div className="flex items-center gap-1">
                  <LinkIcon className="w-4 h-4" /> 
                  <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                    {userProfile.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Joined {userProfile.createdAt ? format(new Date(userProfile.createdAt), 'MMMM yyyy') : 'Recently'}
              </div>
            </div>

            <div className="flex gap-6 mb-8">
              <div 
                className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => openFollowList('followers')}
              >
                <span className="text-xl font-bold text-white">{userProfile.followersCount || 0}</span>
                <span className="text-sm text-zinc-500">Followers</span>
              </div>
              <div 
                className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => openFollowList('following')}
              >
                <span className="text-xl font-bold text-white">{userProfile.followingCount || 0}</span>
                <span className="text-sm text-zinc-500">Following</span>
              </div>
              {userProfile.isCreator && (
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-emerald-400">${userProfile.walletBalance?.toFixed(2) || '0.00'}</span>
                  <span className="text-sm text-zinc-500">Earnings</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Creator Dashboard Preview (if creator) */}
        {userProfile.isCreator && !isEditing && (
          <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-2xl p-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Creator Dashboard</h3>
                <p className="text-sm text-indigo-300">Manage earnings & analytics</p>
              </div>
            </div>
            <Link to="/creator-dashboard" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full text-sm font-medium transition-colors">
              View Dashboard
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-6 border-b border-zinc-900 mb-6">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'posts' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Posts
            {activeTab === 'posts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('media')}
            className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'media' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Media
            {activeTab === 'media' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full"></div>}
          </button>
          {userProfile.isCreator && (
            <button 
              onClick={() => setActiveTab('store')}
              className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'store' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Store
              {activeTab === 'store' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full"></div>}
            </button>
          )}
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('saved')}
              className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'saved' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Saved
              {activeTab === 'saved' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full"></div>}
            </button>
          )}
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('purchases')}
              className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'purchases' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Purchases
              {activeTab === 'purchases' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full"></div>}
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[300px]">
          {loading ? (
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-square bg-zinc-900 animate-pulse"></div>
              ))}
            </div>
          ) : activeTab === 'posts' ? (
            userPosts.length > 0 ? (
              <div className="space-y-4">
                {userPosts.map(post => (
                  <div 
                    key={post.id} 
                    onClick={() => navigate(`/post/${post.id}`)}
                    className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 cursor-pointer hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img referrerPolicy="no-referrer" src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} alt={post.authorName} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-sm font-medium text-white">{post.authorName}</p>
                          <p className="text-xs text-zinc-500">{post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : 'just now'}</p>
                        </div>
                      </div>
                      {post.category && (
                        <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded-full">
                          {post.category}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-200 mb-3">{post.content}</p>
                    {post.imageUrl && (
                      <div className="rounded-xl overflow-hidden">
                        <img referrerPolicy="no-referrer" src={post.imageUrl} alt="Post" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500">
                      <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {post.likesCount || 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> {post.commentsCount || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <FileText className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No posts yet</h3>
                <p className="text-zinc-500">When you create posts, they'll show up here.</p>
              </div>
            )
          ) : activeTab === 'media' ? (
            <div className="grid grid-cols-3 gap-1">
              {userPosts.filter(p => p.imageUrl).length > 0 ? (
                userPosts.filter(p => p.imageUrl).map(post => (
                  <div 
                    key={post.id} 
                    onClick={() => navigate(`/post/${post.id}`)}
                    className="aspect-square bg-zinc-900 relative group cursor-pointer"
                  >
                    <img referrerPolicy="no-referrer" src={post.imageUrl} alt="Media" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <span className="text-white flex items-center gap-1 font-medium"><Heart className="w-5 h-5 fill-current" /> {post.likesCount || 0}</span>
                      <span className="text-white flex items-center gap-1 font-medium"><MessageCircle className="w-5 h-5 fill-current" /> {post.commentsCount || 0}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-20">
                  <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No media yet</h3>
                  <p className="text-zinc-500">Photos and videos you share will appear here.</p>
                </div>
              )}
            </div>
          ) : activeTab === 'store' ? (
            userProducts.length > 0 ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Products</h3>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setIsCreatingProduct(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-medium transition-colors active:scale-95"
                    >
                      Add New
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userProducts.map(product => (
                    <div key={product.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-white line-clamp-1">{product.title}</h4>
                          <span className="text-indigo-400 font-bold">${product.price}</span>
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{product.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800">
                        <span className="text-xs font-medium px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-md uppercase tracking-wider">
                          {product.category}
                        </span>
                        {isOwnProfile && (
                          <button className="text-zinc-400 hover:text-white transition-colors">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <Wallet className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Store Empty</h3>
                <p className="text-zinc-500">No digital products or templates yet.</p>
                {isOwnProfile && (
                  <button 
                    onClick={() => setIsCreatingProduct(true)}
                    className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium transition-colors active:scale-95"
                  >
                    Create Product
                  </button>
                )}
              </div>
            )
          ) : activeTab === 'saved' ? (
            savedPosts.length > 0 ? (
              <div className="space-y-4">
                {savedPosts.map(post => (
                  <div 
                    key={post.id} 
                    onClick={() => navigate(`/post/${post.id}`)}
                    className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 cursor-pointer hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img referrerPolicy="no-referrer" src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} alt={post.authorName} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                           <p className="text-sm font-medium text-white">{post.authorName}</p>
                           <p className="text-xs text-zinc-500">Saved {post.savedAt ? formatDistanceToNow(new Date(post.savedAt), { addSuffix: true }) : 'just now'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDoc(doc(db, `users/${user?.uid}/savedPosts/${post.id}`));
                          toast.info("Removed from saved posts");
                        }}
                        className="text-zinc-500 hover:text-red-500 p-2 rounded-full hover:bg-zinc-800 transition-colors"
                      >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <p className="text-zinc-200 mb-3">{post.content}</p>
                    {post.imageUrl && (
                      <div className="rounded-xl overflow-hidden">
                        <img referrerPolicy="no-referrer" src={post.imageUrl} alt="Post" className="w-full h-auto object-cover" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Bookmark className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No saved posts</h3>
                <p className="text-zinc-500">When you save posts to Drive, they'll appear here.</p>
              </div>
            )
          ) : activeTab === 'purchases' ? (
            userPurchases.length > 0 ? (
              <div className="space-y-4">
                {userPurchases.map(purchase => (
                  <div key={purchase.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="font-bold text-white">{purchase.product?.title || 'Unknown Product'}</h4>
                      <p className="text-sm text-zinc-400">Purchased on {purchase.createdAt ? format(new Date(purchase.createdAt), 'MMM d, yyyy') : 'Unknown date'}</p>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <span className="text-emerald-400 font-bold">${purchase.amount?.toFixed(2)}</span>
                      {purchase.product?.content && (
                        <a 
                          href={purchase.product.content}
                          download={`${purchase.product.title || 'product'}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors flex-1 sm:flex-none text-center"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Wallet className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No purchases yet</h3>
                <p className="text-zinc-500">Products you buy from creators will appear here.</p>
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Create Product Modal */}
      {isCreatingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">Create Product</h2>
              <button 
                onClick={() => setIsCreatingProduct(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Product Title *</label>
                <input 
                  type="text" 
                  required
                  value={productForm.title}
                  onChange={e => setProductForm({...productForm, title: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="e.g., Ultimate Notion Template"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-zinc-400">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateAIProductDesc}
                    disabled={isGeneratingProductDesc || !productForm.title}
                    className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className={`w-3 h-3 ${isGeneratingProductDesc ? 'animate-pulse' : ''}`} />
                    {isGeneratingProductDesc ? 'Generating...' : 'AI Generate'}
                  </button>
                </div>
                <textarea 
                  value={productForm.description}
                  onChange={e => setProductForm({...productForm, description: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-24"
                  placeholder="Describe your product..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Features (One per line)</label>
                <textarea 
                  value={productForm.features}
                  onChange={e => setProductForm({...productForm, features: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-24"
                  placeholder="E.g. Fully customizable&#10;Lifetime updates&#10;High resolution"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Price ($) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={e => setProductForm({...productForm, price: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Category</label>
                  <select 
                    value={productForm.category}
                    onChange={e => setProductForm({...productForm, category: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none"
                  >
                    <option value="Digital">Digital</option>
                    <option value="Template">Template</option>
                    <option value="Course">Course</option>
                    <option value="Service">Service</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Product Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error('Image must be less than 2MB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const compressed = await compressImage(reader.result as string);
                          setImageBase64(compressed);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {imageBase64 && <img referrerPolicy="no-referrer" src={imageBase64} alt="Preview" className="mt-2 h-20 rounded object-cover" />}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Product File (PDF)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 700 * 1024) {
                          toast.error('PDF must be less than 700KB due to database limits');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPdfBase64(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {pdfBase64 && <p className="text-xs text-emerald-400 mt-1">PDF attached successfully</p>}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors active:scale-95"
                >
                  Publish Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {settingsView === 'menu' && <><Settings className="w-5 h-5" /> Settings</>}
                {settingsView === 'account' && 'Account Settings'}
                {settingsView === 'privacy' && 'Privacy Policy'}
                {settingsView === 'terms' && 'Terms of Service'}
                {settingsView === 'support' && 'Help & Support'}
              </h2>
              <button 
                onClick={() => {
                  if (settingsView === 'menu') {
                    setIsSettingsOpen(false);
                  } else {
                    setSettingsView('menu');
                  }
                }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {settingsView === 'menu' && (
                <>
                  <button 
                    onClick={() => setSettingsView('account')}
                    className="w-full flex items-center justify-between p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition-colors text-left group"
                  >
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">Account Settings</h3>
                      <p className="text-sm text-zinc-500">Manage your email, password, and security</p>
                    </div>
                    <Settings className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                  </button>
                  
                  <button onClick={() => setSettingsView('privacy')} className="w-full flex items-center justify-between p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition-colors text-left group">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">Privacy Policy</h3>
                      <p className="text-sm text-zinc-500">Read our data collection and usage policy</p>
                    </div>
                    <FileText className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                  </button>

                  <button onClick={() => setSettingsView('terms')} className="w-full flex items-center justify-between p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition-colors text-left group">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">Terms of Service</h3>
                      <p className="text-sm text-zinc-500">Rules and guidelines for using NEXUS</p>
                    </div>
                    <FileText className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                  </button>

                  <button onClick={() => setSettingsView('support')} className="w-full flex items-center justify-between p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition-colors text-left group">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">Help & Support</h3>
                      <p className="text-sm text-zinc-500">Get assistance with your account</p>
                    </div>
                    <MessageCircle className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                  </button>
                </>
              )}

              {settingsView === 'account' && (
                <div className="text-zinc-300 space-y-4 text-sm leading-relaxed">
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                    <h3 className="text-white font-semibold mb-1">Email Address</h3>
                    <p className="text-zinc-400">{user?.email || 'No email provided'}</p>
                  </div>
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                    <h3 className="text-white font-semibold mb-1">Password</h3>
                    <button 
                      onClick={() => toast.info('Password reset email sent!')}
                      className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                    >
                      Reset Password
                    </button>
                  </div>
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                    <h3 className="text-white font-semibold mb-1">Account Actions</h3>
                    <button 
                      onClick={() => toast.error('Account deletion is permanent. Please contact support.')}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              {settingsView === 'privacy' && (
                <div className="text-zinc-300 space-y-4 text-sm leading-relaxed">
                  <h3 className="text-lg font-bold text-white">1. Information We Collect</h3>
                  <p>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, phone number, postal address, profile picture, payment method, items requested (for delivery services), delivery notes, and other information you choose to provide.</p>
                  <h3 className="text-lg font-bold text-white mt-4">2. Use of Information</h3>
                  <p>We may use the information we collect about you to Provide, maintain, and improve our Services, including, for example, to facilitate payments, send receipts, provide products and services you request (and send related information), develop new features, provide customer support to Users and Drivers, develop safety features, authenticate users, and send product updates and administrative messages.</p>
                </div>
              )}

              {settingsView === 'terms' && (
                <div className="text-zinc-300 space-y-4 text-sm leading-relaxed">
                  <h3 className="text-lg font-bold text-white">1. Acceptance of Terms</h3>
                  <p>By accessing and using our application, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.</p>
                  <h3 className="text-lg font-bold text-white mt-4">2. User Conduct</h3>
                  <p>You agree to use the Service only for lawful purposes. You agree not to take any action that might compromise the security of the site, render the site inaccessible to others or otherwise cause damage to the site or the Content. You agree not to add to, subtract from, or otherwise modify the Content, or to attempt to access any Content that is not intended for you.</p>
                </div>
              )}

              {settingsView === 'support' && (
                <div className="text-zinc-300 space-y-4 text-sm leading-relaxed text-center py-8">
                  <MessageCircle className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white">Need Help?</h3>
                  <p>Our support team is here to help you with any issues or questions you might have.</p>
                  <a href="mailto:support@nexus.com" className="inline-block mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition-colors">
                    Contact Support
                  </a>
                </div>
              )}
            </div>
            
            {settingsView === 'menu' && (
              <div className="p-4 border-t border-zinc-800 text-center">
                <p className="text-xs text-zinc-600">NEXUS AI PRO v1.0.0</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Follow List Modal */}
      {followListType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white capitalize">{followListType}</h2>
              <button 
                onClick={() => setFollowListType(null)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {loadingFollowList ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : followListUsers.length > 0 ? (
                <div className="space-y-4">
                  {followListUsers.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => {
                        setFollowListType(null);
                        navigate(`/profile/${u.id}`);
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-zinc-800/50 rounded-xl cursor-pointer transition-colors"
                    >
                      <img 
                        referrerPolicy="no-referrer" 
                        src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName || 'User'}`} 
                        alt={u.displayName} 
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-semibold text-white">{u.displayName}</h3>
                        <p className="text-sm text-zinc-500">@{u.username || u.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  No {followListType} yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
