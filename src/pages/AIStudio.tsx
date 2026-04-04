import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Briefcase, Zap, Globe, Cpu, DollarSign, TrendingUp, Package, Loader2, Users, BookOpen, Smartphone, Image as ImageIcon, CheckCircle, Lock, Download, Share2, CreditCard, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

const categories = [
  { id: 'business', name: 'Business Plan', icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'ebook', name: 'Ebook Content', icon: BookOpen, color: 'text-green-400', bg: 'bg-green-400/10' },
  { id: 'full_book', name: 'Full Book', icon: BookOpen, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  { id: 'website', name: 'Website Copy', icon: Globe, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { id: 'app', name: 'App Idea', icon: Smartphone, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 'cover', name: 'Book Cover', icon: ImageIcon, color: 'text-pink-400', bg: 'bg-pink-400/10' },
];

const models = [
  { id: 'gemini-3-flash-preview', name: 'Gemini Flash', description: 'Fast & efficient for most tasks', icon: Zap },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini Pro', description: 'Advanced reasoning & complex tasks', icon: Cpu },
  { id: 'gemini-2.5-flash-image', name: 'Gemini Image', description: 'Generate high-quality images', icon: ImageIcon },
];

const compressImage = (base64Str: string, maxWidth = 512, quality = 0.6): Promise<string> => {
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

export default function AIStudio() {
  const { user, userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuthModalOpen } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [runTour, setRunTour] = useState(false);

  const tourSteps: Step[] = [
    {
      target: '.tour-header',
      content: 'Welcome to AI Studio! This is where you can generate amazing content using advanced AI models.',
      disableBeacon: true,
    },
    {
      target: '.tour-credits',
      content: 'Here you can see your remaining credits. Pro users get unlimited credits!',
    },
    {
      target: '.tour-model-select',
      content: 'Choose the AI model that best fits your needs. Gemini Pro is great for complex reasoning, while Gemini Flash is faster.',
    },
    {
      target: '.tour-category-select',
      content: 'Select what type of content you want to create, like a Business Plan or a Book Cover.',
    },
    {
      target: '.tour-prompt-input',
      content: 'Describe your idea in detail here. The more context you provide, the better the result!',
    },
    {
      target: '.tour-generate-btn',
      content: 'Click here to generate your content. It will cost 1 credit per generation.',
    }
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem('hasSeenAIStudioTour', 'true');
    }
  };

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenAIStudioTour');
    if (!hasSeenTour) {
      // Small delay to ensure elements are rendered
      setTimeout(() => setRunTour(true), 1000);
    }
  }, []);

  useEffect(() => {
    if (location.state?.prompt) {
      setCustomPrompt(location.state.prompt);
      window.history.replaceState({}, document.title);
    }
    
    // Check for Paystack redirect
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('upgrade_success') === 'true') {
      toast.success('Successfully upgraded to Pro! You now have unlimited credits.');
      if (user) {
        updateDoc(doc(db, 'users', user.uid), {
          isPro: true,
          credits: 9999
        }).catch(console.error);
      }
      navigate('/ai-studio', { replace: true });
    }
  }, [location, user, navigate]);

  // Auto-select image model if Book Cover is selected
  useEffect(() => {
    if (selectedCategory.id === 'cover') {
      setSelectedModel(models[2]);
    } else if (selectedModel.id === 'gemini-2.5-flash-image') {
      setSelectedModel(models[0]);
    }
  }, [selectedCategory]);

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Please sign in to upgrade');
      setAuthModalOpen(true);
      return;
    }
    
    setIsUpgrading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          origin: window.location.origin,
          isUpgrade: true
        })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to initialize checkout');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout process');
      setIsUpgrading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user || !userProfile) {
      toast.error('Please sign in to use AI Studio');
      setAuthModalOpen(true);
      return;
    }

    if (!userProfile.isPro && (userProfile.credits === undefined || userProfile.credits <= 0)) {
      toast.error('You have run out of credits. Please upgrade to Pro to continue generating.');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
        toast.error('Gemini API Key is missing. Please configure it in your environment variables.');
        setIsGenerating(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      let generatedContent: any = null;

      if (selectedModel.id === 'gemini-2.5-flash-image') {
        // Image Generation
        const prompt = `A highly professional, stunning ${selectedCategory.name}. ${customPrompt}`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1"
            }
          }
        });

        let base64Data = '';
        let textResponse = '';
        const parts = response.candidates?.[0]?.content?.parts || [];
        
        for (const part of parts) {
          if (part.inlineData) {
            base64Data = part.inlineData.data;
            break;
          } else if (part.text) {
            textResponse += part.text;
          }
        }

        if (!base64Data) {
          const finishReason = response.candidates?.[0]?.finishReason;
          if (textResponse) {
            throw new Error(`AI Refused: ${textResponse}`);
          } else if (finishReason) {
            throw new Error(`Failed to generate image. Reason: ${finishReason}`);
          } else {
            throw new Error("Failed to generate image. The API returned an empty response.");
          }
        }

        // Use base64 string directly instead of Firebase Storage
        const imageUrl = `data:image/png;base64,${base64Data}`;

        generatedContent = {
          type: 'image',
          title: customPrompt || 'Generated Image',
          imageUrl: imageUrl,
          explanation: `Generated using ${selectedModel.name}`
        };

      } else {
        // Text Generation (Markdown for all text categories)
        let prompt = `Topic/Instructions: ${customPrompt || `A standard ${selectedCategory.name}`}

Task: Generate a highly detailed, professional, and comprehensive ${selectedCategory.name} based ONLY on the topic above.

CRITICAL INSTRUCTIONS:
1. DO NOT repeat, echo, or acknowledge this prompt or the instructions.
2. Start IMMEDIATELY with the actual content (e.g., Title, Subtitle, Table of Contents, Introduction).
3. Write the full content from beginning to end without stopping. Do not just write an outline.
4. Make it as long and detailed as possible, providing deep insights, storytelling, or comprehensive guides depending on the topic.
5. Format the output in clean Markdown.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: prompt,
          config: {
            systemInstruction: "You are an expert AI author and creator. You write full books, comprehensive websites, detailed apps, and extensive business plans. NEVER repeat the user's prompt. ALWAYS start directly with the requested content (Title, Introduction, etc.). Write extremely long, comprehensive, and detailed content from beginning to end without stopping.",
          }
        });

        generatedContent = { 
          type: 'markdown_book', 
          title: customPrompt || `Generated ${selectedCategory.name}`,
          explanation: `A complete ${selectedCategory.name} generated by AI.`,
          content: response.text || ''
        };
      }
      
      setResult(generatedContent);

      // Deduct credit and save to Firestore
      if (!userProfile.isPro) {
        await updateDoc(doc(db, 'users', user.uid), {
          credits: increment(-1)
        });
      }

      let resultToSave = { ...generatedContent };
      if (generatedContent.type === 'image') {
        // Compress more aggressively to ensure it fits within Firestore's 1MB limit
        const compressedImageUrl = await compressImage(generatedContent.imageUrl, 400, 0.4);
        resultToSave.imageUrl = compressedImageUrl;
      }

      await addDoc(collection(db, 'ai_results'), {
        userId: user.uid,
        tool: selectedCategory.name,
        model: selectedModel.name,
        prompt: customPrompt,
        result: resultToSave,
        createdAt: new Date().toISOString()
      });

      toast.success(`${selectedCategory.name} generated successfully!`);
    } catch (error: any) {
      console.error("Error generating AI content:", error);
      toast.error(error.message || 'Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!userProfile?.isPro) {
      toast.error('Publishing requires a Pro upgrade.');
      handleUpgrade();
      return;
    }

    if (!result) return;

    try {
      let resultToSave = { ...result };
      let imageToSave = null;
      
      if (result.type === 'image') {
        const compressedImageUrl = await compressImage(result.imageUrl, 400, 0.4);
        resultToSave.imageUrl = compressedImageUrl;
        imageToSave = compressedImageUrl;
      }

      await addDoc(collection(db, 'products'), {
        creatorId: user?.uid,
        creatorName: userProfile.displayName || 'Creator',
        creatorPhoto: userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.displayName || 'Creator'}`,
        title: result.title,
        description: result.explanation,
        price: 9.99, // Default price
        category: selectedCategory.id === 'full_book' ? 'Book' : 'AI Content',
        content: JSON.stringify(resultToSave),
        imageUrl: imageToSave,
        salesCount: 0,
        rating: 5.0,
        reviewsCount: 0,
        createdAt: new Date().toISOString()
      });
      
      toast.success('Successfully published to the marketplace!');
      navigate('/marketplace');
    } catch (error) {
      console.error("Error publishing:", error);
      toast.error('Failed to publish. Please try again.');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    let content = '';
    if (result.type === 'image') {
      const a = document.createElement('a');
      a.href = result.imageUrl;
      a.download = `${result.title.replace(/\s+/g, '_')}.png`;
      a.click();
      toast.success('Downloaded successfully!');
      return;
    } else if (result.type === 'markdown_book') {
      content = result.content;
    } else {
      content += `# ${result.title}\n\n`;
      content += `${result.explanation}\n\n`;
      content += `## Target Audience\n${result.targetAudience}\n\n`;
      
      result.sections?.forEach((section: any) => {
        content += `## ${section.heading}\n\n${section.content}\n\n`;
      });
      
      content += `## Action Items\n`;
      result.actionItems?.forEach((item: string, i: number) => {
        content += `${i + 1}. ${item}\n`;
      });
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded successfully!');
  };

  return (
    <div className="p-4 md:p-8 pb-24 max-w-5xl mx-auto">
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#6366f1', // indigo-500
            backgroundColor: '#18181b', // zinc-900
            textColor: '#fff',
            arrowColor: '#18181b',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonNext: {
            backgroundColor: '#6366f1',
          },
          buttonBack: {
            color: '#a1a1aa', // zinc-400
          }
        }}
      />

      <div className="mb-8 text-center tour-header relative">
        <button 
          onClick={() => setRunTour(true)}
          className="absolute right-0 top-0 flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full"
        >
          <HelpCircle className="w-4 h-4" />
          Take a Tour
        </button>
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">AI Studio</h1>
        <p className="text-zinc-400 max-w-xl mx-auto mb-6">
          Create ebooks, websites, apps, and business plans instantly.
        </p>
        
        {/* Credits Display */}
        {userProfile && (
          <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 tour-credits">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">
                {userProfile.isPro ? 'Unlimited Credits' : `${userProfile.credits || 0} Credits Left`}
              </span>
            </div>
            {!userProfile.isPro && (
              <button 
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Model Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl tour-model-select">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Select AI Model</h3>
            <div className="space-y-3">
              {models.map((model) => {
                const Icon = model.icon;
                const isSelected = selectedModel.id === model.id;
                const isDisabled = selectedCategory.id === 'cover' && model.id !== 'gemini-2.5-flash-image';
                
                return (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.1)]' 
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{model.name}</h4>
                      <p className="text-xs text-zinc-500">{model.description}</p>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-indigo-500 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl tour-category-select">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">What to Create</h3>
            <div className="grid grid-cols-1 gap-2">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                      isSelected 
                        ? 'bg-zinc-800 border-zinc-600' 
                        : 'bg-transparent border-transparent hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${cat.color}`} />
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Input & Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Input Area */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Describe your idea in detail
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={`E.g., I want to create a ${selectedCategory.name.toLowerCase()} about...`}
              className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white placeholder-zinc-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none mb-4 tour-prompt-input"
              rows={4}
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!userProfile?.isPro && userProfile?.credits <= 0)}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed tour-generate-btn"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate {selectedCategory.name}
                </>
              )}
            </button>
          </div>

          {/* Results Area */}
          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                      {result.title}
                    </h2>
                    <span className="px-4 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-semibold border border-indigo-500/30">
                      {selectedCategory.name}
                    </span>
                  </div>

                  {result.type === 'image' ? (
                    <div className="mb-8 rounded-2xl overflow-hidden border border-zinc-800">
                      <img referrerPolicy="no-referrer" src={result.imageUrl} alt={result.title} className="w-full h-auto object-cover" />
                    </div>
                  ) : result.type === 'markdown_book' ? (
                    <div className="mb-8 prose prose-invert max-w-none bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50">
                      <Markdown>{result.content}</Markdown>
                    </div>
                  ) : (
                    <>
                      <p className="text-lg text-zinc-300 mb-8 leading-relaxed">
                        {result.explanation}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-black/50 border border-zinc-800/50 rounded-2xl p-5">
                          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Target Audience
                          </h3>
                          <p className="text-white">{result.targetAudience}</p>
                        </div>
                      </div>

                      <div className="space-y-6 mb-8">
                        {result.sections?.map((section: any, i: number) => (
                          <div key={i} className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800/50">
                            <h3 className="text-lg font-semibold text-white mb-2">{section.heading}</h3>
                            <p className="text-zinc-300 leading-relaxed">{section.content}</p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 mb-8">
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-yellow-400" /> Action Items
                        </h3>
                        <ul className="space-y-3">
                          {result.actionItems?.map((step: string, i: number) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">
                                {i + 1}
                              </span>
                              <span className="text-zinc-200">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  {/* Publishing & Export Actions */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-zinc-800/50">
                    <button 
                      onClick={handlePublish}
                      className="flex-1 bg-white hover:bg-zinc-200 text-black font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-5 h-5" />
                      Publish to Marketplace
                      {!userProfile?.isPro && <Lock className="w-4 h-4 ml-1 text-zinc-500" />}
                    </button>
                    <button 
                      onClick={handleDownload}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Download Asset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
