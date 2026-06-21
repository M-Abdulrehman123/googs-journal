/* ==========================================================================
   FOREX JOURNAL - CORE LOGIC & VISUALIZATIONS
   ========================================================================== */

// State Management
let startingCapital = 10000;
let trades = [];
let selectedTags = [];

// DOM Elements
const balanceInput = document.getElementById('starting-capital');
const tradeForm = document.getElementById('trade-form');
const tradesTableBody = document.getElementById('trades-table-body');
const psychTags = document.querySelectorAll('.psych-tag');
const searchInput = document.getElementById('search-trade');
const filterStatus = document.getElementById('filter-status');

// Metrics DOM
const metricEquity = document.getElementById('metric-equity');
const metricProfit = document.getElementById('metric-profit');
const metricWinrate = document.getElementById('metric-winrate');
const metricProfitFactor = document.getElementById('metric-profit-factor');
const metricTotalTrades = document.getElementById('metric-total-trades');

// Canvas Charts DOM
const equityCanvas = document.getElementById('equity-chart');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updateDashboard();
});

// Setup Listeners
function setupEventListeners() {
    // Starting Balance Change
    balanceInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
            startingCapital = val;
            saveData();
            updateDashboard();
        }
    });

    // Toggle psychological tags
    psychTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const tagValue = tag.getAttribute('data-tag');
            tag.classList.toggle('active');
            
            if (tag.classList.contains('active')) {
                selectedTags.push(tagValue);
            } else {
                selectedTags = selectedTags.filter(t => t !== tagValue);
            }
        });
    });

    // Toggle manual exit price visibility
    const outcomeSelect = document.getElementById('outcome');
    const manualExitGroup = document.getElementById('manual-exit-group');
    const exitPriceInput = document.getElementById('exit-price');

    outcomeSelect.addEventListener('change', () => {
        if (outcomeSelect.value === 'Manual') {
            manualExitGroup.style.display = 'block';
            exitPriceInput.setAttribute('required', 'true');
        } else {
            manualExitGroup.style.display = 'none';
            exitPriceInput.removeAttribute('required');
            exitPriceInput.value = '';
        }
    });

    // Form Submission
    tradeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const pair = document.getElementById('pair').value.toUpperCase();
        const action = document.getElementById('action').value;
        const lotSize = parseFloat(document.getElementById('lots').value);
        const entryPrice = parseFloat(document.getElementById('entry-price').value);
        const outcome = outcomeSelect.value;
        const stopLoss = parseFloat(document.getElementById('stop-loss').value) || null;
        const takeProfit = parseFloat(document.getElementById('take-profit').value) || null;
        const strategy = document.getElementById('strategy').value || 'Uncategorized';
        const dateInput = document.getElementById('trade-date').value;

        if (isNaN(lotSize) || isNaN(entryPrice)) {
            alert('Please fill in required numerical fields.');
            return;
        }

        // Calculate exit price based on outcome
        let exitPrice = null;
        let isClosed = outcome !== 'Open';

        if (isClosed) {
            if (outcome === 'TP') {
                exitPrice = takeProfit;
            } else if (outcome === 'SL') {
                exitPrice = stopLoss;
            } else if (outcome === 'BE') {
                exitPrice = entryPrice;
            } else if (outcome === 'Manual') {
                exitPrice = parseFloat(exitPriceInput.value);
                if (isNaN(exitPrice)) {
                    alert('Please enter a manual exit price.');
                    return;
                }
            }
        }

        const tradeDate = dateInput ? new Date(dateInput).toLocaleString() : new Date().toLocaleString();

        // Calculate PnL and Pips
        let pnl = 0;
        let pips = 0;
        let status = 'Open';

        if (isClosed) {
            const isJpy = pair.endsWith('JPY');
            const multiplier = isJpy ? 100 : 10000;
            const contractSize = isJpy ? 1000 : 100000;

            if (action === 'Buy') {
                pips = (exitPrice - entryPrice) * multiplier;
                pnl = (exitPrice - entryPrice) * lotSize * contractSize;
            } else {
                pips = (entryPrice - exitPrice) * multiplier;
                pnl = (entryPrice - exitPrice) * lotSize * contractSize;
            }

            status = pnl >= 0 ? 'Win' : 'Loss';
        }

        const newTrade = {
            id: Date.now().toString(),
            pair,
            action,
            lotSize,
            entryPrice,
            exitPrice,
            stopLoss,
            takeProfit,
            strategy,
            tags: [...selectedTags],
            date: tradeDate,
            pips: parseFloat(pips.toFixed(1)),
            pnl: parseFloat(pnl.toFixed(2)),
            status,
            outcome
        };

        trades.push(newTrade);
        saveData();
        updateDashboard();
        
        // Reset form
        tradeForm.reset();
        resetTags();
        manualExitGroup.style.display = 'none';
        exitPriceInput.removeAttribute('required');
    });

    // Table Filters
    searchInput.addEventListener('input', renderTradesList);
    filterStatus.addEventListener('change', renderTradesList);

    // Export PDF Report
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        generateAndExportPdf();
    });
}

