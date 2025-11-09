import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithCustomToken,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    query,
    onSnapshot,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    setLogLevel,
    runTransaction,
    getDocs
} from 'firebase/firestore';
import {
    Trash2, Edit, Save, X, Plus, Sprout, AlertTriangle, Key, Settings, Package, DollarSign, List, Home, TrendingUp, AlertCircle, Zap, Printer, Eye, Truck, DownloadCloud, Clock, User, LogOut, UserPlus, Minus, Loader2
} from 'lucide-react';

// --- 1. Global Setup & Config ---

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'agri-manager-default';
const appId = rawAppId.split('/')[0];

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// FIX: ใช้ค่าจริงที่น้องนิ้งระบุมาแทนค่า Fallback
const firebaseConfig = {
    apiKey: "AIzaSyAyVibsp6SkEbRY3flK0y0zi60MN7wWlII", 
    authDomain: "lks-kuraburi-app.firebaseapp.com", 
    projectId: "lks-kuraburi-app",
    storageBucket: "lks-kuraburi-app.firebasestorage.app",
    messagingSenderId: "988078485995",
    appId: "1:988078485995:web:49d8f84e9e031ebd77e9ae"
};

// **โค้ดที่ถูกแก้ไข: ลบเงื่อนไขการตรวจสอบ Fallback เพื่อให้แอปฯ รันต่อได้**
console.warn("Using hardcoded FALLBACK Firebase config. Please replace with your actual Firebase configuration for local testing.");

const CONFIG_DOC_PATH = 'app_settings/admin_pin';
const PIN_LENGTH = 4;
const COLLECTION_PATHS = {
    categories: 'custom_categories_agri',
    products: 'products_agri',
    sales: 'sales_agri',
    goodsReceipts: 'goods_receipts_agri',
};

const TAB_OPTIONS = {
    DASHBOARD: 'dashboard',
    PRODUCT: 'products',
    GOODS_RECEIPT: 'goods_receipts',
    SALE: 'sales',
    ADMIN: 'admin',
};

// --- Helper Functions ---

const formatCurrency = (amount) => {
    const numericAmount = typeof amount === 'number' ? amount : 0;
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(numericAmount);
};

const LoadingSpinner = ({ fullScreen = false }) => (
    <div className={`flex flex-col justify-center items-center py-20 ${fullScreen ? 'min-h-screen bg-gray-50' : 'h-full'}`}>
        <Loader2 size={48} className="animate-spin text-green-600" />
        <span className="mt-4 text-lg text-green-700 font-semibold">กำลังโหลดข้อมูล...</span>
    </div>
);

const Button = ({ children, onClick, variant = 'primary', type = 'button', disabled = false, className = '' }) => {
    const baseStyle = 'w-full px-6 py-3 font-bold rounded-xl shadow-lg hover:opacity-90 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2';
    
    const variants = {
        primary: 'bg-green-600 text-white shadow-green-200',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 shadow-gray-100',
        danger: 'bg-red-600 text-white shadow-red-200',
        warning: 'bg-yellow-500 text-white shadow-yellow-200',
        blue: 'bg-blue-500 text-white shadow-blue-200',
        purple: 'bg-purple-500 text-white shadow-purple-200',
        teal: 'bg-teal-600 text-white shadow-teal-200',
        textonly: 'bg-transparent text-gray-600 hover:bg-gray-100 shadow-none p-1 font-normal text-sm w-auto',
        logoutStrong: 'bg-red-600 text-white shadow-red-200 hover:bg-red-700 w-auto px-3 py-2 text-sm', 
    };

    const selectedVariant = variants[variant] || variants.primary;
    const isSmallButton = variant === 'textonly' || variant === 'logoutStrong';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${isSmallButton ? '' : baseStyle} ${selectedVariant} ${className} ${isSmallButton ? 'rounded-lg flex items-center gap-1 font-semibold' : ''}`}
        >
            {disabled ? <Loader2 size={20} className="animate-spin" /> : children}
        </button>
    );
};

const Input = ({ type = 'text', value, onChange, placeholder, required = false, className = '', ...props }) => (
    <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150 ${className}`}
        {...props}
    />
);

