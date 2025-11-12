const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const uploadForm = document.getElementById('uploadForm');
const loading = document.getElementById('loading');
const resultSection = document.getElementById('resultSection');
const errorMessage = document.getElementById('errorMessage');
const submitBtn = document.getElementById('submitBtn');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = `Selected: ${file.name}`;
        submitBtn.style.display = 'inline-block';
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
        showError('Please select a file');
        return;
    }

    // Get selected provider from dropdown
    const provider = document.getElementById('providerSelect').value;

    const formData = new FormData();
    formData.append('file', file);

    loading.classList.add('active');
    resultSection.classList.remove('active');
    errorMessage.innerHTML = '';

    // Hide token usage section on new upload
    const tokenUsageSection = document.getElementById('tokenUsage');
    if (tokenUsageSection) {
        tokenUsageSection.style.display = 'none';
    }

    try {
        const response = await fetch(`/api/ocr/upload?provider=${provider}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received data:', data);
        displayResults(data);

    } catch (error) {
        console.error('Upload error:', error);
        showError(`Error processing invoice: ${error.message}`);
    } finally {
        loading.classList.remove('active');
    }
});

function displayResults(data) {
    console.log('displayResults called with:', data);
    console.log('Data type:', typeof data);
    console.log('Is array?', Array.isArray(data));

    const invoiceContent = document.getElementById('invoiceContent');
    if (!invoiceContent) {
        console.error('invoiceContent element not found!');
        return;
    }

    invoiceContent.innerHTML = '';

    if (!data || typeof data !== 'object') {
        console.error('Invalid data:', data);
        showError('Invalid data format received from server');
        return;
    }

    // Extract and display token usage if available
    if (data._tokenUsage) {
        displayTokenUsage(data._tokenUsage, data._provider);
    }

    // If data is an array, treat it as line items only
    if (Array.isArray(data)) {
        console.log('Data is array with', data.length, 'items');
        data = { items: data };
    }

    // Normalize data structure - handle both camelCase and UPPERCASE_WITH_UNDERSCORES
    const normalizedData = normalizeInvoiceData(data);
    console.log('Normalized data:', normalizedData);

    // Create organized sections
    let html = '';
    console.log('Building HTML sections...');
    console.log('Data keys:', Object.keys(normalizedData));

    // Use normalizedData instead of data
    data = normalizedData;

    // Document Information Section
    if (data.invoiceNumber || data.invoiceDate || data.dueDate || data.orderDate) {
        html += '<div class="info-section">';
        html += '<h2 class="section-title">📋 Document Information</h2>';
        html += '<div class="info-card">';
        if (data.invoiceNumber) html += createInfoRow('Invoice Number', data.invoiceNumber);
        if (data.invoiceDate) html += createInfoRow('Invoice Date', formatDate(data.invoiceDate));
        if (data.orderDate) html += createInfoRow('Order Date', formatDate(data.orderDate));
        if (data.dueDate) html += createInfoRow('Due Date', formatDate(data.dueDate));
        html += '</div></div>';
    }

    // Provider and Customer Information
    html += '<div class="info-section">';
    html += '<h2 class="section-title">👥 Parties Information</h2>';
    html += '<div class="info-grid">';

    // Provider Card
    if (data.providerName || data.providerAddress || data.providerPhone || data.providerEmail || data.providerTaxId) {
        html += '<div class="info-card">';
        html += '<h3>🏢 Provider / Vendor</h3>';
        if (data.providerName) html += createInfoRow('Name', data.providerName);
        if (data.providerAddress) html += createInfoRow('Address', data.providerAddress);
        if (data.providerPhone) html += createInfoRow('Phone', data.providerPhone);
        if (data.providerEmail) html += createInfoRow('Email', data.providerEmail);
        if (data.providerTaxId) html += createInfoRow('Tax ID', data.providerTaxId);
        html += '</div>';
    }

    // Customer Card
    if (data.customerName || data.customerAddress || data.customerPhone || data.customerEmail || data.customerTaxId) {
        html += '<div class="info-card">';
        html += '<h3>👤 Customer / Buyer</h3>';
        if (data.customerName) html += createInfoRow('Name', data.customerName);
        if (data.customerAddress) html += createInfoRow('Address', data.customerAddress);
        if (data.customerPhone) html += createInfoRow('Phone', data.customerPhone);
        if (data.customerEmail) html += createInfoRow('Email', data.customerEmail);
        if (data.customerTaxId) html += createInfoRow('Tax ID', data.customerTaxId);
        html += '</div>';
    }

    html += '</div></div>';

    // Line Items Table
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        html += '<div class="info-section">';
        html += '<h2 class="section-title">🛒 Line Items</h2>';
        html += '<div class="table-container">';
        html += '<table><thead><tr>';

        const headers = Object.keys(data.items[0]);
        headers.forEach(header => {
            html += `<th>${formatHeader(header)}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.items.forEach(item => {
            html += '<tr>';
            headers.forEach(header => {
                const value = item[header];
                const isNumeric = typeof value === 'number' || header.includes('Price') || header.includes('Total') || header.includes('quantity');
                html += `<td class="${isNumeric ? 'numeric' : ''}">${formatValue(value, header)}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div></div>';
    }

    // Financial Summary
    if (data.subtotal || data.taxAmount || data.total || data.discount || data.shippingCost) {
        html += '<div class="info-section">';
        html += '<h2 class="section-title">💰 Financial Summary</h2>';
        html += '<div class="info-card">';
        if (data.subtotal) html += createInfoRow('Subtotal', formatCurrency(data.subtotal));
        if (data.discount) html += createInfoRow('Discount', formatCurrency(data.discount));
        if (data.taxRate) html += createInfoRow('Tax Rate', `${data.taxRate}%`);
        if (data.taxAmount) html += createInfoRow('Tax Amount', formatCurrency(data.taxAmount));
        if (data.shippingCost) html += createInfoRow('Shipping Cost', formatCurrency(data.shippingCost));
        if (data.total) html += createInfoRow('Total', `<strong>${formatCurrency(data.total)}</strong>`);
        html += '</div></div>';
    }

    // Payment Information
    if (data.paymentMethod || data.paymentStatus || data.paymentTerms) {
        html += '<div class="info-section">';
        html += '<h2 class="section-title">💳 Payment Information</h2>';
        html += '<div class="info-card">';
        if (data.paymentMethod) html += createInfoRow('Payment Method', data.paymentMethod);
        if (data.paymentStatus) html += createInfoRow('Payment Status', formatPaymentStatus(data.paymentStatus));
        if (data.paymentTerms) html += createInfoRow('Payment Terms', data.paymentTerms);
        html += '</div></div>';
    }

    // Additional Notes
    if (data.notes || data.terms) {
        html += '<div class="info-section">';
        html += '<h2 class="section-title">📝 Additional Information</h2>';
        html += '<div class="info-card">';
        if (data.notes) html += createInfoRow('Notes', data.notes);
        if (data.terms) html += createInfoRow('Terms', data.terms);
        html += '</div></div>';
    }

    console.log('Generated HTML length:', html.length);
    console.log('Setting innerHTML and showing result section');

    invoiceContent.innerHTML = html;
    resultSection.classList.add('active');

    console.log('Result section classes:', resultSection.className);
    console.log('Display complete!');
}

function createInfoRow(label, value) {
    return `
        <div class="info-row">
            <div class="info-label">${label}:</div>
            <div class="info-value">${value || '-'}</div>
        </div>
    `;
}

function formatHeader(header) {
    return header
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function formatValue(value, header) {
    if (value === null || value === undefined) return '-';

    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes('price') || lowerHeader.includes('total') || lowerHeader.includes('discount')) {
        return formatCurrency(value);
    }

    return value;
}

function formatCurrency(value) {
    if (typeof value === 'number') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }
    return value;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return dateString;
    }
}

function formatPaymentStatus(status) {
    const statusLower = status.toLowerCase();
    let badgeClass = 'badge-info';

    if (statusLower.includes('paid') || statusLower.includes('complete')) {
        badgeClass = 'badge-success';
    } else if (statusLower.includes('pending') || statusLower.includes('partial')) {
        badgeClass = 'badge-warning';
    }

    return `<span class="badge ${badgeClass}">${status}</span>`;
}

function normalizeInvoiceData(data) {
    // Handle uppercase keys from Gemini API response
    const normalized = {};

    // Map uppercase keys to camelCase
    const keyMap = {
        'DOCUMENT_INFORMATION': 'documentInfo',
        'PROVIDER_VENDOR_INFORMATION': 'providerInfo',
        'CUSTOMER_BUYER_INFORMATION': 'customerInfo',
        'LINE_ITEMS': 'items',
        'FINANCIAL_SUMMARY': 'financialSummary',
        'PAYMENT_INFORMATION': 'paymentInfo',
        'ADDITIONAL_INFORMATION': 'additionalInfo'
    };

    // First, check if data has uppercase keys
    Object.keys(data).forEach(key => {
        if (keyMap[key]) {
            const section = data[key];

            // Special handling for LINE_ITEMS - keep as 'items' array
            if (key === 'LINE_ITEMS') {
                normalized['items'] = Array.isArray(section) ? section : [];
                console.log('LINE_ITEMS found, items count:', normalized['items'].length);
            } else if (section && typeof section === 'object' && !Array.isArray(section)) {
                // Flatten nested objects into main data
                Object.keys(section).forEach(innerKey => {
                    normalized[innerKey] = section[innerKey];
                });
            }
        } else {
            // Keep original key if not in map
            normalized[key] = data[key];
        }
    });

    console.log('Normalization complete:', normalized);
    console.log('Items in normalized data:', normalized.items);
    return normalized;
}

function showError(message) {
    errorMessage.innerHTML = `<div class="error">${message}</div>`;
}

function displayTokenUsage(tokenUsage, provider) {
    const tokenUsageSection = document.getElementById('tokenUsage');
    const providerUsed = document.getElementById('providerUsed');
    const inputTokens = document.getElementById('inputTokens');
    const outputTokens = document.getElementById('outputTokens');
    const totalTokens = document.getElementById('totalTokens');

    if (tokenUsageSection && providerUsed && inputTokens && outputTokens && totalTokens) {
        providerUsed.textContent = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : '-';
        inputTokens.textContent = tokenUsage.inputTokens.toLocaleString();
        outputTokens.textContent = tokenUsage.outputTokens.toLocaleString();
        totalTokens.textContent = tokenUsage.totalTokens.toLocaleString();
        tokenUsageSection.style.display = 'block';
    }
}
