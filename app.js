// Green Oops Smart Reviews System — Master Client Controller
// Multi-Module Automotive Analytics & Spring AI Assistant

const API = {
    vehicles: '/api/vehicles',
    health: '/api/health',
    risks: '/api/risks',
    reviews: '/api/reviews',
    ai: '/api/ai/chat',
    recommendations: '/api/recommendations',
    green: '/api/green-driving',
    notifications: '/api/notifications',
    reports: '/api/reports',
    analysis: '/api/analysis',
    authLogin: '/api/auth/login',
    authCurrent: '/api/auth/current',
    authLogout: '/api/auth/logout',
    driverInspection: '/api/driver/inspection',
    driverInspections: '/api/driver/inspections',
    databaseStatus: '/api/database/status',
    databaseTable: '/api/database/table',
    databaseReset: '/api/database/reset'
};

// Application State Store
let state = {
    vehicles: [],
    risks: [],
    riskReportsMap: {},
    currentHealthVehicleId: 1,
    currentReportVehicleId: 1,
    currentUser: null,
    currentRole: 'VEHICLE_OWNER',
    analysisData: null,
    driverInspections: [],
    currentDbTable: 'vehicles',
    selectedVehicleForDetails: null
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initEventListeners();
    initAuth();
    loadAllData();
});

// 1. Navigation & Tab Switching
function initNavigation() {
    const navButtons = document.querySelectorAll('#main-nav-menu .nav-item');
    const tabPages = document.querySelectorAll('.tab-page');
    const pageTitle = document.getElementById('current-page-title');
    const pageSubtitle = document.getElementById('current-page-subtitle');

    const pageMeta = {
        'tab-overview': { title: 'Fleet Overview & Command Center', sub: 'Real-time automotive telemetry, risk engine scoring, and AI assistance' },
        'tab-risk-analytics': { title: 'Vehicle Risk Analytics Dashboard', sub: 'Priority-segregated data tables: High (Table A), Medium (Table B), and Low (Table C)' },
        'tab-analysis': { title: 'Comprehensive Fleet Analysis Module', sub: 'Predictive component failure forecasting, remaining useful life (RUL), and driver safety scorecards' },
        'tab-driver-console': { title: 'Driver Pre-Trip Vehicle Safety Console', sub: 'Mandatory pre-trip roadworthiness verification checklist, defect reporting, and safety clearance' },
        'tab-vehicle-health': { title: 'Vehicle Health & Telemetry Diagnostics', sub: 'Comprehensive oil condition, individual tire monitoring, and powertrain telemetry' },
        'tab-smart-reviews': { title: 'Smart Review Intelligence Center', sub: 'AI sentiment analysis, common praise, frequent issues, and suspicious review radar' },
        'tab-ai-assistant': { title: 'Spring AI Customer Assistant', sub: 'Interactive grounded AI chatbot for vehicle queries, comparisons, and specs' },
        'tab-recommendations': { title: 'Vehicle Recommendation Engine', sub: 'Matched recommendations based on budget, usage, fuel preference, and safety' },
        'tab-green-driving': { title: 'Green Driving & Sustainability Center', sub: 'Quantified CO2 emissions analysis, eco-driving scorecards, and fleet decarbonization' },
        'tab-notifications': { title: 'Smart Alerts & Notification Center', sub: 'Automated warnings for critical diagnostics, tire pressures, and overdue servicing' },
        'tab-reports': { title: 'Official Vehicle Health Reports', sub: 'Executive diagnostics summary and printable PDF export for certified documentation' },
        'tab-database': { title: 'Database & Spring Data JPA Architecture', sub: 'Relational persistence engine, JPA entities, schema definitions, live table metrics, and interactive database exploration' }
    };

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            tabPages.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetPage = document.getElementById(targetId);
            if (targetPage) targetPage.classList.add('active');

            if (pageMeta[targetId]) {
                pageTitle.textContent = pageMeta[targetId].title;
                pageSubtitle.textContent = pageMeta[targetId].sub;
            }

            // Trigger tab specific refresh if needed
            if (targetId === 'tab-analysis') loadAnalysisModule();
            if (targetId === 'tab-driver-console') loadDriverConsole();
            if (targetId === 'tab-vehicle-health') loadVehicleHealth(state.currentHealthVehicleId);
            if (targetId === 'tab-smart-reviews') loadReviewIntelligence();
            if (targetId === 'tab-green-driving') loadGreenDriving();
            if (targetId === 'tab-notifications') loadNotifications();
            if (targetId === 'tab-reports') loadVehicleReport(state.currentReportVehicleId);
            if (targetId === 'tab-database') loadDatabaseTab();
        });
    });

    // Risk Table A/B/C Pills
    const pills = document.querySelectorAll('.pill-btn');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const targetWrapper = pill.getAttribute('data-risk-target');
            document.querySelectorAll('.risk-table-wrapper').forEach(w => w.classList.add('hidden-table'));
            const targetEl = document.getElementById(targetWrapper);
            if (targetEl) targetEl.classList.remove('hidden-table');
        });
    });
}