const Select = ({ value, onChange, required = false, className = '', children }) => (
     <select
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition duration-150 ${className}`}
    >
        {children}
    </select>
);


// --- 2. Shared Components: Delete Modal ---

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, itemName, deleteAction, correctPin }) => {
    const [pinInput, setPinInput] = useState('');
    const [isPinValid, setIsPinValid] = useState(true);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (pinInput === correctPin) {
            setIsPinValid(true);
            setPinInput('');
            onConfirm();
        } else {
            setIsPinValid(false);
        }
    };

    const handleClose = () => {
        setPinInput('');
        setIsPinValid(true);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300 animate-in fade-in-0">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all duration-300 animate-in zoom-in-95">
                <div className="flex flex-col items-center">
                    <div className="p-3 bg-red-100 rounded-full">
                        <AlertTriangle size={32} className="text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mt-4 mb-2 text-center">ยืนยันรหัส PIN เพื่อ {deleteAction}</h3>
                    <p className="text-center text-gray-600 mb-5">
                        การ {deleteAction} <strong className="text-gray-900">"{itemName}"</strong> ต้องใช้รหัสยืนยัน Admin
                    </p>

                    <input
                        type="password"
                        placeholder={`กรอกรหัส PIN ${PIN_LENGTH} หลัก`}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
                        maxLength={PIN_LENGTH}
                        className={`w-full p-3 mb-4 text-center border-2 rounded-lg font-mono text-2xl tracking-[1em] ${
                            isPinValid ? 'border-gray-300 focus:border-red-500 focus:ring-red-200' : 'border-red-500 ring-2 ring-red-300'
                        } transition duration-150`}
                        required
                    />

                    {!isPinValid && (
                        <p className="text-red-600 text-sm mb-4 font-semibold animate-pulse">รหัส PIN ไม่ถูกต้อง โปรดลองอีกครั้ง!</p>
                    )}

                    <div className="flex justify-center space-x-4 w-full">
                        <Button onClick={handleClose} variant="secondary" className="flex-1">
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            variant="danger"
                            className="flex-1"
                            disabled={pinInput.length !== PIN_LENGTH}
                        >
                            ยืนยันและดำเนินการ
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 3. Tab: Dashboard Manager ---

const DashboardManager = ({ products, sales }) => {
    const [selectedFilter, setSelectedFilter] = useState('all'); 

    const availablePeriods = useMemo(() => {
        const days = new Set();
        const months = new Set();
        const years = new Set();
        sales.forEach(sale => {
            if (sale.createdAt?.toDate) {
                const date = sale.createdAt.toDate();
                const year = date.getFullYear().toString();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const yearMonthDay = `${year}-${month}-${day}`;
                const yearMonth = `${year}-${month}`;
                days.add(yearMonthDay);
                months.add(yearMonth);
                years.add(year);
            }
        });
        return {
            days: Array.from(days).sort().reverse(),
            months: Array.from(months).sort().reverse(),
            years: Array.from(years).sort().reverse()
        };
    }, [sales]);

    const filteredSales = useMemo(() => {
        if (selectedFilter === 'all') return sales;
        const [filterType, ...filterParts] = selectedFilter.split('-');
        const filterValue = filterParts.join('-');
        return sales.filter(sale => {
            if (!sale.createdAt?.toDate) return false;
            const date = sale.createdAt.toDate();
            const year = date.getFullYear().toString();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const yearMonthDay = `${year}-${month}-${day}`;
            const yearMonth = `${year}-${month}`;
            if (filterType === 'year' && year === filterValue) return true;
            if (filterType === 'month' && yearMonth === filterValue) return true;
            if (filterType === 'day' && yearMonthDay === filterValue) return true;
            return false;
        });
    }, [sales, selectedFilter]);

    const summary = useMemo(() => {
        let totalRevenue = 0;
        let totalCostOfGoodsSold = 0;
        filteredSales.forEach(sale => {
            totalRevenue += sale.totalRevenue || 0;
            totalCostOfGoodsSold += sale.totalCostOfGoodsSold || 0;
        });
        const totalProfit = totalRevenue - totalCostOfGoodsSold;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const lowStockCount = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= (p.minStockThreshold || 0)).length;
        const outOfStockCount = products.filter(p => (p.stockQuantity || 0) <= 0).length;
        const totalInventoryValue = products.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.stockQuantity || 0)), 0);
        return {
            totalRevenue, totalCostOfGoodsSold, totalProfit, profitMargin,
            totalProducts: products.length, totalSalesCount: filteredSales.length,
            lowStockCount, outOfStockCount, totalInventoryValue,
        };
    }, [filteredSales, products]);

    const analyticsData = useMemo(() => {
        const today = new Date();
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);
        const currentMonthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const monthlySalesCount = {};
        const lastSaleDate = {};
        const salesByDate = [];
        sales.forEach(sale => {
            if (!sale.createdAt?.toDate) return;
            const saleDate = sale.createdAt.toDate();
            const saleMonthYear = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
            sale.items.forEach(item => {
                const productId = item.id;
                if (!productId) return;
                const qty = item.qty || 0;
                if (saleMonthYear === currentMonthYear) {
                    monthlySalesCount[productId] = (monthlySalesCount[productId] || 0) + qty;
                }
                if (!lastSaleDate[productId] || saleDate > lastSaleDate[productId]) {
                    lastSaleDate[productId] = saleDate;
                }
                const saleEntry = { productId, name: item.name, date: saleDate };
                if (!salesByDate.some(s => s.productId === productId)) {
                    salesByDate.push(saleEntry);
                }
            });
        });
        const bestSellers = Object.entries(monthlySalesCount)
            .map(([productId, totalQty]) => ({ name: products.find(p => p.id === productId)?.name || 'N/A', qty: totalQty }))
            .sort((a, b) => b.qty - a.qty).slice(0, 3);
        const staleStock = products
            .filter(p => {
                const stock = p.stockQuantity || 0;
                if (stock <= 0) return false;
                const lastSold = lastSaleDate[p.id];
                return !lastSold || lastSold < ninetyDaysAgo;
            })
            .sort((a, b) => ((b.costPrice || 0) * (b.stockQuantity || 0)) - ((a.costPrice || 0) * (a.stockQuantity || 0)))
            .slice(0, 3);
            
        const allStaleStock = products
            .filter(p => {
                const stock = p.stockQuantity || 0;
                if (stock <= 0) return false;
                const lastSold = lastSaleDate[p.id];
                return !lastSold || lastSold < ninetyDaysAgo;
            });
        const staleStockValue = allStaleStock.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.stockQuantity || 0)), 0);

        const latestSales = salesByDate.sort((a, b) => b.date - a.date).slice(0, 5).map(s => s.name);
        return { latestSales, bestSellers, staleStock, staleStockValue }; 
    }, [products, sales]);

    const criticalStockItems = useMemo(() => {
        return products
            .filter(p => (p.stockQuantity || 0) <= 0 || (p.stockQuantity > 0 && (p.stockQuantity || 0) <= (p.minStockThreshold || 0)))
            .sort((a, b) => {
                const statusA = (a.stockQuantity || 0) <= 0 ? 0 : 1;
                const statusB = (b.stockQuantity || 0) <= 0 ? 0 : 1;
                if (statusA !== statusB) return statusA - statusB;
                return a.name.localeCompare(b.name, 'th');
            });
    }, [products]);

    const stats = [
        { label: "ยอดขายรวม (Revenue)", value: formatCurrency(summary.totalRevenue), icon: DollarSign, color: "bg-green-600 text-white", desc: "รวมรายได้จากบิลขายในงวดที่เลือก" },
        { label: "กำไรสุทธิ (Profit)", value: formatCurrency(summary.totalProfit), icon: TrendingUp, color: summary.totalProfit >= 0 ? "bg-blue-600 text-white" : "bg-purple-600 text-white", desc: `กำไร/ขาดทุน ในงวดที่เลือก | Margin: ${summary.profitMargin.toFixed(1)}%` },
        { label: "สินค้าใกล้หมด (Low Stock)", value: summary.lowStockCount, icon: AlertCircle, color: "bg-yellow-500 text-white", desc: `สต็อกต่ำกว่าเกณฑ์ (${summary.outOfStockCount} รายการหมดแล้ว)` },
        { label: "จำนวนบิลขาย", value: summary.totalSalesCount, icon: List, color: "bg-teal-600 text-white", desc: `จำนวนบิลที่บันทึกในงวดนี้` },
        { label: "มูลค่าสต็อกคงคลัง", value: formatCurrency(summary.totalInventoryValue), icon: Package, color: "bg-indigo-600 text-white", desc: "มูลค่าทุนของสินค้าที่เหลือในสต็อก" },
        { 
            label: "มูลค่าสต็อกค้าง (Stale)", 
            value: formatCurrency(analyticsData.staleStockValue), 
            icon: Clock, 
            color: "bg-orange-600 text-white", 
            desc: `มูลค่าทุนของสินค้าที่ไม่เคลื่อนไหว > 90 วัน`
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in-5 duration-300">
            <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center">
                    <Home className="mr-3 text-green-600" size={32} /> สรุปภาพรวมธุรกิจ
                </h2>
                <div className="flex justify-end items-center bg-white p-2 rounded-xl shadow-lg border w-full md:w-auto">
                    <h3 className="text-sm font-bold text-gray-700 mr-2 flex-shrink-0">แสดงข้อมูลสำหรับ:</h3>
                    <Select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)} className="p-2 text-sm">
                        <option value="all">ทั้งหมด (All Time)</option>
                        <option disabled className="font-bold text-gray-400">--- รายปี ---</option>
                        {availablePeriods.years.map(year => <option key={`year-${year}`} value={`year-${year}`}>ปี {year}</option>)}
                        <option disabled className="font-bold text-gray-400">--- รายเดือน ---</option>
                        {availablePeriods.months.map(monthYear => {
                            const [year, month] = monthYear.split('-');
                            const formattedMonth = new Date(year, month - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
                            return <option key={`month-${monthYear}`} value={`month-${monthYear}`}>{formattedMonth}</option>;
                        })}
                        <option disabled className="font-bold text-gray-400">--- รายวัน ---</option>
                        {availablePeriods.days.map(dayYearMonthDay => {
                            const [year, month, day] = dayYearMonthDay.split('-');
                            const formattedDay = new Date(year, month - 1, day).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                            return <option key={`day-${dayYearMonthDay}`} value={`day-${dayYearMonthDay}`}>{formattedDay}</option>;
                        })}
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {stats.map((stat, index) => (
                    <div 
                        key={index} 
                        className={`p-5 rounded-2xl shadow-xl border-b-4 border-opacity-30 ${stat.color.replace(' text-white', '-200')} ${stat.color} transition-transform duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl`}
                    >
                        <div className="flex items-center">
                            <div className={`p-3 rounded-full bg-white bg-opacity-30`}>
                                <stat.icon size={20} className={`text-white`} />
                            </div>
                            <p className="ml-3 font-semibold text-white text-lg">{stat.label}</p>
                        </div>
                        <p className={`mt-3 text-4xl font-extrabold text-white`}>{stat.value}</p>
                        <p className="text-sm mt-2 text-white opacity-80 truncate">{stat.desc}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <h3 className="text-xl font-bold text-blue-700 mb-4 flex items-center"><TrendingUp className="mr-2" size={24} /> สินค้าที่ขายล่าสุด 5 รายการ</h3>
                    <ul className="text-md space-y-3">
                        {analyticsData.latestSales.length > 0 ? (
                            analyticsData.latestSales.map((name, index) => (
                                <li key={index} className="flex justify-between items-center border-b pb-2 last:border-b-0 text-gray-800">
                                    <span className="font-semibold truncate"><span className="text-gray-400 mr-2">{index + 1}.</span>{name}</span>
                                </li>
                            ))
                        ) : <li className="text-gray-500 italic text-md">ยังไม่มีรายการขายล่าสุด</li>}
                    </ul>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <h3 className="text-xl font-bold text-green-700 mb-4 flex items-center"><Zap className="mr-2" size={24} /> สินค้าขายดีสุดเดือนนี้ (จำนวนชิ้น)</h3>
                    <ul className="text-md space-y-3">
                        {analyticsData.bestSellers.length > 0 ? (
                            analyticsData.bestSellers.map((item, index) => (
                                <li key={index} className="flex justify-between items-center border-b pb-2 last:border-b-0 text-gray-800">
                                    <span className="font-semibold truncate"><span className="text-gray-400 mr-2">{index + 1}.</span>{item.name}</span>
                                    <span className="text-green-600 font-extrabold text-lg">{item.qty} ชิ้น</span>
                                </li>
                            ))
                        ) : <li className="text-gray-500 italic text-md">ยังไม่มีข้อมูลการขายในเดือนนี้</li>}
                    </ul>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <h3 className="text-xl font-bold text-orange-700 mb-4 flex items-center"><Clock className="mr-2" size={24} /> สินค้าไม่เคลื่อนไหว ({'>'} 90 วัน)</h3>
                    <ul className="text-md space-y-3">
                         {analyticsData.staleStock.length > 0 ? (
                            analyticsData.staleStock.map((item, index) => (
                                <li key={index} className="flex justify-between items-center border-b pb-2 last:border-b-0 text-gray-800">
                                    <span className="font-semibold truncate"><span className="text-gray-400 mr-2">{index + 1}.</span>{item.name}</span>
                                    <span className="text-orange-600 font-bold text-lg">{item.stockQuantity} ชิ้น</span>
                                </li>
                            ))
                        ) : <li className="text-gray-500 italic text-md">ยอดเยี่ยม! ไม่มีสินค้าค้างสต็อก</li>}
                    </ul>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl border-2 border-red-100">
                    <h3 className="text-xl font-bold text-red-700 mb-4 flex items-center">
                        <AlertTriangle className="mr-2" size={24} /> สินค้าใกล้หมด/หมด (ต้องรีบสั่ง!)
                        <span className="ml-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-extrabold">
                            รวม {criticalStockItems.length} รายการ
                        </span>
                    </h3>
                    {criticalStockItems.length === 0 ? (
                        <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                            <Sprout size={24} className="text-green-500 mx-auto mb-2" />
                            <p className="text-green-700 font-semibold text-md">ยอดเยี่ยม! สต็อกสินค้าทุกรายการอยู่ในระดับ 'ปกติ' จ้า</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {criticalStockItems.map((product) => {
                                const stockQty = product.stockQuantity || 0;
                                const minThreshold = product.minStockThreshold || 0;
                                const isOutOfStock = stockQty <= 0;
                                const borderColor = isOutOfStock ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50';
                                const textColor = isOutOfStock ? 'text-red-700' : 'text-yellow-700';
                                return (
                                    <div key={product.id} className={`p-3 rounded-xl border-l-4 shadow-sm flex justify-between items-center ${borderColor}`}>
                                        <div className="flex-grow">
                                            <p className="font-bold text-gray-800 text-md">{product.name}</p>
                                            <p className="text-sm text-gray-500">แจ้งเตือนเมื่อต่ำกว่า: {minThreshold} ชิ้น</p>
                                        </div>
                                        <div className="flex-shrink-0 text-right ml-2">
                                            <span className={`text-xl font-extrabold ${textColor}`}>{stockQty} ชิ้น</span>
                                            <p className={`text-sm font-semibold ${textColor}`}>{isOutOfStock ? '(หมดแล้ว!)' : '(เหลือไม่ถึงเกณฑ์)'}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- 4. Tab: Admin Pin Manager ---
const AdminPinManager = ({ db, userId, currentPin, onPinUpdate, sales, startResetAllData }) => {
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [exportFilter, setExportFilter] = useState('all');

    const handleSavePin = async (e) => {
        e.preventDefault();
        setMessage('');
        if (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
            setMessage(`PIN ต้องมี ${PIN_LENGTH} หลักเท่านั้น!`);
            return;
        }
        if (newPin !== confirmPin) {
            setMessage('PIN ยืนยันไม่ตรงกัน!');
            return;
        }
        setIsSaving(true);
        try {
            const configRef = doc(db, `/artifacts/${appId}/users/${userId}/${CONFIG_DOC_PATH}`);
            await setDoc(configRef, { pin: newPin, updatedAt: serverTimestamp() }, { merge: true });
            onPinUpdate(newPin);
            setMessage('ตั้งค่า PIN ใหม่สำเร็จแล้ว! ห้ามลืมเด็ดขาดนะจ๊ะ!');
            setNewPin('');
            setConfirmPin('');
        } catch (error) {
            console.error("Error setting PIN: ", error);
            setMessage('ตั้งค่า PIN ไม่สำเร็จ: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const availablePeriods = useMemo(() => {
        const months = new Set();
        const years = new Set();
        sales.forEach(sale => {
            if (sale.createdAt?.toDate) {
                const date = sale.createdAt.toDate();
                const year = date.getFullYear().toString();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                months.add(`${year}-${month}`);
                years.add(year);
            }
        });
        return {
            months: Array.from(months).sort().reverse(),
            years: Array.from(years).sort().reverse()
        };
    }, [sales]);

    const exportSalesData = () => {
        const filteredSales = sales.filter(sale => {
            if (exportFilter === 'all') return true;
            if (!sale.createdAt?.toDate) return false;
            const date = sale.createdAt.toDate();
            const year = date.getFullYear().toString();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const yearMonth = `${year}-${month}`;
            if (exportFilter.startsWith('year-') && year === exportFilter.substring(5)) return true;
            if (exportFilter.startsWith('month-') && yearMonth === exportFilter.substring(6)) return true;
            return false;
        });
        
        if (filteredSales.length === 0) {
            setMessage('ไม่พบรายการขายในช่วงเวลาที่เลือก'); 
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
        const headers = ["Bill ID", "Date", "Subtotal", "Discount", "Total Revenue", "COGS", "Profit", "Item Details"];
        csvContent += headers.join(",") + "\n";

        filteredSales.forEach(sale => {
            const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleString('th-TH') : 'N/A';
            const itemDetails = sale.items.map(item => `${item.name} x${item.qty} (@${item.unitPrice})`).join('; ');
            const row = [
                `"${sale.billId}"`, `"${saleDate}"`,
                sale.subtotal, sale.discount, sale.totalRevenue,
                sale.totalCostOfGoodsSold, sale.profit, `"${itemDetails}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const filterName = exportFilter === 'all' ? 'ทั้งหมด' : exportFilter;
        link.setAttribute("download", `Sales_Report_${filterName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in-5 duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-yellow-200">
                <h2 className="text-2xl font-bold text-yellow-700 mb-4 flex items-center">
                    <Key className="mr-3" size={28} /> ตั้งค่ารหัส PIN (Admin Security)
                </h2>
                <p className="text-md text-gray-600 mb-4">
                    รหัส PIN {PIN_LENGTH} หลักนี้จำเป็นสำหรับยืนยันการดำเนินการสำคัญ เช่น ลบข้อมูล
                </p>

                <div className="mb-4 p-4 bg-yellow-50 rounded-lg">
                    <span className="font-bold text-gray-700 mr-2 text-md">รหัส PIN ปัจจุบัน:</span>
                    <span className={`font-mono text-2xl font-extrabold px-3 py-1 rounded-md ${currentPin ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {currentPin ? currentPin.split('').map(() => '*').join('') : 'ยังไม่ได้ตั้งค่า!'}
                    </span>
                    {!currentPin && <p className="text-red-600 text-sm mt-1 font-semibold">**กรุณาตั้งค่า PIN ก่อนใช้งานฟังก์ชันลบ**</p>}
                </div>
                
                <form onSubmit={handleSavePin} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            type="password"
                            placeholder={`PIN ใหม่ (${PIN_LENGTH} หลัก)`}
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
                            maxLength={PIN_LENGTH}
                            className="font-mono text-center text-lg tracking-[0.5em]"
                            required
                        />
                        <Input
                            type="password"
                            placeholder={`ยืนยัน PIN ใหม่ (${PIN_LENGTH} หลัก)`}
                            value={confirmPin}
                            onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
                            maxLength={PIN_LENGTH}
                            className="font-mono text-center text-lg tracking-[0.5em]"
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="warning"
                        disabled={isSaving || newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
                    >
                        <Save size={20} />
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึก PIN ใหม่'}
                    </Button>
                    {message && (
                        <p className={`text-sm font-semibold text-center pt-2 ${message.includes('สำเร็จ') ? 'text-green-600' : 'text-red-600'}`}>
                            {message}
                        </p>
                    )}
                </form>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 flex items-center">
                    <Printer className="mr-3" size={28} /> รายงานการขาย (Export)
                </h2>
                <p className="text-md text-gray-600 mb-4">
                    เลือกช่วงเวลาที่ต้องการ Export รายละเอียดบิลขายเป็นไฟล์ CSV (เปิดใน Excel ได้)
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <Select
                        value={exportFilter}
                        onChange={(e) => setExportFilter(e.target.value)}
                        className="flex-grow"
                    >
                        <option value="all">ทั้งหมด (All Time)</option>
                        <option disabled className="font-bold text-gray-400">--- รายปี ---</option>
                        {availablePeriods.years.map(year => <option key={`export-year-${year}`} value={`year-${year}`}>ปี {year}</option>)}
                        <option disabled className="font-bold text-gray-400">--- รายเดือน ---</option>
                        {availablePeriods.months.map(monthYear => {
                            const [year, month] = monthYear.split('-');
                            const formattedMonth = new Date(year, month - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
                            return <option key={`export-month-${monthYear}`} value={`month-${monthYear}`}>{formattedMonth}</option>;
                        })}
                    </Select>

                    <Button
                        onClick={exportSalesData}
                        variant="blue"
                        className="sm:w-auto"
                        disabled={sales.length === 0}
                    >
                        <DownloadCloud size={20} /> Export เป็นไฟล์ Excel (.CSV)
                    </Button>
                </div>
            </div>

            <div className="bg-red-50 p-6 rounded-2xl shadow-xl border-2 border-red-200">
                <h2 className="text-2xl font-bold text-red-700 mb-4 flex items-center">
                    <Trash2 className="mr-3" size={28} /> ล้างข้อมูลทั้งหมด (Dangerous Zone!)
                </h2>
                <p className="text-md text-red-600 mb-4 font-semibold">
                    การดำเนินการนี้จะลบข้อมูล **สินค้า บิลขาย รายการรับเข้า และหมวดหมู่** ทั้งหมดของร้านหลักเกษตร คุระบุรี อย่างถาวร! ไม่สามารถกู้คืนได้!
                </p>
                <Button
                    onClick={startResetAllData}
                    variant="danger"
                    disabled={!currentPin}
                >
                    <AlertTriangle size={20} /> ยืนยัน PIN เพื่อล้างข้อมูลทั้งหมด
                </Button>
                {!currentPin && <p className="text-sm text-red-600 mt-2 text-center font-bold">**กรุณาตั้งค่า PIN ก่อนใช้งานฟังก์ชันนี้**</p>}
            </div>
        </div>
    );
};

// --- 5. Tab: Category Manager ---

const CategoryManager = ({ db, userId, categories, startDelete }) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [addError, setAddError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddCategory = async (e) => {
        e.preventDefault();
        setAddError(null);
        if (!newCategoryName.trim() || !db || !userId) return;
        setIsSaving(true);
        try {
            const categoriesCollectionPath = `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.categories}`;
            await addDoc(collection(db, categoriesCollectionPath), {
                name: newCategoryName.trim(),
                createdAt: serverTimestamp(),
            });
            setNewCategoryName('');
        } catch (e) {
            console.error("Error adding document: ", e);
            setAddError("เพิ่มหมวดหมู่ไม่สำเร็จ");
        } finally {
            setIsSaving(false);
        }
    };

    const startEdit = (category) => {
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
    };

    const cancelEdit = () => {
        setEditingCategoryId(null);
        setEditingCategoryName('');
    };

    const handleEditCategory = async (id) => {
        setAddError(null);
        if (!editingCategoryName.trim() || !db || !userId) return;
        setIsSaving(true);
        try {
            const categoriesDocRef = doc(db, `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.categories}`, id);
            await updateDoc(categoriesDocRef, {
                name: editingCategoryName.trim(),
                updatedAt: serverTimestamp()
            });
            cancelEdit();
        } catch (e) {
            console.error("Error updating document: ", e);
            setAddError("แก้ไขหมวดหมู่ไม่สำเร็จ");
        } finally {
            setIsSaving(false);
        }
    };
    
    const CategoryItem = ({ category }) => {
        const isEditing = editingCategoryId === category.id;

        return (
            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 last:border-b-0 min-h-[76px]">
                {isEditing ? (
                    <Input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="flex-grow p-2"
                        placeholder="ชื่อหมวดหมู่ใหม่"
                    />
                ) : (
                    <span className="text-gray-800 font-medium text-lg truncate pr-4">{category.name}</span>
                )}
                
                <div className="flex space-x-2 flex-shrink-0 ml-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => handleEditCategory(category.id)}
                                className="p-3 bg-green-500 text-white rounded-full shadow-md hover:bg-green-600 transition duration-150 transform hover:scale-105 disabled:bg-gray-300"
                                title="บันทึก"
                                disabled={!editingCategoryName.trim() || isSaving}
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="p-3 bg-gray-400 text-white rounded-full shadow-md hover:bg-gray-500 transition duration-150 transform hover:scale-105"
                                title="ยกเลิก"
                            >
                                <X size={20} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => startEdit(category)}
                                className="p-3 bg-yellow-500 text-white rounded-full shadow-md hover:bg-yellow-600 transition duration-150 transform hover:scale-105"
                                title="แก้ไข"
                            >
                                <Edit size={20} />
                            </button>
                            <button
                                onClick={() => startDelete(category, 'ลบหมวดหมู่', COLLECTION_PATHS.categories)} 
                                className="p-3 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition duration-150 transform hover:scale-105"
                                title="ลบ (ต้องใช้ PIN ยืนยัน)"
                            >
                                <Trash2 size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-xl border border-green-100">
                <h2 className="text-2xl font-bold text-green-700 mb-4 flex items-center">
                    <Plus className="mr-3" size={28} /> เพิ่มหมวดหมู่ใหม่
                </h2>
                <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
                    <Input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="เช่น: ปุ๋ยอินทรีย์, ยาฆ่าเชื้อรา"
                        className="flex-grow"
                        required
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        className="sm:w-auto"
                        disabled={!newCategoryName.trim() || isSaving}
                    >
                        {isSaving ? 'กำลังเพิ่ม...' : 'เพิ่มหมวดหมู่'}
                    </Button>
                </form>
                {addError && <p className="text-red-500 text-sm mt-2">{addError}</p>}
            </section>

            <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <h2 className="text-2xl font-bold text-gray-700 p-5 border-b bg-gray-50 flex items-center">
                    <List className="mr-3" size={28} /> รายการหมวดหมู่ ({categories.length} หมวดหมู่)
                </h2>
                {categories.length === 0 ? (
                    <p className="p-6 text-center text-gray-500 text-lg">ยังไม่มีหมวดหมู่ ลองเพิ่มหมวดหมู่สินค้าดูนะจ๊ะ!</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {categories.map((category) => (
                            <CategoryItem key={category.id} category={category} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

// --- 6. Tab: Product Manager ---

const ProductManager = ({ db, userId, products, categories, startDelete }) => {
    const [newProduct, setNewProduct] = useState({ 
        name: '', costPrice: '', sellingPrice: '', 
        categoryId: '', stockQuantity: '', minStockThreshold: '' 
    });
    const [addError, setAddError] = useState(null);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all'); 
    const [editingProductId, setEditingProductId] = useState(null);
    const [editProductData, setEditProductData] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const handleAddProduct = async (e) => {
        e.preventDefault();
        setAddError(null);
        const { name, costPrice, sellingPrice, categoryId, stockQuantity, minStockThreshold } = newProduct;
        if (!name.trim() || !costPrice || !sellingPrice || !categoryId || !db || !userId) {
             setAddError("กรุณากรอกข้อมูลสินค้าให้ครบถ้วน!");
             return;
        }
        setIsSaving(true);
        try {
            const productsCollectionPath = `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.products}`;
            await addDoc(collection(db, productsCollectionPath), {
                name: name.trim(),
                costPrice: parseFloat(costPrice), 
                sellingPrice: parseFloat(sellingPrice), 
                categoryId: categoryId,
                stockQuantity: parseFloat(stockQuantity) || 0,
                minStockThreshold: parseFloat(minStockThreshold) || 10, 
                createdAt: serverTimestamp(),
            });
            setNewProduct({ name: '', costPrice: '', sellingPrice: '', categoryId: '', stockQuantity: '', minStockThreshold: '' });
        } catch (e) {
            console.error("Error adding product: ", e);
            setAddError("เพิ่มสินค้าไม่สำเร็จ");
        } finally {
            setIsSaving(false);
        }
    };
    
    const startEdit = (product) => {
        setEditingProductId(product.id);
        setEditProductData({
            id: product.id,
            name: product.name,
            costPrice: (product.costPrice || '').toString(),
            sellingPrice: (product.sellingPrice || '').toString(),
            categoryId: product.categoryId,
            stockQuantity: (product.stockQuantity || '').toString(),
            minStockThreshold: (product.minStockThreshold || '').toString(),
        });
        setAddError(null);
    };

    const cancelEdit = () => {
        setEditingProductId(null);
        setEditProductData({});
        setAddError(null);
    };

    const handleUpdateProduct = async () => {
        setAddError(null);
        const { id, name, costPrice, sellingPrice, categoryId, stockQuantity, minStockThreshold } = editProductData;
        if (!name.trim() || !costPrice || !sellingPrice || !categoryId) {
            setAddError("กรุณากรอกข้อมูลสินค้าให้ครบถ้วนก่อนบันทึก!");
            return;
        }
        setIsSaving(true);
        try {
            const productsDocRef = doc(db, `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.products}`, id);
            await updateDoc(productsDocRef, {
                name: name.trim(),
                costPrice: parseFloat(costPrice),
                sellingPrice: parseFloat(sellingPrice),
                categoryId: categoryId,
                stockQuantity: parseFloat(stockQuantity) || 0,
                minStockThreshold: parseFloat(minStockThreshold) || 10,
                updatedAt: serverTimestamp(),
            });
            cancelEdit();
        } catch (e) {
            console.error("Error updating product: ", e);
            setAddError("แก้ไขสินค้าไม่สำเร็จ: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const sortedAndFilteredProducts = useMemo(() => {
        let list = (selectedCategoryFilter === 'all')
            ? products
            : products.filter(p => p.categoryId === selectedCategoryFilter);

        const getStockStatus = (product) => {
            const stock = product.stockQuantity || 0;
            const min = product.minStockThreshold || 0;
            if (stock <= 0) return 0; // Red
            if (stock <= min) return 1; // Yellow
            return 2; // Normal
        };

        return list.sort((a, b) => {
            const statusA = getStockStatus(a);
            const statusB = getStockStatus(b);
            if (statusA !== statusB) return statusA - statusB;
            return a.name.localeCompare(b.name, 'th');
        });
    }, [products, selectedCategoryFilter]);


    const ProductItem = ({ product }) => {
        const category = categories.find(cat => cat.id === product.categoryId);
        const profitPerUnit = (product.sellingPrice || 0) - (product.costPrice || 0);
        const isEditing = editingProductId === product.id;
        
        const stockQty = product.stockQuantity || 0;
        const minThreshold = product.minStockThreshold || 0;
        const isOutOfStock = stockQty <= 0;
        const isLowStock = stockQty > 0 && stockQty <= minThreshold;
        
        const stockClasses = isOutOfStock 
            ? 'bg-red-500 text-white' 
            : isLowStock 
            ? 'bg-yellow-400 text-yellow-900' 
            : 'bg-green-500 text-white'; 
        
        const stockIcon = isOutOfStock ? <AlertTriangle size={16} /> : isLowStock ? <AlertCircle size={16} /> : null;
        const borderClasses = isOutOfStock ? 'border-l-4 border-red-500 bg-red-50' : isLowStock ? 'border-l-4 border-yellow-400 bg-yellow-50' : 'border-b';

        if (!isEditing) {
            return (
                <div className={`flex items-center justify-between p-4 bg-white ${borderClasses} border-gray-100 last:border-b-0 text-sm`}>
                    <div className="flex-grow min-w-0">
                        <p className="font-bold text-gray-800 truncate text-md">{product.name}</p>
                        <p className="text-gray-500 text-sm">
                            {category ? category.name : 'ไม่มีหมวดหมู่'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <span className="text-blue-600 font-bold">ทุน: {formatCurrency(product.costPrice || 0)}</span>
                            <span className="text-green-600 font-bold">ขาย: {formatCurrency(product.sellingPrice || 0)}</span>
                            <span className={`font-bold ${profitPerUnit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                                กำไร/ชิ้น: {formatCurrency(profitPerUnit)}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-2 ml-2 flex-shrink-0">
                        <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${stockClasses}`}>
                            {stockIcon}
                            <span className="ml-1.5">
                                สต็อก: {stockQty} {isOutOfStock ? '(หมด)' : isLowStock ? `(ต่ำกว่าเกณฑ์ ${minThreshold})` : ''}
                            </span>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => startEdit(product)}
                                className="p-2 bg-yellow-500 text-white rounded-full shadow-md hover:bg-yellow-600 transition duration-150 transform hover:scale-105"
                                title="แก้ไข"
                            >
                                <Edit size={18} />
                            </button>
                            <button
                                onClick={() => startDelete(product, 'ลบรายการสินค้า', COLLECTION_PATHS.products)}
                                className="p-2 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition duration-150 transform hover:scale-105"
                                title="ลบรายการสินค้า (ต้องใช้ PIN ยืนยัน)"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="p-4 bg-yellow-50 border-b-2 border-yellow-200 last:border-b-0 animate-in fade-in-5">
                <h4 className="font-bold text-md mb-3 text-yellow-800">กำลังแก้ไข: {product.name}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-sm">
                    <Input
                        type="text" value={editProductData.name}
                        onChange={(e) => setEditProductData({ ...editProductData, name: e.target.value })}
                        placeholder="ชื่อสินค้า"
                    />
                    <Select
                        value={editProductData.categoryId}
                        onChange={(e) => setEditProductData({ ...editProductData, categoryId: e.target.value })}
                    >
                        <option value="" disabled>เลือกหมวดหมู่</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </Select>
                    <Input
                        type="number" value={editProductData.costPrice}
                        onChange={(e) => setEditProductData({ ...editProductData, costPrice: e.target.value })}
                        placeholder="ราคาทุน" min="0" step="0.01"
                    />
                    <Input
                        type="number" value={editProductData.sellingPrice}
                        onChange={(e) => setEditProductData({ ...editProductData, sellingPrice: e.target.value })}
                        placeholder="ราคาขาย" min="0" step="0.01"
                    />
                    <Input
                        type="number" value={editProductData.stockQuantity}
                        onChange={(e) => setEditProductData({ ...editProductData, stockQuantity: e.target.value })}
                        placeholder="สต็อกปัจจุบัน" min="0"
                    />
                    <Input
                        type="number" value={editProductData.minStockThreshold}
                        onChange={(e) => setEditProductData({ ...editProductData, minStockThreshold: e.target.value })}
                        placeholder="เกณฑ์แจ้งเตือน" min="0"
                    />
                </div>
                {addError && <p className="text-red-500 text-sm mb-2 text-center">{addError}</p>}
                <div className="flex space-x-2 justify-end">
                    <Button
                        onClick={handleUpdateProduct}
                        variant="primary"
                        className="w-auto px-4 py-2 text-sm"
                        disabled={isSaving || !editProductData.name || !editProductData.costPrice || !editProductData.sellingPrice}
                    >
                        <Save size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </Button>
                    <Button
                        onClick={cancelEdit}
                        variant="secondary"
                        className="w-auto px-4 py-2 text-sm"
                    >
                        <X size={16} /> ยกเลิก
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 flex items-center">
                    <Plus className="mr-3" size={28} /> เพิ่มรายการสินค้าใหม่ (พร้อมสต็อก)
                </h2>
                <form onSubmit={handleAddProduct} className="space-y-4">
                    <Input
                        type="text" value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        placeholder="ชื่อสินค้า (เช่น: ปุ๋ยอินทรีย์ 20kg)" required
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            type="number" value={newProduct.costPrice}
                            onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })}
                            placeholder="ราคาทุนต่อหน่วย (บาท)" min="0.01" step="0.01" required
                        />
                        <Input
                            type="number" value={newProduct.sellingPrice}
                            onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: e.target.value })}
                            placeholder="ราคาขายต่อหน่วย (บาท)" min="0.01" step="0.01" required
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            type="number" value={newProduct.stockQuantity}
                            onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: e.target.value })}
                            placeholder="จำนวนสต็อกปัจจุบัน" min="0" required
                        />
                        <Input
                            type="number" value={newProduct.minStockThreshold}
                            onChange={(e) => setNewProduct({ ...newProduct, minStockThreshold: e.target.value })}
                            placeholder="เกณฑ์แจ้งเตือนสต็อกต่ำ (Min Stock)" min="0" required
                        />
                    </div>
                    <Select
                        value={newProduct.categoryId}
                        onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                        required
                    >
                        <option value="" disabled>-- เลือกหมวดหมู่ --</option>
                        {categories.length === 0 && <option disabled>กรุณาเพิ่มหมวดหมู่ก่อน...</option>}
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </Select>
                    <Button
                        type="submit"
                        variant="blue"
                        disabled={isSaving || categories.length === 0 || !newProduct.name.trim() || !newProduct.costPrice || !newProduct.sellingPrice || !newProduct.categoryId}
                    >
                        <Package size={20} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกสินค้า'}
                    </Button>
                </form>
                {addError && <p className="text-red-500 text-sm mt-2 text-center">{addError}</p>}
            </section>

            <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <h2 className="text-2xl font-bold text-gray-700 p-5 border-b bg-gray-50 flex items-center">
                    <Package className="mr-3" size={28} /> รายการสินค้าทั้งหมด ({products.length} รายการ)
                </h2>
                
                <div className="p-4 border-b bg-gray-50 flex items-center">
                    <label htmlFor="categoryFilter" className="text-md font-medium text-gray-700 mr-2">กรองตามหมวดหมู่:</label>
                    <Select
                        id="categoryFilter"
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="p-2 text-sm max-w-xs"
                    >
                        <option value="all">-- ดูทั้งหมด --</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </Select>
                </div>

                {products.length === 0 ? (
                    <p className="p-6 text-center text-gray-500 text-lg">ยังไม่มีรายการสินค้า</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sortedAndFilteredProducts.map((product) => (
                            <ProductItem key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};


// --- 7. Tab: Goods Receipt Manager ---

const GoodsReceiptManager = ({ db, userId, products, receipts, startDelete, receiveProductStock }) => {
    const [newReceipt, setNewReceipt] = useState({
        date: new Date().toISOString().substring(0, 10),
        productId: '', quantity: '', unitCost: '', notes: ''
    });
    const [receiptError, setReceiptError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('all');

    const totalCost = useMemo(() => (parseFloat(newReceipt.quantity) || 0) * (parseFloat(newReceipt.unitCost) || 0), [newReceipt.quantity, newReceipt.unitCost]);

    useEffect(() => {
        if (newReceipt.productId) {
            const selectedProduct = products.find(p => p.id === newReceipt.productId);
            if (selectedProduct) {
                setNewReceipt(prev => ({ ...prev, unitCost: (selectedProduct.costPrice || 0).toString() }));
            }
        }
    }, [newReceipt.productId, products]);

    const handleSaveReceipt = async (e) => {
        e.preventDefault();
        setReceiptError(null);
        const { date, productId, quantity, unitCost, notes } = newReceipt;
        const parsedQuantity = parseFloat(quantity) || 0;
        const parsedUnitCost = parseFloat(unitCost) || 0;

        if (!date || !productId || parsedQuantity <= 0 || parsedUnitCost <= 0 || !db || !userId) {
             setReceiptError("กรุณากรอกข้อมูลรับเข้าให้ครบถ้วนและถูกต้อง!");
             return;
        }
        setIsSaving(true);
        try {
            const receiptsCollectionPath = `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.goodsReceipts}`;
            const receiptDoc = {
                date: date, productId: productId,
                productName: products.find(p => p.id === productId)?.name || 'ไม่พบสินค้า',
                quantity: parsedQuantity, unitCost: parsedUnitCost,
                totalCost: totalCost, notes: notes.trim(),
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(db, receiptsCollectionPath), receiptDoc);
            
            await receiveProductStock(productId, parsedQuantity, parsedUnitCost);

            setNewReceipt({ date: new Date().toISOString().substring(0, 10), productId: '', quantity: '', unitCost: '', notes: '' });
            setReceiptError(null);
        } catch (e) {
            console.error("Error adding receipt or updating stock: ", e);
            setReceiptError("บันทึกรับเข้าสต็อกไม่สำเร็จ: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    const filteredReceipts = useMemo(() => {
        return (selectedFilter === 'all')
            ? receipts
            : receipts.filter(r => r.date && r.date.substring(0, 7) === selectedFilter);
    }, [receipts, selectedFilter]);

    const filterOptions = useMemo(() => {
        const options = new Set(receipts.map(r => r.date ? r.date.substring(0, 7) : null).filter(Boolean));
        return Array.from(options).sort().reverse().map(ym => {
            const [year, month] = ym.split('-');
            const formattedMonth = new Date(year, month - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            return { value: ym, label: formattedMonth };
        });
    }, [receipts]);
    
    const adjustQuantity = (amount) => {
        setNewReceipt(prev => {
            const newQty = Math.max(0, (parseInt(prev.quantity) || 0) + amount);
            return { ...prev, quantity: newQty === 0 ? '' : newQty.toString() };
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in-5 duration-300">
            <section className="bg-white p-6 rounded-2xl shadow-xl border border-purple-100">
                <h2 className="text-2xl font-bold text-purple-700 mb-4 flex items-center">
                    <Truck className="mr-3" size={28} /> บันทึกรายการรับเข้าสต็อก (ซื้อสินค้า)
                </h2>
                
                <form onSubmit={handleSaveReceipt} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับเข้า</label>
                            <Input
                                type="date"
                                value={newReceipt.date}
                                onChange={(e) => setNewReceipt({ ...newReceipt, date: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกสินค้า</label>
                            <Select
                                value={newReceipt.productId}
                                onChange={(e) => setNewReceipt({ ...newReceipt, productId: e.target.value })}
                                required
                            >
                                <option value="" disabled>เลือกสินค้า...</option>
                                {products.length === 0 && <option disabled>กรุณาเพิ่มสินค้าก่อน...</option>}
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนที่รับเข้า</label>
                            <div className="flex space-x-2">
                                <Input
                                    type="number"
                                    value={newReceipt.quantity}
                                    onChange={(e) => setNewReceipt({ ...newReceipt, quantity: e.target.value })}
                                    placeholder="0" min="0" required
                                />
                                <button type="button" onClick={() => adjustQuantity(1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition">+1</button>
                                <button type="button" onClick={() => adjustQuantity(5)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition">+5</button>
                                <button type="button" onClick={() => adjustQuantity(10)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition">+10</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ราคาต้นทุน/หน่วย (บาท)</label>
                            <Input
                                type="number"
                                value={newReceipt.unitCost}
                                onChange={(e) => setNewReceipt({ ...newReceipt, unitCost: e.target.value })}
                                placeholder="ราคา/หน่วย" min="0.01" step="0.01" required
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">📝 หมายเหตุ (เช่น: สั่งจาก บจก. ปุ๋ยยักษ์, คืนของ)</label>
                        <textarea
                            value={newReceipt.notes}
                            onChange={(e) => setNewReceipt({ ...newReceipt, notes: e.target.value })}
                            placeholder="ระบุรายละเอียดเพิ่มเติม (ไม่บังคับ)"
                            rows="2"
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-150"
                        />
                    </div>

                    <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-200">
                        <span className="font-bold text-xl text-purple-700">ราคารวมทั้งหมด:</span>
                        <span className="font-extrabold text-3xl text-purple-700">{formatCurrency(totalCost)}</span>
                    </div>

                    <Button
                        type="submit"
                        variant="purple"
                        disabled={isSaving || products.length === 0 || !newReceipt.productId || (parseFloat(newReceipt.quantity) || 0) <= 0 || totalCost <= 0}
                    >
                        <Save size={20} /> {isSaving ? 'กำลังบันทึกและเพิ่มสต็อก...' : 'บันทึกรับเข้าสต็อก'}
                    </Button>
                </form>
                {receiptError && <p className="text-red-500 text-sm mt-2 text-center">{receiptError}</p>}
            </section>

            <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <h2 className="text-2xl font-bold text-gray-700 p-5 border-b bg-gray-50 flex items-center">
                    <List className="mr-3" size={28} /> รายการรับเข้าสต็อก ({receipts.length} รายการ)
                </h2>
                
                <div className="p-4 border-b">
                    <label htmlFor="monthFilter" className="text-md font-medium text-gray-700 mr-2">เลือกดูรายเดือน:</label>
                    <Select id="monthFilter" value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)} className="p-2 text-sm max-w-xs">
                        <option value="all">ทั้งหมด</option>
                        {filterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Select>
                </div>

                {receipts.length === 0 ? (
                    <p className="p-6 text-center text-gray-500 text-lg">ยังไม่มีรายการรับเข้าสต็อก</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredReceipts.map((receipt) => {
                            const receiptDate = receipt.date ? new Date(receipt.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric'}) : (receipt.createdAt?.toDate ? receipt.createdAt.toDate().toLocaleDateString('th-TH') : 'ไม่ระบุวันที่');
                            return (
                                <div key={receipt.id} className="flex items-center justify-between p-4 bg-white hover:bg-purple-50 transition duration-150">
                                    <div className="flex-grow min-w-0">
                                        <p className="font-bold text-gray-800 truncate text-md">{receipt.productName}</p>
                                        <p className="text-gray-500 text-sm">
                                            วันที่: {receiptDate} | จำนวน: <span className="font-semibold text-gray-700">{receipt.quantity} ชิ้น</span>
                                        </p>
                                        <p className="text-sm font-bold text-blue-600">
                                            ต้นทุน/หน่วย: {formatCurrency(receipt.unitCost)}
                                        </p>
                                        {receipt.notes && (
                                            <p className="text-xs mt-1 italic text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">
                                                หมายเหตุ: {receipt.notes}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                                        <div className="text-right">
                                            <span className="font-extrabold text-xl text-purple-700">{formatCurrency(receipt.totalCost)}</span>
                                            <p className="text-sm text-gray-500">รวมต้นทุน</p>
                                        </div>
                                        <button
                                            onClick={() => startDelete(receipt, 'ลบรายการรับเข้า', COLLECTION_PATHS.goodsReceipts)}
                                            className="p-3 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition duration-150 transform hover:scale-105"
                                            title="ลบรายการรับเข้า (ต้องใช้ PIN ยืนยัน)"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {selectedFilter !== 'all' && filteredReceipts.length === 0 && (
                            <p className="p-6 text-center text-gray-500">ไม่พบรายการรับเข้าในเดือนที่เลือก</p>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

// --- 8. Sale Details Modal ---

const SaleDetailsModal = ({ isOpen, onClose, sale }) => {
    if (!isOpen || !sale) return null;

    const billDate = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString('th-TH', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : 'ไม่พบข้อมูลวันที่';
    
    const subtotal = sale.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    const discount = sale.discount || 0;
    const netAmount = sale.totalRevenue || (subtotal - discount);

    
    const handlePrint = () => {
        const printContent = document.getElementById('bill-print-area');
        if (printContent) {
            const originalContents = document.body.innerHTML;
            const printArea = printContent.innerHTML;
            
            const printStyles = `
                @media print {
                    @page { 
                        size: 80mm auto; 
                        margin: 2mm; 
                    }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: 'Sarabun', sans-serif; 
                        font-size: 10pt; 
                        color: #000;
                        line-height: 1.4;
                    }
                    .print-container { 
                        width: 100%; 
                        margin: 0; 
                        padding: 0; 
                    }
                    .bill-header { 
                        text-align: center; 
                        font-size: 14pt; 
                        font-weight: bold; 
                        margin-bottom: 8px; 
                    }
                    .bill-subheader {
                        text-align: center;
                        font-size: 10pt;
                        margin-bottom: 8px;
                    }
                    .bill-info, .bill-summary, .bill-footer { 
                        border-top: 1px dashed #555; 
                        padding-top: 5px; 
                        margin-top: 5px; 
                        font-size: 10pt;
                    }
                    .bill-total {
                        border-top: 2px solid #000;
                        padding-top: 5px;
                        margin-top: 5px;
                        font-size: 12pt;
                        font-weight: bold;
                    }
                    .item-table {
                        width: 100%;
                        font-size: 10pt;
                    }
                    .item-table th, .item-table td {
                        padding: 2px 0;
                        vertical-align: top;
                    }
                    .item-table th:nth-child(1), .item-table td:nth-child(1) { text-align: left; width: 50%; padding-right: 2px; }
                    .item-table th:nth-child(2), .item-table td:nth-child(2) { text-align: right; width: 15%; }
                    .item-table th:nth-child(3), .item-table td:nth-child(3) { text-align: right; width: 15%; }
                    .item-table th:nth-child(4), .item-table td:nth-child(4) { text-align: right; width: 20%; font-weight: bold; }
                    
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                    }
                    
                    .print-hidden { display: none; }
                }
            `;

            document.body.innerHTML = `
                <html>
                    <head>
                        <title>ใบเสร็จ ${sale.billId}</title>
                        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
                        <style>${printStyles}</style>
                    </head>
                    <body>
                        <div class="print-container">
                            ${printArea}
                        </div>
                    </body>
                </html>
            `;
            
            window.print();
            
            setTimeout(() => {
                document.body.innerHTML = originalContents;
                window.location.reload(); 
            }, 500);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300 animate-in fade-in-0">
            <div className="bg-white rounded-xl p-0 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 animate-in zoom-in-95">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">รายละเอียดบิลขาย</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6">
                    <div id="bill-print-area" className="p-1 font-sans">
                        <div className="text-center mb-4 pb-2">
                            <h3 className="text-2xl font-extrabold text-green-700 bill-header">หลักเกษตร คุระบุรี 🌿</h3>
                            <p className="text-sm text-gray-600 bill-subheader">ใบเสร็จรับเงินอย่างย่อ</p>
                        </div>

                        <div className="text-sm text-gray-700 mb-4 bill-info">
                            <p><strong>บิลเลขที่:</strong> {sale.billId}</p>
                            <p><strong>วันที่/เวลา:</strong> {billDate}</p>
                        </div>

                        <table className="w-full item-table">
                            <thead>
                                <tr className="border-b-2 border-dashed">
                                    <th className="text-left font-semibold">รายการ</th>
                                    <th className="text-right font-semibold">จำนวน</th>
                                    <th className="text-right font-semibold">@</th>
                                    <th className="text-right font-semibold">รวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((item, index) => (
                                    <tr key={index} className="border-b border-dashed">
                                        <td className="pr-1 py-1">{item.name}</td>
                                        <td className="text-right py-1">{item.qty}</td>
                                        <td className="text-right py-1">{item.unitPrice.toFixed(2)}</td>
                                        <td className="text-right font-semibold py-1">{(item.unitPrice * item.qty).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-4 pt-3 space-y-1 text-md bill-summary">
                            <div className="flex justify-between summary-row">
                                <span className="font-semibold">ยอดรวม (Subtotal):</span>
                                <span className="font-semibold">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-red-600 summary-row">
                                <span className="font-semibold">ส่วนลด:</span>
                                <span className="font-semibold">{formatCurrency(discount)}</span>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-3 flex justify-between text-xl bill-total">
                            <span className="font-bold text-gray-800">รวมทั้งสิ้น:</span>
                            <span className="font-extrabold text-green-700">{formatCurrency(netAmount)}</span>
                        </div>

                        <div className="text-center mt-6 text-sm text-gray-500 bill-footer">
                            <p>ขอบคุณที่อุดหนุนสินค้าเกษตรของเราค่ะ!</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between space-x-3 p-4 border-t bg-gray-50 rounded-b-xl print-hidden">
                    <Button
                        onClick={handlePrint}
                        variant="blue"
                        className="flex-1"
                    >
                        <Printer size={20} /> พิมพ์บิล
                    </Button>
                    <Button
                        onClick={onClose}
                        variant="secondary"
                        className="flex-1"
                    >
                        ปิด
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- 9. Tab: Sales Manager ---

const SalesManager = ({ db, userId, sales, products, startDelete, updateProductStock, categories }) => {
    
    const [currentBillItems, setCurrentBillItems] = useState([]);
    const [discount, setDiscount] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantityInput, setQuantityInput] = useState('');
    const [billError, setBillError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSaleForView, setSelectedSaleForView] = useState(null);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

    const { subtotal, grandTotal, totalCostOfGoodsSold } = useMemo(() => {
        const calculatedSubtotal = currentBillItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const parsedDiscount = parseFloat(discount) || 0;
        let calculatedGrandTotal = calculatedSubtotal - parsedDiscount;
        if (calculatedGrandTotal < 0) calculatedGrandTotal = 0;
        const calculatedTotalCostOfGoodsSold = currentBillItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
        return { subtotal: calculatedSubtotal, grandTotal: calculatedGrandTotal, totalCostOfGoodsSold: calculatedTotalCostOfGoodsSold };
    }, [currentBillItems, discount]);
    
    const filteredProductsForDropdown = useMemo(() => {
        const filtered = (selectedCategoryFilter === 'all')
            ? products
            : products.filter(p => p.categoryId === selectedCategoryFilter);
        
        return filtered.sort((a, b) => {
            const stockA = a.stockQuantity || 0;
            const stockB = b.stockQuantity || 0;
            if (stockA > 0 && stockB <= 0) return -1; 
            if (stockB > 0 && stockA <= 0) return 1;  
            return a.name.localeCompare(b.name, 'th'); 
        });
    }, [products, selectedCategoryFilter]);


    const handleAddItem = (e) => {
        e.preventDefault();
        setBillError(null);
        
        const productId = selectedProductId;
        const qty = parseInt(quantityInput) || 0;

        if (!productId || qty <= 0) {
            setBillError("กรุณาเลือกสินค้าและระบุจำนวนที่ถูกต้อง");
            return;
        }

        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const currentInCartQty = currentBillItems.filter(item => item.id === productId).reduce((sum, item) => sum + item.quantity, 0);
        
        if (product.stockQuantity < (currentInCartQty + qty)) {
            setBillError(`⚠️ สต็อกไม่พอ! สินค้า ${product.name} เหลือเพียง ${product.stockQuantity} ชิ้น`);
            return;
        }

        const newItem = {
            id: product.id,
            name: product.name,
            unitPrice: product.sellingPrice || 0,
            costPrice: product.costPrice || 0, 
            quantity: qty,
            stockRemaining: product.stockQuantity - (currentInCartQty + qty) 
        };

        const existingIndex = currentBillItems.findIndex(item => item.id === newItem.id);

        if (existingIndex > -1) {
            const updatedItems = [...currentBillItems];
            updatedItems[existingIndex].quantity += qty;
            updatedItems[existingIndex].stockRemaining = newItem.stockRemaining;
            setCurrentBillItems(updatedItems);
        } else {
            setCurrentBillItems([...currentBillItems, newItem]);
        }
        
        setQuantityInput('');
        setSelectedProductId('');
    };

    const updateItemQuantity = (index, newQuantity) => {
        const qty = parseInt(newQuantity) || 0;
        if (qty < 0) return;
        setBillError(null); 

        const item = currentBillItems[index];
        const product = products.find(p => p.id === item.id);
        
        if (product.stockQuantity < qty) {
            setBillError(`⚠️ สต็อกไม่พอสำหรับ ${product.name}! เหลือเพียง ${product.stockQuantity} ชิ้น`);
            return;  
        }
        
        if (qty === 0) {
            deleteItemFromBill(index);
        } else {
            const updatedItems = [...currentBillItems];
            updatedItems[index].quantity = qty;
            updatedItems[index].stockRemaining = product.stockQuantity - qty;
            setCurrentBillItems(updatedItems);
        }
    };
    
    const adjustItemQuantity = (index, amount) => {
        const item = currentBillItems[index];
        const newQty = item.quantity + amount;
        updateItemQuantity(index, newQty);
    };

    const deleteItemFromBill = (index) => {
        setCurrentBillItems(currentBillItems.filter((_, i) => i !== index));
        setBillError(null);
    };
    
    const adjustFormQuantity = (amount) => {
        setQuantityInput(prev => {
            const newQty = Math.max(0, (parseInt(prev) || 0) + amount);
            return newQty === 0 ? '' : newQty.toString();
        });
    };

    const handleConfirmedSale = useCallback(async () => {
        setIsSaving(true);
        setBillError(null);

        const finalItems = currentBillItems.map(item => ({
            id: item.id,
            name: item.name,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            qty: item.quantity,
            totalRevenue: item.unitPrice * item.quantity,
            totalCost: item.costPrice * item.quantity,
        }));
        
        const billId = `B-${Math.floor(Date.now() / 1000) % 10000}`;
        const parsedDiscount = parseFloat(discount) || 0;

        const saleDocument = {
            billId: billId,
            items: finalItems,
            discount: parsedDiscount,
            subtotal: subtotal,
            totalRevenue: grandTotal, 
            totalCostOfGoodsSold: totalCostOfGoodsSold,
            createdAt: serverTimestamp(),
            profit: grandTotal - totalCostOfGoodsSold,
        };

        try {
            const salesCollectionPath = `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.sales}`;
            await addDoc(collection(db, salesCollectionPath), saleDocument);
            
            const stockUpdatePromises = currentBillItems.map(item => 
                updateProductStock(item.id, item.quantity)
            );
            await Promise.all(stockUpdatePromises);

            setCurrentBillItems([]);
            setDiscount('');
            setQuantityInput('');
            setSelectedProductId('');
        } catch (e) {
            console.error("Error adding sale or updating stock: ", e);
            setBillError("บันทึกบิลขายไม่สำเร็จ: " + e.message);
        } finally {
            setIsSaving(false);
        }
    }, [db, userId, currentBillItems, discount, subtotal, grandTotal, totalCostOfGoodsSold, updateProductStock]);

    const handleSaveSale = async () => {
        if (!db || !userId || currentBillItems.length === 0 || isSaving) {
            setBillError("กรุณาเพิ่มรายการสินค้าในบิลก่อนบันทึก");
            return;
        }
        await handleConfirmedSale(); 
    };
    
    const SaleItem = ({ sale }) => {
        const billDate = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString('th-TH') : 'กำลังโหลด...';
        const profit = (sale.totalRevenue || 0) - (sale.totalCostOfGoodsSold || 0);

        return (
            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 last:border-b-0 text-sm hover:bg-teal-50 transition duration-150">
                <div className="flex-grow min-w-0">
                    <p className="font-bold text-gray-800 text-md">บิลเลขที่: {sale.billId}</p>
                    <p className="text-gray-500 text-sm">
                        วันที่: {billDate} | <span className="text-gray-700">{sale.items.length} รายการ</span>
                    </p>
                    <p className="text-sm">
                        กำไร: 
                        <span className={`ml-1 font-bold text-md ${profit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                            {formatCurrency(profit)}
                        </span>
                    </p>
                </div>
                
                <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    <span className="font-extrabold text-xl text-green-700">{formatCurrency(sale.totalRevenue)}</span>
                    
                    <button
                        onClick={() => setSelectedSaleForView(sale)}
                        className="p-3 bg-blue-500 text-white rounded-full shadow-md hover:bg-blue-600 transition duration-150 transform hover:scale-105"
                        title="ดูรายละเอียด/พิมพ์บิล"
                    >
                        <Eye size={20} />
                    </button>
                    
                    <button
                        onClick={() => startDelete(sale, 'ลบบิลขาย', COLLECTION_PATHS.sales)}
                        className="p-3 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition duration-150 transform hover:scale-105"
                        title="ลบบิลขาย (ต้องใช้ PIN ยืนยัน)"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in-5 duration-300">
            
            <SaleDetailsModal 
                isOpen={!!selectedSaleForView}
                onClose={() => setSelectedSaleForView(null)}
                sale={selectedSaleForView}
            />

            <section className="bg-white p-6 rounded-2xl shadow-xl border border-teal-100">
                <h2 className="text-2xl font-bold text-teal-700 mb-4 flex items-center">
                    <DollarSign className="mr-3" size={28} /> สร้างบิลขายใหม่
                </h2>
                
                <form onSubmit={handleAddItem} className="space-y-4 mb-4 border-b border-gray-200 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">กรองหมวดหมู่</label>
                            <Select
                                id="categoryFilterSales"
                                value={selectedCategoryFilter}
                                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            >
                                <option value="all">-- แสดงสินค้าทั้งหมด --</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกสินค้า</label>
                            <Select
                                id="productSelect"
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                required
                            >
                                <option value="" disabled>เลือกสินค้า...</option>
                                {filteredProductsForDropdown.map(p => (
                                    <option 
                                        key={p.id} 
                                        value={p.id}
                                        disabled={(p.stockQuantity || 0) <= 0}
                                        className={(p.stockQuantity || 0) <= 0 ? 'text-red-400' : 'text-black'}
                                    >
                                        {p.name} ({formatCurrency(p.sellingPrice || 0)})
                                        {(p.stockQuantity || 0) <= 0 ? ' (สินค้าหมด)' : ` (เหลือ ${p.stockQuantity})`}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
                        <div className="flex space-x-2">
                            <Input
                                type="number"
                                id="quantityInput"
                                value={quantityInput}
                                onChange={(e) => setQuantityInput(e.target.value)} 
                                placeholder="0" min="0" required
                                className="w-24 text-center"
                            />
                            <div className="flex space-x-1">
                                <button type="button" onClick={() => adjustFormQuantity(1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition">+1</button>
                                <button type="button" onClick={() => adjustFormQuantity(5)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition">+5</button>
                                <button type="button" onClick={() => adjustFormQuantity(10)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition">+10</button>
                            </div>
                        </div>
                    </div>
                    
                    <Button
                        type="submit"
                        variant="teal"
                        disabled={products.length === 0 || !selectedProductId || (parseInt(quantityInput) || 0) <= 0}
                    >
                        <Plus size={20} /> เพิ่มรายการเข้าบิล
                    </Button>
                </form>

                {billError && <p className="text-red-600 text-sm mb-4 text-center font-semibold animate-pulse">{billError}</p>}
                
                <div className="border border-gray-200 rounded-xl overflow-hidden mt-4">
                    <div className="hidden sm:grid grid-cols-12 text-xs font-semibold text-gray-600 p-3 border-b bg-gray-50">
                        <span className="col-span-5">สินค้า</span>
                        <span className="col-span-2 text-right">ราคา/หน่วย</span>
                        <span className="col-span-3 text-center">จำนวน</span>
                        <span className="col-span-1 text-right">รวม</span>
                        <span className="col-span-1"></span>
                    </div>
                    <div className="divide-y divide-gray-100 min-h-[100px]">
                        {currentBillItems.length === 0 ? (
                            <p className="p-6 text-center text-gray-500 text-lg">ยังไม่มีรายการสินค้าในบิล</p>
                        ) : (
                            currentBillItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 items-center p-3 text-sm hover:bg-teal-50 gap-y-2">
                                    <span className="col-span-12 sm:col-span-5 truncate pr-1 text-gray-800 font-semibold">{item.name}</span>
                                    <span className="col-span-4 sm:col-span-2 text-left sm:text-right text-gray-600">
                                        <span className="sm:hidden">ราคา: </span>{formatCurrency(item.unitPrice)}
                                    </span>
                                    <div className="col-span-8 sm:col-span-3 text-center flex items-center justify-start sm:justify-center space-x-2">
                                        <button type="button" onClick={() => adjustItemQuantity(index, -1)} className="p-1 w-8 h-8 bg-red-100 text-red-600 rounded-full font-bold hover:bg-red-200">-</button>
                                        <span className='font-bold text-lg w-10 text-center'>{item.quantity}</span>
                                        <button type="button" onClick={() => adjustItemQuantity(index, 1)} className="p-1 w-8 h-8 bg-green-100 text-green-600 rounded-full font-bold hover:bg-green-200">+</button>
                                        <span className="text-xs text-gray-400">(เหลือ {item.stockRemaining})</span>
                                    </div>
                                    <span className="col-span-4 sm:col-span-1 text-left sm:text-right font-bold text-teal-700">
                                        <span className="sm:hidden">รวม: </span>{formatCurrency(item.unitPrice * item.quantity)}
                                    </span>
                                    <button 
                                        onClick={() => deleteItemFromBill(index)} 
                                        className="col-span-12 sm:col-span-1 flex justify-end text-red-400 hover:text-red-600"
                                        title="ลบรายการ"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    <div className="flex justify-between items-center text-gray-700 text-lg">
                        <span className="font-medium">รวมราคาสินค้า (Subtotal):</span>
                        <span className="font-semibold text-xl">{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <label htmlFor="discountInput" className="font-medium text-gray-700 text-lg">ส่วนลดท้ายบิล (บาท):</label>
                        <Input 
                            type="number" 
                            id="discountInput" 
                            value={discount} 
                            onChange={(e) => setDiscount(e.target.value)} 
                            min="0" 
                            className="w-32 text-right p-2 border rounded-lg text-red-600 font-semibold text-lg" 
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                    
                    <div className="pt-4 border-t-2 border-teal-500 flex justify-between items-center text-2xl text-gray-800">
                        <span className="font-bold text-teal-700">รวมทั้งสิ้น (Grand Total):</span>
                        <span className="font-extrabold text-3xl text-teal-700">{formatCurrency(grandTotal)}</span>
                    </div>
                </div>

                <Button
                    onClick={handleSaveSale} 
                    variant="teal"
                    className="w-full mt-6 py-4 text-lg"
                    disabled={currentBillItems.length === 0 || isSaving}
                >
                    <Save size={24} /> {isSaving ? 'กำลังบันทึกบิลและตัดสต็อก...' : 'บันทึกบิลขาย'}
                </Button>

            </section>

            <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <h2 className="text-2xl font-bold text-gray-700 p-5 border-b bg-gray-50 flex items-center">
                    <List className="mr-3" size={28} /> รายการบิลขายที่บันทึกแล้ว ({sales.length} บิล)
                </h2>
                {sales.length === 0 ? (
                    <p className="p-6 text-center text-gray-500 text-lg">ยังไม่มีรายการบิลขาย</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sales.map((sale) => (
                            <SaleItem key={sale.id} sale={sale} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

// --- 10. Main App Component ---

export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [activeTab, setActiveTab] = useState(TAB_OPTIONS.DASHBOARD);
    
    // Data States
    const [categories, setCategories] = useState([]); 
    const [products, setProducts] = useState([]); 
    const [sales, setSales] = useState([]); 
    const [receipts, setReceipts] = useState([]); 
    const [adminPin, setAdminPin] = useState(null); 

    // App Status
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [error, setError] = useState(null);
    
    // Delete Modal States
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null); 
    const [deleteActionName, setDeleteActionName] = useState('');
    const [deleteCollectionPath, setDeleteCollectionPath] = useState('');
    const [onConfirmCallback, setOnConfirmCallback] = useState(null); 

    // --- Firebase Initialization & Authentication ---
    useEffect(() => {
        try {
            // **โค้ดที่ถูกแก้ไข: ลบเงื่อนไขการตรวจสอบ Fallback API Key เพื่อให้รันต่อได้**
            // if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "AIzaSyAyVibsp6SkEbRY3flK0y0zi60MN7wWlII") {
            //     setError("Firebase config is missing or invalid.");
            //     setIsLoading(false);
            //     setIsAuthChecking(false);
            //     return;
            // }
            
            setLogLevel('debug');
            
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);
            
            setDb(firestore);
            setAuth(firebaseAuth); 

            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthChecking(false);
                } else {
                    if (initialAuthToken) {
                        try {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } catch (e) {
                            console.error("Custom Token Sign-In Error:", e);
                            setIsAuthChecking(false);
                        }
                    } else {
                        setIsAuthChecking(false);
                    }
                }
            });

            return () => unsubscribeAuth();
        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setError("ไม่สามารถเริ่มต้น Firebase ได้: " + e.message);
            setIsLoading(false);
            setIsAuthChecking(false);
        }
    }, []);

    // --- Real-time Data Listeners ---
    useEffect(() => {
        if (!db || !userId) {
            if (!userId) {
                setCategories([]);
                setProducts([]);
                setSales([]);
                setReceipts([]);
                setAdminPin(null);
                setIsLoading(false);
            }
            return;
        }

        setIsLoading(true);
        let unsubscribes = [];
        const baseDocPath = `/artifacts/${appId}/users/${userId}`;

        const setupListener = (collectionName, setState, sorter) => {
            const q = query(collection(db, `${baseDocPath}/${collectionName}`));
            return onSnapshot(q, (snapshot) => {
                let fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (sorter) {
                    fetchedData.sort(sorter);
                } else {
                    fetchedData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                }
                setState(fetchedData);
                setIsLoading(false); 
            }, (err) => {
                console.error(`Firestore ${collectionName} Snapshot Error:`, err);
                setError(`เกิดข้อผิดพลาดในการดึงข้อมูล ${collectionName}`);
                setIsLoading(false);
            });
        };

        // A. Categories (Sort by name ASC)
        unsubscribes.push(setupListener(COLLECTION_PATHS.categories, setCategories, (a, b) => a.name.localeCompare(b.name, 'th')));
        
        // B. Products 
        unsubscribes.push(setupListener(COLLECTION_PATHS.products, setProducts));

        // C. Sales 
        unsubscribes.push(setupListener(COLLECTION_PATHS.sales, setSales));
        
        // D. Goods Receipts 
        unsubscribes.push(setupListener(COLLECTION_PATHS.goodsReceipts, setReceipts));

        // E. Admin PIN Listener
        const pinDocRef = doc(db, `${baseDocPath}/${CONFIG_DOC_PATH}`);
        const unsubscribePin = onSnapshot(pinDocRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().pin) {
                setAdminPin(docSnap.data().pin);
            } else {
                setAdminPin(null); 
            }
        }, (err) => {
            console.error("Firestore PIN Snapshot Error:", err);
            setError("ไม่สามารถดึงข้อมูล PIN ได้");
        });
        unsubscribes.push(unsubscribePin);
        
        const listenerPromises = [
            getDocs(query(collection(db, `${baseDocPath}/${COLLECTION_PATHS.categories}`))),
            getDocs(query(collection(db, `${baseDocPath}/${COLLECTION_PATHS.products}`))),
            getDocs(query(collection(db, `${baseDocPath}/${COLLECTION_PATHS.sales}`))),
            getDocs(query(collection(db, `${baseDocPath}/${COLLECTION_PATHS.goodsReceipts}`))),
        ];

        Promise.all(listenerPromises)
            .then(() => {
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Error during initial data fetch:", err);
                setError("เกิดข้อผิดพลาดในการดึงข้อมูลเริ่มต้น");
                setIsLoading(false);
            });


        return () => unsubscribes.forEach(unsub => unsub());
    }, [db, userId]);

    // --- Stock Update Functions ---

    // 1. Deduct Stock (for Sales)
    const updateProductStock = useCallback(async (productId, soldQuantity) => {
        if (!db || !userId) return;
        const productRef = doc(db, `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.products}`, productId);
        try {
            await runTransaction(db, async (transaction) => {
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) throw new Error("Product not found");
                const currentStock = productDoc.data().stockQuantity || 0;
                const newStock = Math.max(0, currentStock - soldQuantity); 
                transaction.update(productRef, { 
                    stockQuantity: newStock,
                    updatedAt: serverTimestamp()
                });
            });
        } catch (e) {
            console.error("Error updating product stock: ", e);
            setError("เกิดข้อผิดพลาดในการตัดสต็อก: " + e.message); 
        }
    }, [db, userId]);
    
    // 2. Add Stock (for Goods Receipt)
    const receiveProductStock = useCallback(async (productId, receivedQuantity, unitCost) => {
        if (!db || !userId) return;
        const productRef = doc(db, `/artifacts/${appId}/users/${userId}/${COLLECTION_PATHS.products}`, productId);
        try {
            await runTransaction(db, async (transaction) => {
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) throw new Error("Product not found");
                const currentStock = productDoc.data().stockQuantity || 0;
                const newStock = currentStock + receivedQuantity;
                
                transaction.update(productRef, { 
                    stockQuantity: newStock,
                    costPrice: unitCost, 
                    updatedAt: serverTimestamp()
                });
            });
        } catch (e) {
            console.error("Error receiving product stock: ", e);
             setError("เกิดข้อผิดพลาดในการรับสต็อก: " + e.message);
        }
    }, [db, userId]);
    
    // --- Data Reset Function ---
    const resetAllData = useCallback(async () => {
        if (!db || !userId) return;
        
        try {
            const collectionsToReset = [
                COLLECTION_PATHS.products,
                COLLECTION_PATHS.sales,
                COLLECTION_PATHS.goodsReceipts,
                COLLECTION_PATHS.categories,
            ];
            const baseDocPath = `/artifacts/${appId}/users/${userId}`;
            
            for (const collectionName of collectionsToReset) {
                const q = collection(db, `${baseDocPath}/${collectionName}`);
                const snapshot = await getDocs(q);
                const deletePromises = [];
                snapshot.docs.forEach(doc => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                await Promise.all(deletePromises);
            }

            const pinDocRef = doc(db, `${baseDocPath}/${CONFIG_DOC_PATH}`);
            await deleteDoc(pinDocRef);
            
            setError(null);
            window.location.reload(); 

        } catch (e) {
            console.error("Error resetting all data: ", e);
            setError("เกิดข้อผิดพลาดร้ายแรงในการล้างข้อมูล: " + e.message);
        }
    }, [db, userId]); 

    // --- Delete Functionality ---

    const startDelete = useCallback((item, actionName, collectionPath, callback = null) => {
        if (!adminPin) {
             setError('คุณต้องตั้งค่ารหัส PIN ก่อนจึงจะลบข้อมูลได้! (ที่แท็บ "ตั้งค่า Admin")');
             return;
        }
        setItemToDelete(item);
        setDeleteActionName(actionName);
        setDeleteCollectionPath(collectionPath);
        
        setOnConfirmCallback(() => callback); 
        setIsDeleteModalOpen(true);
    }, [adminPin]);

    const startResetAllData = useCallback(() => {
        startDelete({ name: 'ข้อมูลทั้งหมด' }, 'ล้างข้อมูลทั้งหมด', 'FULL_DATA_RESET', resetAllData);
    }, [adminPin, resetAllData, startDelete]);


    const confirmDelete = useCallback(async () => {
        if (!itemToDelete || !db || !userId || !deleteCollectionPath) return;

        // 1. Full Data Reset
        if (deleteCollectionPath === 'FULL_DATA_RESET') {
            const callback = onConfirmCallback; 
            if (typeof callback === 'function') {
                await callback();
            }
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
            setOnConfirmCallback(null);
            return; 
        }

        // 2. Standard Delete
        if (!itemToDelete.id) {
            console.error("Item to delete has no ID.");
            setError(`ไม่สามารถลบรายการได้: ข้อมูลรายการไม่สมบูรณ์`);
            setIsDeleteModalOpen(false);
            return;
        }
        
        try {
            const itemDocRef = doc(db, `/artifacts/${appId}/users/${userId}/${deleteCollectionPath}`, itemToDelete.id);
            await deleteDoc(itemDocRef);
            
            if (deleteCollectionPath === COLLECTION_PATHS.sales) {
                 console.warn("Sale deleted. Stock was NOT automatically reversed. Manual adjustment recommended.");
            }
            if (deleteCollectionPath === COLLECTION_PATHS.goodsReceipts) {
                 console.warn("Goods Receipt deleted. Stock was NOT automatically reversed. Manual adjustment recommended.");
            }
            
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
            setOnConfirmCallback(null);
            setError(null); 
        } catch (e) {
            console.error("Error deleting document: ", e);
            setError(`ลบ ${deleteActionName} ไม่สำเร็จ: ${e.message}`);
        }
    }, [itemToDelete, db, userId, deleteCollectionPath, onConfirmCallback, deleteActionName]);

    // --- Render Logic ---

    const handleLogout = () => {
        if (auth) {
            signOut(auth).catch(e => {
                console.error("Logout error:", e);
                setError("เกิดข้อผิดพลาดในการออกจากระบบ");
            });
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <LoadingSpinner />;
        }
        
        switch (activeTab) {
            case TAB_OPTIONS.DASHBOARD:
                return <DashboardManager products={products} sales={sales} />;
            case TAB_OPTIONS.PRODUCT:
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-6">
                            <CategoryManager 
                                db={db} 
                                userId={userId} 
                                categories={categories} 
                                startDelete={startDelete} 
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-6">
                            <ProductManager 
                                db={db} 
                                userId={userId} 
                                products={products} 
                                categories={categories} 
                                startDelete={startDelete} 
                            />
                        </div>
                    </div>
                );
            case TAB_OPTIONS.GOODS_RECEIPT: 
                return <GoodsReceiptManager 
                            db={db} 
                            userId={userId} 
                            products={products}
                            receipts={receipts}
                            startDelete={startDelete}
                            receiveProductStock={receiveProductStock}
                       />;
            case TAB_OPTIONS.SALE:
                return <SalesManager 
                            db={db} 
                            userId={userId} 
                            sales={sales} 
                            products={products} 
                            startDelete={startDelete} 
                            updateProductStock={updateProductStock}
                            categories={categories}
                       />;
            case TAB_OPTIONS.ADMIN:
                return <AdminPinManager 
                            db={db} 
                            userId={userId} 
                            currentPin={adminPin} 
                            onPinUpdate={setAdminPin} 
                            sales={sales} 
                            startResetAllData={startResetAllData}
                       />;
            default:
                return <div>เลือกแท็บเพื่อเริ่มต้นการทำงาน</div>;
        }
    };

    // STYLED AuthManager Component
    const AuthManager = () => {
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [isRegisterMode, setIsRegisterMode] = useState(false);
        const [authMessage, setAuthMessage] = useState('');
        const [isProcessing, setIsProcessing] = useState(false);

        const handleAuthAction = async (e) => {
            e.preventDefault();
            setAuthMessage('');
            setIsProcessing(true);

            if (!email || password.length < 6) {
                setAuthMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และกรุณากรอกอีเมลให้ถูกต้อง');
                setIsProcessing(false);
                return;
            }

            try {
                if (isRegisterMode) {
                    await createUserWithEmailAndPassword(auth, email, password);
                } else {
                    await signInWithEmailAndPassword(auth, email, password);
                }
            } catch (e) {
                console.error("Auth error:", e);
                let msg = e.message;
                if (e.code === 'auth/email-already-in-use') msg = 'อีเมลนี้ถูกใช้แล้ว ลองเข้าสู่ระบบแทน';
                if (e.code === 'auth/invalid-credential') msg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
                if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') msg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
                
                setAuthMessage(`❌ ข้อผิดพลาด: ${msg}`);
            } finally {
                setIsProcessing(false);
            }
        };

        return (
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-green-700 mb-2">
                        หลักเกษตร คุระบุรี 🌿
                    </h2>
                    <p className="text-lg text-gray-600">
                        {isRegisterMode ? 'ลงทะเบียนบัญชีผู้ดูแลระบบ' : 'เข้าสู่ระบบผู้ดูแลระบบ'}
                    </p>
                </div>

                <form onSubmit={handleAuthAction} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your.email@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="อย่างน้อย 6 ตัวอักษร"
                            minLength="6"
                            required
                        />
                    </div>
                    
                    {authMessage && (
                        <p className={`p-3 rounded-lg text-sm font-semibold text-center ${authMessage.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-600'}`}>
                            {authMessage}
                        </p>
                    )}

                    <Button
                        type="submit"
                        variant={isRegisterMode ? 'primary' : 'blue'}
                        disabled={isProcessing || password.length < 6}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                {isRegisterMode ? 'กำลังลงทะเบียน...' : 'กำลังเข้าสู่ระบบ...'}
                            </>
                        ) : (
                            <>
                                {isRegisterMode ? <UserPlus size={20} /> : <User size={20} />}
                                {isRegisterMode ? 'ลงทะเบียน' : 'เข้าสู่ระบบ'}
                            </>
                        )}
                    </Button>
                </form>

                <button
                    onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthMessage(''); }}
                    className="w-full mt-4 text-sm text-center text-gray-600 hover:text-blue-600 transition underline"
                >
                    {isRegisterMode ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? ลงทะเบียนใหม่'}
                </button>
            </div>
        );
    };

    // --- Main Render ---

    // Show Global Error
    if (error && !isDeleteModalOpen) { 
        return (
            <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
                 <div className="p-6 text-center text-red-700 bg-white rounded-xl shadow-2xl border-2 border-red-200 max-w-xl mx-auto">
                    <AlertTriangle size={40} className="text-red-600 mx-auto mb-4" />
                    <h2 className="font-bold text-2xl mb-2">เกิดข้อผิดพลาด!</h2>
                    <p className="text-md">{error}</p>
                    <button
                        onClick={() => { setError(null); if (error.includes("Firebase config")) window.location.reload(); }}
                        className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition duration-150"
                    >
                        ตกลง
                    </button>
                </div>
            </div>
        );
    }
    
    // 1. Show Loading while checking initial auth status
    if (isAuthChecking) {
        return <LoadingSpinner fullScreen={true} />;
    }
    
    // 2. Show Auth Manager if not logged in
    if (!userId) {
        return (
            <div className="min-h-screen bg-gray-100 p-4 sm:p-8 flex items-center justify-center">
                {auth && <AuthManager />}
            </div>
        );
    }

    // 3. Show Main App (Logged In)
    const tabs = [
        { id: TAB_OPTIONS.DASHBOARD, icon: Home, label: 'แดชบอร์ด' },
        { id: TAB_OPTIONS.PRODUCT, icon: Package, label: 'สินค้า/หมวดหมู่' },
        { id: TAB_OPTIONS.GOODS_RECEIPT, icon: Truck, label: 'รับเข้าสต็อก' }, 
        { id: TAB_OPTIONS.SALE, icon: DollarSign, label: 'บิลขาย' },
        { id: TAB_OPTIONS.ADMIN, icon: Settings, label: 'ตั้งค่า Admin' },
    ];

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans relative">
            
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                itemName={itemToDelete?.name || itemToDelete?.billId || 'รายการนี้'}
                deleteAction={deleteActionName}
                correctPin={adminPin}
            />
            
            <header className="max-w-7xl mx-auto mb-6 flex flex-col pt-4 relative">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <h1 className="text-3xl font-extrabold text-green-700 sm:text-4xl tracking-tight flex items-center">
                            <Sprout size={36} className="mr-3 text-green-600" />
                            หลักเกษตร คุระบุรี
                        </h1>
                        <p className="mt-1 text-md text-gray-500">
                            แดชบอร์ดสรุปกำไรขาดทุนและแจ้งเตือนสต็อกอัตโนมัติ!
                        </p>
                        <div className="mt-2 text-xs text-gray-400 p-2 bg-gray-50 rounded-lg inline-block">
                            App ID: <span className="font-mono">{appId}</span> | User ID: <span className="font-mono">{userId}</span>
                        </div>
                    </div>
                </div>

                <Button 
                    onClick={handleLogout}
                    variant="logoutStrong"
                    className="absolute top-0 right-0 px-3 py-2 text-sm border border-red-700 z-20" 
                    title="ออกจากระบบ"
                >
                    <LogOut size={16} /> Logout
                </Button>
            </header>

            <main className="max-w-7xl mx-auto">
                {/* STYLED Tab Navigation */}
                <div className="flex flex-wrap bg-white p-2 rounded-2xl shadow-lg mb-6 border border-gray-100">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-xl transition duration-200 text-sm sm:text-md font-semibold whitespace-nowrap ${
                                isActive
                                    ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                                    : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                            }`}
                        >
                            <Icon size={20} />
                            {tab.label}
                        </button>
                    )})}
                </div>

                {/* Content Area */}
                {renderContent()}
            </main>
            
            <footer className="mt-12 text-center text-gray-400 text-sm max-w-7xl mx-auto">
                <p>ข้อมูลทั้งหมดถูกจัดเก็บแบบส่วนตัวด้วย Firebase Firestore</p>
                <p>Vite + React + Tailwind CSS</p>
            </footer>
        </div>
    );
}