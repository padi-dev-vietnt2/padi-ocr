const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const uploadForm = document.getElementById('uploadForm');
const loading = document.getElementById('loading');
const resultSection = document.getElementById('resultSection');
const errorMessage = document.getElementById('errorMessage');
const submitBtn = document.getElementById('submitBtn');

// Modal elements
const modal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');
const previewThumbnail = document.getElementById('previewThumbnail');

// Global variable to store the detected currency
let detectedCurrency = 'USD'; // Default fallback

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = `Selected: ${file.name}`;
        submitBtn.style.display = 'inline-block';

        // Show image preview
        const imagePreview = document.getElementById('imagePreview');
        const previewThumbnail = document.getElementById('previewThumbnail');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewThumbnail.src = event.target.result;
                imagePreview.classList.add('active');
            };
            reader.readAsDataURL(file);
        } else {
            // Hide preview for non-image files (PDFs)
            imagePreview.classList.remove('active');
        }
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
        const response = await fetch(`/upload?provider=${provider}`, {
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

    // Set the detected currency from the data (default to USD if not provided)
    detectedCurrency = normalizedData.currency || 'USD';
    console.log('Detected currency:', detectedCurrency);

    // Create organized sections
    let html = '';
    console.log('Building HTML sections...');
    console.log('Data keys:', Object.keys(normalizedData));

    // Use normalizedData instead of data
    data = normalizedData;

    // Document Information Section
    if (data.invoiceNumber || data.invoiceDate || data.dueDate || data.orderDate || data.currency) {
        html += '<div class="info-section">';
        html += '<h2 class="section-title">📋 Document Information</h2>';
        html += '<div class="info-card">';
        if (data.invoiceNumber) html += createInfoRow('Invoice Number', data.invoiceNumber);
        if (data.invoiceDate) html += createInfoRow('Invoice Date', formatDate(data.invoiceDate));
        if (data.orderDate) html += createInfoRow('Order Date', formatDate(data.orderDate));
        if (data.dueDate) html += createInfoRow('Due Date', formatDate(data.dueDate));
        if (data.currency) html += createInfoRow('Currency', data.currency);
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

        const allHeaders = Object.keys(data.items[0]);

        // Check which columns have any non-null/non-empty values
        let visibleHeaders = allHeaders.filter(header => {
            const lowerHeader = header.toLowerCase();
            const isTaxColumn = lowerHeader.includes('tax');

            if (!isTaxColumn) {
                return true; // Show all non-tax columns
            }

            // For tax columns, check if any item has a value
            return data.items.some(item => {
                const value = item[header];
                return value !== null && value !== undefined && value !== '' && value !== 0;
            });
        });

        // Remove existing item number column if present
        const itemNumberIndex = visibleHeaders.findIndex(header =>
            header.toLowerCase().includes('item') && header.toLowerCase().includes('number')
        );
        if (itemNumberIndex >= 0) {
            visibleHeaders.splice(itemNumberIndex, 1);
        }

        // Add auto-generated item number header at the first position
        html += '<th>No.</th>';
        visibleHeaders.forEach(header => {
            html += `<th>${formatHeader(header)}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.items.forEach((item, index) => {
            html += '<tr>';
            // Add auto-generated item number
            html += `<td class="numeric">${index + 1}</td>`;
            visibleHeaders.forEach(header => {
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
    if (lowerHeader.includes('price') || lowerHeader.includes('total') || lowerHeader.includes('discount') || lowerHeader.includes('tax')) {
        return formatCurrency(value);
    }

    return value;
}

function formatCurrency(value) {
    if (typeof value === 'number') {
        // Map currency codes to appropriate locales for better formatting
        const currencyLocaleMap = {
            'USD': 'en-US',
            'EUR': 'de-DE',
            'GBP': 'en-GB',
            'JPY': 'ja-JP',
            'CNY': 'zh-CN',
            'VND': 'vi-VN',
            'KRW': 'ko-KR',
            'THB': 'th-TH',
            'SGD': 'en-SG',
            'AUD': 'en-AU',
            'CAD': 'en-CA',
            'INR': 'en-IN',
            'MYR': 'ms-MY',
            'PHP': 'en-PH',
            'IDR': 'id-ID'
        };

        const locale = currencyLocaleMap[detectedCurrency] || 'en-US';

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: detectedCurrency
            }).format(value);
        } catch (error) {
            // Fallback to USD if currency code is invalid
            console.warn(`Invalid currency code: ${detectedCurrency}, falling back to USD`);
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(value);
        }
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
    // The new Gemini structured output already returns flattened camelCase data
    // We just need to ensure compatibility with old format if needed
    console.log('Normalizing invoice data...');
    console.log('Input data keys:', Object.keys(data));

    // Check if data is already in the new flat format (has items array at top level)
    if (data.items && Array.isArray(data.items)) {
        console.log('Data is in new flat format, items count:', data.items.length);
        return data;
    }

    // Legacy format handling - uppercase keys with nested structure
    const normalized = {};
    const keyMap = {
        'DOCUMENT_INFORMATION': 'documentInfo',
        'DOCUMENT INFORMATION': 'documentInfo',
        'PROVIDER_VENDOR_INFORMATION': 'providerInfo',
        'PROVIDER/VENDOR_INFORMATION': 'providerInfo',
        'PROVIDER/VENDOR INFORMATION': 'providerInfo',
        'CUSTOMER_BUYER_INFORMATION': 'customerInfo',
        'CUSTOMER/BUYER_INFORMATION': 'customerInfo',
        'CUSTOMER/BUYER INFORMATION': 'customerInfo',
        'LINE_ITEMS': 'items',
        'LINE ITEMS': 'items',
        'FINANCIAL_SUMMARY': 'financialSummary',
        'FINANCIAL SUMMARY': 'financialSummary',
        'PAYMENT_INFORMATION': 'paymentInfo',
        'PAYMENT INFORMATION': 'paymentInfo',
        'ADDITIONAL_INFORMATION': 'additionalInfo',
        'ADDITIONAL INFORMATION': 'additionalInfo'
    };

    // Check if data has any uppercase keys (old Gemini format)
    const hasUppercaseKeys = Object.keys(data).some(key => keyMap[key]);

    if (!hasUppercaseKeys) {
        // Data is already in camelCase format, return as-is
        console.log('Data already in camelCase format');
        return data;
    }

    // Handle old uppercase format
    console.log('Converting old uppercase format to flat format');
    Object.keys(data).forEach(key => {
        if (keyMap[key]) {
            const section = data[key];

            // Special handling for LINE_ITEMS or LINE ITEMS (with space)
            if (key === 'LINE_ITEMS' || key === 'LINE ITEMS') {
                // Check if section is an array directly or has nested 'items' property
                if (Array.isArray(section)) {
                    normalized['items'] = section;
                } else if (section && section.items && Array.isArray(section.items)) {
                    normalized['items'] = section.items;
                } else {
                    normalized['items'] = [];
                }
                console.log('LINE_ITEMS found, items count:', normalized['items'].length);
            } else if (section && typeof section === 'object' && !Array.isArray(section)) {
                // Flatten nested objects into main data
                Object.keys(section).forEach(innerKey => {
                    normalized[innerKey] = section[innerKey];
                });
            }
        } else if (key.startsWith('_')) {
            // Preserve internal keys like _tokenUsage, _provider
            normalized[key] = data[key];
        }
    });

    console.log('Normalization complete');
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

// Modal functionality
// Open modal when clicking the preview thumbnail
previewThumbnail.addEventListener('click', function() {
    if (this.src) {
        modalImage.src = this.src;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
});

// Close modal when clicking the X button
modalClose.addEventListener('click', function() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto'; // Restore scrolling
});

// Close modal when clicking outside the image
modal.addEventListener('click', function(e) {
    if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
});
