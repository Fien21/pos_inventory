const fs = require('fs');
const path = require('path');

const dir = 'h:/Website_History/AztechFiles/pos_inventory_Folders/pos_inventory/client/src/pages';
const files = [
    'Audits.tsx', 'Categories.tsx', 'Customers.tsx', 'ProductForm.tsx', 
    'Reports.tsx', 'SalesHistory.tsx', 'Settings.tsx', 'Shifts.tsx', 
    'StockPurchase.tsx', 'Suppliers.tsx', 'Support.tsx'
];

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (file === 'Reports.tsx') {
        content = content.replace(/<div className="page" style={{([^}]+)}}>/g, '<div className="flex flex-col h-full bg-[#f8fafc]" style={{$1}}>');
    }

    if (file === 'Support.tsx') {
        content = content.replace(/<div className="page-container animate-fade-in">/, '<div className="flex flex-col h-full bg-[#f8fafc]">');
    } else {
        content = content.replace(/<div className="page">/, '<div className="flex flex-col h-full bg-[#f8fafc]">');
    }

    const headerMatch = content.indexOf('<div className="page-header">');
    if (headerMatch !== -1) {
        // find matching closing div
        let i = headerMatch;
        let depth = 0;
        let startFound = false;
        let closingIdx = -1;
        while (i < content.length) {
            if (content.substring(i, i + 4) === '<div') {
                depth++;
                startFound = true;
            } else if (content.substring(i, i + 5) === '</div') {
                depth--;
                if (startFound && depth === 0) {
                    closingIdx = i;
                    break;
                }
            }
            i++;
        }

        if (closingIdx !== -1) {
            let beforeHeader = content.substring(0, headerMatch);
            let insideHeader = content.substring(headerMatch + '<div className="page-header">'.length, closingIdx);
            let afterHeader = content.substring(closingIdx + '</div>'.length);

            // Replace <h1> styling inside header
            insideHeader = insideHeader.replace(/<h1(.*?)>(.*?)<\/h1>/s, (match, p1, p2) => {
                if(p1.includes('className=')) {
                    return `<h1${p1} className="${p1.match(/className="([^"]+)"/)[1]} text-[20px] font-bold text-slate-900 tracking-tight">${p2}</h1>`.replace(/className="([^"]+)"\s+className="([^"]+)"/, 'className="$1 $2"');
                }
                return `<h1 className="text-[20px] font-bold text-slate-900 tracking-tight"${p1}>${p2}</h1>`;
            });
            
            insideHeader = insideHeader.replace(/<p>(.*?)<\/p>/s, '<p className="text-[11px] text-slate-500 font-medium">$1</p>');

            let newHeader = `<header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">` + insideHeader + `</header>\n            <main className="flex-1 p-5 overflow-y-auto w-full">`;
            
            // Now we need to append </main> before the last </div>
            let lastDivIdx = afterHeader.lastIndexOf('</div>');
            if (lastDivIdx !== -1) {
                afterHeader = afterHeader.substring(0, lastDivIdx) + '</main>\n        </div>' + afterHeader.substring(lastDivIdx + '</div>'.length);
            }
            
            content = beforeHeader + newHeader + afterHeader;
        }
    }
    fs.writeFileSync(filePath, content);
    console.log(`Processed ${file}`);
});
