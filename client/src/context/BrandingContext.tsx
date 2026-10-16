import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface BrandingContextType {
    name: string;
    subtitle: string;
    logoIcon: string;
    logoUrl: string | null;
    posPinLength: number;
    hasPosPin: boolean;
    emailDomain: string;
    maintenanceMode: boolean;
    receiptFooter: string;
    receiptPolicy: string;
    loading: boolean;
    updateSettings: (
        appName: string,
        subtitle: string,
        logoIcon: string,
        logoFile: File | null,
        removeLogo: boolean,
        posPin?: string | null,
        posPinLength?: number,
        emailDomain?: string,
        maintenanceMode?: boolean,
        receiptFooter?: string,
        receiptPolicy?: string
    ) => Promise<void>;
    refreshSettings: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

export function useBranding() {
    const ctx = useContext(BrandingContext);
    if (!ctx) throw new Error('useBranding must be used within a BrandingProvider');
    return ctx;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
    const [name, setName] = useState<string>('Shadow Apollo');
    const [subtitle, setSubtitle] = useState<string>('Inventory & POS System');
    const [logoIcon, setLogoIcon] = useState<string>('⚡');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [posPinLength, setPosPinLength] = useState<number>(4);
    const [hasPosPin, setHasPosPin] = useState<boolean>(false);
    const [emailDomain, setEmailDomain] = useState<string>('shadow.com');
    const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
    const [receiptFooter, setReceiptFooter] = useState<string>('Thank you for shopping with us!');
    const [receiptPolicy, setReceiptPolicy] = useState<string>('No return, no exchange after 7 days.');
    const [loading, setLoading] = useState<boolean>(true);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/settings');
            if (res.data) {
                setName(res.data.appName);
                setSubtitle(res.data.subtitle);
                setLogoIcon(res.data.logoIcon);
                setLogoUrl(res.data.logoUrl || null);
                setPosPinLength(res.data.posPinLength || 4);
                setHasPosPin(!!res.data.hasPosPin);
                setEmailDomain(res.data.emailDomain || 'shadow.com');
                setMaintenanceMode(!!res.data.maintenanceMode);
                setReceiptFooter(res.data.receiptFooter || 'Thank you for shopping with us!');
                setReceiptPolicy(res.data.receiptPolicy || 'No return, no exchange after 7 days.');
                document.title = `${res.data.appName} — ${res.data.subtitle}`;
            }
        } catch (error) {
            console.error('Failed to load branding settings from server, using default branding:', error);
            document.title = `${name} — ${subtitle}`;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const updateSettings = async (
        appName: string,
        subtitle: string,
        logoIcon: string,
        logoFile: File | null,
        removeLogo: boolean,
        posPin?: string | null,
        posPinLength?: number,
        emailDomainInput?: string,
        maintenanceModeInput?: boolean,
        receiptFooterInput?: string,
        receiptPolicyInput?: string
    ) => {
        try {
            const formData = new FormData();
            formData.append('appName', appName);
            formData.append('subtitle', subtitle);
            formData.append('logoIcon', logoIcon);
            if (logoFile) {
                formData.append('logo', logoFile);
            }
            if (removeLogo) {
                formData.append('removeLogo', 'true');
            }
            if (posPin !== undefined && posPin !== null) {
                formData.append('posPin', posPin);
            }
            if (posPinLength !== undefined) {
                formData.append('posPinLength', String(posPinLength));
            }
            if (emailDomainInput !== undefined) {
                formData.append('emailDomain', emailDomainInput);
            }
            if (maintenanceModeInput !== undefined) {
                formData.append('maintenanceMode', String(maintenanceModeInput));
            }
            if (receiptFooterInput !== undefined) {
                formData.append('receiptFooter', receiptFooterInput);
            }
            if (receiptPolicyInput !== undefined) {
                formData.append('receiptPolicy', receiptPolicyInput);
            }

            const res = await axios.put('/api/settings', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.data) {
                setName(res.data.appName);
                setSubtitle(res.data.subtitle);
                setLogoIcon(res.data.logoIcon);
                setLogoUrl(res.data.logoUrl || null);
                setPosPinLength(res.data.posPinLength || 4);
                setHasPosPin(!!res.data.hasPosPin);
                setEmailDomain(res.data.emailDomain || 'shadow.com');
                setMaintenanceMode(!!res.data.maintenanceMode);
                setReceiptFooter(res.data.receiptFooter || 'Thank you for shopping with us!');
                setReceiptPolicy(res.data.receiptPolicy || 'No return, no exchange after 7 days.');
                document.title = `${res.data.appName} — ${res.data.subtitle}`;
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    };

    return (
        <BrandingContext.Provider
            value={{
                name,
                subtitle,
                logoIcon,
                logoUrl,
                posPinLength,
                hasPosPin,
                emailDomain,
                maintenanceMode,
                receiptFooter,
                receiptPolicy,
                loading,
                updateSettings,
                refreshSettings: fetchSettings,
            }}
        >
            {children}
        </BrandingContext.Provider>
    );
}
