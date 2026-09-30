import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Plus, Edit3, Trash2, Users, Shield, UserCheck, UserCog } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    rfidUid?: string;
}

export default function UserManagement() {
    const { emailDomain } = useBranding();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const openUserModal = async (user?: User) => {
        const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const EYE_OFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

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
              <option value="CASHIER" ${user?.role === 'CASHIER' ? 'selected' : ''}>Cashier</option>
              <option value="STAFF" ${user?.role === 'STAFF' ? 'selected' : ''}>Staff</option>
              <option value="ADMIN" ${user?.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
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
                
                // Append email domain automatically if not present
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
                    toggleBtn.addEventListener('mouseenter', () => {
                        toggleBtn.style.color = 'var(--text-primary)';
                    });
                    toggleBtn.addEventListener('mouseleave', () => {
                        toggleBtn.style.color = 'var(--text-secondary)';
                    });
                    toggleBtn.addEventListener('click', () => {
                        const isPassword = passwordInput.type === 'password';
                        passwordInput.type = isPassword ? 'text' : 'password';
                        toggleBtn.innerHTML = isPassword ? EYE_OFF_SVG : EYE_SVG;
                    });
                }

                let rfidBuffer = '';
                let lastKeyTime = Date.now();
                const handleKeyDown = (e: KeyboardEvent) => {
                    const now = Date.now();
                    if (now - lastKeyTime > 80) rfidBuffer = '';
                    lastKeyTime = now;
                    if (e.key === 'Enter' && rfidBuffer.length > 2) {
                        const rfidInput = document.getElementById('swal-rfid') as HTMLInputElement;
                        if (rfidInput) rfidInput.value = rfidBuffer;
                        rfidBuffer = '';
                    } else if (e.key.length === 1) {
                        rfidBuffer += e.key;
                    }
                };
                window.addEventListener('keydown', handleKeyDown);
                (Swal as any)._customKeydown = handleKeyDown;
            },
            willClose: () => {
                if ((Swal as any)._customKeydown) {
                    window.removeEventListener('keydown', (Swal as any)._customKeydown);
                }
            },
        });

        if (formValues) {
            try {
                const data: any = { name: formValues.name, email: formValues.email, role: formValues.role };
                if (formValues.password) data.password = formValues.password;
                if (formValues.rfidUid) data.rfidUid = formValues.rfidUid;
                if (formValues.posPin) data.posPin = formValues.posPin;

                if (user) {
                    await axios.put(`/api/users/${user.id}`, data);
                } else {
                    await axios.post('/api/users', data);
                }

                Swal.fire({
                    icon: 'success',
                    title: user ? 'Updated!' : 'Created!',
                    timer: 1500,
                    showConfirmButton: false,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                });
                fetchUsers();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Something went wrong',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent)',
                });
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
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            confirmButtonText: 'Yes, Delete'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/users/${user.id}`);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    timer: 1500,
                    showConfirmButton: false,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                });
                fetchUsers();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Something went wrong',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent)',
                });
            }
        }
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>User Management</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Control system user access levels</p>
                </div>
                <button className="btn btn-primary" onClick={() => openUserModal()}>
                    <Plus size={18} /> Add User
                </button>
            </div>

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : (
                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
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
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: 'var(--bg-hover)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--accent)',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <strong>{u.name}</strong>
                                            </div>
                                        </td>
                                        <td>{u.email}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {u.role === 'ADMIN' ? (
                                                    <Shield size={16} style={{ color: 'var(--accent)' }} />
                                                ) : u.role === 'STAFF' ? (
                                                    <UserCog size={16} style={{ color: 'var(--green)' }} />
                                                ) : (
                                                    <UserCheck size={16} style={{ color: 'var(--text-secondary)' }} />
                                                )}
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    color: u.role === 'ADMIN' ? 'var(--accent)' : u.role === 'STAFF' ? 'var(--green)' : 'var(--text-secondary)'
                                                }}>{u.role}</span>
                                            </div>
                                        </td>
                                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button className="btn-icon btn-edit" onClick={() => openUserModal(u)} title="Edit User">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button className="btn-icon btn-delete" onClick={() => deleteUser(u)} title="Delete User">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
