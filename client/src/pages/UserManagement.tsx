import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Plus, Edit3, Trash2, Users, Shield, UserCheck, UserCog, Key } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    rfidUid?: string;
}

interface Role {
    id: number;
    name: string;
    permissions: string; // JSON string
    createdAt: string;
}

const AVAILABLE_PERMISSIONS = [
    { id: '*', label: 'All Access (Admin)' },
    // POINT OF SALE
    { id: 'DASHBOARD', label: 'Dashboard' },
    { id: 'POS_TERMINAL', label: 'POS Terminal' },

    { id: 'REFUNDS_RETURNS', label: 'Refunds & Returns' },
    { id: 'LAYAWAY_RESERVES', label: 'Layaway / Reserves' },
    // OPERATIONS & CASH
    { id: 'CASH_DRAWER', label: 'Cash Drawer & Till' },
    { id: 'SHIFTS_READING', label: 'Shifts & X/Z Reading' },
    { id: 'SALES_HISTORY', label: 'Sales History & Receipts' },
    { id: 'PAYMENT_MODES', label: 'Payment Modes' },
    { id: 'SYNC_QUEUE', label: 'Sync Queue' },
    // INVENTORY & CATALOG
    { id: 'STOCK_INVENTORY', label: 'Stock Inventory' },
    { id: 'PRICE_CHECK', label: 'Price Check / Scan' },
    { id: 'CATEGORIES', label: 'Categories' },
    { id: 'SUPPLIERS_POS', label: 'Suppliers & POs' },
    // CUSTOMERS & MANAGEMENT
    { id: 'LOYALTY_CUSTOMERS', label: 'Loyalty & Customers' },
    { id: 'USER_ROLE_MGMT', label: 'User & Role Management' },
    { id: 'REPORTS_ANALYTICS', label: 'Reports & Analytics' },
    { id: 'AUDITS_LOGS', label: 'Audits & Logs' },
    { id: 'SETTINGS', label: 'Settings' }
];

