import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Merchant } from '@el/types';

interface MerchantContextType {
    currentMerchant: Merchant | null;
    merchants: Merchant[];
    setMerchant: (merchant: Merchant) => void;
    isLoading: boolean;
}

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

export const MerchantProvider = ({ children }: { children: ReactNode }) => {
    const [currentMerchant, setCurrentMerchant] = useState<Merchant | null>(null);
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 获取商家列表
        const fetchMerchants = async () => {
            try {
                const apiBase = (import.meta.env.VITE_API_URL || import.meta.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');
                const res = await fetch(`${apiBase}/merchants`);
                const json = await res.json();
                if (json.code === 200 && json.data.length > 0) {
                    setMerchants(json.data);
                    // 默认选中第一个
                    setCurrentMerchant(json.data[0]);
                }
            } catch (e) {
                console.error('Failed to fetch merchants:', e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMerchants();
    }, []);

    const setMerchant = (merchant: Merchant) => {
        setCurrentMerchant(merchant);
        // 可以持久化到 localStorage
        // localStorage.setItem('currentMerchantId', merchant.id);
    };

    return (
        <MerchantContext.Provider value={{ currentMerchant, merchants, setMerchant, isLoading }}>
            {children}
        </MerchantContext.Provider>
    );
};

export const useMerchant = () => {
    const context = useContext(MerchantContext);
    if (context === undefined) {
        throw new Error('useMerchant must be used within a MerchantProvider');
    }
    return context;
};