// 2. Event Listeners
function initEventListeners() {
    document.getElementById('btn-refresh').addEventListener('click', loadAllData);

    // Search and Filters on Overview
    document.getElementById('input-search').addEventListener('input', renderOverviewTable);
    document.getElementById('filter-risk').addEventListener('change', renderOverviewTable);
    document.getElementById('filter-fuel').addEventListener('change', renderOverviewTable);

    // Auth & Role Switcher
    document.getElementById('btn-switch-role').addEventListener('click', handleQuickRoleToggle);
    document.getElementById('btn-open-login').addEventListener('click', () => openModal('modal-auth-login'));
    document.getElementById('btn-close-auth-modal').addEventListener('click', () => closeModal('modal-auth-login'));
    document.getElementById('btn-cancel-auth').addEventListener('click', () => closeModal('modal-auth-login'));
    document.getElementById('btn-fill-owner').addEventListener('click', () => {
        document.getElementById('input-login-email').value = 'owner@greenoops.com';
        document.getElementById('input-login-password').value = 'Owner@123';
    });
    document.getElementById('btn-fill-driver').addEventListener('click', () => {
        document.getElementById('input-login-email').value = 'driver@greenoops.com';
        document.getElementById('input-login-password').value = 'Driver@123';
    });
    document.getElementById('form-login').addEventListener('submit', handleLoginSubmit);

    // Driver Pre-Trip Inspection Form
    document.getElementById('form-driver-inspection').addEventListener('submit', handleDriverInspectionSubmit);

    // Add Vehicle Modal
    document.getElementById('btn-open-add-vehicle').addEventListener('click', () => openModal('modal-add-vehicle'));
    document.getElementById('btn-close-add-modal').addEventListener('click', () => closeModal('modal-add-vehicle'));
    document.getElementById('btn-cancel-add').addEventListener('click', () => closeModal('modal-add-vehicle'));
    document.getElementById('form-add-vehicle').addEventListener('submit', handleAddVehicleSubmit);

    // Maintenance Service Modal
    const btnOpenMaint = document.getElementById('btn-open-add-maintenance');
    if (btnOpenMaint) btnOpenMaint.addEventListener('click', () => openAddMaintenanceModal());
    const btnCloseMaint = document.getElementById('btn-close-maint-modal');
    if (btnCloseMaint) btnCloseMaint.addEventListener('click', () => closeModal('modal-add-maintenance'));
    const btnCancelMaint = document.getElementById('btn-cancel-maint');
    if (btnCancelMaint) btnCancelMaint.addEventListener('click', () => closeModal('modal-add-maintenance'));
    const formMaint = document.getElementById('form-add-maintenance');
    if (formMaint) formMaint.addEventListener('submit', handleAddMaintenanceSubmit);

    // Vehicle Details Modal
    const btnCloseVd = document.getElementById('btn-close-vd-modal');
    if (btnCloseVd) btnCloseVd.addEventListener('click', () => closeModal('modal-vehicle-details'));
    const btnCloseVdFooter = document.getElementById('btn-close-vd-footer');
    if (btnCloseVdFooter) btnCloseVdFooter.addEventListener('click', () => closeModal('modal-vehicle-details'));
    const btnVdLogMaint = document.getElementById('btn-vd-log-maint');
    if (btnVdLogMaint) btnVdLogMaint.addEventListener('click', () => {
        closeModal('modal-vehicle-details');
        if (state.selectedVehicleForDetails) openAddMaintenanceModal(state.selectedVehicleForDetails.id);
    });
    const btnVdDeleteVeh = document.getElementById('btn-vd-delete-vehicle');
    if (btnVdDeleteVeh) btnVdDeleteVeh.addEventListener('click', () => {
        if (state.selectedVehicleForDetails) handleDeleteVehicle(state.selectedVehicleForDetails.id);
    });

    // Database Actions
    const btnDbRefresh = document.getElementById('btn-db-refresh');
    if (btnDbRefresh) btnDbRefresh.addEventListener('click', loadDatabaseTab);
    const btnReseedDb = document.getElementById('btn-reseed-db');
    if (btnReseedDb) btnReseedDb.addEventListener('click', handleReseedDatabase);

    // Review Modal
    document.getElementById('btn-open-add-review').addEventListener('click', () => openModal('modal-add-review'));
    document.getElementById('btn-close-review-modal').addEventListener('click', () => closeModal('modal-add-review'));
    document.getElementById('btn-cancel-review').addEventListener('click', () => closeModal('modal-add-review'));
    document.getElementById('form-submit-review').addEventListener('submit', handleAddReviewSubmit);

    // Vehicle Health Selector
    document.getElementById('select-health-vehicle').addEventListener('change', (e) => {
        state.currentHealthVehicleId = parseInt(e.target.value, 10);
        loadVehicleHealth(state.currentHealthVehicleId);
    });

    // Report Selector
    document.getElementById('select-report-vehicle').addEventListener('change', (e) => {
        state.currentReportVehicleId = parseInt(e.target.value, 10);
        loadVehicleReport(state.currentReportVehicleId);
    });

    // Recommender Form
    document.getElementById('form-recommender').addEventListener('submit', handleRecommenderSubmit);

    // AI Chat
    document.getElementById('form-ai-chat').addEventListener('submit', handleAiChatSubmit);
    document.querySelectorAll('.pill-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.getAttribute('data-prompt');
            document.getElementById('input-chat-query').value = prompt;
            handleAiChatSubmit(new Event('submit'));
        });
    });

    // Welcoming Banner & Voice Assistant Actions
    const bannerAskBtn = document.getElementById('btn-banner-ai-ask');
    if (bannerAskBtn) {
        bannerAskBtn.addEventListener('click', () => {
            const aiTabBtn = document.querySelector('[data-tab="tab-ai-assistant"]');
            if (aiTabBtn) aiTabBtn.click();
            const chatInput = document.getElementById('input-chat-query');
            if (chatInput) {
                chatInput.focus();
                chatInput.placeholder = "Ask an agriculture or smart fleet question...";
            }
        });
    }

    const voiceBtn = document.getElementById('btn-trigger-voice');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            const aiTabBtn = document.querySelector('[data-tab="tab-ai-assistant"]');
            if (aiTabBtn) aiTabBtn.click();
            showToast("Voice assistant activated. Listening for query...", "info");
        });
    }

    const weatherWidget = document.getElementById('widget-weather-area');
    if (weatherWidget) {
        weatherWidget.addEventListener('click', () => {
            showToast("Regional microclimate: 28°C, Humidity 64%, Wind 12 km/h NW. Soil moisture steady.", "info");
        });
    }

    const helpfulPlacesWidget = document.getElementById('widget-helpful-places');
    if (helpfulPlacesWidget) {
        helpfulPlacesWidget.addEventListener('click', () => {
            showToast("Navigating to Regional Agro & Fleet Centers...", "info");
        });
    }
}

// 3. Data Loading
async function loadAllData() {
    const startTime = performance.now();
    try {
        const [vehRes, riskSumRes, riskTablesRes, riskReportsRes] = await Promise.all([
            fetch(API.vehicles),
            fetch(`${API.risks}/summary`),
            fetch(`${API.risks}/tables`),
            fetch(`${API.vehicles}/risk-summary`)
        ]);

        state.vehicles = await vehRes.json();
        const riskSummary = await riskSumRes.json();
        const riskTables = await riskTablesRes.json();
        const riskReports = await riskReportsRes.json();

        state.riskReportsMap = {};
        if (Array.isArray(riskReports)) {
            riskReports.forEach(r => {
                if (r && r.vehicleId) state.riskReportsMap[r.vehicleId] = r;
            });
        }

        // Update Overview KPIs
        document.getElementById('kpi-total-vehicles').textContent = state.vehicles.length;
        document.getElementById('kpi-high-risk').textContent = riskSummary.highPriorityCount || 0;
        document.getElementById('kpi-medium-risk').textContent = riskSummary.mediumPriorityCount || 0;
        document.getElementById('kpi-low-risk').textContent = riskSummary.lowPriorityCount || 0;
        document.getElementById('kpi-overdue-service').textContent = riskSummary.overdueMaintenanceCount || 0;

        populateVehicleDropdowns();
        renderOverviewTable();
        renderRiskTables(riskTables);
        loadNotifications();

        const latency = Math.round(performance.now() - startTime);
        document.getElementById('system-status-indicator').textContent = `H2 Database & Engine Active (${latency}ms)`;
    } catch (err) {
        console.error('Data load error:', err);
        showToast('Error connecting to backend services: ' + err.message, 'error');
    }
}

function populateVehicleDropdowns() {
    const healthSelect = document.getElementById('select-health-vehicle');
    const reportSelect = document.getElementById('select-report-vehicle');
    const reviewSelect = document.getElementById('select-review-vehicle');
    const driverVehSelect = document.getElementById('insp-vehicle-select');
    const maintSelect = document.getElementById('select-maint-vehicle');

    const optionsHtml = state.vehicles.map(v =>
        `<option value="${v.id}">${v.modelName} (${v.registrationNumber})</option>`
    ).join('');

    healthSelect.innerHTML = optionsHtml;
    reportSelect.innerHTML = optionsHtml;
    reviewSelect.innerHTML = optionsHtml;
    if (driverVehSelect) driverVehSelect.innerHTML = optionsHtml;
    if (maintSelect) maintSelect.innerHTML = optionsHtml;

    if (state.vehicles.length > 0) {
        state.currentHealthVehicleId = state.vehicles[0].id;
        state.currentReportVehicleId = state.vehicles[0].id;
        loadVehicleHealth(state.currentHealthVehicleId);
        loadVehicleReport(state.currentReportVehicleId);
    }
}