export default function UserManagement() {
    const { emailDomain } = useBranding();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES'>('USERS');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes] = await Promise.all([
                axios.get('/api/users'),
                axios.get('/api/roles')
            ]);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openUserModal = async (user?: User) => {
        const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const EYE_OFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

        const rolesOptions = roles.map(r => `<option value="${r.name}" ${user?.role === r.name ? 'selected' : ''}>${r.name}</option>`).join('');

        const { value: formValues } = await Swal.fire({
            title: user ? 'Edit User' : 'Create User',
            html: `
        <div style="text-align:left; font-family: var(--font); color: var(--text-primary);">
          <div style="margin-bottom: 12px;">
            <label style="display:block; margin-bottom:4px; font-size:0.85em; color:var(--text-secondary);">Name</label>
            <input id="swal-name" class="swal2-input" placeholder="Full name" value="${user?.name || ''}" style="margin:0; width:100%; box-sizing:border-box; background: var(--bg-primary); color: var(--text-primary); border-color: var(--border);">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display:block; margin-bottom:4px; font-size:0.85em; color:var(--text-secondary);">Email</label>
            <input id="swal-email" class="swal2-input" type="email" placeholder="username@${emailDomain}" value="${user?.email || ''}" style="margin:0; width:100%; box-sizing:border-box; background: var(--bg-primary); color: var(--text-primary); border-color: var(--border);">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">If no domain is specified, @${emailDomain} will be appended automatically.</div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display:block; margin-bottom:4px; font-size:0.85em; color:var(--text-secondary);">${user ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <div style="position: relative; display: flex; align-items: center;">
              <input id="swal-password" class="swal2-input" type="password" placeholder="••••••••" style="margin:0; width:100%; box-sizing:border-box; padding-right: 42px; background: var(--bg-primary); color: var(--text-primary); border-color: var(--border);">
              <button id="swal-toggle-password" type="button" style="position: absolute; right: 14px; background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; padding: 0; outline: none; transition: color 0.2s ease;">
                ${EYE_SVG}
              </button>
            </div>
          </div>
          <div>
            <label style="display:block; margin-bottom:4px; font-size:0.85em; color:var(--text-secondary);">Role</label>
            <select id="swal-role" class="swal2-select" style="margin:0; width:100%; box-sizing:border-box; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 8px;">
              ${rolesOptions}
            </select>
          </div>
          <div style="margin-bottom: 12px; margin-top: 12px;">
            <label style="display:block; margin-bottom:4px; font-size:0.85em; color:var(--text-secondary);">RFID Card / Badge UID</label>
            <input id="swal-rfid" class="swal2-input" placeholder="Manual typing or scan..." value="${user?.rfidUid || ''}" style="margin:0; width:100%; box-sizing:border-box; background: var(--bg-primary); color: var(--text-primary); border-color: var(--border);">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display:block; margin-bottom:4px; font-size:0.85em; color:var(--text-secondary);">${user ? 'New 4-Digit POS Shift PIN (leave blank to keep)' : '4-Digit POS Shift PIN'}</label>
            <input id="swal-pospin" class="swal2-input" type="password" maxlength="4" placeholder="••••" style="margin:0; width:100%; box-sizing:border-box; background: var(--bg-primary); color: var(--text-primary); border-color: var(--border);">
          </div>
        </div>
      `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: user ? 'Update' : 'Create',
            confirmButtonColor: 'var(--accent)',
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            preConfirm: () => {
                const name = (document.getElementById('swal-name') as HTMLInputElement).value.trim();
                let email = (document.getElementById('swal-email') as HTMLInputElement).value.trim();
                const password = (document.getElementById('swal-password') as HTMLInputElement).value;
                const role = (document.getElementById('swal-role') as HTMLSelectElement).value;
                const rfidUid = (document.getElementById('swal-rfid') as HTMLInputElement).value.trim();
                const posPin = (document.getElementById('swal-pospin') as HTMLInputElement).value.trim();
                
                if (!name || !email) {
                    Swal.showValidationMessage('Name and email are required');
                    return;
                }
                
                if (!email.includes('@')) {
                    email = `${email}@${emailDomain}`;
                }
                
                if (!user && !password) {
                    Swal.showValidationMessage('Password is required for new users');
                    return;
                }
                
                return { name, email, password, role, rfidUid, posPin };
            },
            didOpen: () => {
                const passwordInput = document.getElementById('swal-password') as HTMLInputElement;
                const toggleBtn = document.getElementById('swal-toggle-password') as HTMLButtonElement;
                if (passwordInput && toggleBtn) {
                    toggleBtn.addEventListener('click', () => {
                        const isPassword = passwordInput.type === 'password';
                        passwordInput.type = isPassword ? 'text' : 'password';
                        toggleBtn.innerHTML = isPassword ? EYE_OFF_SVG : EYE_SVG;
                    });
                }
            }
        });

        if (formValues) {
            try {
                const data: any = { name: formValues.name, email: formValues.email, role: formValues.role };
                if (formValues.password) data.password = formValues.password;
                if (formValues.rfidUid) data.rfidUid = formValues.rfidUid;
                if (formValues.posPin) data.posPin = formValues.posPin;

                if (user) await axios.put(`/api/users/${user.id}`, data);
                else await axios.post('/api/users', data);

                Swal.fire({ icon: 'success', title: user ? 'Updated!' : 'Created!', timer: 1500, showConfirmButton: false });
                fetchData();
            } catch (err: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error });
            }
        }
    };

    const deleteUser = async (user: User) => {
        const result = await Swal.fire({
            title: 'Delete User?',
            text: `Are you sure you want to delete "${user.name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--red)',
            confirmButtonText: 'Yes, Delete'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/users/${user.id}`);
                Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
                fetchData();
            } catch (err: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error });
            }
        }
    };

    const openRoleModal = async (role?: Role) => {
        const isCoreRole = role && ['ADMIN', 'STAFF', 'CASHIER'].includes(role.name);
        let selectedPerms = role ? JSON.parse(role.permissions) : [];
        if (!Array.isArray(selectedPerms)) selectedPerms = [];

        const { value: formValues } = await Swal.fire({
            title: role ? 'Edit Role' : 'Create Role',
            width: '500px',
            html: `
        <div style="text-align:left; font-family: var(--font); color: var(--text-primary);">
          <div style="margin-bottom: 12px;">
            <label style="display:block; margin-bottom:4px; font-size:0.85em; color:var(--text-secondary);">Role Name</label>
            <input id="swal-role-name" class="swal2-input" placeholder="e.g. MANAGER" value="${role?.name || ''}" ${isCoreRole ? 'disabled' : ''} style="margin:0; width:100%; box-sizing:border-box; background: var(--bg-primary); color: var(--text-primary); border-color: var(--border); text-transform: uppercase;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display:block; margin-bottom:8px; font-size:0.85em; color:var(--text-secondary);">Permissions (Modules Access)</label>
            <div style="max-height: 250px; overflow-y: auto; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
                ${AVAILABLE_PERMISSIONS.map(p => `
                    <div style="display: flex; align-items: center; margin-bottom: 8px; gap: 8px;">
                        <input type="checkbox" id="perm-${p.id}" value="${p.id}" class="perm-checkbox" ${selectedPerms.includes(p.id) || selectedPerms.includes('*') ? 'checked' : ''} style="accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer;">
                        <label for="perm-${p.id}" style="cursor: pointer;">${p.label}</label>
                    </div>
                `).join('')}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Check "All Access (Admin)" to grant full system access.</div>
          </div>
        </div>
      `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: role ? 'Update Role' : 'Create Role',
            confirmButtonColor: 'var(--accent)',
            preConfirm: () => {
                const name = (document.getElementById('swal-role-name') as HTMLInputElement).value.trim().toUpperCase();
                
                const checkboxes = document.querySelectorAll('.perm-checkbox');
                const permissions: string[] = [];
                checkboxes.forEach((cb: any) => {
                    if (cb.checked) permissions.push(cb.value);
                });
                
                if (!name) {
                    Swal.showValidationMessage('Role name is required');
                    return;
                }
                
                return { name, permissions };
            }
        });

        if (formValues) {
            try {
                if (role) await axios.put(`/api/roles/${role.id}`, formValues);
                else await axios.post('/api/roles', formValues);

                Swal.fire({ icon: 'success', title: role ? 'Updated!' : 'Created!', timer: 1500, showConfirmButton: false });
                fetchData();
            } catch (err: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error });
            }
        }
    };

    const deleteRole = async (role: Role) => {
        const result = await Swal.fire({
            title: 'Delete Role?',
            text: `Are you sure you want to delete the "${role.name}" role?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--red)',
            confirmButtonText: 'Yes, Delete'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/roles/${role.id}`);
                Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
                fetchData();
            } catch (err: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error });
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Access Control</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Manage users and dynamic roles</p>
                </div>
                <div className="flex items-center gap-2">
                    <motion.button
                        className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded flex items-center gap-2 text-[12px] font-bold transition-colors"
                        onClick={() => activeTab === 'USERS' ? openUserModal() : openRoleModal()}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Plus size={14} />
                        {activeTab === 'USERS' ? 'Add User' : 'Add Role'}
                    </motion.button>
                </div>
            </header>

            <main className="flex-1 p-5 overflow-y-auto w-full">
                {/* Tabs */}
                <div className="flex gap-4 mb-5 border-b border-slate-200">
                    <button 
                        onClick={() => setActiveTab('USERS')}
                        className={`flex items-center gap-2 pb-2 px-1 text-[13px] font-bold transition-colors border-b-2 ${
                            activeTab === 'USERS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Users size={16} /> Users
                    </button>
                    <button 
                        onClick={() => setActiveTab('ROLES')}
                        className={`flex items-center gap-2 pb-2 px-1 text-[13px] font-bold transition-colors border-b-2 ${
                            activeTab === 'ROLES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Shield size={16} /> Roles
                    </button>
                </div>

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : (
                <AnimatePresence mode="wait">
                    {activeTab === 'USERS' ? (
                        <motion.div key="users" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>User</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Created At</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <tr key={u.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 'bold' }}>
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <strong>{u.name}</strong>
                                                    </div>
                                                </td>
                                                <td>{u.email}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Shield size={16} style={{ color: 'var(--accent)' }} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent)' }}>{u.role}</span>
                                                    </div>
                                                </td>
                                                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button className="btn-icon btn-edit" onClick={() => openUserModal(u)} title="Edit User"><Edit3 size={16} /></button>
                                                        <button className="btn-icon btn-delete" onClick={() => deleteUser(u)} title="Delete User"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="roles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Role Name</th>
                                            <th>Permissions Count</th>
                                            <th>Created At</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roles.map((r) => {
                                            const perms = JSON.parse(r.permissions || '[]');
                                            const isCore = ['ADMIN', 'STAFF', 'CASHIER'].includes(r.name);
                                            return (
                                                <tr key={r.id}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <Key size={18} style={{ color: 'var(--accent)' }} />
                                                            <strong>{r.name}</strong>
                                                            {isCore && <span style={{ padding: '2px 6px', background: 'var(--bg-hover)', color: 'var(--text-muted)', fontSize: '0.7rem', borderRadius: '4px' }}>CORE</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: 'var(--text-muted)' }}>
                                                            {perms.includes('*') ? 'Full Access (All)' : `${perms.length} Modules`}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button className="btn-icon btn-edit" onClick={() => openRoleModal(r)} title="Edit Role"><Edit3 size={16} /></button>
                                                            {!isCore && <button className="btn-icon btn-delete" onClick={() => deleteRole(r)} title="Delete Role"><Trash2 size={16} /></button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
            </main>
        </div>
    );
}
