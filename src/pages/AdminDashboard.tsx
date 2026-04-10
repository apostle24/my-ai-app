import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Users, DollarSign, Activity, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      if (userProfile?.role !== 'admin') return;
      
      try {
        // Fetch recent users
        const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
        const usersSnap = await getDocs(usersQ);
        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch recent transactions
        const txQ = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(50));
        const txSnap = await getDocs(txQ);
        setTransactions(txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching admin data:", error);
        toast.error("Failed to load admin dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [userProfile]);

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update user role");
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-zinc-400">You do not have permission to view this page.</p>
      </div>
    );
  }

  const totalRevenue = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const totalTax = transactions.reduce((sum, tx) => sum + (tx.taxAmount || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-500" />
          Admin Dashboard
        </h1>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-zinc-400">Total Users (Recent)</p>
            <p className="text-2xl font-bold text-white">{users.length}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-zinc-400">Total Revenue</p>
            <p className="text-2xl font-bold text-white">${totalRevenue.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <p className="text-sm text-zinc-400">Total Tax Collected</p>
            <p className="text-2xl font-bold text-white">${totalTax.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-zinc-400">Transactions</p>
            <p className="text-2xl font-bold text-white">{transactions.length}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Management */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                User Management
              </h2>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <div className="flex items-center gap-3">
                    <img referrerPolicy="no-referrer" src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} alt={u.displayName} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-semibold text-white">{u.displayName}</p>
                      <p className="text-xs text-zinc-400">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-700 text-zinc-300'}`}>
                      {u.role || 'user'}
                    </span>
                    <button 
                      onClick={() => handleToggleAdmin(u.id, u.role)}
                      className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Toggle Role
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Recent Transactions
              </h2>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <div>
                    <p className="font-semibold text-white capitalize">{tx.type}</p>
                    <p className="text-xs text-zinc-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">+${tx.amount?.toFixed(2)}</p>
                    <p className={`text-xs ${tx.status === 'success' ? 'text-emerald-500' : 'text-yellow-500'}`}>{tx.status}</p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center text-zinc-500 py-8">No recent transactions</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
