import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, deleteDoc, getDocs, setDoc, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Sparkles, Camera, Edit2, Trash2, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import Statuses from '../components/Statuses';
import { GoogleGenAI } from "@google/genai";

const CATEGORIES = ['General', 'Technology', 'Design', 'Business', 'Life', 'Art', 'Gaming'];

export default function Home() {
  const { user, userProfile } = useAuth();
  const { setAuthModalOpen, setPremiumModalOpen } = useAppStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [postVisibility, setPostVisibility] = useState('public');
  const [postLimit, setPostLimit] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (location.state?.focusCreate && textareaRef.current) {
      textareaRef.current.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.state]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(postLimit));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((post: any) => {
          if (post.isDraft && post.authorId !== user?.uid) return false;
          if (post.visibility === 'private' && post.authorId !== user?.uid) return false;
          return true;
        });
      setPosts(postsData);
      setLoading(false);
      
      if (snapshot.docs.length < postLimit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
      
      if (postsData.length === 0 && user) {
        generateDemoContent();
      }
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, postLimit]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          setPostLimit(prev => prev + 10);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget, hasMore]);

  const generateDemoContent = async () => {
    if (!userProfile) return;
    try {
      const demoPosts = [
        {
          authorId: 'demo-1',
          authorName: 'Sarah Jenkins',
          authorPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          content: "Just launched my new AI-powered design tool! 🚀 The response has been overwhelming. Here's a sneak peek at the interface.",
          imageUrl: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=800',
          likesCount: 124,
          commentsCount: 18,
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          authorId: 'demo-2',
          authorName: 'Marcus Chen',
          authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          content: "What's everyone working on this weekend? I'm diving deep into some new machine learning models for predictive analytics. 📊🤖",
          likesCount: 89,
          commentsCount: 42,
          createdAt: new Date(Date.now() - 7200000).toISOString()
        },
        {
          authorId: userProfile.uid,
          authorName: userProfile.displayName || 'Demo User',
          authorPhoto: userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.displayName || 'Demo'}`,
          content: "Welcome to NEXUS! 🚀 This is your first post. Try creating your own post with an image, generating AI business ideas, or setting up your creator profile!",
          likesCount: 5,
          commentsCount: 1,
          createdAt: new Date().toISOString()
        }
      ];

      for (const post of demoPosts) {
        await addDoc(collection(db, 'posts'), post);
      }
    } catch (error) {
      console.error("Error generating demo content:", error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAIPost = async () => {
    if (!user || !userProfile) {
      toast.error('Please sign in to use AI features');
      setAuthModalOpen(true);
      return;
    }

    if (!userProfile.isPro) {
      setPremiumModalOpen(true);
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      toast.error('Gemini API Key is missing. Please configure it in your environment variables.');
      return;
    }

    setIsGenerating(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = newPostContent.trim() 
        ? `Topic: ${newPostContent}\n\nTask: Write an engaging social media post about the topic above. Keep it concise, use emojis, and make it sound natural and conversational. DO NOT repeat the topic or this prompt. Start directly with the post content.`
        : `Task: Write a short, engaging, and creative social media post about a random interesting topic (like technology, productivity, creativity, or daily life). Use emojis and make it sound natural. DO NOT repeat this prompt. Start directly with the post content.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setNewPostContent(response.text.trim());
        toast.success('Post generated successfully!');
      }
    } catch (error) {
      console.error("Error generating post:", error);
      toast.error("Failed to generate post. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();
    if (!user || !userProfile) {
      toast.error('Please sign in to post');
      setAuthModalOpen(true);
      return;
    }
    if (!newPostContent.trim() && !selectedImage) return;

    setIsUploading(true);
    try {
      let finalImageUrl = selectedImage;

      if (selectedFile) {
        try {
          const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('../firebase');
          const fileExtension = selectedFile.name.split('.').pop();
          const fileName = `posts/${user.uid}/${Date.now()}.${fileExtension}`;
          const storageRef = ref(storage, fileName);
          
          await uploadBytes(storageRef, selectedFile);
          finalImageUrl = await getDownloadURL(storageRef);
        } catch (storageError) {
          console.error("Error uploading to storage:", storageError);
          // Fallback to base64 if storage fails (e.g. due to rules), but only if it's small enough
          if (selectedFile.size > 1048576) {
            throw new Error("File is too large to save without Firebase Storage. Please configure Storage rules.");
          }
        }
      }

      const postData: any = {
        authorId: user.uid,
        authorName: userProfile.displayName || 'User',
        authorPhoto: userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.displayName || 'User'}`,
        content: newPostContent.trim(),
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        category: selectedCategory,
        visibility: postVisibility,
        isDraft: isDraft
      };
      
      if (finalImageUrl) {
        postData.imageUrl = finalImageUrl;
      }

      await addDoc(collection(db, 'posts'), postData);
      setNewPostContent('');
      setSelectedImage(null);
      setSelectedFile(null);
      setSelectedCategory('General');
      toast.success(isDraft ? 'Draft saved successfully!' : 'Post created successfully!');
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) {
      toast.error('Please sign in to like posts');
      setAuthModalOpen(true);
      return;
    }
    
    const likeRef = doc(db, 'likes', `${user.uid}_${postId}`);
    const postRef = doc(db, 'posts', postId);

    try {
      if (isLiked) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        // Like
        await setDoc(likeRef, {
          postId,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
        await updateDoc(postRef, { likesCount: increment(1) });
        
        // Notify author
        const post = posts.find(p => p.id === postId);
        if (post && post.authorId !== user.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: post.authorId,
            type: 'like',
            title: 'New Like',
            message: `${userProfile?.displayName || 'Someone'} liked your post.`,
            isRead: false,
            link: `/post/${postId}`,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-zinc-900 rounded-2xl p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-zinc-800 rounded-full"></div>
              <div className="space-y-2">
                <div className="w-32 h-4 bg-zinc-800 rounded"></div>
                <div className="w-20 h-3 bg-zinc-800 rounded"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full h-4 bg-zinc-800 rounded"></div>
              <div className="w-5/6 h-4 bg-zinc-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      {/* Statuses Feed */}
      <div className="p-4 border-b border-zinc-900 bg-black">
        <Statuses />
      </div>

      {/* Create Post */}
      <div className="p-4 border-b border-zinc-900 bg-black sticky top-0 z-10">
        <form onSubmit={(e) => handleCreatePost(e, false)} className="flex gap-3">
          <img referrerPolicy="no-referrer" 
            src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName || 'User'}`} 
            alt="Profile" 
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-zinc-500 resize-none overflow-hidden"
              rows={3}
            />
            
            {selectedImage && (
              <div className="relative mt-2 mb-3 inline-block">
                <img referrerPolicy="no-referrer" src={selectedImage} alt="Preview" className="max-h-64 rounded-xl object-cover border border-zinc-800" />
                <button 
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-900/50">
              <div className="flex gap-2 items-center">
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-full transition-colors"
                  title="Upload Media"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </button>
                <button 
                  type="button"
                  onClick={handleGenerateAIPost}
                  disabled={isGenerating}
                  className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-full transition-colors disabled:opacity-50"
                  title="Generate with AI"
                >
                  <Sparkles className={`w-5 h-5 ${isGenerating ? 'animate-pulse' : ''}`} />
                </button>
                
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-zinc-900 text-zinc-300 text-sm md:text-xs rounded-full px-3 py-1.5 border border-zinc-800 focus:outline-none focus:border-indigo-500 ml-2"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={postVisibility}
                  onChange={(e) => setPostVisibility(e.target.value)}
                  className="bg-zinc-900 text-zinc-300 text-sm md:text-xs rounded-full px-3 py-1.5 border border-zinc-800 focus:outline-none focus:border-indigo-500 ml-2"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={(e) => handleCreatePost(e, true)}
                  disabled={(!newPostContent.trim() && !selectedImage) || isGenerating || isUploading}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-full font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Draft
                </button>
                <button 
                  type="submit"
                  disabled={(!newPostContent.trim() && !selectedImage) || isGenerating || isUploading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-full font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Posting...
                    </>
                  ) : (
                    'Post'
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Feed */}
      <div className="divide-y divide-zinc-900">
        {posts.map(post => (
          <PostCard key={post.id} post={post} onLike={handleLike} currentUser={user} userProfile={userProfile} />
        ))}
      </div>
      
      {/* Infinite Scroll Observer Target */}
      {posts.length > 0 && (
        <div ref={observerTarget} className="py-8 flex justify-center">
          {hasMore ? (
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <p className="text-sm text-zinc-500">You've reached the end</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PostCard({ post, onLike, currentUser, userProfile }: { post: any, onLike: any, currentUser: any, userProfile?: any }) {
  const navigate = useNavigate();
  const { setPremiumModalOpen } = useAppStore();
  const [isLiked, setIsLiked] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    setLocalLikesCount(post.likesCount || 0);
  }, [post.likesCount]);

  useEffect(() => {
    if (!currentUser) return;
    const likeRef = doc(db, 'likes', `${currentUser.uid}_${post.id}`);
    const unsubscribe = onSnapshot(likeRef, (doc) => {
      setIsLiked(doc.exists());
    });
    return () => unsubscribe();
  }, [currentUser, post.id]);

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'comments'), where('postId', '==', post.id), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [showComments, post.id]);

  const handleLikeClick = async () => {
    if (!currentUser) return;
    
    // Optimistic update
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLocalLikesCount((prev: number) => newIsLiked ? prev + 1 : Math.max(0, prev - 1));
    
    try {
      await onLike(post.id, !newIsLiked); // Pass the old state to the handler
    } catch (error) {
      // Revert on failure
      setIsLiked(!newIsLiked);
      setLocalLikesCount(post.likesCount || 0);
    }
  };

  const handleGenerateAIComment = async () => {
    if (!currentUser || !userProfile) {
      toast.error('Please sign in to use AI features');
      return;
    }

    if (!userProfile.isPro) {
      setPremiumModalOpen(true);
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      toast.error('Gemini API Key is missing. Please configure it in your environment variables.');
      return;
    }

    setIsGeneratingComment(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Post: "${post.content}"\n\nTask: Write a short, engaging, and friendly comment in response to the social media post above. Keep it concise (1-2 sentences) and conversational. DO NOT repeat the post or this prompt. Start directly with the comment.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setNewComment(response.text.trim());
        toast.success('Comment generated successfully!');
      }
    } catch (error) {
      console.error("Error generating comment:", error);
      toast.error("Failed to generate comment. Please try again.");
    } finally {
      setIsGeneratingComment(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editContent.trim()) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        content: editContent.trim(),
        isDraft: false,
        editedAt: new Date().toISOString()
      });
      setIsEditing(false);
      setShowMenu(false);
      toast.success('Post updated!');
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error('Failed to update post');
    }
  };

  const handleSavePost = async () => {
    if (!currentUser) return setPremiumModalOpen(true);
    try {
      const savedRef = doc(db, `users/${currentUser.uid}/savedPosts/${post.id}`);
      const savedDoc = await getDoc(savedRef);
      if (savedDoc.exists()) {
        await deleteDoc(savedRef);
        toast.info('Post removed from Drive');
      } else {
        await setDoc(savedRef, { savedAt: new Date().toISOString() });
        toast.success('Post saved to Drive');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeletePost = async () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        toast.success('Post deleted');
      } catch (error) {
        console.error("Error deleting post:", error);
        toast.error('Failed to delete post');
      }
    }
  };

  const handleReportPost = async () => {
    if (!currentUser) {
      toast.error('Please sign in to report posts');
      return;
    }
    
    const reason = window.prompt('Please provide a reason for reporting this post:');
    if (!reason) return;

    try {
      await addDoc(collection(db, 'reports'), {
        postId: post.id,
        reporterId: currentUser.uid,
        reason: reason,
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
      toast.success('Post reported successfully. Our team will review it.');
      setShowMenu(false);
    } catch (error) {
      console.error("Error reporting post:", error);
      toast.error('Failed to report post');
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/#/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.authorName}`,
          text: post.content,
          url: url,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim()) return;
    
    setIsSubmittingComment(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: post.id,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'User',
        authorPhoto: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || 'User'}`,
        content: newComment.trim(),
        createdAt: new Date().toISOString()
      });
      
      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(1)
      });
      
      if (post.authorId !== currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: post.authorId,
          type: 'comment',
          title: 'New Comment',
          message: `${currentUser.displayName || 'Someone'} commented on your post.`,
          isRead: false,
          link: `/post/${post.id}`,
          createdAt: new Date().toISOString()
        });
      }
      
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div 
      className="p-4 hover:bg-zinc-900/30 transition-colors cursor-pointer"
      onClick={() => navigate(`/post/${post.id}`)}
    >
      <div className="flex items-start gap-3">
        <Link to={`/profile/${post.authorId}`} onClick={(e) => e.stopPropagation()}>
          <img referrerPolicy="no-referrer" src={post.authorPhoto} alt={post.authorName} className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to={`/profile/${post.authorId}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-white truncate hover:underline">
                {post.authorName}
              </Link>
              {post.category && (
                <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-full">
                  {post.category}
                </span>
              )}
              {post.isDraft && (
                <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded-full">
                  Draft
                </span>
              )}
              <span className="text-sm text-zinc-500">·</span>
              <span className="text-sm text-zinc-500">
                {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : 'just now'}
                {post.editedAt && <span className="ml-1 text-xs italic opacity-70">(edited)</span>}
              </span>
            </div>
            
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="text-zinc-500 hover:text-white p-1 rounded-full hover:bg-zinc-800"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => { handleSavePost(); setShowMenu(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
                  >
                    <Bookmark className="w-4 h-4" /> Save to Drive
                  </button>
                  {currentUser?.uid === post.authorId ? (
                    <>
                      <button 
                        onClick={() => { setIsEditing(true); setShowMenu(false); }}
                        className="w-full text-left px-4 py-3 text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Post
                      </button>
                      <button 
                        onClick={handleDeletePost}
                        className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Post
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={handleReportPost}
                      className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-zinc-800"
                    >
                      Report Post
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEditSubmit}
                  className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-zinc-200 whitespace-pre-wrap">
              {post.content.split(/(#[a-zA-Z0-9_]+)/g).map((part: string, i: number) => 
                part.startsWith('#') ? (
                  <Link key={i} to={`/explore?tag=${part.slice(1)}`} onClick={(e) => e.stopPropagation()} className="text-indigo-400 hover:underline">
                    {part}
                  </Link>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>
          )}
          
          {post.imageUrl && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-800">
              {post.imageUrl.startsWith('data:video') ? (
                <video src={post.imageUrl} className="w-full h-auto object-cover" controls playsInline />
              ) : (
                <img referrerPolicy="no-referrer" src={post.imageUrl} alt="Post media" className="w-full h-auto object-cover" />
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 max-w-md">
            <button 
              onClick={(e) => { e.stopPropagation(); handleLikeClick(); }}
              className={`flex items-center gap-2 group transition-colors ${isLiked ? 'text-pink-500' : 'text-zinc-500 hover:text-pink-500'}`}
            >
              <div className={`p-2 rounded-full group-hover:bg-pink-500/10 ${isLiked ? 'bg-pink-500/10' : ''}`}>
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </div>
              <span className="text-sm font-medium">{localLikesCount}</span>
            </button>
            
            <button 
              onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
              className="flex items-center gap-2 text-zinc-500 hover:text-blue-500 group transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-blue-500/10">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">{post.commentsCount || 0}</span>
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className="flex items-center gap-2 text-zinc-500 hover:text-green-500 group transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-green-500/10">
                <Share2 className="w-5 h-5" />
              </div>
            </button>
            
            <button 
              onClick={(e) => { e.stopPropagation(); handleSavePost(); }}
              className="flex items-center gap-2 text-zinc-500 hover:text-indigo-500 group transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-indigo-500/10">
                <Bookmark className="w-5 h-5" />
              </div>
            </button>
          </div>

          {/* Comments Section */}
          {showComments && (
            <div className="mt-4 pt-4 border-t border-zinc-800/50" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleCommentSubmit} className="flex gap-3 mb-4">
                <img referrerPolicy="no-referrer" 
                  src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName || 'User'}`} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1 flex items-center bg-zinc-900 rounded-full px-4 py-1 border border-zinc-800 focus-within:border-zinc-700 transition-colors">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm text-white placeholder-zinc-500 py-2"
                  />
                  <button 
                    type="button"
                    onClick={handleGenerateAIComment}
                    disabled={isGeneratingComment}
                    className="p-1.5 text-purple-400 hover:bg-purple-500/10 rounded-full transition-colors disabled:opacity-50"
                    title="Generate AI Comment"
                  >
                    <Sparkles className={`w-4 h-4 ${isGeneratingComment ? 'animate-pulse' : ''}`} />
                  </button>
                  <button 
                    type="submit"
                    disabled={!newComment.trim() || isSubmittingComment || isGeneratingComment}
                    className="text-indigo-400 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                  >
                    Post
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <Link to={`/profile/${comment.authorId}`}>
                      <img referrerPolicy="no-referrer" src={comment.authorPhoto} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover hover:opacity-80 transition-opacity" />
                    </Link>
                    <div className="flex-1 bg-zinc-900/50 rounded-2xl rounded-tl-none p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Link to={`/profile/${comment.authorId}`} className="font-medium text-sm text-white hover:underline">
                          {comment.authorName}
                        </Link>
                        <span className="text-xs text-zinc-500">
                          {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : 'just now'}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-center text-sm text-zinc-500 py-4">No comments yet. Be the first!</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
