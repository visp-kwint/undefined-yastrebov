// Функции для отображения отчётов в чате

function isReportCommand(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('отчёт') || lower.includes('отчет') || 
           lower.includes('диаграмма') || lower.includes('график') ||
           lower.includes('сделай отчёт') || lower.includes('генерация отчёта') ||
           lower.includes('report') || lower.includes('chart') ||
           lower.includes('excel') || lower.includes('эксель') ||
           lower.includes('pdf');
}

function renderTable(tableData) {
    let html = '<div class="report-table-container">';
    html += '<h4 class="report-table-title">' + (tableData.title || 'Таблица') + '</h4>';
    html += '<table class="report-table">';

    html += '<thead><tr>';
    tableData.headers.forEach(header => {
        html += '<th>' + header + '</th>';
    });
    html += '</tr></thead>';

    html += '<tbody>';
    tableData.rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            html += '<td>' + cell + '</td>';
        });
        html += '</tr>';
    });

    if (tableData.totals) {
        html += '<tr class="report-total">';
        tableData.totals.forEach(total => {
            html += '<td><strong>' + total + '</strong></td>';
        });
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
}

function renderImage(imageData) {
    const src = imageData.dataUrl || imageData.url || imageData.base64;
    return '<div class="report-image-container">' +
           '<img src="' + src + '" alt="' + (imageData.name || 'Диаграмма') + '" class="report-image">' +
           '</div>';
}

function renderAttachments(files) {
    if (!files || !files.length) return '';

    let html = '<div class="report-attachments">';
    html += '<h4 class="report-attachments-title">📎 Файлы для скачивания:</h4>';
    html += '<div class="report-files">';

    files.forEach(file => {
        const icon = file.type === 'pdf' ? '📕' : 
                     file.type === 'excel' ? '📗' : 
                     file.type === 'image' ? '🖼️' : '📎';
        html += '<a href="' + file.url + '" download class="report-file-link">' +
                '<span class="report-file-icon">' + icon + '</span>' +
                '<span class="report-file-name">' + file.name + '</span>' +
                '</a>';
    });

    html += '</div></div>';
    return html;
}

function renderReport(reportData) {
    let html = '<div class="report-card">';
    html += '<div class="report-header">';
    html += '<h3 class="report-title">📊 Отчёт</h3>';
    html += '</div>';
    html += '<div class="report-body">';

    if (reportData.text) {
        html += '<p class="report-text">' + reportData.text + '</p>';
    }

    if (reportData.tables && reportData.tables.length) {
        reportData.tables.forEach(table => {
            html += renderTable(table);
        });
    }

    if (reportData.images && reportData.images.length) {
        reportData.images.forEach(img => {
            html += renderImage(img);
        });
    }

    if (reportData.attachments && reportData.attachments.length) {
        html += renderAttachments(reportData.attachments);
    }

    if (reportData.files && reportData.files.length) {
        html += renderAttachments(reportData.files);
    }

    html += '</div></div>';
    return html;
}

async function generateReport(documentId, type) {
    try {
        const res = await fetch('/api/reports/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId, type })
        });

        if (res.ok) {
            const data = await res.json();
            return data.data || data;
        } else {
            throw new Error('Ошибка генерации отчёта');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        return null;
    }
}