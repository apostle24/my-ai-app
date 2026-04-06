import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc, updateDoc, increment, setDoc, addDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';
import { PostCard } from './Home';
import { useAppStore } from '../store';
import { toast } from 'sonner';

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { setAuthModalOpen, setPremiumModalOpen } = useAppStore();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;
      try {
        const docRef = doc(db, 'posts', postId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPost({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching post:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, 'comments'), where('postId', '==', postId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [postId]);

  const handleLike = async (id: string, isLiked: boolean) => {
    if (!user) {
      toast.error('Please sign in to like posts');
      setAuthModalOpen(true);
      return;
    }
    
    const likeRef = doc(db, 'likes', `${user.uid}_${id}`);
    const postRef = doc(db, 'posts', id);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, {
          postId: id,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
        await updateDoc(postRef, { likesCount: increment(1) });
        
        if (post && post.authorId !== user.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: post.authorId,
            type: 'like',
            title: 'New Like',
            message: `${userProfile?.displayName || 'Someone'} liked your post.`,
            isRead: false,
            link: `/post/${id}`,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleGenerateAIComment = async () => {
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

    setIsGeneratingComment(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Write a short, engaging, and friendly comment in response to this social media post: "${post?.content || ''}". Keep it concise (1-2 sentences) and conversational.`;

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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to comment');
      setAuthModalOpen(true);
      return;
    }
    if (!newComment.trim() || !postId) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId,
        authorId: user.uid,
        authorName: userProfile?.displayName || 'User',
        authorPhoto: userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName || 'User'}`,
        content: newComment.trim(),
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1)
      });

      if (post && post.authorId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: post.authorId,
          type: 'comment',
          title: 'New Comment',
          message: `${userProfile?.displayName || 'Someone'} commented on your post.`,
          isRead: false,
          link: `/post/${postId}`,
          createdAt: new Date().toISOString()
        });
      }

      setNewComment('');
      toast.success('Comment added!');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading post...</div>;
  }

  if (!post) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-4">Post not found</h2>
        <button onClick={() => navigate('/')} className="text-indigo-400 hover:text-indigo-300">
          Go back home
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-zinc-900 p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Post</h1>
      </div>
      <PostCard post={post} onLike={handleLike} currentUser={user} />

      <div className="p-4 border-t border-zinc-900">
        <h2 className="text-lg font-bold text-white mb-4">Comments</h2>
        
        <form onSubmit={handleAddComment} className="flex gap-3 mb-8">
          <img referrerPolicy="no-referrer" 
            src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName || 'User'}`} 
            alt="You" 
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1 flex items-center bg-zinc-900 rounded-full border border-zinc-800 px-4 py-2 focus-within:border-indigo-500 transition-colors">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-500 text-sm"
              disabled={isSubmitting || isGeneratingComment}
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
              disabled={!newComment.trim() || isSubmitting || isGeneratingComment}
              className="p-2 text-indigo-500 hover:text-indigo-400 disabled:opacity-50 disabled:hover:text-indigo-500 transition-colors ml-1"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="space-y-6">
          {comments.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-8">No comments yet. Be the first to share your thoughts!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <img referrerPolicy="no-referrer" 
                  src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName || 'User'}`} 
                  alt={comment.authorName} 
                  className="w-10 h-10 rounded-full object-cover cursor-pointer"
                  onClick={() => navigate(`/profile/${comment.authorId}`)}
                />
                <div className="flex-1">
                  <div className="bg-zinc-900 rounded-2xl rounded-tl-none p-3 border border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                      <span 
                        className="font-bold text-sm text-white cursor-pointer hover:underline"
                        onClick={() => navigate(`/profile/${comment.authorId}`)}
                      >
                        {comment.authorName}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
