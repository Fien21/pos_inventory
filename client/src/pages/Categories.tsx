import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Plus, Edit3, Trash2, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Category {
    id: number;
    name: string;
    _count?: {
        products: number;
    };
}

export default function Categories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/categories');
            setCategories(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleSeedDefaults = async () => {
        const defaults = [
            "Beverages (Drinks)",
            "Snacks & Confectionery",
            "Packaged & Canned Goods",
            "Personal Care & Toiletries",
            "Household & Cleaning Supplies",
            "Fresh & Perishables (Dairy / Bakery)"
        ];
        
        const result = await Swal.fire({
            title: 'Generate Defaults?',
            text: 'This will add 6 standard retail categories.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#6c63ff',
            confirmButtonText: 'Yes, add them',
            background: '#1a1a2e',
            color: '#eee',
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                for (const name of defaults) {
                    await axios.post('/api/categories', { name });
                }
                Swal.fire({
                    icon: 'success', title: 'Done!', text: 'Default categories added.',
                    background: '#1a1a2e', color: '#eee', timer: 1500, showConfirmButton: false
                });
                fetchCategories();
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to add defaults.', background: '#1a1a2e', color: '#eee' });
                setLoading(false);
            }
        }
    };

    const handleAddCategory = async () => {
        const { value: name } = await Swal.fire({
            title: 'Create Category',
            input: 'text',
            inputLabel: 'Category Name',
            inputPlaceholder: 'Enter category name...',
            showCancelButton: true,
            confirmButtonColor: '#6c63ff',
            cancelButtonColor: '#555',
            background: '#1a1a2e',
            color: '#eee',
            inputValidator: (value) => {
                if (!value) {
                    return 'Category name is required!';
                }
            }
        });

        if (name) {
            try {
                await axios.post('/api/categories', { name });
                Swal.fire({
                    icon: 'success',
                    title: 'Created!',
                    text: 'Category has been created.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
                fetchCategories();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Failed to create category.',
                    background: '#1a1a2e',
                    color: '#eee',
                });
            }
        }
    };

    const handleEditCategory = async (category: Category) => {
        const { value: name } = await Swal.fire({
            title: 'Edit Category',
            input: 'text',
            inputLabel: 'Category Name',
            inputValue: category.name,
            inputPlaceholder: 'Enter category name...',
            showCancelButton: true,
            confirmButtonColor: '#6c63ff',
            cancelButtonColor: '#555',
            background: '#1a1a2e',
            color: '#eee',
            inputValidator: (value) => {
                if (!value) {
                    return 'Category name is required!';
                }
            }
        });

        if (name && name !== category.name) {
            try {
                await axios.put(`/api/categories/${category.id}`, { name });
                Swal.fire({
                    icon: 'success',
                    title: 'Updated!',
                    text: 'Category name has been updated.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
                fetchCategories();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Failed to update category.',
                    background: '#1a1a2e',
                    color: '#eee',
                });
            }
        }
    };

    const handleDeleteCategory = async (category: Category) => {
        const productCount = category._count?.products || 0;
        let warningText = `Are you sure you want to delete "${category.name}"?`;
        if (productCount > 0) {
            warningText = `Warning: "${category.name}" contains ${productCount} products. Deleting it will leave these products without a valid category, or the operation may fail!`;
        }

        const result = await Swal.fire({
            title: 'Delete Category?',
            text: warningText,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff6b6b',
            cancelButtonColor: '#555',
            confirmButtonText: 'Yes, delete it',
            background: '#1a1a2e',
            color: '#eee',
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/categories/${category.id}`);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Category has been deleted.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
                fetchCategories();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Failed to delete category. Make sure it contains no products first.',
                    background: '#1a1a2e',
                    color: '#eee',
                });
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Category Management</h1>
                    <p className="text-[11px] text-slate-500 font-medium">{categories.length} categories</p>
                </div>
                <div className="flex gap-3">
                    <motion.button
                        className="btn btn-secondary border border-slate-300 px-4 py-2 rounded font-bold text-[13px] bg-slate-50 hover:bg-slate-100 flex items-center gap-2"
                        onClick={handleSeedDefaults}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Layers size={18} />
                        Load Defaults
                    </motion.button>
                    <motion.button
                        className="btn btn-primary bg-slate-900 text-white px-4 py-2 rounded font-bold text-[13px] flex items-center gap-2"
                        onClick={handleAddCategory}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Plus size={18} />
                        Add Category
                    </motion.button>
                </div>
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : categories.length === 0 ? (
                <div className="empty-state">
                    <Layers size={48} />
                    <h3>No categories found</h3>
                    <p>Create your first category to group your products</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Category Name</th>
                                    <th>Products Count</th>
                                    <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((c) => (
                                    <tr key={c.id}>
                                        <td style={{ fontWeight: '500' }}>{c.name}</td>
                                        <td>
                                            <span style={{
                                                padding: '4px 8px',
                                                background: 'rgba(108, 99, 255, 0.1)',
                                                border: '1px solid rgba(108, 99, 255, 0.2)',
                                                borderRadius: '6px',
                                                fontSize: '0.85em',
                                                color: '#6c63ff'
                                            }}>
                                                {c._count?.products || 0} products
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button className="btn-icon btn-edit" onClick={() => handleEditCategory(c)}>
                                                    <Edit3 size={16} />
                                                </button>
                                                <button className="btn-icon btn-delete" onClick={() => handleDeleteCategory(c)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </main>
        </div>
    );
}
