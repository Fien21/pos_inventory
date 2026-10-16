const fs = require('fs');
const path = require('path');

const dir = 'h:/Website_History/AztechFiles/pos_inventory_Folders/pos_inventory/client/src/pages';
const files = [
    'Audits.tsx', 'Categories.tsx', 'Customers.tsx', 'ProductForm.tsx', 
    'Reports.tsx', 'SalesHistory.tsx', 'Settings.tsx', 'Shifts.tsx', 
    'StockPurchase.tsx', 'Suppliers.tsx'
];

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace the first <div className="page"> with <div className="flex flex-col h-full bg-[#f8fafc]">
    content = content.replace(/<div className="page">/g, '<div className="flex flex-col h-full bg-[#f8fafc]">');
    
    // In Reports.tsx, there's a Loading Reports... which is <div className="page" style={...}>
    content = content.replace(/<div className="page" style={{([^}]+)}}>/g, '<div className="flex flex-col h-full bg-[#f8fafc]" style={{$1}}>');

    // We need to replace the page-header. We can search for <div className="page-header">
    // and replace it with <header className="..."> and also replace its closing </div> with </header>
    // However, keeping it as <div> with the tailwind classes is also fine and easier to avoid tag mismatch.
    // Let's replace `<div className="page-header">` with `<header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">`
    // Then we need to find the matching closing </div> and replace it with </header>
    // Since regex matching nested divs is hard, let's use a simple state machine or careful replacement.

    // A simpler way: we know page-header has no nested divs inside its top level other than <div>, <button>, etc.
    // Actually we can just leave it as <div className="page-header"> and change CSS, but to be exactly like Inventory, let's replace in CSS.
});
