import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, Search, Filter, Star, Download, TrendingUp, Package, X, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';

import { usePaystackPayment } from 'react-paystack';

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

const BuyButton = ({ product, user, className, children, onClick }: { product: any, user: any, className?: string, children?: React.ReactNode, onClick?: () => void }) => {
  const { setAuthModalOpen } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const baseAmount = Number(product.price) || 0;
  const taxRate = 0.10; // 10% tax
  const taxAmount = baseAmount * taxRate;
  const totalAmount = baseAmount + taxAmount;
  const amountInPesewas = Math.round(totalAmount * 100);

  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || '',
    amount: amountInPesewas > 0 ? amountInPesewas : 100, // Paystack requires amount > 0
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_your_paystack_key',
    currency: 'GHS',
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    try {
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        creatorId: product.creatorId || 'unknown',
        itemId: product.id,
        amount: totalAmount,
        taxAmount: taxAmount,
        baseAmount: baseAmount,
        type: 'purchase',
        status: 'success',
        paymentReference: reference.reference,
        createdAt: new Date().toISOString()
      });
      toast.success('Payment successful! Your purchase is complete.');
      if (onClick) onClick();
    } catch (error) {
      console.error('Error recording transaction:', error);
      toast.error('Payment successful, but failed to record transaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onClosePayment = () => {
    toast.error('Payment canceled');
    setIsProcessing(false);
  };

  const handlePurchase = async () => {
    if (!user) {
      toast.error('Please sign in to purchase');
      setAuthModalOpen(true);
      return;
    }

    if (amount <= 0) {
      // Handle free product
      setIsProcessing(true);
      await onSuccess({ reference: 'free_item_' + Date.now() });
      return;
    }

    if (!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY) {
      toast.error('Paystack Public Key is missing. Please configure VITE_PAYSTACK_PUBLIC_KEY in your environment variables.');
      return;
    }

    setIsProcessing(true);
    initializePayment({ onSuccess, onClose: onClosePayment });
  };

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        handlePurchase();
      }}
      disabled={isProcessing}
      className={className || "flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"}
    >
      {isProcessing ? 'Processing...' : children || (
        <>
          <Download className="w-4 h-4" />
          Buy
        </>
      )}
    </button>
  );
};

const ProductCard = ({ product, user, setSelectedProduct }: { product: any, user: any, setSelectedProduct: (p: any) => void }) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all group flex flex-col">
      <div className="aspect-video bg-zinc-800 relative overflow-hidden">
        {product.imageUrl ? (
          <img referrerPolicy="no-referrer"  
            src={product.imageUrl} 
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-zinc-700" />
          </div>
        )}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-sm font-medium text-white border border-white/10">
          {product.category}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-white line-clamp-1">{product.title}</h3>
          <span className="text-lg font-bold text-indigo-400">GH₵{Number(product.price).toFixed(2)}</span>
        </div>
        <p className="text-zinc-400 text-sm line-clamp-2 mb-4 flex-1">
          {product.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            {product.creatorPhoto ? (
              <img referrerPolicy="no-referrer"  src={product.creatorPhoto} alt={product.creatorName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                {product.creatorName?.charAt(0) || 'C'}
              </div>
            )}
            <span className="text-sm text-zinc-300">{product.creatorName || 'Creator'}</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 text-sm">
            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            <span>{product.rating ? product.rating.toFixed(1) : '5.0'}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button 
            onClick={() => setSelectedProduct(product)}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center"
          >
            Details
          </button>
          <BuyButton product={product} user={user} />
        </div>
      </div>
    </div>
  );
};