// Build a professional standalone PDF document and export it
function generateAndExportPdf() {
    const template = document.getElementById('pdf-template');
    const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // --- Compute summary stats ---
    const closedTrades = trades.filter(t => t.status !== 'Open');
    const wins = closedTrades.filter(t => t.status === 'Win').length;
    const losses = closedTrades.filter(t => t.status === 'Loss').length;
    const openCount = trades.filter(t => t.status === 'Open').length;
    const winRate = closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(1) : '0.0';
    const netProfit = closedTrades.reduce((acc, t) => acc + t.pnl, 0);
    const netProfitStr = (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const gains = closedTrades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
    const lossesVal = Math.abs(closedTrades.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = lossesVal > 0 ? (gains / lossesVal).toFixed(2) : gains > 0 ? '∞' : '1.00';
    const equity = (startingCapital + netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // --- Build trade rows ---
    const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
    const tradeRowsHtml = sortedTrades.length === 0
        ? `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: #94a3b8; font-style: italic;">No trades logged yet.</td></tr>`
        : sortedTrades.map((t, i) => {
            const isWin = t.status === 'Win';
            const isOpen = t.status === 'Open';
            const pnlColor = isOpen ? '#64748b' : isWin ? '#047857' : '#be123c';
            const pnlText = isOpen ? '—' : (t.pnl >= 0 ? '+' : '') + '$' + t.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ` (${t.pips > 0 ? '+' : ''}${t.pips} pips)`;

            let outcomeLabel = 'OPEN', outcomeBg = '#dbeafe', outcomeColor = '#1d4ed8';
            if (t.outcome === 'TP')     { outcomeLabel = 'HIT TP';    outcomeBg = '#dcfce7'; outcomeColor = '#166534'; }
            else if (t.outcome === 'SL')    { outcomeLabel = 'HIT SL';    outcomeBg = '#fee2e2'; outcomeColor = '#991b1b'; }
            else if (t.outcome === 'BE')    { outcomeLabel = 'BREAKEVEN'; outcomeBg = '#fef9c3'; outcomeColor = '#854d0e'; }
            else if (t.outcome === 'Manual') { outcomeLabel = 'MANUAL';    outcomeBg = '#ede9fe'; outcomeColor = '#5b21b6'; }

            const actionBg   = t.action === 'Buy' ? '#dcfce7' : '#fee2e2';
            const actionColor = t.action === 'Buy' ? '#166534'  : '#991b1b';
            const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';

            return `<tr style="background: ${rowBg};">
                <td style="padding: 0.65rem 0.75rem; font-size: 0.78rem; color: #475569; white-space: nowrap;">${t.date}</td>
                <td style="padding: 0.65rem 0.75rem; font-weight: 700; color: #0f172a; font-size: 0.9rem;">${t.pair}</td>
                <td style="padding: 0.65rem 0.75rem;">
                    <span style="background:${actionBg}; color:${actionColor}; padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;">${t.action.toUpperCase()}</span>
                </td>
                <td style="padding: 0.65rem 0.75rem; color: #334155; font-size: 0.85rem;">${t.lotSize}</td>
                <td style="padding: 0.65rem 0.75rem; font-family: 'Fira Code', monospace; color: #334155; font-size: 0.82rem;">${t.entryPrice}</td>
                <td style="padding: 0.65rem 0.75rem; font-family: 'Fira Code', monospace; color: #334155; font-size: 0.82rem;">${t.exitPrice || '—'}</td>
                <td style="padding: 0.65rem 0.75rem; font-weight: 700; color: ${pnlColor}; font-size: 0.82rem;">${pnlText}</td>
                <td style="padding: 0.65rem 0.75rem; color: #475569; font-size: 0.8rem;">${t.strategy || '—'}</td>
                <td style="padding: 0.65rem 0.75rem; text-align: center;">
                    <span style="background:${outcomeBg}; color:${outcomeColor}; padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;">${outcomeLabel}</span>
                </td>
            </tr>`;
        }).join('');

    // --- Inject full document into template ---
    template.innerHTML = `
    <div style="background:#ffffff; padding: 0; margin: 0; font-family: 'Outfit', -apple-system, sans-serif;">

        <!-- HEADER BANNER -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 2rem 2.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #06b6d4;">
            <div>
                <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem;">
                    <div style="width: 10px; height: 10px; background: #06b6d4; border-radius: 50%;"></div>
                    <span style="color: #06b6d4; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;">Trading Journal Report</span>
                </div>
                <h1 style="color: #ffffff; font-size: 2rem; font-weight: 800; margin: 0; letter-spacing: -0.02em;">Goggs <span style="font-weight: 300; color: #94a3b8;">Journal</span></h1>
                <p style="color: #64748b; font-size: 0.8rem; margin: 0.35rem 0 0 0;">Position History · Performance Report</p>
            </div>
            <div style="text-align: right;">
                <div style="color: #94a3b8; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.25rem;">Generated</div>
                <div style="color: #e2e8f0; font-size: 0.9rem; font-weight: 500;">${now}</div>
                <div style="margin-top: 0.6rem; background: rgba(6,182,212,0.15); border: 1px solid #06b6d4; border-radius: 6px; padding: 0.3rem 0.75rem; display: inline-block;">
                    <span style="color: #06b6d4; font-size: 0.75rem; font-weight: 700;">CONFIDENTIAL</span>
                </div>
            </div>
        </div>

        <!-- SUMMARY STATS STRIP -->
        <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 1.25rem 2.5rem; display: flex; gap: 0; justify-content: space-between;">
            ${[
                { label: 'Account Balance',  value: '$' + equity,      color: '#0f172a' },
                { label: 'Net Profit / Loss', value: netProfitStr,      color: netProfit >= 0 ? '#047857' : '#be123c' },
                { label: 'Win Rate',          value: winRate + '%',     color: '#1d4ed8' },
                { label: 'Profit Factor',     value: profitFactor,      color: '#0f172a' },
                { label: 'Total Trades',      value: trades.length,     color: '#0f172a' },
                { label: 'Wins / Losses',     value: `${wins} / ${losses}`, color: '#0f172a' },
                { label: 'Open Positions',    value: openCount,         color: '#64748b' },
            ].map(s => `
                <div style="text-align: center; flex: 1; border-right: 1px solid #e2e8f0; padding: 0 1rem; last-child: none;">
                    <div style="color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.3rem;">${s.label}</div>
                    <div style="color: ${s.color}; font-size: 1.15rem; font-weight: 800;">${s.value}</div>
                </div>`).join('')}
        </div>

        <!-- TRADES TABLE -->
        <div style="padding: 1.75rem 2.5rem 2rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 2px solid #e2e8f0;">
                <div style="width: 3px; height: 1.2rem; background: linear-gradient(to bottom, #06b6d4, #8b5cf6); border-radius: 2px;"></div>
                <h2 style="font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.01em;">All Trade Entries</h2>
                <span style="margin-left: auto; background: #f1f5f9; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 20px; border: 1px solid #e2e8f0;">${trades.length} records</span>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="background: #0f172a;">
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; white-space: nowrap;">Date</th>
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Pair</th>
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Side</th>
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Lots</th>
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Entry</th>
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Exit</th>
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; white-space: nowrap;">Net PnL (Pips)</th>
                        <th style="padding: 0.75rem; text-align: left; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Setup</th>
                        <th style="padding: 0.75rem; text-align: center; color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Outcome</th>
                    </tr>
                </thead>
                <tbody style="border: 1px solid #e2e8f0;">
                    ${tradeRowsHtml}
                </tbody>
            </table>
        </div>

        <!-- FOOTER -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 0.9rem 2.5rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8; font-size: 0.72rem;">© Goggs Journal · Forex Trading Log</span>
            <span style="color: #06b6d4; font-size: 0.72rem; font-weight: 600;">goggs-journal.vercel.app</span>
        </div>

    </div>`;

    // Export the template
    const opt = {
        margin: 0,
        filename: 'Goggs_Journal_Report.pdf',
        image: { type: 'jpeg', quality: 0.99 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'px', format: [1100, 842], orientation: 'landscape', hotfixes: ['px_scaling'] }
    };

    html2pdf().set(opt).from(template).save().then(() => {
        // template stays hidden, nothing to clean up
    });
}

// Reset Tag Buttons
function resetTags() {
    selectedTags = [];
    psychTags.forEach(tag => tag.classList.remove('active'));
}

// Save to LocalStorage
function saveData() {
    localStorage.setItem('startingCapital', startingCapital.toString());
    localStorage.setItem('forexTrades', JSON.stringify(trades));
}

// Load from LocalStorage
function loadData() {
    const savedCapital = localStorage.getItem('startingCapital');
    if (savedCapital) {
        startingCapital = parseFloat(savedCapital);
        balanceInput.value = startingCapital;
    } else {
        balanceInput.value = startingCapital;
    }

    const savedTrades = localStorage.getItem('forexTrades');
    if (savedTrades) {
        trades = JSON.parse(savedTrades);
    }
}

// Delete Log Entry
window.deleteTrade = function(id) {
    if (confirm('Are you sure you want to delete this trade log?')) {
        trades = trades.filter(t => t.id !== id);
        saveData();
        updateDashboard();
    }
};

// Calculate and Update Dash Metrics
function updateDashboard() {
    const closedTrades = trades.filter(t => t.status !== 'Open');
    
    // Net profit
    const netProfit = closedTrades.reduce((acc, t) => acc + t.pnl, 0);
    const currentEquity = startingCapital + netProfit;
    
    // Total Trades count
    metricTotalTrades.textContent = trades.length;

    // Net Profit display
    metricProfit.textContent = (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    metricProfit.className = 'metric-val ' + (netProfit >= 0 ? 'text-profit' : 'text-loss');

    // Current Equity display
    metricEquity.textContent = '$' + currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Win Rate
    if (closedTrades.length > 0) {
        const wins = closedTrades.filter(t => t.status === 'Win').length;
        const winrate = (wins / closedTrades.length) * 100;
        metricWinrate.textContent = winrate.toFixed(1) + '%';
    } else {
        metricWinrate.textContent = '0.0%';
    }

    // Profit Factor (Gains / Losses)
    const gains = closedTrades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
    const losses = Math.abs(closedTrades.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
    
    if (losses > 0) {
        const pf = gains / losses;
        metricProfitFactor.textContent = pf.toFixed(2);
    } else {
        metricProfitFactor.textContent = gains > 0 ? 'Max (∞)' : '1.00';
    }

    renderTradesList();
    drawEquityCurve();
}

// Render dynamic tables
function renderTradesList() {
    tradesTableBody.innerHTML = '';
    
    const searchVal = searchInput.value.toLowerCase().trim();
    const statusFilterVal = filterStatus.value;

    const filteredTrades = trades.filter(t => {
        const matchesSearch = t.pair.toLowerCase().includes(searchVal) || t.strategy.toLowerCase().includes(searchVal);
        
        let matchesStatus = true;
        if (statusFilterVal === 'Wins') matchesStatus = t.status === 'Win';
        else if (statusFilterVal === 'Losses') matchesStatus = t.status === 'Loss';
        else if (statusFilterVal === 'Open') matchesStatus = t.status === 'Open';

        return matchesSearch && matchesStatus;
    });

    if (filteredTrades.length === 0) {
        tradesTableBody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="empty-state">
                        <i class="fa-solid fa-folder-open"></i>
                        <p>No trades logged matching your search filters.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Sort descending by date (newest first)
    const sortedTrades = [...filteredTrades].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTrades.forEach(trade => {
        const tr = document.createElement('tr');
        
        const isWin = trade.status === 'Win';
        const isOpen = trade.status === 'Open';
        
        let pnlText = '---';
        let pnlClass = '';
        if (!isOpen) {
            const sign = trade.pnl >= 0 ? '+' : '';
            pnlText = `${sign}$${trade.pnl.toLocaleString(undefined, {minimumFractionDigits: 2})} (${trade.pips > 0 ? '+' : ''}${trade.pips} pips)`;
            pnlClass = isWin ? 'text-profit font-weight-bold' : 'text-loss font-weight-bold';
        }

        // Render psychological tags
        const tagsHtml = trade.tags.map(tag => `<span class="table-tag">${tag}</span>`).join('');

        // Resolve detailed outcome label
        let outcomeLabel = 'OPEN';
        if (trade.outcome) {
            if (trade.outcome === 'TP') outcomeLabel = 'HIT TP';
            else if (trade.outcome === 'SL') outcomeLabel = 'HIT SL';
            else if (trade.outcome === 'BE') outcomeLabel = 'BREAKEVEN';
            else if (trade.outcome === 'Manual') outcomeLabel = 'MANUAL';
            else if (trade.outcome === 'Open') outcomeLabel = 'OPEN';
        } else {
            // Fallback for older saved trades
            outcomeLabel = trade.status.toUpperCase();
        }

        tr.innerHTML = `
            <td>${trade.date}</td>
            <td><strong style="color: var(--accent-cyber);">${trade.pair}</strong></td>
            <td><span class="badge ${trade.action === 'Buy' ? 'long' : 'short'}">${trade.action.toUpperCase()}</span></td>
            <td>${trade.lotSize} Lots</td>
            <td>${trade.entryPrice}</td>
            <td>${trade.exitPrice || '---'}</td>
            <td class="${pnlClass}">${pnlText}</td>
            <td><span style="font-family: var(--font-code); font-size: 0.8rem; background: rgba(255,255,255,0.03); padding: 0.2rem 0.4rem; border-radius: 4px;">${trade.strategy}</span></td>
            <td><div class="table-tags">${tagsHtml || 'None'}</div></td>
            <td><span class="badge-outcome ${trade.status.toLowerCase()}">${outcomeLabel}</span></td>
            <td>
                <button class="btn-delete" onclick="deleteTrade('${trade.id}')" aria-label="Delete Trade Log">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tradesTableBody.appendChild(tr);
    });
}

// Draw Custom Canvas Equity Curve
function drawEquityCurve() {
    const ctx = equityCanvas.getContext('2d');
    
    // Scale for High DPI screens
    const width = equityCanvas.parentElement.clientWidth;
    const height = equityCanvas.parentElement.clientHeight;
    equityCanvas.width = width * window.devicePixelRatio;
    equityCanvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Calculate balance values
    const dataPoints = [startingCapital];
    let runningBalance = startingCapital;
    
    // Order trades chronological (oldest to newest) to draw curve
    const chronoTrades = [...trades]
        .filter(t => t.status !== 'Open')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    chronoTrades.forEach(t => {
        runningBalance += t.pnl;
        dataPoints.push(runningBalance);
    });

    // Layout configuration
    const paddingLeft = 60;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;
    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Render Grid Lines & Labels
    const minVal = Math.min(...dataPoints) * 0.98; // Add 2% buffer below
    const maxVal = Math.max(...dataPoints) * 1.02; // Add 2% buffer above
    const valueRange = maxVal - minVal;

    // Draw horizontal grid lines
    const gridLinesCount = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b'; // Label colors
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < gridLinesCount; i++) {
        const val = minVal + (valueRange * (i / (gridLinesCount - 1)));
        const y = height - paddingBottom - (graphHeight * (i / (gridLinesCount - 1)));
        
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();

        ctx.fillText(`$${Math.round(val)}`, paddingLeft - 10, y);
    }

    // Plot values
    const xStep = dataPoints.length > 1 ? graphWidth / (dataPoints.length - 1) : graphWidth;

    const points = dataPoints.map((val, idx) => {
        const x = paddingLeft + (idx * xStep);
        const y = height - paddingBottom - (graphHeight * ((val - minVal) / valueRange));
        return { x, y, val };
    });

    // Draw Area Gradient Fill
    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
        ctx.lineTo(points[0].x, height - paddingBottom);
        ctx.closePath();

        const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
        areaGrad.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
        areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Draw Line Curve
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        
        const lineGrad = ctx.createLinearGradient(paddingLeft, 0, width - paddingRight, 0);
        lineGrad.addColorStop(0, '#06b6d4');
        lineGrad.addColorStop(0.5, '#8b5cf6');
        lineGrad.addColorStop(1, '#10b981');
        
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw points highlight nodes
        points.forEach((p, idx) => {
            // Inner circle
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#070a13';
            ctx.fill();
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Outer glow node on hover / last node
            if (idx === points.length - 1) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
                ctx.fill();
            }
        });
    } else {
        // Draw standard empty placeholder line
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, height - paddingBottom - (graphHeight / 2));
        ctx.lineTo(width - paddingRight, height - paddingBottom - (graphHeight / 2));
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No closed trades logged to display equity curve.', width / 2, height / 2);
    }

    // Draw X-axis label indicators
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    if (points.length > 1) {
        ctx.fillText('Start', points[0].x, height - paddingBottom + 15);
        if (points.length > 2) {
            const midIdx = Math.floor(points.length / 2);
            ctx.fillText(`T${midIdx}`, points[midIdx].x, height - paddingBottom + 15);
        }
        ctx.fillText(`T${points.length - 1}`, points[points.length - 1].x, height - paddingBottom + 15);
    }
}
