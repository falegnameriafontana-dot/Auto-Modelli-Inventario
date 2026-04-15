import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  Plus, 
  Search, 
  LogOut, 
  Car, 
  Trash2, 
  Edit2, 
  Image as ImageIcon, 
  Loader2, 
  Filter,
  X,
  ChevronRight,
  Info,
  AlertCircle,
  Printer,
  Share2,
  Mail,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
interface CarModel {
  id: string;
  brand: string;
  model: string;
  scale: string;
  year?: string;
  color?: string;
  condition?: string;
  notes?: string;
  imageUrl?: string;
  userId: string;
  createdAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Error Handling ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData.map(p => p.providerId) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('Firestore Error')) {
        setHasError(true);
        try {
          const parsed = JSON.parse(event.error.message.replace('Firestore Error: ', ''));
          setErrorDetails(parsed.error);
        } catch {
          setErrorDetails(event.error.message);
        }
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ops! Qualcosa è andato storto</h2>
          <p className="text-gray-600 mb-6">{errorDetails || "Si è verificato un errore durante l'accesso ai dati."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Ricarica Applicazione
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [editingModel, setEditingModel] = useState<CarModel | null>(null);
  const [isSearchingImage, setIsSearchingImage] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    scale: '1:18',
    year: '',
    color: '',
    condition: 'Nuovo',
    notes: '',
    imageUrl: ''
  });

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handlePrint = () => {
    setIsPrinting(true);
    // Give React time to render the print view
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleShare = () => {
    if (filteredModels.length === 0) {
      alert("La lista è vuota, non c'è nulla da condividere.");
      return;
    }
    setIsShareModalOpen(true);
  };

  const getShareText = () => {
    return filteredModels.map(m => 
      `${m.brand} ${m.model} (${m.scale}) - ${m.year || 'N/A'} - ${m.color || 'N/A'} - ${m.condition}`
    ).join('\n');
  };

  const shareViaWhatsApp = () => {
    const text = `Ecco la mia collezione di modellini:\n\n${getShareText()}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const shareViaEmail = () => {
    const subject = 'La mia Collezione di Modellini';
    const body = `Ecco la mia collezione di modellini:\n\n${getShareText()}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const copyToClipboard = () => {
    const text = `Ecco la mia collezione di modellini:\n\n${getShareText()}`;
    navigator.clipboard.writeText(text).then(() => {
      alert("Lista copiata negli appunti!");
    });
  };

  const nativeShare = async () => {
    const shareData = {
      title: 'La mia Collezione di Modellini',
      text: `Ecco la mia collezione di modellini:\n\n${getShareText()}`
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Errore durante la condivisione:", err);
      }
    } else {
      alert("La condivisione nativa non è supportata su questo browser.");
    }
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) {
      setCarModels([]);
      return;
    }

    const q = query(
      collection(db, 'carModels'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const models = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CarModel[];
      setCarModels(models);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'carModels');
    });

    return unsubscribe;
  }, [user]);

  // --- Actions ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const data = {
        ...formData,
        userId: user.uid,
        createdAt: editingModel ? editingModel.createdAt : serverTimestamp()
      };

      if (editingModel) {
        await updateDoc(doc(db, 'carModels', editingModel.id), data);
      } else {
        await addDoc(collection(db, 'carModels'), data);
      }

      setIsModalOpen(false);
      setEditingModel(null);
      setFormData({
        brand: '',
        model: '',
        scale: '1:18',
        year: '',
        color: '',
        condition: 'Nuovo',
        notes: '',
        imageUrl: ''
      });
    } catch (error) {
      handleFirestoreError(error, editingModel ? OperationType.UPDATE : OperationType.CREATE, 'carModels');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo modellino?")) return;
    try {
      await deleteDoc(doc(db, 'carModels', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `carModels/${id}`);
    }
  };

  const handleEdit = (model: CarModel) => {
    setEditingModel(model);
    setFormData({
      brand: model.brand,
      model: model.model,
      scale: model.scale,
      year: model.year || '',
      color: model.color || '',
      condition: model.condition || 'Nuovo',
      notes: model.notes || '',
      imageUrl: model.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const searchImage = async () => {
    if (!formData.brand || !formData.model) {
      alert("Inserisci marca e modello per cercare un'immagine.");
      return;
    }

    setIsSearchingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const prompt = `Trova un URL di un'immagine pubblica di alta qualità per un modellino di auto: ${formData.brand} ${formData.model} ${formData.scale}. Rispondi solo con l'URL dell'immagine, niente altro. Se non trovi nulla di specifico, usa una foto generica di un'auto simile.`;
      
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      const url = result.text.trim();
      
      if (url.startsWith('http')) {
        setFormData(prev => ({ ...prev, imageUrl: url }));
      } else {
        // Fallback to picsum if Gemini fails to provide a clean URL
        const fallbackUrl = `https://picsum.photos/seed/${formData.brand}-${formData.model}/800/600`;
        setFormData(prev => ({ ...prev, imageUrl: fallbackUrl }));
      }
    } catch (error) {
      console.error("Image search failed", error);
      const fallbackUrl = `https://picsum.photos/seed/${formData.brand}-${formData.model}/800/600`;
      setFormData(prev => ({ ...prev, imageUrl: fallbackUrl }));
    } finally {
      setIsSearchingImage(false);
    }
  };

  // --- Filtering ---
  const brands = useMemo(() => {
    const set = new Set(carModels.map(m => m.brand));
    return Array.from(set).sort();
  }, [carModels]);

  const filteredModels = useMemo(() => {
    return carModels
      .filter(m => {
        const matchesSearch = 
          m.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.model.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBrand = !selectedBrand || m.brand === selectedBrand;
        return matchesSearch && matchesBrand;
      })
      .sort((a, b) => {
        const brandCompare = a.brand.localeCompare(b.brand);
        if (brandCompare !== 0) return brandCompare;
        return a.model.localeCompare(b.model);
      });
  }, [carModels, searchTerm, selectedBrand]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-gray-100"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Car className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AutoModel Inventory</h1>
          <p className="text-gray-600 mb-8">Gestisci la tua collezione di modellini in modo semplice e professionale.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:shadow-xl transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Accedi con Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {isPrinting ? (
        <div id="print-view" className="bg-white text-black p-8 w-full min-h-screen">
        <div className="border-b-4 border-green-600 pb-4 mb-8">
          <h1 className="text-4xl font-black text-green-700">Collezione Modellini</h1>
          <p className="text-slate-500 font-medium mt-1">Totale: {filteredModels.length} modellini</p>
        </div>
        <div className="space-y-6">
          {filteredModels.map((model) => (
            <div key={model.id} className="border-b border-slate-200 pb-6 last:border-0 break-inside-avoid page-break-inside-avoid">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-green-600 font-bold text-sm uppercase tracking-wider">{model.brand}</span>
                  <h2 className="text-2xl font-bold text-slate-900">{model.model}</h2>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-green-50 border border-green-200 rounded-lg text-sm font-bold text-green-700">
                    {model.scale}
                  </span>
                  <p className="text-sm text-slate-500 mt-1 font-medium">{model.year}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div className="flex flex-col">
                  <span className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Colore</span>
                  <span className="font-semibold text-slate-700">{model.color}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Condizione</span>
                  <span className="font-semibold text-slate-700">{model.condition}</span>
                </div>
              </div>
              {model.notes && (
                <div className="bg-green-50/30 p-4 rounded-xl border border-green-100/50 text-sm text-slate-600 italic leading-relaxed">
                  {model.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      ) : (
        <div className="min-h-screen flex flex-col md:flex-row print:hidden">
        
        {/* Sidebar */}
        <aside className="w-full md:w-72 bg-slate-900/80 backdrop-blur-xl border-r border-white/10 flex-shrink-0 flex flex-col text-white">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
                <Car className="w-6 h-6" />
              </div>
              <span className="font-bold text-xl tracking-tight text-emerald-400">AutoInv</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-emerald-500/70 uppercase tracking-wider">Marche</h2>
              <Filter className="w-4 h-4 text-slate-500" />
            </div>
            <div className="space-y-1">
              <button 
                onClick={() => setSelectedBrand(null)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${!selectedBrand ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                Tutte le marche
              </button>
              {brands.map(brand => (
                <button 
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${selectedBrand === brand ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 border-t border-white/5">
            <div className="flex items-center gap-3">
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-emerald-500/30 shadow-sm" />
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent">
          <header className="h-20 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cerca per marca o modello..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrint}
                className="p-3 text-emerald-400/70 hover:text-emerald-400 hover:bg-white/5 rounded-2xl transition-all flex items-center gap-2"
                title="Stampa Lista"
              >
                <Printer className="w-5 h-5" />
                <span className="hidden lg:inline text-sm font-bold">Stampa</span>
              </button>
              <button 
                onClick={handleShare}
                className="p-3 text-emerald-400/70 hover:text-emerald-400 hover:bg-white/5 rounded-2xl transition-all flex items-center gap-2"
                title="Condividi Lista"
              >
                <Share2 className="w-5 h-5" />
                <span className="hidden lg:inline text-sm font-bold">Condividi</span>
              </button>
              <button 
                onClick={() => {
                  setEditingModel(null);
                  setFormData({
                    brand: '',
                    model: '',
                    scale: '1:18',
                    year: '',
                    color: '',
                    condition: 'Nuovo',
                    notes: '',
                    imageUrl: ''
                  });
                  setIsModalOpen(true);
                }}
                className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Nuovo Modellino
              </button>
            </div>
          </header>

          <div id="print-content" className="p-8 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-emerald-500 drop-shadow-md">La tua Collezione</h1>
                <p className="text-emerald-200/80 mt-1 drop-shadow-sm">Hai {filteredModels.length} modellini in totale.</p>
              </div>
            </div>

            {filteredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center mb-6">
                  <Car className="w-12 h-12 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Nessun modellino trovato</h3>
                <p className="text-gray-500 mt-2 max-w-xs">Inizia ad aggiungere i tuoi modellini cliccando sul pulsante "Nuovo Modellino".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                <AnimatePresence>
                  {filteredModels.map((model) => (
                    <motion.div 
                      key={model.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group bg-slate-900/90 backdrop-blur-sm rounded-3xl overflow-hidden border border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                    >
                      <div className="relative aspect-[4/3] bg-white/10 overflow-hidden">
                        <img 
                          src={model.imageUrl || `https://picsum.photos/seed/${model.brand}-${model.model}/800/600`} 
                          alt={`${model.brand} ${model.model}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1 bg-emerald-600/90 backdrop-blur-sm rounded-full text-xs font-bold text-white shadow-sm">
                            {model.scale}
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button 
                            onClick={() => handleEdit(model)}
                            className="p-3 bg-white rounded-2xl text-gray-900 hover:bg-emerald-50 hover:text-emerald-600 transition-all transform hover:scale-110"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(model.id)}
                            className="p-3 bg-white rounded-2xl text-gray-900 hover:bg-red-50 hover:text-red-600 transition-all transform hover:scale-110"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">{model.brand}</p>
                          <h3 className="text-xl font-bold text-white leading-tight mb-2">{model.model}</h3>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {model.year && (
                              <span className="px-2 py-1 bg-white/10 backdrop-blur-sm rounded-lg text-[10px] font-bold text-gray-300 uppercase">Anno: {model.year}</span>
                            )}
                            {model.color && (
                              <span className="px-2 py-1 bg-white/10 backdrop-blur-sm rounded-lg text-[10px] font-bold text-gray-300 uppercase">{model.color}</span>
                            )}
                            <span className="px-2 py-1 bg-white/10 backdrop-blur-sm rounded-lg text-[10px] font-bold text-gray-300 uppercase">{model.condition}</span>
                          </div>
                        </div>
                        {model.notes && (
                          <p className="text-sm text-slate-400 line-clamp-2 italic border-t border-slate-800 pt-4 mt-auto">
                            "{model.notes}"
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </main>

        {/* Modale Condivisione */}
        <AnimatePresence>
          {isShareModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsShareModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-emerald-600" />
                    Condividi Lista
                  </h3>
                  <button onClick={() => setIsShareModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                
                <div className="p-6 space-y-3">
                  <button 
                    onClick={shareViaWhatsApp}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-green-50 text-green-700 hover:bg-green-100 transition-all font-bold text-left"
                  >
                    <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white">
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <span>WhatsApp</span>
                  </button>
                  
                  <button 
                    onClick={shareViaEmail}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-bold text-left"
                  >
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white">
                      <Mail className="w-6 h-6" />
                    </div>
                    <span>Email / Gmail</span>
                  </button>
                  
                  <button 
                    onClick={copyToClipboard}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all font-bold text-left"
                  >
                    <div className="w-10 h-10 bg-slate-500 rounded-xl flex items-center justify-center text-white">
                      <Copy className="w-6 h-6" />
                    </div>
                    <span>Copia negli appunti</span>
                  </button>

                  {navigator.share && (
                    <button 
                      onClick={nativeShare}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all font-bold text-left"
                    >
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                        <Share2 className="w-6 h-6" />
                      </div>
                      <span>Altre opzioni</span>
                    </button>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 text-center">
                  <p className="text-xs text-gray-500">Verrà inviata solo la lista testuale dei modellini.</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white/90 backdrop-blur-xl w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{editingModel ? 'Modifica Modellino' : 'Nuovo Modellino'}</h2>
                    <p className="text-sm text-gray-500">Inserisci i dettagli del tuo modellino.</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Marca *</label>
                      <input 
                        required
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({...formData, brand: e.target.value})}
                        placeholder="es. Ferrari"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Modello *</label>
                      <input 
                        required
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({...formData, model: e.target.value})}
                        placeholder="es. F40"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Scala *</label>
                      <select 
                        required
                        value={formData.scale}
                        onChange={(e) => setFormData({...formData, scale: e.target.value})}
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                      >
                        <option value="1:18">1:18</option>
                        <option value="1:24">1:24</option>
                        <option value="1:43">1:43</option>
                        <option value="1:64">1:64</option>
                        <option value="1:87">1:87</option>
                        <option value="Altro">Altro</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Anno</label>
                      <input 
                        type="text"
                        value={formData.year}
                        onChange={(e) => setFormData({...formData, year: e.target.value})}
                        placeholder="es. 1987"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Colore</label>
                      <input 
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({...formData, color: e.target.value})}
                        placeholder="es. Rosso Corsa"
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Stato</label>
                      <select 
                        value={formData.condition}
                        onChange={(e) => setFormData({...formData, condition: e.target.value})}
                        className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                      >
                        <option value="Nuovo">Nuovo</option>
                        <option value="Ottimo">Ottimo</option>
                        <option value="Usato">Usato</option>
                        <option value="Restaurato">Restaurato</option>
                        <option value="Per ricambi">Per ricambi</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 flex items-center justify-between">
                      Immagine URL
                      <button 
                        type="button"
                        onClick={searchImage}
                        disabled={isSearchingImage}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        {isSearchingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                        Cerca con AI
                      </button>
                    </label>
                    <input 
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Note</label>
                    <textarea 
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Aggiungi dettagli, storia del modellino, etc..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all outline-none resize-none"
                    />
                  </div>

                  <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/50 backdrop-blur-md">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Annulla
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                    >
                      {editingModel ? 'Salva Modifiche' : 'Aggiungi Modellino'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    )}
  </ErrorBoundary>
  );
}
