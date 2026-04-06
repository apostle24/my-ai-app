import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, CreditCard, Download, Package, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useAppStore } from '../store';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

export default function CreatorDashboard() {
  const { user, userProfile } = useAuth();
  const { setAuthModalOpen } = useAppStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'transactions'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    const productsQuery = query(
      collection(db, 'products'),
      where('creatorId', '==', user.uid),
      limit(50)
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
    };
  }, [user]);

  const handleApplyCreator = async () => {
    if (!user) return;
    setIsApplying(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isCreator: true,
        updatedAt: new Date().toISOString()
      });
      toast.success('Congratulations! You are now a creator.');
      // The UI will update automatically because userProfile is reactive in AuthContext
    } catch (error) {
      console.error("Error applying for creator:", error);
      toast.error('Failed to apply. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > (userProfile.walletBalance || 0)) {
      toast.error('Insufficient balance');
      return;
    }

    setIsWithdrawing(true);
    try {
      // In a real app, this would call a Cloud Function to securely process the withdrawal via Stripe API
      // For this demo, we'll just record the withdrawal request
      
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        creatorId: user.uid,
        amount: amount,
        type: 'withdrawal',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Update creator's wallet balance
      import('firebase/firestore').then(async ({ getDoc, increment }) => {
        const creatorRef = doc(db, 'users', user.uid);
        await updateDoc(creatorRef, {
          walletBalance: increment(-amount)
        });
      });

      toast.success('Withdrawal request submitted successfully!');
      setWithdrawAmount('');
      
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      toast.error('Failed to submit withdrawal request');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const salesData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      return {
        date: format(d, 'MMM dd'),
        start: startOfDay(d).toISOString(),
        end: endOfDay(d).toISOString(),
        earnings: 0,
        sales: 0
      };
    });

    transactions.forEach(tx => {
      if (tx.type === 'purchase' && tx.status === 'completed') {
        const txDate = tx.createdAt;
        const day = last7Days.find(d => txDate >= d.start && txDate <= d.end);
        if (day) {
          day.earnings += tx.amount;
          day.sales += 1;
        }
      }
    });

    return last7Days;
  }, [transactions]);

  const topProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 5);
  }, [products]);

  if (!userProfile?.isCreator) {
    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh] px-4 text-center">
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-2">Sign in to access Dashboard</h2>
            <p className="text-zinc-400 mb-6">You need to be signed in to become a creator and manage your earnings.</p>
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
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
          <TrendingUp className="w-10 h-10 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Become a Creator</h2>
        <p className="text-zinc-400 max-w-md mb-8">
          Unlock monetization features, sell digital products, and earn from your content.
        </p>
        <button 
          onClick={handleApplyCreator}
          disabled={isApplying}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-colors disabled:opacity-50"
        >
          {isApplying ? 'Applying...' : 'Apply Now'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-indigo-400" />
          Creator Dashboard
        </h1>
        <button 
          onClick={() => window.location.href = '/ai-studio'}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <Package className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <DollarSign className="w-4 h-4" /> Available Balance
            </div>
            <div className="text-4xl font-bold text-white">
              ${userProfile.walletBalance?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Total Earned
          </div>
          <div className="text-2xl font-bold text-white">
            ${transactions.filter(t => t.type === 'purchase').reduce((acc, t) => acc + t.amount, 0).toFixed(2)}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Package className="w-4 h-4 text-indigo-400" /> Total Products
          </div>
          <div className="text-2xl font-bold text-white">
            {products.length}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Earnings (Last 7 Days)
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Earnings']}
                />
                <Area 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorEarnings)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            Sales Volume (Last 7 Days)
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#818cf8' }}
                  cursor={{ fill: '#27272a', opacity: 0.4 }}
                  formatter={(value: number) => [value, 'Sales']}
                />
                <Bar 
                  dataKey="sales" 
                  fill="#818cf8" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-400" />
          Top Selling Products
        </h2>
        {topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-sm">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium text-right">Price</th>
                  <th className="pb-3 font-medium text-right">Sales</th>
                  <th className="pb-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {topProducts.map(product => (
                  <tr key={product.id} className="text-sm hover:bg-zinc-800/30 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <img referrerPolicy="no-referrer" 
                          src={product.imageUrl || `https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100`} 
                          alt={product.title} 
                          className="w-10 h-10 rounded-lg object-cover bg-zinc-800"
                        />
                        <span className="font-medium text-white">{product.title}</span>
                      </div>
                    </td>
                    <td className="py-4 text-zinc-400">{product.category}</td>
                    <td className="py-4 text-right text-zinc-300">${product.price.toFixed(2)}</td>
                    <td className="py-4 text-right text-zinc-300">{product.salesCount || 0}</td>
                    <td className="py-4 text-right font-medium text-emerald-400">
                      ${((product.salesCount || 0) * product.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No products sold yet.</p>
          </div>
        )}
      </div>

      {/* Withdrawal Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          Withdraw Funds
        </h2>
        <form onSubmit={handleWithdraw} className="flex gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-zinc-500">$</span>
            </div>
            <input
              type="number"
              min="10"
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount (Min $10)"
              className="block w-full pl-8 pr-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isWithdrawing || !withdrawAmount}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isWithdrawing ? 'Processing...' : 'Withdraw'}
          </button>
        </form>
        <p className="text-xs text-zinc-500 mt-3">
          Withdrawals are processed via Stripe and typically take 1-2 business days.
        </p>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-zinc-500">Loading transactions...</div>
          ) : transactions.length > 0 ? (
            <div className="divide-y divide-zinc-800/50">
              {transactions.map(tx => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === 'withdrawal' ? 'bg-pink-500/10 text-pink-500' : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {tx.type === 'withdrawal' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{tx.description || (tx.type === 'withdrawal' ? 'Withdrawal' : 'Sale')}</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        {tx.createdAt ? format(new Date(tx.createdAt), 'MMM d, yyyy • h:mm a') : 'Unknown date'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.type === 'withdrawal' ? 'text-white' : 'text-emerald-400'}`}>
                      {tx.type === 'withdrawal' ? '-' : '+'}${tx.amount.toFixed(2)}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {tx.status === 'completed' ? (
                        <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-xs text-emerald-500">Completed</span></>
                      ) : tx.status === 'pending' ? (
                        <><Clock className="w-3 h-3 text-yellow-500" /><span className="text-xs text-yellow-500">Pending</span></>
                      ) : (
                        <><XCircle className="w-3 h-3 text-red-500" /><span className="text-xs text-red-500">Failed</span></>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-white font-medium mb-1">No transactions yet</h3>
              <p className="text-zinc-500 text-sm">When you earn or withdraw money, it will show up here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
