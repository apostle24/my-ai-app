import { useState } from "react";
import { X, Check, Zap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Please sign in to upgrade');
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
          isUpgrade: true,
          interval
        })
      });

      const data = await response.json();
      if (data.url) {
        if (data.url.includes(window.location.origin)) {
          window.location.href = data.url;
        } else {
          window.open(data.url, '_blank');
        }
        onClose();
        setIsUpgrading(false);
      } else {
        throw new Error(data.error || 'Failed to initialize checkout');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout process');
      setIsUpgrading(false);
    }
  };

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
              <span className="text-4xl font-bold text-white">${interval === 'month' ? '9.99' : '99.00'}</span>
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