export default function Marketplace() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  
  // Add Product Modal State
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    features: '',
    price: '',
    category: 'Template',
    imageUrl: ''
  });
  const [imageBase64, setImageBase64] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const categories = ['All', 'Template', 'Course', 'Document', 'Presentation', 'Service', 'AI Prompt', 'Book', 'AI Content'];
  const productCategories = categories.filter(c => c !== 'All');

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, text: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    if (!selectedProduct) {
      setReviews([]);
      return;
    }
    const q = query(collection(db, `products/${selectedProduct.id}/reviews`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedProduct]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to leave a review');
      return;
    }
    if (!newReview.text.trim()) {
      toast.error('Please write a review');
      return;
    }
    if (selectedProduct.id.startsWith('mock-') || (selectedProduct.id.startsWith('p') && selectedProduct.id.length <= 3)) {
      toast.error('Cannot review demo products. Please add a real product first.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, `products/${selectedProduct.id}/reviews`), {
        userId: user.uid,
        userName: user.displayName || 'User',
        userPhoto: user.photoURL || '',
        rating: newReview.rating,
        text: newReview.text,
        createdAt: new Date().toISOString()
      });

      // Update product average rating
      const newCount = (selectedProduct.reviewsCount || 0) + 1;
      const currentTotal = (selectedProduct.rating || 5) * (selectedProduct.reviewsCount || 0);
      const newAvg = (currentTotal + newReview.rating) / newCount;
      
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        rating: newAvg,
        reviewsCount: newCount
      });

      setNewReview({ rating: 5, text: '' });
      toast.success('Review submitted successfully!');
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to add a product');
      return;
    }
    
    if (!newProduct.title || !newProduct.description || !newProduct.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'products'), {
        title: newProduct.title,
        description: newProduct.description,
        features: newProduct.features.split('\n').filter(f => f.trim() !== ''),
        price: Number(newProduct.price),
        category: newProduct.category,
        imageUrl: imageBase64 || newProduct.imageUrl || `https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80`,
        content: pdfBase64 || '',
        creatorId: user.uid,
        creatorName: user.displayName || 'Anonymous Creator',
        creatorPhoto: user.photoURL || '',
        createdAt: new Date().toISOString()
      });
      
      toast.success('Product added successfully!');
      setIsAddingProduct(false);
      setNewProduct({ title: '', description: '', features: '', price: '', category: 'Template', imageUrl: '' });
      setImageBase64('');
      setPdfBase64('');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('success') === 'true') {
      toast.success('Payment successful! Your purchase is complete.');
      // Remove query params
      navigate('/marketplace', { replace: true });
    } else if (urlParams.get('canceled') === 'true') {
      toast.error('Payment canceled.');
      navigate('/marketplace', { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (fetchedProducts.length === 0) {
        setProducts([
          {
            id: 'p1',
            title: 'Ultimate Notion Life Planner',
            description: 'Organize your entire life with this comprehensive Notion system. Includes habit tracker, finance dashboard, and goal setting.',
            price: 300.00,
            category: 'Template',
            creatorName: 'Sarah Jenkins',
            creatorId: 'c1',
            imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800',
            features: ['Daily & Weekly Planners', 'Finance & Budget Tracker', 'Habit & Goal Tracking', 'Lifetime Updates']
          },
          {
            id: 'p2',
            title: 'Social Media Content Calendar',
            description: 'Plan 30 days of content in 1 hour with this Airtable template. Perfect for creators and agencies.',
            price: 180.00,
            category: 'Template',
            creatorName: 'Marcus Chen',
            creatorId: 'c2',
            imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800',
            features: ['30-Day Content Strategy', 'Platform-Specific Formats', 'Analytics Tracking', 'Collaboration Ready']
          },
          {
            id: 'p3',
            title: 'Freelance Invoice Template',
            description: 'Professional, automated invoice template for freelancers. Get paid faster and look more professional.',
            price: 0.00,
            category: 'Document',
            creatorName: 'Elena Rodriguez',
            creatorId: 'c3',
            imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
            features: ['Auto-calculating Totals', 'Tax & Discount Fields', 'Professional Design', 'Export to PDF']
          },
          {
            id: 'p4',
            title: 'Startup Pitch Deck',
            description: 'The exact pitch deck template used to raise $1M+. Includes slide-by-slide instructions and examples.',
            price: 450.00,
            category: 'Presentation',
            creatorName: 'David Kim',
            creatorId: 'c4',
            imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
            features: ['15+ Slide Templates', 'Investor-Approved Structure', 'Financial Model Included', 'Figma & PowerPoint Formats']
          },
          {
            id: 'p5',
            title: 'ChatGPT Marketing Prompts',
            description: '100+ tested ChatGPT prompts for marketers, copywriters, and SEO specialists.',
            price: 150.00,
            category: 'AI Prompt',
            creatorName: 'Alex Rivera',
            creatorId: 'c5',
            imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
            features: ['100+ Copy/Paste Prompts', 'SEO Optimization Prompts', 'Email Marketing Sequences', 'Social Media Hooks']
          },
          {
            id: 'p6',
            title: 'Mastering React Hooks',
            description: 'A comprehensive video course on advanced React Hooks patterns and performance optimization.',
            price: 750.00,
            category: 'Course',
            creatorName: 'Tech Academy',
            creatorId: 'c6',
            imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
            features: ['4 Hours of Video Content', 'Custom Hooks Patterns', 'Performance Optimization', 'Certificate of Completion']
          },
          {
            id: 'p7',
            title: 'SaaS Landing Page UI Kit',
            description: 'A premium, high-converting UI kit for SaaS companies. Includes 50+ components and 5 full page designs in Figma.',
            price: 600.00,
            category: 'Template',
            creatorName: 'Design Studio',
            creatorId: 'c7',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
            features: ['50+ UI Components', '5 Full Landing Pages', 'Responsive Design', 'Figma Source Files']
          },
          {
            id: 'p8',
            title: 'Complete SEO Audit Checklist',
            description: 'The ultimate 150-point SEO checklist used by top agencies to rank websites on page 1 of Google.',
            price: 220.00,
            category: 'Document',
            creatorName: 'Growth Hackers',
            creatorId: 'c8',
            imageUrl: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800',
            features: ['150+ Actionable Points', 'Technical SEO Checks', 'On-Page & Off-Page SEO', 'Google Sheets Format']
          },
          {
            id: 'p9',
            title: 'AI Image Generation Masterclass',
            description: 'Learn how to write perfect prompts for Midjourney, DALL-E 3, and Stable Diffusion to create stunning artwork.',
            price: 380.00,
            category: 'Course',
            creatorName: 'AI Artists',
            creatorId: 'c9',
            imageUrl: 'https://images.unsplash.com/photo-1686191128892-3b370f3c582c?w=800',
            features: ['Midjourney V6 Techniques', 'DALL-E 3 Integration', 'Prompt Engineering Secrets', 'Commercial Rights Guide']
          }
        ]);
      } else {
        setProducts(fetchedProducts);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Mock search delay
  useEffect(() => {
    if (!searchQuery) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(() => {
      setIsSearching(false);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = p.title?.toLowerCase().includes(searchLower) ||
                            p.description?.toLowerCase().includes(searchLower) ||
                            (p.features && Array.isArray(p.features) && p.features.some((f: string) => f.toLowerCase().includes(searchLower)));
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesPrice = priceFilter === 'all' || 
                           (priceFilter === 'free' && Number(p.price) === 0) ||
                           (priceFilter === 'paid' && Number(p.price) > 0);
      
      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [products, searchQuery, selectedCategory, priceFilter]);

  return (
    <div className="p-4 md:p-8 pb-24 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-8 h-8 text-indigo-400" />
            Marketplace
          </h1>
          <p className="text-zinc-400 mt-1">Discover and buy digital products, templates, and tools.</p>
        </div>
        <button 
          onClick={() => setIsAddingProduct(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-zinc-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, templates, courses..."
              className="block w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-6 py-3 border rounded-2xl transition-colors active:scale-95 ${
              showFilters || selectedCategory !== 'All' || priceFilter !== 'all'
                ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700' 
                : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
            {(selectedCategory !== 'All' || priceFilter !== 'all') && (
              <span className="ml-1 w-2 h-2 rounded-full bg-white"></span>
            )}
          </button>
        </div>

        {/* Expanded Filters Panel */}
        {showFilters && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Filter Products</h3>
              <button 
                onClick={() => {
                  setSelectedCategory('All');
                  setPriceFilter('all');
                }}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === cat 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Price</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'Any Price' },
                    { id: 'free', label: 'Free' },
                    { id: 'paid', label: 'Paid' }
                  ].map(price => (
                    <button
                      key={price.id}
                      onClick={() => setPriceFilter(price.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        priceFilter === price.id 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {price.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      {isSearching || loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-zinc-900 rounded-2xl h-80 animate-pulse border border-zinc-800"></div>
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} user={user} setSelectedProduct={setSelectedProduct} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-zinc-900/50 rounded-3xl border border-zinc-800/50">
          <ShoppingBag className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No products found</h3>
          <p className="text-zinc-400 max-w-md mx-auto">
            {searchQuery ? `We couldn't find anything matching "${searchQuery}".` : "No products match your current filters."}
          </p>
          <button 
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setPriceFilter('all');
            }}
            className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="relative aspect-video bg-zinc-800">
              {selectedProduct.imageUrl ? (
                <img referrerPolicy="no-referrer"  
                  src={selectedProduct.imageUrl} 
                  alt={selectedProduct.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-zinc-700" />
                </div>
              )}
              <button 
                onClick={() => setSelectedProduct(null)} 
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-medium text-white border border-white/10">
                {selectedProduct.category}
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">{selectedProduct.title}</h2>
                <span className="text-2xl font-bold text-indigo-400">GH₵{Number(selectedProduct.price).toFixed(2)}</span>
              </div>
              
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800">
                {selectedProduct.creatorPhoto ? (
                  <img referrerPolicy="no-referrer"  src={selectedProduct.creatorPhoto} alt={selectedProduct.creatorName} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                    {selectedProduct.creatorName?.charAt(0) || 'C'}
                  </div>
                )}
                <div>
                  <p className="text-sm text-zinc-400">Created by</p>
                  <p className="text-white font-medium">{selectedProduct.creatorName || 'Creator'}</p>
                </div>
                <div className="ml-auto flex items-center gap-1 text-zinc-400">
                  <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                  <span className="font-medium text-white">{selectedProduct.rating ? selectedProduct.rating.toFixed(1) : '5.0'}</span>
                  <span className="text-sm">({selectedProduct.reviewsCount || 0} reviews)</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {selectedProduct.description}
                  </p>
                </div>
                
                {selectedProduct.features && selectedProduct.features.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Features</h3>
                    <ul className="space-y-2">
                      {selectedProduct.features.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-zinc-300">
                          <div className="mt-1 min-w-[16px] flex justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-zinc-800">
                  <h3 className="text-lg font-semibold text-white mb-4">Reviews</h3>
                  
                  {user && (
                    <form onSubmit={handleSubmitReview} className="mb-6 bg-zinc-800/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-zinc-400">Your Rating:</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setNewReview({ ...newReview, rating: star })}
                              className="focus:outline-none"
                            >
                              <Star className={`w-5 h-5 ${newReview.rating >= star ? 'fill-yellow-500 text-yellow-500' : 'text-zinc-600'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={newReview.text}
                        onChange={(e) => setNewReview({ ...newReview, text: e.target.value })}
                        placeholder="Write your review..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20 mb-3"
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </form>
                  )}

                  <div className="space-y-4">
                    {reviews.length > 0 ? (
                      reviews.map((review) => (
                        <div key={review.id} className="bg-zinc-800/30 p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {review.userPhoto ? (
                                <img referrerPolicy="no-referrer"  src={review.userPhoto} alt={review.userName} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                                  {review.userName?.charAt(0) || 'U'}
                                </div>
                              )}
                              <span className="text-sm font-medium text-white">{review.userName}</span>
                            </div>
                            <div className="flex items-center">
                              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 mr-1" />
                              <span className="text-xs text-zinc-400">{review.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          <p className="text-sm text-zinc-300">{review.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-500 text-sm italic">No reviews yet. Be the first to review!</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-6 py-3 text-zinc-400 hover:text-white transition-colors font-medium"
              >
                Close
              </button>
              <BuyButton 
                product={selectedProduct} 
                user={user} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
                onClick={() => setSelectedProduct(null)}
              >
                <Download className="w-5 h-5" />
                Buy Now
              </BuyButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Add New Product</h2>
              <button onClick={() => setIsAddingProduct(false)} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="add-product-form" onSubmit={handleAddProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.title}
                    onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Ultimate Notion Planner"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Description *</label>
                  <textarea
                    required
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                    placeholder="Describe your product..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Features (One per line)</label>
                  <textarea
                    value={newProduct.features}
                    onChange={(e) => setNewProduct({ ...newProduct, features: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
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
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Category *</label>
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {productCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
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
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {imageBase64 && <img referrerPolicy="no-referrer"  src={imageBase64} alt="Preview" className="mt-2 h-20 rounded object-cover" />}
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
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {pdfBase64 && <p className="text-xs text-emerald-400 mt-1">PDF attached successfully</p>}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-product-form"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
