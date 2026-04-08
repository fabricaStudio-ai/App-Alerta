/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Mic, 
  Send, 
  Wifi, 
  WifiOff, 
  MapPin, 
  MapPinOff, 
  Volume2, 
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  History,
  Settings,
  MoreVertical,
  LogIn,
  LogOut,
  User,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DecisionEngine } from './services/geminiService';
import { AppContext, DecisionResponse, RiskLevel } from './types';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [internetAvailable, setInternetAvailable] = useState(true);
  const [gpsAvailable, setGpsAvailable] = useState(true);
  const [silentMode, setSilentMode] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [history, setHistory] = useState<DecisionResponse[]>(() => {
    const saved = localStorage.getItem('safeguard_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  
  const engine = useRef(new DecisionEngine());

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Sync user profile
        const userRef = doc(db, 'users', u.uid);
        setDoc(userRef, {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, []);

  // Test Firestore connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    localStorage.setItem('safeguard_history', JSON.stringify(history));
  }, [history]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleProcess = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    try {
      const context: AppContext = {
        fala_usuario: input,
        internet_disponivel: internetAvailable,
        gps_disponivel: gpsAvailable,
        gravacao_disponivel: true,
        contatos_configurados: true,
        modo_silencioso_ativado: silentMode,
        usuario_autenticado: !!user,
        suporte_firebase_auth: true,
        suporte_firestore: true,
        suporte_storage: true,
      };

      const result = await engine.current.processContext(context);
      setDecision(result);
      setHistory(prev => [result, ...prev]);

      // Save to Firestore if online and authenticated
      if (internetAvailable && user) {
        await addDoc(collection(db, 'events'), {
          userId: user.uid,
          timestamp: serverTimestamp(),
          riskLevel: result.nivel_risco,
          userMessage: input,
          decision: result,
          status: result.fase_evento
        });
      }

      setInput('');
    } catch (error) {
      console.error(error);
      // Fallback local logic if Gemini fails or offline
      if (!internetAvailable) {
        // Simple heuristic for offline
        const isUrgent = input.toLowerCase().includes('ajuda') || input.toLowerCase().includes('socorro');
        setDecision({
          nivel_risco: isUrgent ? RiskLevel.LEVEL_4 : RiskLevel.LEVEL_1,
          fase_evento: "ativo",
          motivo_classificacao: "Processamento local (Offline)",
          mensagem_usuario: isUrgent ? "Procure um local seguro imediatamente!" : "Mantenha a calma e observe os arredores.",
          acoes_recomendadas: ["Afaste-se do local", "Procure ajuda"],
          acoes_app: {
            iniciar_gravacao: true,
            salvar_localizacao: true,
            modo_silencioso: true,
            alertar_contatos: false,
            sugerir_ligacao_emergencia: true,
            registrar_evento_local: true,
            pronto_para_sync: false,
            gerar_relatorio_pos_evento: false
          },
          estado_rede: {
            internet_disponivel: false,
            gps_disponivel: gpsAvailable,
            orientacao_offline: "Dados salvos localmente. Sincronização pendente."
          },
          firebase: {
            usar_auth: true,
            usuario_autenticado: false,
            salvar_firestore_quando_possivel: true,
            salvar_storage_quando_possivel: true
          },
          proximo_passo: "Aguardar conexão para sincronizar."
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.LEVEL_1: return 'text-blue-500 bg-blue-50 border-blue-100';
      case RiskLevel.LEVEL_2: return 'text-amber-500 bg-amber-50 border-amber-100';
      case RiskLevel.LEVEL_3: return 'text-red-500 bg-red-50 border-red-100';
      case RiskLevel.LEVEL_4: return 'text-red-900 bg-red-100 border-red-200';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-slate-50 flex flex-col shadow-xl">
      {/* Header */}
      <header className="p-6 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-slate-900 dark:bg-slate-100 rounded-xl flex items-center justify-center text-white dark:text-slate-900">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight dark:text-white">SafeGuard AI</h1>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              <span className="flex items-center gap-1">
                {internetAvailable ? <Wifi size={10} className="text-green-500" /> : <WifiOff size={10} className="text-red-500" />}
                {internetAvailable ? 'Online' : 'Offline'}
              </span>
              <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <span className="flex items-center gap-1">
                {gpsAvailable ? <MapPin size={10} className="text-green-500" /> : <MapPinOff size={10} className="text-red-500" />}
                GPS {gpsAvailable ? 'OK' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <History size={20} />
        </button>
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        {user ? (
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <LogOut size={20} />
          </button>
        ) : (
          <button onClick={handleLogin} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <LogIn size={20} />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 dark:bg-slate-950">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Histórico de Eventos</h2>
                <button onClick={() => setShowHistory(false)} className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fechar</button>
              </div>
              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm italic">Nenhum evento registrado.</div>
              ) : (
                history.map((item, i) => (
                  <div key={i} className="safe-card p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${getRiskColor(item.nivel_risco).split(' ')[0].replace('text-', 'bg-')}`} />
                      <div>
                        <div className="text-xs font-bold truncate max-w-[180px]">{item.mensagem_usuario}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">Nível {item.nivel_risco} • {item.fase_evento}</div>
                      </div>
                    </div>
                    <button onClick={() => { setDecision(item); setShowHistory(false); }} className="text-xs font-bold text-slate-900">Ver</button>
                  </div>
                ))
              )}
              {history.length > 0 && (
                <button 
                  onClick={() => { setHistory([]); localStorage.removeItem('safeguard_history'); }}
                  className="w-full py-3 text-xs font-bold text-red-500 uppercase tracking-widest"
                >
                  Limpar Histórico
                </button>
              )}
            </motion.div>
          ) : !decision ? (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="safe-card bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-none">
                <h2 className="text-xl font-bold mb-2">Como posso ajudar?</h2>
                <p className="text-slate-400 dark:text-slate-600 text-sm">
                  Relate o que está acontecendo. Serei direto e ajudarei você a se manter segura.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setSilentMode(!silentMode)}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${silentMode ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800'}`}
                >
                  {silentMode ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  <span className="text-xs font-semibold uppercase tracking-wide">Modo Silencioso</span>
                </button>
                <button 
                  onClick={() => setInternetAvailable(!internetAvailable)}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${!internetAvailable ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800'}`}
                >
                  {!internetAvailable ? <WifiOff size={24} /> : <Wifi size={24} />}
                  <span className="text-xs font-semibold uppercase tracking-wide">Simular Offline</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="decision"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Risk Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${getRiskColor(decision.nivel_risco)} dark:bg-opacity-10 dark:border-opacity-20`}>
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} />
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-widest opacity-70">Risco Nível {decision.nivel_risco}</div>
                    <div className="font-bold">{decision.fase_evento === 'ativo' ? 'SITUAÇÃO ATIVA' : 'PÓS-EVENTO'}</div>
                  </div>
                </div>
                <button onClick={() => setDecision(null)} className="p-1 opacity-50 hover:opacity-100">
                  <CheckCircle2 size={20} />
                </button>
              </div>

              {/* Guidance */}
              <div className="safe-card space-y-4">
                <div className="text-lg font-bold leading-tight">
                  {decision.mensagem_usuario}
                </div>
                
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest">Ações Recomendadas</div>
                  <ul className="space-y-2">
                    {decision.acoes_recomendadas.map((acao, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-100 mt-1.5 shrink-0" />
                        {acao}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* App Actions Status */}
              <div className="grid grid-cols-2 gap-3">
                {decision.acoes_app.iniciar_gravacao && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
Gravando Áudio
                  </div>
                )}
                {decision.acoes_app.salvar_localizacao && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                    <MapPin size={14} />
Localização Salva
                  </div>
                )}
              </div>

              {decision.estado_rede.orientacao_offline && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/30 text-[10px] font-medium italic">
                  {decision.estado_rede.orientacao_offline}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="relative flex items-center gap-2">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
            placeholder="Descreva a situação..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 dark:text-slate-100 transition-all"
            disabled={loading}
          />
          <button 
            onClick={handleProcess}
            disabled={loading || !input.trim()}
            className="w-12 h-12 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-90"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
          <button className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl flex items-center justify-center transition-all active:scale-90">
            <Mic size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}
