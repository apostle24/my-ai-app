import { useState } from "react";
import { X, Check, Zap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { usePaystackPayment } from 'react-paystack';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  const amount = interval === 'month' ? 15000 : 150000; // Amount in pesewas (GH₵150 and GH₵1500)

  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || '',
    amount: amount,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_your_paystack_key',
    currency: 'GHS',
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          isPro: true,
          credits: 9999
        });
        
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          amount: amount / 100,
          type: 'subscription',
          status: 'success',
          paymentReference: reference.reference,
          createdAt: new Date().toISOString()
        });
      }
      toast.success('Successfully upgraded to Pro! You now have unlimited credits.');
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Payment successful, but failed to update profile. Please contact support.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const onClosePayment = () => {
    toast.error('Payment canceled');
    setIsUpgrading(false);
  };

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Please sign in to upgrade');
      return;
    }
    
    if (!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY) {
      toast.info('Test Mode: Simulating successful upgrade...');
      setIsUpgrading(true);
      setTimeout(() => {
        onSuccess({ reference: 'simulated_upgrade_' + Date.now() });
      }, 1500);
      return;
    }

    setIsUpgrading(true);
    initializePayment({ onSuccess, onClose: onClosePayment });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-6">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Upgrade to Premium</h2>
          <p className="text-zinc-400 mb-8">Unlock unlimited AI generation, 4K images, and advanced features.</p>

          <div className="flex bg-zinc-900 p-1 rounded-xl mb-6">
            <button
              onClick={() => setInterval('month')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${interval === 'month' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('year')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${interval === 'year' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              Yearly <span className="text-xs text-green-400 ml-1">Save 17%</span>
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 text-left">
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-bold text-white">GH₵{interval === 'month' ? '150' : '1500'}</span>
              <span className="text-zinc-400">/{interval === 'month' ? 'mo' : 'yr'}</span>
            </div>
            <ul className="space-y-4">
              {[
                'Unlimited AI Studio Generation',
                'High-Quality 4K Image Generation',
                'AI-Generated Post Content',
                'AI-Generated Comment Replies',
                'AI Profile Bio Generation',
                'AI Product Descriptions'
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                  <div className="bg-indigo-500/20 p-1 rounded-full">
                    <Check className="w-3 h-3 text-indigo-400" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUpgrading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Upgrade Now'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
