import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';

interface Ticket {
    id: string;
    subject: string;
    message: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
    createdAt: string;
    reply?: string;
}

export default function Support() {
    const { user } = useAuth();
    const { clientInfo } = useLicense();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const fetchTickets = async () => {
        try {
            setFetching(true);
            const res = await axios.get('/api/tickets');
            setTickets(res.data.tickets || []);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchTickets();
        const interval = setInterval(fetchTickets, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) return;

        setLoading(true);
        try {
            await axios.post('/api/tickets', {
                subject,
                message,
                senderName: user?.name,
                senderRole: user?.role
            });
            
            Swal.fire({
                icon: 'success',
                title: 'Ticket Submitted',
                text: 'Your support ticket has been sent to IT Administration.',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
            });
            
            setSubject('');
            setMessage('');
            fetchTickets();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Failed to Send',
                text: 'Could not submit the support ticket. Please try again.',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="page-title page-title text-[20px] font-bold text-slate-900 tracking-tight">IT Support Tickets</h1>
                    <p className="page-subtitle">Contact Central Administration for technical assistance</p>
                </div>
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                {/* Submit New Ticket */}
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        Create New Ticket
                    </h2>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Issue Subject</label>
                            <input
                                type="text"
                                className="form-input"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="E.g., Receipt Printer Not Working"
                                required
                            />
                        </div>
                        
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Detailed Description</label>
                            <textarea
                                className="form-input"
                                rows={6}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe the issue you are experiencing..."
                                required
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary w-full" 
                            style={{ marginTop: '1.5rem', display: 'flex', gap: '8px', justifyContent: 'center' }}
                            disabled={loading}
                        >
                            <Send size={18} />
                            {loading ? 'Submitting...' : 'Submit Support Ticket'}
                        </button>
                    </form>
                </div>

                {/* Ticket History */}
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        My Support Tickets
                    </h2>

                    {fetching && tickets.length === 0 ? (
                        <div className="empty-state">Loading your tickets...</div>
                    ) : tickets.length === 0 ? (
                        <div className="empty-state">
                            <CheckCircle size={48} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p>You have no active support tickets.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {tickets.map(ticket => (
                                <div key={ticket.id} style={{ 
                                    padding: '16px', 
                                    borderRadius: '8px', 
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{ticket.subject}</h3>
                                        <span style={{ 
                                            padding: '4px 8px', 
                                            borderRadius: '99px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 600,
                                            background: ticket.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.1)' : ticket.status === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                            color: ticket.status === 'RESOLVED' ? '#10b981' : ticket.status === 'IN_PROGRESS' ? '#f59e0b' : '#3b82f6'
                                        }}>
                                            {ticket.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px', lineHeight: 1.5 }}>
                                        {ticket.message}
                                    </p>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} />
                                        {new Date(ticket.createdAt).toLocaleString()}
                                    </div>
                                    
                                    {ticket.reply && (
                                        <div style={{ 
                                            marginTop: '16px', 
                                            padding: '12px', 
                                            background: 'var(--bg-hover)', 
                                            borderRadius: '6px',
                                            borderLeft: '3px solid var(--accent)'
                                        }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>Admin Reply:</div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{ticket.reply}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
        </div>
    );
}
