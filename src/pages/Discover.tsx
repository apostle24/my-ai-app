import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, TrendingUp, Users, Sparkles, Video, Image as ImageIcon, FileText, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Markdown from 'react-markdown';

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [aiIdeas, setAiIdeas] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [webResults, setWebResults] = useState<any>(null);
  const [isWebSearching, setIsWebSearching] = useState(false);
  const navigate = useNavigate();

  // Trending search keywords
  const trendingSearches = ['AI Automation', 'Notion Templates', 'SaaS Ideas', 'Content Creation', 'Marketing Strategy'];

  const handleWebSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsWebSearching(true);
    setIsSearchFocused(false);
    setWebResults(null);
    setActiveCategory('Web Results');
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
        toast.error('Gemini API Key is missing. Please configure it in your environment variables.');
        setIsWebSearching(false);
        return;
      }
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Search the web for: ${searchQuery}. Provide a comprehensive summary of the top results, including different perspectives or options. Format as clean markdown.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      setWebResults({
        text: response.text,
        sources: chunks ? chunks.map((c: any) => c.web).filter(Boolean) : []
      });
      
    } catch (error) {
      console.error("Web search error:", error);
      toast.error("Failed to perform web search.");
    } finally {
      setIsWebSearching(false);
    }
  };

  useEffect(() => {
    const fetchDiscoverData = async () => {
      try {
        // Fetch top creators
        const creatorsQ = query(collection(db, 'users'), where('isCreator', '==', true), limit(5));
        const creatorsSnap = await getDocs(creatorsQ);
        const fetchedCreators = creatorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (fetchedCreators.length === 0) {
          setCreators([
            { id: 'c1', displayName: 'Sarah Jenkins', username: 'sarahj', photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
            { id: 'c2', displayName: 'Marcus Chen', username: 'marcusc', photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
            { id: 'c3', displayName: 'Elena Rodriguez', username: 'elenar', photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' },
            { id: 'c4', displayName: 'David Kim', username: 'davidk', photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' }
          ]);
        } else {
          setCreators(fetchedCreators);
        }

        // Fetch AI Ideas
        const aiQ = query(collection(db, 'ai_results'), orderBy('createdAt', 'desc'), limit(4));
        const aiSnap = await getDocs(aiQ);
        const fetchedAi = aiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (fetchedAi.length === 0) {
          setAiIdeas([
            {
              id: 'ai1',
              prompt: 'AI Automation Agency',
              structuredData: JSON.stringify({
                businessName: 'AutoFlow AI',
                explanation: 'An agency that helps small businesses automate their customer service and lead generation using custom AI chatbots.'
              })
            },
            {
              id: 'ai2',
              prompt: 'Digital Product for Creators',
              structuredData: JSON.stringify({
                businessName: 'CreatorKit',
                explanation: 'A comprehensive bundle of Notion templates, Lightroom presets, and social media planners for aspiring content creators.'
              })
            }
          ]);
        } else {
          setAiIdeas(fetchedAi);
        }

        // Fetch Templates
        const templatesQ = query(collection(db, 'products'), where('category', '==', 'Template'), limit(4));
        const templatesSnap = await getDocs(templatesQ);
        const fetchedTemplates = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (fetchedTemplates.length === 0) {
          setTemplates([
            { id: 't1', title: 'Ultimate Notion Life Planner', description: 'Organize your entire life with this comprehensive Notion system.', price: '19.99', creatorName: 'Sarah Jenkins' },
            { id: 't2', title: 'Social Media Content Calendar', description: 'Plan 30 days of content in 1 hour with this Airtable template.', price: '12.00', creatorName: 'Marcus Chen' },
            { id: 't3', title: 'Freelance Invoice Template', description: 'Professional, automated invoice template for freelancers.', price: '5.00', creatorName: 'Elena Rodriguez' },
            { id: 't4', title: 'Startup Pitch Deck', description: 'The exact pitch deck template used to raise $1M+.', price: '29.00', creatorName: 'David Kim' }
          ]);
        } else {
          setTemplates(fetchedTemplates);
        }
      } catch (error) {
        console.error("Error fetching discover data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoverData();

    // Real-time listener for trending posts
    const postsQ = query(collection(db, 'posts'), orderBy('likesCount', 'desc'), limit(10));
    const unsubscribePosts = onSnapshot(postsQ, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (fetchedPosts.length === 0) {
        setTrendingPosts([
          {
            id: 'demo-post-1',
            authorName: 'Sarah Jenkins',
            authorPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            content: "Just launched my new AI-powered design tool! 🚀 The response has been overwhelming.",
            imageUrl: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=800',
            likesCount: 124,
          },
          {
            id: 'demo-post-2',
            authorName: 'Marcus Chen',
            authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            content: "What's everyone working on this weekend? I'm diving deep into some new machine learning models. 📊🤖",
            likesCount: 89,
          }
        ]);
      } else {
        setTrendingPosts(fetchedPosts);
      }
    });

    return () => {
      unsubscribePosts();
    };
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(() => {
      setIsSearching(false);
    }, 600);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredCreators = creators.filter(c => 
    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPosts = trendingPosts.filter(p => 
    p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.authorName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAiIdeas = aiIdeas.filter(a => 
    a.prompt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = templates.filter(t => 
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-8 pb-24">
      {/* Search Bar */}
      <div className={`relative ${isSearchFocused ? 'z-50' : 'z-10'}`}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-zinc-500" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
          placeholder="Search creators, posts, AI ideas, or ask anything..."
          className="block w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-lg"
        />
        
        {/* Search Suggestions Dropdown */}
        {isSearchFocused && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
            {!searchQuery ? (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Trending Searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.map(term => (
                    <button 
                      key={term}
                      onClick={() => setSearchQuery(term)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm text-zinc-300 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-2">
                {filteredCreators.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-xs font-semibold text-zinc-500 px-3 py-2 uppercase tracking-wider">Creators</h3>
                    {filteredCreators.slice(0, 3).map(creator => (
                      <div key={creator.id} className="flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors" onClick={() => { setSearchQuery(creator.displayName); setIsSearchFocused(false); }}>
                        <img referrerPolicy="no-referrer" src={creator.photoURL || `https://ui-avatars.com/api/?name=${creator.displayName}`} alt={creator.displayName} className="w-8 h-8 rounded-full" />
                        <div>
                          <p className="text-sm font-medium text-white">{creator.displayName}</p>
                          <p className="text-xs text-zinc-500">@{creator.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {filteredTemplates.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-xs font-semibold text-zinc-500 px-3 py-2 uppercase tracking-wider">Templates</h3>
                    {filteredTemplates.slice(0, 3).map(template => (
                      <div key={template.id} className="flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors" onClick={() => { setSearchQuery(template.title); setIsSearchFocused(false); }}>
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white line-clamp-1">{template.title}</p>
                          <p className="text-xs text-zinc-500">By {template.creatorName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredAiIdeas.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-xs font-semibold text-zinc-500 px-3 py-2 uppercase tracking-wider">AI Ideas</h3>
                    {filteredAiIdeas.slice(0, 3).map(idea => {
                      let parsedResult = null;
                      try { parsedResult = JSON.parse(idea.structuredData); } catch (e) {}
                      return (
                        <div key={idea.id} className="flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors" onClick={() => { setSearchQuery(parsedResult?.businessName || idea.prompt); setIsSearchFocused(false); }}>
                          <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-yellow-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white line-clamp-1">{parsedResult?.businessName || idea.prompt}</p>
                            <p className="text-xs text-zinc-500 line-clamp-1">{parsedResult?.explanation || idea.content}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="p-3 mt-2 border-t border-zinc-800 flex flex-col gap-2">
                  <button 
                    onClick={() => navigate('/ai-studio', { state: { prompt: searchQuery } })}
                    className="w-full py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Ask AI about "{searchQuery}"
                  </button>
                  <button 
                    onClick={() => {
                      handleWebSearch();
                    }}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Search Web for "{searchQuery}"
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {searchQuery && !isSearchFocused && (
        <div className="flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <button 
            onClick={() => navigate('/ai-studio', { state: { prompt: searchQuery } })}
            className="flex-1 min-w-[200px] p-4 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl flex items-center gap-4 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-semibold">Generate AI Ideas</h3>
              <p className="text-sm text-indigo-300">Create a business plan for "{searchQuery}"</p>
            </div>
          </button>
          
          <button 
            onClick={() => handleWebSearch()}
            className="flex-1 min-w-[200px] p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl flex items-center gap-4 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Search className="w-6 h-6 text-zinc-400" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-semibold">Web Search</h3>
              <p className="text-sm text-zinc-400">Find external resources for "{searchQuery}"</p>
            </div>
          </button>
        </div>
      )}

      {/* Categories */}
      <div className="relative group">
        <button 
          onClick={() => {
            const el = document.getElementById('categories-scroll');
            if (el) el.scrollBy({ left: -200, behavior: 'smooth' });
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>

        <div id="categories-scroll" className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
          {['All', 'Web Results', 'Trending', 'Creators', 'AI Ideas', 'Templates', 'Videos'].map((cat) => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                activeCategory === cat ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button 
          onClick={() => {
            const el = document.getElementById('categories-scroll');
            if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {isSearching ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400">Searching for "{searchQuery}"...</p>
        </div>
      ) : (
        <>
          {/* Web Results */}
          {(activeCategory === 'All' || activeCategory === 'Web Results') && (isWebSearching || webResults) && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  Web Results
                </h2>
              </div>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                {isWebSearching ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-zinc-400">Searching the web for "{searchQuery}"...</p>
                  </div>
                ) : webResults ? (
                  <div className="space-y-6">
                    <div className="prose prose-invert max-w-none prose-p:text-zinc-300 prose-a:text-blue-400 hover:prose-a:text-blue-300">
                      <Markdown>{webResults.text}</Markdown>
                    </div>
                    
                    {webResults.sources && webResults.sources.length > 0 && (
                      <div className="pt-4 border-t border-zinc-800">
                        <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Sources</h3>
                        <div className="flex flex-wrap gap-2">
                          {webResults.sources.map((source: any, idx: number) => (
                            <a 
                              key={idx}
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm text-zinc-300 transition-colors"
                            >
                              <Globe className="w-3 h-3 text-zinc-500" />
                              <span className="truncate max-w-[200px]">{source.title || new URL(source.uri).hostname}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {/* Top Creators */}
          {(activeCategory === 'All' || activeCategory === 'Creators') && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Top Creators
                </h2>
                <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">See all</button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? (
                  [1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-zinc-900 rounded-2xl p-4 flex flex-col items-center animate-pulse">
                      <div className="w-16 h-16 bg-zinc-800 rounded-full mb-3"></div>
                      <div className="w-20 h-4 bg-zinc-800 rounded mb-2"></div>
                      <div className="w-16 h-3 bg-zinc-800 rounded"></div>
                    </div>
                  ))
                ) : filteredCreators.length > 0 ? (
                  filteredCreators.map(creator => (
                    <div 
                      key={creator.id} 
                      onClick={() => navigate(`/profile/${creator.id}`)}
                      className="bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/50 rounded-2xl p-4 flex flex-col items-center transition-colors cursor-pointer group"
                    >
                      <img referrerPolicy="no-referrer" 
                        src={creator.photoURL || `https://ui-avatars.com/api/?name=${creator.displayName || 'Creator'}`} 
                        alt={creator.displayName} 
                        className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-transparent group-hover:border-indigo-500 transition-colors"
                      />
                      <h3 className="font-semibold text-white text-center truncate w-full">{creator.displayName}</h3>
                      <p className="text-xs text-zinc-500 mb-3 truncate w-full text-center">@{creator.username}</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.success(`You are now following ${creator.displayName}`);
                        }}
                        className="w-full py-1.5 bg-white text-black hover:bg-zinc-200 rounded-full text-sm font-medium transition-colors"
                      >
                        Follow
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-zinc-500">
                    No creators found matching "{searchQuery}".
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Trending Posts */}
          {(activeCategory === 'All' || activeCategory === 'Trending') && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-pink-500" />
                  Trending Now
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  [1, 2].map(i => (
                    <div key={i} className="bg-zinc-900 rounded-2xl h-48 animate-pulse"></div>
                  ))
                ) : filteredPosts.length > 0 ? (
                  filteredPosts.map(post => (
                    <div 
                      key={post.id} 
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <img referrerPolicy="no-referrer" src={post.authorPhoto} alt={post.authorName} className="w-8 h-8 rounded-full" />
                        <div>
                          <p className="text-sm font-medium text-white">{post.authorName}</p>
                          <p className="text-xs text-zinc-500">{post.likesCount} likes</p>
                        </div>
                      </div>
                      <p className="text-zinc-300 text-sm line-clamp-3">{post.content}</p>
                      {post.imageUrl && (
                        <div className="mt-3 h-32 rounded-xl overflow-hidden">
                          <img referrerPolicy="no-referrer" src={post.imageUrl} alt="Post" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-zinc-500">
                    No trending posts found matching "{searchQuery}".
                  </div>
                )}
              </div>
            </section>
          )}

          {/* AI Ideas */}
          {(activeCategory === 'All' || activeCategory === 'AI Ideas') && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Greatest AI Ideas
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  [1, 2].map(i => (
                    <div key={i} className="bg-zinc-900 rounded-2xl h-32 animate-pulse"></div>
                  ))
                ) : filteredAiIdeas.length > 0 ? (
                  filteredAiIdeas.map(idea => {
                    let parsedResult = null;
                    try {
                      parsedResult = JSON.parse(idea.structuredData);
                    } catch (e) {
                      // Handle non-JSON results if any
                    }
                    return (
                      <div key={idea.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-yellow-500" />
                          <p className="text-sm font-medium text-white line-clamp-1">{idea.prompt}</p>
                        </div>
                        {parsedResult && parsedResult.businessName ? (
                          <>
                            <h3 className="text-lg font-bold text-indigo-400 mb-1">{parsedResult.businessName}</h3>
                            <p className="text-zinc-400 text-sm line-clamp-2">{parsedResult.explanation}</p>
                          </>
                        ) : (
                          <p className="text-zinc-400 text-sm line-clamp-3">{idea.content}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-8 text-zinc-500">
                    No AI ideas found matching "{searchQuery}".
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Templates */}
          {(activeCategory === 'All' || activeCategory === 'Templates') && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  Trending Templates
                </h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? (
                  [1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-zinc-900 rounded-2xl h-40 animate-pulse"></div>
                  ))
                ) : filteredTemplates.length > 0 ? (
                  filteredTemplates.map(template => (
                    <div key={template.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors cursor-pointer flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-white mb-1 line-clamp-1">{template.title}</h3>
                        <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{template.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-indigo-400 font-bold">${template.price}</span>
                        <span className="text-xs text-zinc-500">By {template.creatorName}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-zinc-500">
                    No templates found matching "{searchQuery}".
                  </div>
                )}
              </div>
            </section>
          )}
          {/* Videos */}
          {(activeCategory === 'All' || activeCategory === 'Videos') && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Video className="w-5 h-5 text-blue-500" />
                  Trending Videos
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'v1', title: 'What is Generative AI?', embedId: 'G2fqAlgmoPo' },
                  { id: 'v2', title: 'How to build a SaaS', embedId: 'k1zB2q_g0j0' },
                  { id: 'v3', title: 'React in 100 Seconds', embedId: 'Tn6-PIqc4UM' }
                ].map(video => (
                  <div key={video.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors group">
                    <div className="relative aspect-video w-full">
                      <iframe 
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${video.embedId}`} 
                        title={video.title}
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                      ></iframe>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white mb-1 line-clamp-2">{video.title}</h3>
                      <p className="text-xs text-zinc-500">YouTube Video</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
