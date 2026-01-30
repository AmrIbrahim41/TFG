import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ArrowRight, Lock, User, Loader2 } from 'lucide-react';

const Login = () => {
  const { loginUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await loginUser(username, password);
    if (success) {
        navigate('/');
    } else {
        setIsLoading(false);
    }
  };

  return (
    // ADDED 'w-full' HERE to fix the alignment issue
    <div className="w-full min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Abstract Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        
        <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 mb-6">
                <Dumbbell size={32} />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
            <p className="text-zinc-500 mt-2">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                    <User size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder="Username" 
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-12 pr-4 py-4 text-white placeholder-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                  onChange={(e) => setUsername(e.target.value)}
                />
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                    <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-12 pr-4 py-4 text-white placeholder-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                  onChange={(e) => setPassword(e.target.value)}
                />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-900/20 mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <>Sign In <ArrowRight size={20} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;