// 4. Render Overview Table
function renderOverviewTable() {
    const search = document.getElementById('input-search').value.toLowerCase().trim();
    const riskFilter = document.getElementById('filter-risk').value;
    const fuelFilter = document.getElementById('filter-fuel').value;

    const filtered = state.vehicles.filter(v => {
        const matchSearch = !search ||
            v.registrationNumber.toLowerCase().includes(search) ||
            v.modelName.toLowerCase().includes(search) ||
            v.type.toLowerCase().includes(search);

        const matchFuel = fuelFilter === 'ALL' || (v.fuelType && v.fuelType.toLowerCase() === fuelFilter.toLowerCase());

        // Dynamic Risk level evaluation
        const report = state.riskReportsMap[v.id];
        const riskScore = report ? report.score : (v.lastServiceDate ? 15 : 45);
        const riskLevel = report ? report.level : (riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW');
        const matchRisk = riskFilter === 'ALL' || riskLevel.toUpperCase() === riskFilter.toUpperCase();

        return matchSearch && matchFuel && matchRisk;
    });

    document.getElementById('visible-count-badge').textContent = `${filtered.length} of ${state.vehicles.length} Units`;
    const tbody = document.getElementById('vehicle-table-body');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 2rem; color: var(--text-muted);">No vehicles match search / filter criteria.</td></tr>`;
        return;
    }

    filtered.forEach(v => {
        const tr = document.createElement('tr');
        const effUnit = v.fuelType === 'Electric' ? 'km/kWh' : 'km/L';
        const report = state.riskReportsMap[v.id];
        const riskScore = report ? report.score : (v.lastServiceDate ? 15 : 45);
        const riskLevel = report ? report.level : (riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW');
        const badgeClass = riskLevel === 'HIGH' ? 'badge-high' : riskLevel === 'MEDIUM' ? 'badge-medium' : 'badge-low';

        tr.innerHTML = `
            <td>#${v.id}</td>
            <td>
                <strong>${escapeHtml(v.modelName)}</strong>
                <div class="reg-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.4-.1.6v4.5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                    ${escapeHtml(v.registrationNumber)}
                </div>
            </td>
            <td><span class="badge badge-fuel">${escapeHtml(v.fuelType)}</span></td>
            <td>${v.year}</td>
            <td><strong>${(v.odometerKm || 0).toLocaleString()}</strong> km</td>
            <td>${v.fuelEfficiencyKmPerL} ${effUnit}</td>
            <td>${v.lastServiceDate || '<span class="text-red">None Recorded</span>'}</td>
            <td><strong style="font-family:var(--font-mono)">${riskScore}</strong> / 100</td>
            <td><span class="badge ${badgeClass}">${riskLevel}</span></td>
            <td class="text-right" style="white-space:nowrap">
                <button class="btn btn-sm btn-secondary" onclick="openVehicleDetailsModal(${v.id})" title="View complete vehicle specs & maintenance history">Specs</button>
                <button class="btn btn-sm btn-secondary" onclick="viewVehicleHealth(${v.id})" title="Telemetry health diagnostics">Health</button>
                <button class="btn btn-sm btn-primary" onclick="viewVehicleReport(${v.id})" title="Official certified report">Report</button>
                <button class="btn btn-sm btn-secondary" onclick="openAddMaintenanceModal(${v.id})" title="Log service event">Service</button>
                <button class="btn btn-sm btn-danger" onclick="handleDeleteVehicle(${v.id})" title="Delete vehicle">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 5. Render Risk Tables (A, B, C)
function renderRiskTables(tables) {
    const listA = tables.HIGH || [];
    const listB = tables.MEDIUM || [];
    const listC = tables.LOW || [];

    document.getElementById('badge-count-table-a').textContent = `${listA.length} Records`;
    document.getElementById('badge-count-table-b').textContent = `${listB.length} Records`;
    document.getElementById('badge-count-table-c').textContent = `${listC.length} Records`;

    renderRiskTableBody('tbody-table-a', listA);
    renderRiskTableBody('tbody-table-b', listB);
    renderRiskTableBody('tbody-table-c', listC);
}

function renderRiskTableBody(elementId, items) {
    const tbody = document.getElementById(elementId);
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records in this risk category.</td></tr>`;
        return;
    }

    items.forEach(r => {
        const tr = document.createElement('tr');
        const statusBadgeClass = r.status === 'Open' ? 'badge-status-open' :
                                 r.status === 'In Progress' ? 'badge-status-progress' : 'badge-status-resolved';

        tr.innerHTML = `
            <td>
                <strong>${r.vehicleModel}</strong><br>
                <span class="reg-tag">${r.registrationNumber}</span>
            </td>
            <td><span class="badge badge-neutral">${r.riskCategory}</span></td>
            <td><strong style="color:#fff">${r.detectedIssue}</strong></td>
            <td><span style="font-family:var(--font-mono); font-weight:700; color:#fff">${r.measuredValue}</span></td>
            <td>${r.expectedRange}</td>
            <td><strong style="font-family:var(--font-mono); color:${r.priority === 'HIGH' ? 'var(--color-red)' : r.priority === 'MEDIUM' ? 'var(--color-amber)' : 'var(--color-emerald)'}">${r.riskScore}</strong></td>
            <td style="max-width:220px; font-size:0.8rem; color:var(--text-secondary)">${r.reason}</td>
            <td style="max-width:220px; font-size:0.8rem; color:#fff">${r.recommendedAction}</td>
            <td style="font-size:0.75rem; color:var(--text-muted)">${r.detectedDate}</td>
            <td><span class="badge ${statusBadgeClass}">${r.status}</span></td>
            <td class="text-right">
                <select class="status-select-btn" onchange="handleUpdateRiskStatus(${r.id}, this.value)">
                    <option value="" disabled selected>Change Status</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.handleUpdateRiskStatus = async function(riskId, newStatus) {
    try {
        const res = await fetch(`${API.risks}/${riskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Status update failed');
        showToast(`Risk record #${riskId} updated to ${newStatus}`, 'success');
        const tablesRes = await fetch(`${API.risks}/tables`);
        const tables = await tablesRes.json();
        renderRiskTables(tables);
    } catch (e) {
        showToast(e.message, 'error');
    }
};

// 6. Vehicle Health Diagnostics & Tire Diagram
async function loadVehicleHealth(vehicleId) {
    try {
        const res = await fetch(`${API.health}/${vehicleId}`);
        if (!res.ok) throw new Error('Failed to load health telemetry');
        const h = await res.json();

        // Overall status
        const overallBadge = document.getElementById('health-overall-status-badge');
        overallBadge.textContent = h.overallHealthStatus;
        overallBadge.className = `badge ${h.overallHealthStatus === 'CRITICAL' ? 'badge-high' : h.overallHealthStatus === 'SERVICE_REQUIRED' ? 'badge-high' : h.overallHealthStatus === 'MONITOR' ? 'badge-medium' : 'badge-low'}`;
        document.getElementById('health-source-label').textContent = h.dataSource;

        // Oil Condition
        document.getElementById('val-oil-level').textContent = h.oilLevelPercent ? `${h.oilLevelPercent}%` : 'N/A (EV)';
        document.getElementById('val-oil-pressure').textContent = h.oilPressureStatus;
        document.getElementById('val-oil-condition').textContent = h.oilCondition;
        document.getElementById('val-oil-last').textContent = h.lastOilChange || 'N/A';
        document.getElementById('val-oil-next').textContent = h.nextOilChange || 'N/A';
        const oilBadge = document.getElementById('val-oil-status');
        oilBadge.textContent = h.oilMaintenanceStatus;
        oilBadge.className = `badge ${h.oilMaintenanceStatus === 'OVERDUE' ? 'badge-high' : h.oilMaintenanceStatus === 'DUE_SOON' ? 'badge-medium' : 'badge-low'}`;

        // Tires
        document.getElementById('val-tire-target-psi').textContent = `${h.recommendedTirePressurePsi} PSI`;
        setTireNode('node-tire-fl', 'val-tire-fl-psi', 'val-tire-fl-tread', h.tirePressureFlPsi, h.tireTreadFlMm, h.recommendedTirePressurePsi);
        setTireNode('node-tire-fr', 'val-tire-fr-psi', 'val-tire-fr-tread', h.tirePressureFrPsi, h.tireTreadFrMm, h.recommendedTirePressurePsi);
        setTireNode('node-tire-rl', 'val-tire-rl-psi', 'val-tire-rl-tread', h.tirePressureRlPsi, h.tireTreadRlMm, h.recommendedTirePressurePsi);
        setTireNode('node-tire-rr', 'val-tire-rr-psi', 'val-tire-rr-tread', h.tirePressureRrPsi, h.tireTreadRrMm, h.recommendedTirePressurePsi);
        document.getElementById('val-tire-status-note').textContent = `Tire wear and inspection status: ${h.tireInspectionStatus} (Tread Depth > 3.0mm required)`;

        // Powertrain & Electronics
        document.getElementById('val-coolant-temp').textContent = `${h.coolantTempCelsius}°C`;
        document.getElementById('val-battery-soh').textContent = `${h.batteryHealthPercent}%`;
        document.getElementById('val-battery-voltage').textContent = `${h.batteryVoltage} V`;
        document.getElementById('val-brake-front').textContent = `${h.brakePadFrontPercent}% pad wear`;
        document.getElementById('val-brake-rear').textContent = `${h.brakePadRearPercent}% pad wear`;
        document.getElementById('val-brake-fluid').textContent = h.brakeFluidStatus;
        document.getElementById('val-dtc-codes').innerHTML = h.diagnosticTroubleCodes.length > 0 ?
            h.diagnosticTroubleCodes.map(c => `<span class="badge badge-high" style="margin-right:4px">${c}</span>`).join('') :
            '<span class="badge badge-low">No Fault Codes</span>';
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function setTireNode(nodeId, psiId, treadId, psi, tread, target) {
    const node = document.getElementById(nodeId);
    document.getElementById(psiId).textContent = `${psi} PSI`;
    document.getElementById(treadId).textContent = `Tread: ${tread} mm`;

    const deviation = Math.abs(psi - target);
    if (deviation >= 5.0) {
        node.classList.add('tire-warning');
    } else {
        node.classList.remove('tire-warning');
    }
}

// 7. Smart Reviews
async function loadReviewIntelligence() {
    try {
        const [analysisRes, reviewsRes] = await Promise.all([
            fetch(`${API.reviews}/analysis`),
            fetch(API.reviews)
        ]);
        const analysis = await analysisRes.json();
        const reviews = await reviewsRes.json();

        document.getElementById('rev-kpi-total').textContent = analysis.totalAnalyzed;
        document.getElementById('rev-period-display').textContent = analysis.periodCovered;
        document.getElementById('rev-kpi-pos').textContent = analysis.positiveCount;
        document.getElementById('rev-kpi-neu').textContent = analysis.neutralCount;
        document.getElementById('rev-kpi-neg').textContent = analysis.negativeCount;

        // Frequent Problems
        document.getElementById('rev-problems-list').innerHTML = analysis.frequentProblems.map(p => `<li>⚠️ ${p}</li>`).join('');
        // Praise
        document.getElementById('rev-praise-list').innerHTML = analysis.commonPraise.map(p => `<li>⭐ ${p}</li>`).join('');
        // Suspicious review radar
        document.getElementById('rev-suspicious-list').innerHTML = analysis.suspiciousPatterns.map(p => `<li>🚨 ${p}</li>`).join('');

        // Reviews Feed
        const feed = document.getElementById('reviews-feed-list');
        feed.innerHTML = '';
        reviews.forEach(r => {
            const card = document.createElement('div');
            card.className = `review-card ${r.flaggedSuspicious ? 'review-flagged' : ''}`;
            const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

            card.innerHTML = `
                <div class="review-top">
                    <div>
                        <span class="review-author">${r.author}</span>
                        ${r.verifiedPurchase ? '<span class="badge badge-low" style="margin-left:6px">Verified Owner</span>' : ''}
                        ${r.flaggedSuspicious ? '<span class="tag-suspicious" style="margin-left:6px">AUDIT FLAG: SUSPICIOUS PATTERN</span>' : ''}
                    </div>
                    <span class="review-rating-stars">${stars}</span>
                </div>
                <div class="review-headline">${r.title}</div>
                <div class="review-body">${r.comment}</div>
                <div class="review-tags-row">
                    <span class="badge badge-neutral">${r.reviewDate}</span>
                    <span class="badge ${r.sentiment === 'POSITIVE' ? 'badge-low' : r.sentiment === 'NEGATIVE' ? 'badge-high' : 'badge-medium'}">${r.sentiment}</span>
                    ${r.problemTags.map(t => `<span class="tag-problem">${t}</span>`).join('')}
                    ${r.praiseTags.map(t => `<span class="tag-praise">${t}</span>`).join('')}
                </div>
            `;
            feed.appendChild(card);
        });
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// 8. Spring AI Customer Assistant Chat
async function handleAiChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('input-chat-query');
    const query = input.value.trim();
    if (!query) return;

    input.value = '';
    const container = document.getElementById('chat-messages-container');

    // Append user message
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message msg-user';
    userDiv.innerHTML = `<div class="msg-bubble">${escapeHtml(query)}</div>`;
    container.appendChild(userDiv);
    container.scrollTop = container.scrollHeight;

    // Loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message msg-ai';
    loadingDiv.innerHTML = `<div class="msg-bubble" style="color:var(--text-muted)">Analyzing verified vehicle telemetry, reviews, and specs...</div>`;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch(API.ai, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: query })
        });
        const data = await res.json();
        loadingDiv.remove();

        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message msg-ai';
        aiDiv.innerHTML = `
            <div class="msg-bubble">
                ${formatMarkdown(data.response)}
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:4px;">
                    🛡️ Grounded Engine: ${data.engine || 'GreenOps Certified Records'}
                </div>
            </div>
        `;
        container.appendChild(aiDiv);
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        loadingDiv.innerHTML = `<div class="msg-bubble" style="color:var(--color-red)">Error retrieving AI response: ${err.message}</div>`;
    }
}

// 9. Vehicle Recommendations
async function handleRecommenderSubmit(e) {
    e.preventDefault();
    const payload = {
        maxBudget: parseFloat(document.getElementById('rec-budget').value) || null,
        usage: document.getElementById('rec-usage').value,
        fuelPreference: document.getElementById('rec-fuel').value,
        minEfficiency: parseFloat(document.getElementById('rec-min-eff').value) || null,
        safetyPriority: document.getElementById('rec-safety').value,
        maxMaintenanceBudget: 15000.0,
        preferredVehicleType: null
    };

    try {
        const res = await fetch(API.recommendations, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const recommendations = await res.json();
        const container = document.getElementById('recommendation-results-container');
        container.innerHTML = '';

        recommendations.forEach(r => {
            const item = document.createElement('div');
            item.className = 'rec-item-card';

            item.innerHTML = `
                <div class="rec-top">
                    <div>
                        <h4 style="font-size:1.1rem; color:#fff; font-weight:800">${r.modelName}</h4>
                        <span class="badge badge-fuel">${r.fuelType}</span>
                        <span class="badge badge-neutral">${r.category}</span>
                        <span class="badge badge-low">${r.safetyRating}</span>
                    </div>
                    <div class="rec-score-pill">${r.matchScorePercent}% Match</div>
                </div>
                <div class="rec-spec-row">
                    <span>Est. Acquisition: <strong>₹${(r.estimatedPrice / 100000).toFixed(1)}L</strong></span>
                    <span>Rated Efficiency: <strong>${r.efficiencyValue} ${r.efficiencyUnit}</strong></span>
                    <span>Annual Maint. History: <strong>₹${r.avgAnnualMaintenanceCost.toLocaleString()}</strong></span>
                </div>
                <div class="rec-justification">
                    <strong>Match Justification:</strong> ${r.matchJustification}
                </div>
                <div class="rec-pros-cons-grid">
                    <div>
                        <strong style="color:#6ee7b7; font-size:0.8rem">Advantages:</strong>
                        <ul class="pros-list" style="padding-left:1.2rem; margin-top:4px">
                            ${r.advantages.map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        <strong style="color:#fca5a5; font-size:0.8rem">Considerations:</strong>
                        <ul class="cons-list" style="padding-left:1.2rem; margin-top:4px">
                            ${r.disadvantages.length > 0 ? r.disadvantages.map(d => `<li>${d}</li>`).join('') : '<li>None detected</li>'}
                        </ul>
                    </div>
                </div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:8px">
                    Data Disclosures: ${r.unavailableDataItems.join(' • ')}
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// 10. Green Driving & Sustainability
async function loadGreenDriving() {
    try {
        const res = await fetch(API.green);
        const data = await res.json();

        const tbody = document.getElementById('green-table-body');
        tbody.innerHTML = '';
        data.vehicles.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${v.modelName}</strong></td>
                <td><span class="badge badge-fuel">${v.fuelType}</span></td>
                <td><strong>${v.efficiency} ${v.efficiencyUnit}</strong></td>
                <td><strong style="color:${v.co2GramsPerKm === 0 ? 'var(--color-emerald)' : 'var(--color-amber)'}">${v.co2GramsPerKm} g/km</strong></td>
                <td><span class="badge badge-low">${v.ecoScore} / 100</span></td>
                <td style="font-size:0.78rem; color:var(--text-secondary)">${v.calculationMethodology}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('green-eco-tips-list').innerHTML = data.maintenanceEcoTips.map(t => `<li>${t}</li>`).join('');
        document.getElementById('green-assumptions-note').textContent = data.documentedAssumptions;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// 11. Notifications
async function loadNotifications() {
    try {
        const res = await fetch(API.notifications);
        const notifs = await res.json();

        const openCount = notifs.filter(n => n.status === 'Open').length;
        document.getElementById('sidebar-alert-badge').textContent = openCount;

        const container = document.getElementById('notifications-container');
        container.innerHTML = '';
        notifs.forEach(n => {
            const card = document.createElement('div');
            card.className = `notification-card ${n.priority === 'CRITICAL' ? 'notif-critical' : n.priority === 'WARNING' ? 'notif-warning' : 'notif-info'}`;

            card.innerHTML = `
                <div>
                    <div class="notif-content-title">
                        <span class="badge ${n.priority === 'CRITICAL' ? 'badge-high' : n.priority === 'WARNING' ? 'badge-medium' : 'badge-neutral'}">${n.priority}</span>
                        ${n.title}
                    </div>
                    <div class="notif-content-msg">${n.message}</div>
                    <div class="notif-meta">Target: ${n.registrationNumber} &bull; Time: ${formatTimestamp(n.timestamp)} &bull; Status: <strong>${n.status}</strong></div>
                </div>
                <div class="notif-actions">
                    ${!n.acknowledged ? `<button class="btn btn-sm btn-secondary" onclick="handleAckNotification(${n.id})">Acknowledge</button>` : '<span class="badge badge-low">Acknowledged</span>'}
                    ${n.status === 'Open' ? `<button class="btn btn-sm btn-primary" onclick="handleResolveNotification(${n.id})">Resolve</button>` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        showToast(e.message, 'error');
    }
}

window.handleAckNotification = async function(id) {
    await fetch(`${API.notifications}/${id}/acknowledge`, { method: 'POST' });
    showToast(`Notification #${id} acknowledged`, 'success');
    loadNotifications();
};

window.handleResolveNotification = async function(id) {
    await fetch(`${API.notifications}/${id}/resolve`, { method: 'POST' });
    showToast(`Notification #${id} resolved`, 'success');
    loadNotifications();
};

// 12. Vehicle Health Reports
async function loadVehicleReport(vehicleId) {
    try {
        const res = await fetch(`${API.reports}/${vehicleId}`);
        const r = await res.json();
        const v = r.vehicle;
        const h = r.telemetry;

        const container = document.getElementById('report-sheet-container');
        container.innerHTML = `
            <div class="report-doc-header">
                <div>
                    <div class="report-brand">Green Oops Smart Fleet Analytics</div>
                    <div class="report-doc-title">Certified Vehicle Health & Risk Assessment Document</div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px">Target Vehicle: <strong>${v.modelName} (${v.registrationNumber})</strong> &bull; Category: ${v.type}</div>
                </div>
                <div class="report-meta-box">
                    <div>Document Ref: <strong>${r.reportId}</strong></div>
                    <div>Generated: ${formatTimestamp(r.generatedAt)}</div>
                    <div>Diagnostic Safety Grade: <strong style="color:var(--color-emerald)">${r.riskAssessment.riskLevel}</strong></div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">1. Executive Health Summary</div>
                <div style="font-size:0.9rem; line-height:1.6; background:rgba(255,255,255,0.02); padding:1rem; border-radius:6px;">
                    ${r.healthSummary}
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">2. Risk Scoring & Priority Findings</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div>Calculated Risk Score: <strong>${r.riskAssessment.riskScore} / 100</strong></div>
                    <div>Primary Recommendation: <strong>${r.riskAssessment.recommendation}</strong></div>
                </div>
                <div style="font-size:0.85rem; color:var(--text-secondary)">
                    <strong>Identified Risk Factors:</strong>
                    <ul style="padding-left:1.5rem; margin-top:4px;">
                        ${r.riskAssessment.reasons.map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">3. Measured Subsystem Diagnostics</div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; font-size:0.85rem;">
                    <div>Engine Oil Level: <strong>${h ? h.oilLevelPercent + '%' : 'N/A'}</strong></div>
                    <div>Oil Pressure: <strong>${h ? h.oilPressureStatus : 'N/A'}</strong></div>
                    <div>Coolant Temp: <strong>${h ? h.coolantTempCelsius + '°C' : 'N/A'}</strong></div>
                    <div>FL Tire Pressure: <strong>${h ? h.tirePressureFlPsi + ' PSI' : 'N/A'}</strong></div>
                    <div>FR Tire Pressure: <strong>${h ? h.tirePressureFrPsi + ' PSI' : 'N/A'}</strong></div>
                    <div>RL Tire Pressure: <strong>${h ? h.tirePressureRlPsi + ' PSI' : 'N/A'}</strong></div>
                    <div>RR Tire Pressure: <strong>${h ? h.tirePressureRrPsi + ' PSI' : 'N/A'}</strong></div>
                    <div>Battery Health: <strong>${h ? h.batteryHealthPercent + '%' : 'N/A'}</strong></div>
                    <div>Front Brake Wear: <strong>${h ? h.brakePadFrontPercent + '%' : 'N/A'}</strong></div>
                </div>
            </div>

            <div class="report-section">
                <div class="report-section-title">4. Actionable Engineering Directives</div>
                <ul style="padding-left:1.5rem; font-size:0.85rem; color:var(--text-primary)">
                    ${r.recommendedActions.map(act => `<li>${act}</li>`).join('')}
                </ul>
            </div>

            <div class="report-section">
                <div class="report-section-title">5. Data Integrity & Limitations Disclosure</div>
                <ul style="padding-left:1.5rem; font-size:0.75rem; color:var(--text-muted)">
                    ${r.dataLimitations.map(lim => `<li>${lim}</li>`).join('')}
                </ul>
            </div>
        `;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// 13. Form Submissions (Add Vehicle & Review)
async function handleAddVehicleSubmit(e) {
    e.preventDefault();
    const payload = {
        registrationNumber: document.getElementById('input-reg').value.trim(),
        modelName: document.getElementById('input-model-name').value.trim(),
        type: document.getElementById('select-type').value,
        fuelType: document.getElementById('select-fuel').value,
        year: parseInt(document.getElementById('input-year').value, 10),
        odometerKm: parseInt(document.getElementById('input-odo').value, 10),
        estimatedPrice: parseFloat(document.getElementById('input-price').value) || 1500000,
        lastServiceDate: document.getElementById('input-service-date').value || null
    };

    try {
        const res = await fetch(API.vehicles, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Vehicle creation failed');
        showToast(`Vehicle ${payload.registrationNumber} registered!`, 'success');
        closeModal('modal-add-vehicle');
        document.getElementById('form-add-vehicle').reset();
        loadAllData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleAddReviewSubmit(e) {
    e.preventDefault();
    const payload = {
        vehicleId: parseInt(document.getElementById('select-review-vehicle').value, 10),
        author: document.getElementById('input-review-author').value.trim(),
        rating: parseInt(document.getElementById('select-review-rating').value, 10),
        title: document.getElementById('input-review-title').value.trim(),
        comment: document.getElementById('input-review-comment').value.trim()
    };

    try {
        const res = await fetch(API.reviews, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Review submission failed');
        const created = await res.json();
        showToast(`Review submitted! Sentiment: ${created.sentiment}`, 'success');
        closeModal('modal-add-review');
        document.getElementById('form-submit-review').reset();
        loadReviewIntelligence();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Helpers
window.viewVehicleHealth = function(id) {
    const healthNav = document.querySelector('button[data-tab="tab-vehicle-health"]');
    if (healthNav) healthNav.click();
    document.getElementById('select-health-vehicle').value = id;
    loadVehicleHealth(id);
};

window.viewVehicleReport = function(id) {
    const reportNav = document.querySelector('button[data-tab="tab-reports"]');
    if (reportNav) reportNav.click();
    document.getElementById('select-report-vehicle').value = id;
    loadVehicleReport(id);
};

function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('active'); m.setAttribute('aria-hidden', 'false'); }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('active'); m.setAttribute('aria-hidden', 'true'); }
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/### (.*)/g, '<h4 style="color:#fff; margin:8px 0 4px">$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

function formatTimestamp(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return isoStr;
    }
}

// ==========================================================================
// 14. AUTHENTICATION & ROLE-BASED ACCESS
// ==========================================================================
async function initAuth() {
    try {
        const res = await fetch(API.authCurrent);
        if (res.ok) {
            state.currentUser = await res.json();
            state.currentRole = state.currentUser.role;
            updateUserDisplay();
        }
    } catch (e) {
        console.warn('Could not load current session, using fallback', e);
    }
}

function updateUserDisplay() {
    if (!state.currentUser) return;
    const user = state.currentUser;
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role-display');
    const tagEl = document.getElementById('user-verified-display');
    const avatarEl = document.getElementById('user-avatar-initials');
    const roleSwitcherLabel = document.getElementById('label-role-switcher');
    const addVehBtn = document.getElementById('btn-open-add-vehicle');

    const displayName = user.name || user.fullName || 'User';
    if (nameEl) nameEl.textContent = displayName;
    if (tagEl) {
        tagEl.textContent = user.verificationDoc ? `✓ Verified: ${user.verificationDoc}` : '✓ Verified Credentials';
    }

    // Initials
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    if (avatarEl) {
        avatarEl.textContent = initials;
        if (user.role === 'DRIVER') {
            avatarEl.classList.add('user-avatar-driver');
        } else {
            avatarEl.classList.remove('user-avatar-driver');
        }
    }

    if (roleEl) {
        if (user.role === 'DRIVER') {
            roleEl.textContent = 'COMMERCIAL DRIVER';
            roleEl.className = 'user-role-badge badge-driver';
        } else {
            roleEl.textContent = 'VEHICLE OWNER';
            roleEl.className = 'user-role-badge badge-owner';
        }
    }

    if (roleSwitcherLabel) {
        roleSwitcherLabel.textContent = user.role === 'DRIVER' ? 'Switch to Owner' : 'Switch to Driver';
    }

    // Role-based view control
    if (addVehBtn) {
        addVehBtn.style.display = user.role === 'DRIVER' ? 'none' : 'inline-flex';
    }

    // Auto fill driver form name if driver is logged in
    const inspDriverInput = document.getElementById('insp-driver-name');
    if (inspDriverInput && user.role === 'DRIVER') {
        inspDriverInput.value = displayName;
    }
}

async function handleQuickRoleToggle() {
    const isOwner = state.currentRole === 'VEHICLE_OWNER';
    const targetEmail = isOwner ? 'driver@greenoops.com' : 'owner@greenoops.com';
    const targetPassword = isOwner ? 'Driver@123' : 'Owner@123';

    try {
        const res = await fetch(API.authLogin, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail, password: targetPassword })
        });
        if (!res.ok) throw new Error('Role toggle failed');
        state.currentUser = await res.json();
        state.currentRole = state.currentUser.role;
        updateUserDisplay();

        if (state.currentRole === 'DRIVER') {
            showToast(`Switched to Driver Mode (${state.currentUser.name})`, 'success');
            const driverNav = document.querySelector('button[data-tab="tab-driver-console"]');
            if (driverNav) driverNav.click();
        } else {
            showToast(`Switched to Vehicle Owner Mode (${state.currentUser.name})`, 'success');
            const ownerNav = document.querySelector('button[data-tab="tab-overview"]');
            if (ownerNav) ownerNav.click();
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('input-login-email').value.trim();
    const password = document.getElementById('input-login-password').value.trim();

    try {
        const res = await fetch(API.authLogin, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Invalid credentials');
        }
        state.currentUser = await res.json();
        state.currentRole = state.currentUser.role;
        updateUserDisplay();
        closeModal('modal-auth-login');
        showToast(`Authenticated as ${state.currentUser.name} (${state.currentUser.role})`, 'success');

        if (state.currentRole === 'DRIVER') {
            const driverNav = document.querySelector('button[data-tab="tab-driver-console"]');
            if (driverNav) driverNav.click();
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==========================================================================
// 15. ANALYSIS MODULE
// ==========================================================================
async function loadAnalysisModule() {
    try {
        const res = await fetch(API.analysis);
        if (!res.ok) throw new Error('Failed to load fleet analysis report');
        const data = await res.json();
        state.analysisData = data;
        renderAnalysisModule(data);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function renderAnalysisModule(data) {
    // Executive KPIs
    const avail = data.fleetAvailabilityRatePercent || data.fleetAvailabilityPercent || 96.4;
    document.getElementById('an-availability').textContent = `${avail}%`;
    document.getElementById('an-mtbf').textContent = `${data.meanTimeBetweenFailuresDays || 112} Days`;
    document.getElementById('an-roi').textContent = `${data.maintenanceRoiMultiplier || 4.8}x`;

    const oilDeg = (data.telemetryDistribution && data.telemetryDistribution.lubricantDegradationIndexPercent) ||
                    data.lubricantDegradationIndexPercent || 28.5;
    document.getElementById('an-oil-index').textContent = `${oilDeg}%`;

    // Predictive Failure Forecast Cards
    const cardsContainer = document.getElementById('forecast-cards-container');
    cardsContainer.innerHTML = '';

    const forecasts = data.predictiveForecasts || data.componentForecasts || data.forecasts || [];
    forecasts.forEach(f => {
        const card = document.createElement('div');
        const prob = f.failureProbabilityPercent || 0;
        const isCritical = prob >= 70;
        const isWarning = prob >= 40 && prob < 70;
        card.className = `forecast-card ${isCritical ? 'forecast-card-critical' : isWarning ? 'forecast-card-warning' : 'forecast-card-good'}`;

        const barColor = isCritical ? 'var(--color-red)' : isWarning ? 'var(--color-amber)' : 'var(--color-emerald)';
        const tagBadge = isCritical ? 'badge-high' : isWarning ? 'badge-medium' : 'badge-low';
        const rulDays = f.estimatedDaysToFailure || f.remainingUsefulLifeDays || 0;
        const rulKm = f.estimatedKmRemaining || f.remainingUsefulLifeKm || 0;
        const stress = f.keyStressFactor || f.primaryStressFactor || 'Normal operational load';
        const action = f.recommendedPreventiveAction || f.recommendedAction || 'Continue routine telemetry check';

        card.innerHTML = `
            <div class="forecast-top">
                <div>
                    <div class="forecast-component-name">${f.componentName}</div>
                    <div class="forecast-vehicle-model">${f.vehicleModel} &bull; ${f.registrationNumber}</div>
                </div>
                <span class="badge ${tagBadge}">${prob}% Risk</span>
            </div>

            <div class="forecast-prob-meter">
                <div class="forecast-prob-header">
                    <span>Failure Likelihood</span>
                    <span style="color:${barColor}">${prob}%</span>
                </div>
                <div class="forecast-bar-track">
                    <div class="forecast-bar-fill" style="width:${prob}%; background:${barColor}"></div>
                </div>
            </div>

            <div class="forecast-metrics-row">
                <div class="forecast-metric-item">
                    <span class="forecast-metric-label">Remaining Life (RUL)</span>
                    <span class="forecast-metric-val">${rulDays} Days</span>
                </div>
                <div class="forecast-metric-item">
                    <span class="forecast-metric-label">Estimated Range</span>
                    <span class="forecast-metric-val">${rulKm.toLocaleString()} km</span>
                </div>
            </div>

            <div style="font-size:0.78rem; color:var(--text-muted)">
                Stress Factor: <strong style="color:#fff">${stress}</strong>
            </div>

            <div class="forecast-action-box">
                💡 ${action}
            </div>
        `;
        cardsContainer.appendChild(card);
    });

    // Driver Scorecards Table
    const driverTbody = document.getElementById('driver-scorecard-tbody');
    driverTbody.innerHTML = '';

    const scorecards = data.driverScorecards || [];
    scorecards.forEach(d => {
        const tr = document.createElement('tr');
        const gradeText = d.overallGrade || d.grade || 'B';
        const gradeBadge = gradeText.startsWith('A') ? 'badge-low' : gradeText.startsWith('B') ? 'badge-low' : 'badge-medium';
        const vehName = d.assignedVehicle || d.assignedVehicleModel || 'Fleet Unit';
        const effScore = d.efficiencyScore || d.ecoEfficiencyScore || 90;
        const idleLoss = d.idleFuelWastePercent != null ? `${d.idleFuelWastePercent}%` : `${d.idleFuelLossLiters || 4} L`;
        const obs = Array.isArray(d.drivingBehaviorObservations) ? d.drivingBehaviorObservations.join(' • ') : (d.observations || 'Safe driving profile');

        tr.innerHTML = `
            <td><strong>${d.driverName}</strong></td>
            <td><span class="reg-tag">${vehName}</span></td>
            <td><strong style="color:${d.safetyScore >= 80 ? 'var(--color-emerald)' : 'var(--color-amber)'}">${d.safetyScore}/100</strong></td>
            <td><strong>${effScore}/100</strong></td>
            <td>${d.harshBrakingPer100Km}</td>
            <td><span style="color:var(--text-secondary)">${idleLoss}</span></td>
            <td><span class="badge ${gradeBadge}">${gradeText}</span></td>
            <td style="font-size:0.8rem; color:var(--text-secondary); max-width:240px">${obs}</td>
        `;
        driverTbody.appendChild(tr);
    });

    // Risk Factor Correlation Bars
    const corrContainer = document.getElementById('correlation-bars-container');
    corrContainer.innerHTML = '';
    const correlations = data.riskFactorCorrelation || data.riskFactorContributions || {};
    Object.keys(correlations).forEach(factor => {
        const percent = correlations[factor];
        const item = document.createElement('div');
        item.className = 'correlation-item';
        item.innerHTML = `
            <div class="correlation-meta">
                <span class="correlation-factor-name">${factor}</span>
                <span class="correlation-val">${percent}%</span>
            </div>
            <div class="correlation-bar-track">
                <div class="correlation-bar-fill" style="width:${percent}%"></div>
            </div>
        `;
        corrContainer.appendChild(item);
    });

    // Executive Directives List
    const dirContainer = document.getElementById('directives-list-container');
    dirContainer.innerHTML = '';
    const directives = data.executiveAnalyticsDirectives || data.executiveDirectives || [];
    directives.forEach(dir => {
        const li = document.createElement('li');
        li.className = 'directive-item';
        li.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>${dir}</span>
        `;
        dirContainer.appendChild(li);
    });
}

// ==========================================================================
// 16. DRIVER PRE-TRIP CONSOLE
// ==========================================================================
async function loadDriverConsole() {
    try {
        const res = await fetch(API.driverInspections);
        if (!res.ok) throw new Error('Failed to load driver inspections');
        const list = await res.json();
        state.driverInspections = list;
        renderDriverInspections(list);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function renderDriverInspections(list) {
    const tbody = document.getElementById('inspection-history-tbody');
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted)">No pre-trip sign-offs recorded yet.</td></tr>`;
        return;
    }

    list.forEach(item => {
        const tr = document.createElement('tr');
        const isSafe = item.safetyVerdict === 'CLEARED_FOR_ROUTE' || item.safetyVerdict === 'CLEARED';
        const displayReg = item.vehicleReg || ('Vehicle #' + item.vehicleId);
        const displayRemark = item.remarks || item.driverRemarks || 'Pre-trip roadworthiness cleared';

        tr.innerHTML = `
            <td style="font-size:0.78rem; color:var(--text-muted)">${formatTimestamp(item.timestamp)}</td>
            <td><span class="reg-tag">${displayReg}</span></td>
            <td>${item.driverName}</td>
            <td><span class="badge ${isSafe ? 'verdict-cleared' : 'verdict-defect'}">${item.safetyVerdict}</span></td>
            <td style="font-size:0.8rem; color:var(--text-secondary); max-width:220px">${displayRemark}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleDriverInspectionSubmit(e) {
    e.preventDefault();
    const vehicleId = parseInt(document.getElementById('insp-vehicle-select').value, 10);
    const selectedVeh = state.vehicles.find(v => v.id === vehicleId);
    const regNum = selectedVeh ? selectedVeh.registrationNumber : '';

    const payload = {
        vehicleId: vehicleId,
        vehicleReg: regNum,
        driverName: document.getElementById('insp-driver-name').value.trim(),
        odometerKm: parseInt(document.getElementById('insp-odometer').value, 10) || 0,
        tirePressureVisualOk: document.getElementById('chk-tire').checked,
        oilLevelChecked: document.getElementById('chk-oil').checked,
        brakesResponsive: document.getElementById('chk-brakes').checked,
        lightsOperational: document.getElementById('chk-lights').checked,
        remarks: document.getElementById('insp-remarks').value.trim()
    };

    try {
        const res = await fetch(API.driverInspection, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Pre-trip submission failed');
        const saved = await res.json();

        if (saved.safetyVerdict === 'CLEARED_FOR_ROUTE' || saved.safetyVerdict === 'CLEARED') {
            showToast(`Pre-trip inspection passed! ${regNum || 'Vehicle'} cleared for route.`, 'success');
        } else {
            showToast(`Defect logged! Owner alerted with urgent advisory for ${regNum || 'Vehicle'}.`, 'error');
        }

        // Refresh inspections and background notifications
        loadDriverConsole();
        loadNotifications();
        document.getElementById('insp-remarks').value = '';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================================================
// 15. DATABASE & SPRING DATA JPA CONSOLE
// ==========================================================================
async function loadDatabaseTab() {
    try {
        const res = await fetch(API.databaseStatus);
        if (!res.ok) throw new Error('Failed to fetch database status');
        const stats = await res.json();

        document.getElementById('db-stat-engine').textContent = stats.databaseType ? stats.databaseType.split(' ')[0] + ' Database' : 'H2 Database';
        document.getElementById('db-stat-status').textContent = stats.isDatabaseActive ? 'Status: CONNECTED & ONLINE' : 'Status: IN-MEMORY FALLBACK';
        document.getElementById('db-stat-total-records').textContent = (stats.totalRecords || 0).toLocaleString();

        const tablesGrid = document.getElementById('db-tables-grid-container');
        tablesGrid.innerHTML = '';

        const tableDescs = {
            'vehicles': 'Monitored vehicles, powertrains, NCAP ratings, prices',
            'maintenance_records': 'Historical service records, costs, repair logs',
            'vehicle_health': 'Telemetry, oil condition, tire PSI, DTC fault codes',
            'priority_risk_items': 'Priority-ranked risks (Tables A/B/C) with severity',
            'customer_reviews': 'Customer feedback, sentiment analysis, problem tags',
            'smart_notifications': 'Automated diagnostic warnings and alerts',
            'user_accounts': 'RBAC authentication, drivers, vehicle owners',
            'driver_inspections': 'Pre-trip roadworthiness inspection sign-offs'
        };

        const tables = stats.tables || {};
        Object.keys(tables).forEach(tableName => {
            const count = tables[tableName];
            const card = document.createElement('div');
            card.className = `db-table-card ${state.currentDbTable === tableName ? 'active-table' : ''}`;
            card.onclick = () => loadTableData(tableName);
            card.innerHTML = `
                <div class="db-table-card-top">
                    <span class="db-table-name">${tableName}</span>
                    <span class="db-table-count">${count}</span>
                </div>
                <div class="db-table-desc">${tableDescs[tableName] || 'Persisted SQL table'}</div>
                <button class="btn btn-sm btn-secondary" style="margin-top:auto; width:100%">Browse Table Data</button>
            `;
            tablesGrid.appendChild(card);
        });

        // Load active table
        loadTableData(state.currentDbTable);
    } catch (err) {
        console.error('Database tab load error:', err);
        showToast('Error loading database statistics: ' + err.message, 'error');
    }
}

async function loadTableData(tableName) {
    state.currentDbTable = tableName;
    document.querySelectorAll('.db-table-card').forEach(c => c.classList.remove('active-table'));

    document.getElementById('db-viewer-title').textContent = `Table: ${tableName} (Live SQL Query)`;
    document.getElementById('db-viewer-subtitle').textContent = `Displaying persisted records from Spring Data JPA repository`;

    try {
        const res = await fetch(`${API.databaseTable}/${tableName}`);
        if (!res.ok) throw new Error('Failed to fetch table records');
        const data = await res.json();

        document.getElementById('db-viewer-count-badge').textContent = `${data.length} Records`;

        const thead = document.getElementById('db-live-table-thead');
        const tbody = document.getElementById('db-live-table-tbody');
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted)">No rows in table ${tableName}.</td></tr>`;
            return;
        }

        // Generate headers dynamically
        const sample = data[0];
        const keys = Object.keys(sample).slice(0, 8); // Display first 8 columns

        const trHead = document.createElement('tr');
        keys.forEach(k => {
            const th = document.createElement('th');
            th.textContent = k;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);

        // Generate rows
        data.forEach(row => {
            const tr = document.createElement('tr');
            keys.forEach(k => {
                const td = document.createElement('td');
                let val = row[k];
                if (typeof val === 'object' && val !== null) {
                    val = JSON.stringify(val);
                }
                if (String(val).length > 40) {
                    val = String(val).substring(0, 40) + '...';
                }
                td.textContent = val !== null && val !== undefined ? val : '';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast('Error fetching table data: ' + err.message, 'error');
    }
}

async function handleReseedDatabase() {
    try {
        const res = await fetch(API.databaseReset, { method: 'POST' });
        if (!res.ok) throw new Error('Database reset failed');
        showToast('Database clean re-seed complete!', 'success');
        loadAllData();
        loadDatabaseTab();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================================================
// 16. MAINTENANCE & VEHICLE DETAILS MODAL HANDLERS
// ==========================================================================
function openAddMaintenanceModal(vehicleId) {
    const dateInput = document.getElementById('input-maint-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const select = document.getElementById('select-maint-vehicle');
    if (select && vehicleId) {
        select.value = vehicleId;
    }
    openModal('modal-add-maintenance');
}

async function handleAddMaintenanceSubmit(e) {
    e.preventDefault();
    const vehicleId = parseInt(document.getElementById('select-maint-vehicle').value, 10);
    const serviceDate = document.getElementById('input-maint-date').value;
    const type = document.getElementById('select-maint-type').value;
    const cost = parseFloat(document.getElementById('input-maint-cost').value) || 0;
    const description = document.getElementById('input-maint-desc').value.trim();

    try {
        const res = await fetch(`${API.vehicles}/${vehicleId}/maintenance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleId, serviceDate, type, cost, description })
        });
        if (!res.ok) throw new Error('Failed to save maintenance record');
        showToast('Maintenance service logged successfully to database!', 'success');
        closeModal('modal-add-maintenance');
        document.getElementById('input-maint-desc').value = '';

        loadAllData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function openVehicleDetailsModal(vehicleId) {
    const v = state.vehicles.find(item => item.id === vehicleId);
    if (!v) return;

    state.selectedVehicleForDetails = v;

    document.getElementById('vd-title').textContent = `${v.modelName} (${v.type})`;
    document.getElementById('vd-reg-subtitle').textContent = `Reg: ${v.registrationNumber} • Fuel: ${v.fuelType} • Year: ${v.year}`;

    // Specs Grid
    const specsContainer = document.getElementById('vd-specs-container');
    specsContainer.innerHTML = `
        <div class="vd-spec-box"><span class="vd-spec-label">Odometer</span><span class="vd-spec-val">${v.odometerKm.toLocaleString()} km</span></div>
        <div class="vd-spec-box"><span class="vd-spec-label">Powertrain</span><span class="vd-spec-val">${v.fuelType}</span></div>
        <div class="vd-spec-box"><span class="vd-spec-label">Efficiency</span><span class="vd-spec-val">${v.fuelEfficiencyKmPerL} ${v.fuelType === 'Electric' ? 'km/kWh' : 'km/L'}</span></div>
        <div class="vd-spec-box"><span class="vd-spec-label">Safety Rating</span><span class="vd-spec-val">${v.safetyRating}</span></div>
        <div class="vd-spec-box"><span class="vd-spec-label">Estimated Value</span><span class="vd-spec-val">₹${(v.estimatedPrice / 100000).toFixed(1)} Lakhs</span></div>
        <div class="vd-spec-box"><span class="vd-spec-label">Last Service</span><span class="vd-spec-val">${v.lastServiceDate || 'None'}</span></div>
    `;

    // Maintenance Records
    const tbody = document.getElementById('vd-maint-tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted)">Loading service history...</td></tr>';

    openModal('modal-vehicle-details');

    try {
        const res = await fetch(`${API.vehicles}/${vehicleId}/maintenance`);
        if (!res.ok) throw new Error('Failed to load maintenance records');
        const records = await res.json();

        tbody.innerHTML = '';
        if (!records || records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted)">No maintenance logs found for this vehicle.</td></tr>';
            return;
        }

        records.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size:0.8rem; color:var(--text-muted)">${r.serviceDate}</td>
                <td><span class="badge badge-neutral">${r.type}</span></td>
                <td style="font-size:0.82rem; color:var(--text-secondary)">${escapeHtml(r.description)}</td>
                <td class="text-right" style="font-family:var(--font-mono); font-weight:700">₹${(r.cost || 0).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--color-red)">Error loading history: ${err.message}</td></tr>`;
    }
}

async function handleDeleteVehicle(vehicleId) {
    const v = state.vehicles.find(item => item.id === vehicleId);
    const reg = v ? v.registrationNumber : '#' + vehicleId;
    if (!confirm(`Are you sure you want to delete vehicle ${reg} from the database? This action will remove all associated health telemetry, risks, and maintenance records.`)) {
        return;
    }

    try {
        const res = await fetch(`${API.vehicles}/${vehicleId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete operation failed');
        showToast(`Vehicle ${reg} removed from database`, 'success');
        closeModal('modal-vehicle-details');
        loadAllData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.openAddMaintenanceModal = openAddMaintenanceModal;
window.openVehicleDetailsModal = openVehicleDetailsModal;
window.handleDeleteVehicle = handleDeleteVehicle;



