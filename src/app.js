// MOTOR DE FINANZAS PERSONAL: FINANZAS FLEX & SANDBOX PROYECTOS
// Desarrollado con lógica robusta de doble entrada, persistencia y reactividad.

// CONSEJOS_FINANCIEROS se carga globalmente desde src/consejos.js para soporte file:/// y web
// (sin import para compatibilidad total con carga clásica directa)

const CONSEJOS = (typeof CONSEJOS_FINANCIEROS !== "undefined" && Array.isArray(CONSEJOS_FINANCIEROS) && CONSEJOS_FINANCIEROS.length)
    ? CONSEJOS_FINANCIEROS
    : (typeof window !== "undefined" && (window.CONSEJOS || window.CONSEJOS_FINANCIEROS)) 
        ? (window.CONSEJOS || window.CONSEJOS_FINANCIEROS) 
        : (typeof globalThis !== "undefined" && (globalThis.CONSEJOS || globalThis.CONSEJOS_FINANCIEROS)) 
            ? (globalThis.CONSEJOS || globalThis.CONSEJOS_FINANCIEROS) 
            : [];

// ----------------------------------------------------
// 1. ESTADO DE LA APLICACIÓN (BASE DE DATOS LOCAL)
// ----------------------------------------------------

const CURRENCY_CONFIGS = {
    EUR: { locale: 'de-DE', code: 'EUR', symbol: '€', name: 'Euros' },
    USD: { locale: 'en-US', code: 'USD', symbol: '$', name: 'Dólares' },
    GBP: { locale: 'en-GB', code: 'GBP', symbol: '£', name: 'Libras' },
    JPY: { locale: 'ja-JP', code: 'JPY', symbol: '¥', name: 'Yenes' },
    MXN: { locale: 'es-MX', code: 'MXN', symbol: '$', name: 'Pesos Mex' },
    ARS: { locale: 'es-AR', code: 'ARS', symbol: '$', name: 'Pesos Arg' },
    COP: { locale: 'es-CO', code: 'COP', symbol: '$', name: 'Pesos Col' },
    CLP: { locale: 'es-CL', code: 'CLP', symbol: '$', name: 'Pesos Chi' }
};

// ====================================================
// MOTOR DE ALMACENAMIENTO INDEXEDDB Y MIGRACIÓN
// ====================================================
const DB_NAME = "MiHuchaDB";
const STORE_NAME = "keyvalue";

function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

const dbStorage = {
    async getItem(key) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error("IndexedDB error on getItem:", e);
            return null;
        }
    },
    async setItem(key, value) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error("IndexedDB error on setItem:", e);
        }
    },
    async removeItem(key) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error("IndexedDB error on removeItem:", e);
        }
    }
};

// ====================================================
// COMPONENTE DE SELECCIÓN Y CREACIÓN DE ETIQUETAS/CATEGORÍAS
// ====================================================

// ====================================================
// FUNCIÓN DE SANITIZACIÓN Y PREVENCIÓN XSS
// ====================================================
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
if (typeof window !== "undefined") {
    window.escapeHtml = escapeHtml;
}

const PRESET_BANK_TAGS = ["Nómina", "Ahorros", "Emergencias", "Gastos Diarios", "Viajes", "Facturas", "Seguro", "Colegiado", "Trastero", "Inversión"];

function initTagSelector(containerId, initialTags = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let tags = [...initialTags].map(t => t.trim()).filter(t => t !== "");

    const render = () => {
        container.innerHTML = `
            <div class="tags-input-wrapper" style="border:1px solid var(--border-color); padding:8px; border-radius:6px; background:var(--bg-input); display:flex; flex-wrap:wrap; gap:6px; align-items:center; min-height:42px;">
                ${tags.map((tag, idx) => `
                    <span class="tag-pill" style="background:var(--primary-dark); border:1px solid var(--primary-light); color:var(--text-light); padding:2px 8px; border-radius:4px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; user-select:none;">
                        ${tag}
                        <span class="tag-remove" data-index="${idx}" style="cursor:pointer; font-weight:bold; color:var(--text-muted);">&times;</span>
                    </span>
                `).join("")}
                <input type="text" class="new-tag-input" placeholder="+ Añadir..." style="border:none; outline:none; background:transparent; color:var(--text-light); font-size:0.78rem; flex:1; min-width:80px; padding:0; height:auto;">
            </div>
            <div class="preset-tags" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; align-items: center;">
                <span style="font-size:0.72rem; color:var(--text-muted); margin-right:4px;">Sugeridos:</span>
                ${PRESET_BANK_TAGS.filter(pt => !tags.includes(pt)).map(pt => `
                    <span class="preset-tag-pill" data-tag="${pt}" style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); color:var(--text-secondary); padding:2px 6px; border-radius:4px; font-size:0.7rem; cursor:pointer; transition: all 0.2s; user-select:none;">
                        + ${pt}
                    </span>
                `).join("")}
            </div>
            <input type="hidden" id="${containerId}-value" value="${tags.join(",")}">
        `;

        const input = container.querySelector(".new-tag-input");
        
        const addTag = () => {
            const val = input.value.trim().replace(/,/g, "");
            if (val && !tags.includes(val)) {
                tags.push(val);
                render();
            } else {
                input.value = "";
            }
        };

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
            }
        });
        
        input.addEventListener("blur", () => {
            addTag();
        });

        container.querySelectorAll(".preset-tag-pill").forEach(el => {
            el.addEventListener("click", () => {
                const val = el.dataset.tag;
                if (!tags.includes(val)) {
                    tags.push(val);
                    render();
                }
            });
        });

        container.querySelectorAll(".tag-remove").forEach(el => {
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(el.dataset.index, 10);
                tags.splice(idx, 1);
                render();
            });
        });
    };

    render();
}


async function migrateLocalStorageToIndexedDB() {
    try {
        const isMigrated = await dbStorage.getItem("migrated_from_localstorage");
        if (isMigrated) return;

        const storedProfiles = localStorage.getItem("finanzas_profiles");
        const storedCurrentId = localStorage.getItem("finanzas_current_profile_id");

        if (storedProfiles) {
            const profiles = JSON.parse(storedProfiles);
            await dbStorage.setItem("finanzas_profiles", profiles);
            
            if (storedCurrentId) {
                await dbStorage.setItem("finanzas_current_profile_id", storedCurrentId);
            }

            for (const prof of profiles) {
                const profileKey = "finanzas_db_" + prof.id;
                const storedDb = localStorage.getItem(profileKey);
                if (storedDb) {
                    await dbStorage.setItem(profileKey, JSON.parse(storedDb));
                }
            }
            console.log("Migración exitosa de LocalStorage a IndexedDB realizada.");
        }
        
        const onboardingShown = localStorage.getItem("finanzas_onboarding_shown");
        if (onboardingShown) {
            await dbStorage.setItem("finanzas_onboarding_shown", onboardingShown);
        }

        await dbStorage.setItem("migrated_from_localstorage", true);
    } catch (e) {
        console.error("Error migrando base de datos a IndexedDB:", e);
    }
}

let state = {
    banks: [],
    fixedExpenses: [],
    transactions: [],
    budgets: {},
    projects: [],
    projectFolders: [],
    activityLog: [],
    currentMonth: "", // Formato "YYYY-MM"
    maskMode: false,
    savingGoals: [],
    closedMonths: [],
    plannedIncomes: {}, // { "YYYY-MM": { amount, type, description, distributions: [{bankId, value}], mode } }
    currency: "EUR"
};

// Variables globales de sesión y seguridad (declaradas al principio para evitar errores de inicialización por TDZ)
let pendingProfileId = null;
let isLocked = false;
let lastActivityTime = Date.now();
let autoLockInterval = null;

// Configuración inicial de datos semilla (Mock Data) para causar impacto visual al cargar por primera vez
const SEED_DATA = {
    banks: [
        { id: "b_1", name: "BBVA (Nómina)", balance: 2450.00, purpose: "Nómina y gastos corrientes", minBalance: 1000.00, targetBalance: 3000.00, createdAt: "2026-05-01T10:00:00.000Z" },
        { id: "b_2", name: "Revolut (Gastos)", balance: 345.50, purpose: "Gastos diarios y ocio", minBalance: 200.00, targetBalance: null, createdAt: "2026-05-01T10:00:00.000Z" },
        { id: "b_3", name: "Banco Santander (Ahorros)", balance: 8000.00, purpose: "Fondo de Emergencia", minBalance: 5000.00, targetBalance: 12000.00, createdAt: "2026-05-01T10:00:00.000Z" }
    ],
    fixedExpenses: [
        { id: "fe_1", name: "Alquiler del Piso", amount: 650.00, bankId: "b_1" },
        { id: "fe_2", name: "Suscripción Netflix", amount: 17.99, bankId: "b_2" },
        { id: "fe_3", name: "Gimnasio Cuota", amount: 45.00, bankId: "b_1" },
        { id: "fe_4", name: "Seguro de Salud", amount: 60.00, bankId: "b_3" }
    ],
    transactions: [
        // Ingresos
        {
            id: "tx_init_1",
            type: "income",
            subtype: "Nómina",
            description: "Nómina Mensual Mayo",
            amount: 2500.00,
            date: "2026-05-01",
            month: "2026-05",
            distributions: [
                { bankId: "b_1", amount: 1500.00 },
                { bankId: "b_2", amount: 500.00 },
                { bankId: "b_3", amount: 500.00 }
            ]
        },
        // Gastos Variables
        {
            id: "tx_init_2",
            type: "expense",
            subtype: "Variable",
            description: "Cena Restaurante",
            amount: 54.50,
            bankId: "b_2",
            date: "2026-05-10",
            month: "2026-05"
        },
        {
            id: "tx_init_3",
            type: "expense",
            subtype: "Variable",
            description: "Compra Supermercado",
            amount: 80.00,
            bankId: "b_1",
            date: "2026-05-12",
            month: "2026-05"
        }
    ],
    budgets: {
        "2026-05": {
            "b_1": { expectedIncome: 1800.00, expectedExpense: 800.00 },
            "b_2": { expectedIncome: 500.00, expectedExpense: 300.00 },
            "b_3": { expectedIncome: 500.00, expectedExpense: 100.00 }
        }
    },
    projects: [
        {
            id: "p_1",
            name: "Lanzamiento Micro-SaaS AI",
            description: "Simulador aislado de ingresos y gastos para una app de transcripción de audios de voz.",
            createdAt: "2026-05-10",
            investments: [
                { id: "pinv_1", description: "Compra de dominio .com", amount: 12.00, date: "2026-05-10" },
                { id: "pinv_2", description: "Servidor GPU de inicio", amount: 75.00, date: "2026-05-12" }
            ],
            earnings: [
                { id: "pear_1", description: "Suscripción cliente 1", amount: 29.00, date: "2026-05-14" },
                { id: "pear_2", description: "Suscripción cliente 2", amount: 49.00, date: "2026-05-15" },
                { id: "pear_3", description: "Pago anual corporativo", amount: 199.00, date: "2026-05-16" }
            ]
        },
        {
            id: "p_2",
            name: "Venta de Camisetas Online",
            description: "Simulador de Print-on-Demand con diseños de nicho tecnológico.",
            createdAt: "2026-05-12",
            investments: [
                { id: "pinv_3", description: "Publicidad en Redes", amount: 150.00, date: "2026-05-12" },
                { id: "pinv_4", description: "Diseñador freelance (Fiverr)", amount: 50.00, date: "2026-05-13" }
            ],
            earnings: [
                { id: "pear_4", description: "Venta de 4 camisetas", amount: 88.00, date: "2026-05-15" }
            ]
        }
    ],
    currentMonth: "2026-05",
    activityLog: [],
    maskMode: false,
    savingGoals: [
        { id: "g_1", name: "Fondo de Emergencia", targetAmount: 5000.00, currentAmount: 3000.00, bankId: "b_3", deadline: "2026-12-31" },
        { id: "g_2", name: "Viaje a Japón", targetAmount: 2500.00, currentAmount: 850.00, bankId: "b_2", deadline: "2026-09-30" }
    ],
    closedMonths: []
};

// ----------------------------------------------------
// 2. INICIALIZACIÓN Y PERSISTENCIA
// ----------------------------------------------------

// ====================================================
// 2. INICIALIZACIÓN, MULTI-PERFILES Y PERSISTENCIA
// ====================================================

let profilesState = {
    profiles: [], // Array de { id, username, pin, createdAt }
    currentProfileId: null
};

// Cargar la lista de perfiles y establecer el activo
async function loadProfiles() {
    const storedProfiles = await dbStorage.getItem("finanzas_profiles");
    const storedCurrentId = await dbStorage.getItem("finanzas_current_profile_id");
    
    if (storedProfiles) {
        profilesState.profiles = storedProfiles;
        profilesState.currentProfileId = storedCurrentId;
    }
    
    // Migración inteligente: Si no hay perfiles creados, pero existe la base de datos anterior 'finanzas_sandbox_db'
    if (!profilesState.profiles || profilesState.profiles.length === 0) {
        const legacyData = localStorage.getItem("finanzas_sandbox_db");
        const defaultProfileId = "p_user_" + Date.now();
        
        profilesState.profiles = [{
            id: defaultProfileId,
            username: "Usuario Principal",
            pin: null, // Sin PIN por defecto
            createdAt: new Date().toISOString()
        }];
        profilesState.currentProfileId = defaultProfileId;
        
        // Guardar la lista de perfiles
        await dbStorage.setItem("finanzas_profiles", profilesState.profiles);
        await dbStorage.setItem("finanzas_current_profile_id", defaultProfileId);
        
        // Si hay datos legacy, migrarlos al nuevo perfil
        if (legacyData) {
            try {
                await dbStorage.setItem("finanzas_db_" + defaultProfileId, JSON.parse(legacyData));
            } catch (e) {
                console.error(e);
            }
        }
    }
    
    // Garantizar que currentProfileId sea válido
    const activeExists = profilesState.profiles.some(p => p.id === profilesState.currentProfileId);
    if (!activeExists && profilesState.profiles.length > 0) {
        profilesState.currentProfileId = profilesState.profiles[0].id;
        await dbStorage.setItem("finanzas_current_profile_id", profilesState.currentProfileId);
    }
}

// Cargar estado
async function loadState() {
    // Asegurar migración de datos a IndexedDB
    await migrateLocalStorageToIndexedDB();
    
    // Primero nos aseguramos de que los perfiles estén inicializados
    await loadProfiles();
    
    const profileKey = "finanzas_db_" + profilesState.currentProfileId;
    const stored = await dbStorage.getItem(profileKey);
    
    if (stored) {
        state = stored;
        if (!state.activityLog) {
            state.activityLog = [];
        }
        if (state.maskMode === undefined) {
            state.maskMode = false;
        }
        if (!state.savingGoals) {
            state.savingGoals = [];
        }
        if (!state.closedMonths) {
            state.closedMonths = [];
        }
        if (!state.plannedIncomes) {
            state.plannedIncomes = {};
        }
        if (!state.currency) {
            state.currency = "EUR";
        }
        if (!state.projectFolders) {
            state.projectFolders = [];
        }
        // Asegurar que exista el mes actual
        if (!state.currentMonth) {
            state.currentMonth = getSystemCurrentMonth();
        }
    } else {
        // Datos semilla por defecto
        state = JSON.parse(JSON.stringify(SEED_DATA));
        // Ajustar el mes al del sistema real del usuario para máxima coherencia
        const sysMonth = getSystemCurrentMonth();
        state.currentMonth = sysMonth;
        
        // Ajustar fechas e índices de transacciones demo al mes real del usuario
        if (state.budgets["2026-05"] && sysMonth !== "2026-05") {
            state.budgets[sysMonth] = state.budgets["2026-05"];
            delete state.budgets["2026-05"];
            state.transactions.forEach(tx => {
                tx.month = sysMonth;
                tx.date = sysMonth + tx.date.substring(7);
            });
        }
        
        await dbStorage.setItem(profileKey, state);
    }
}

// Guardar estado y propagar cambios reactivamente
function saveState() {
    if (!profilesState.currentProfileId) return;
    const profileKey = "finanzas_db_" + profilesState.currentProfileId;
    
    // Guardado asíncrono fire-and-forget en IndexedDB
    dbStorage.setItem(profileKey, state).catch(e => console.error("Error guardando estado:", e));
    dbStorage.setItem("finanzas_profiles", profilesState.profiles).catch(e => console.error("Error guardando perfiles:", e));
    dbStorage.setItem("finanzas_current_profile_id", profilesState.currentProfileId).catch(e => console.error("Error guardando perfil activo:", e));
    
    renderAll();
    
    // Actualizar la interfaz del perfil
    renderProfileWidget();
}

// Registrar una actividad/evento en la bitácora
function logActivity(description) {
    if (!state.activityLog) {
        state.activityLog = [];
    }
    const timestamp = new Date().toISOString();
    state.activityLog.unshift({
        id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        timestamp: timestamp,
        description: description
    });
    // Limitar a los últimos 150 registros para evitar sobrecarga
    if (state.activityLog.length > 150) {
        state.activityLog = state.activityLog.slice(0, 150);
    }
    
    // Guardar directamente en base de datos en segundo plano
    if (profilesState.currentProfileId) {
        const profileKey = "finanzas_db_" + profilesState.currentProfileId;
        dbStorage.setItem(profileKey, state).catch(e => console.error("Error guardando log de actividad:", e));
    }
}

// Obtener el mes actual del sistema en formato YYYY-MM
function getSystemCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// ----------------------------------------------------
// 3. NAVEGACIÓN Y COMPORTAMIENTO DE PESTAÑAS
// ----------------------------------------------------

function initNavigation() {
    const tabs = document.querySelectorAll(".nav-btn");
    const panels = document.querySelectorAll(".tab-panel");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-target");
            if (!targetId) return;

            const activePanel = document.getElementById(targetId);
            if (!activePanel) return;

            tabs.forEach(t => t.classList.remove("active"));
            panels.forEach(p => {
                p.classList.remove("active");
                p.style.display = "none";
            });

            tab.classList.add("active");
            activePanel.style.display = "block";
            
            // Forzar reflow para animación CSS
            setTimeout(() => {
                activePanel.classList.add("active");
            }, 10);

            // Cambiar el título de la vista actual dinámicamente
            const titleEl = document.getElementById("current-view-title");
            const subtitleEl = document.getElementById("current-view-subtitle");
            if (titleEl && subtitleEl) {
                const tabSpan = tab.querySelector("span");
                const viewName = tabSpan ? tabSpan.textContent : "Programa Finanzas";
                titleEl.textContent = viewName === "Tablero" ? "Tablero Principal" : viewName;
                
                let viewDesc = "Resumen global de capital y balances";
                if (targetId === "panel-expenses") viewDesc = "Matriz de gastos recurrentes y registro de movimientos";
                else if (targetId === "panel-closure") viewDesc = "Evolución del saldo y desglose de gastos por banco";
                else if (targetId === "panel-performance") viewDesc = "Gráficos de rendimiento e historial consolidado";
                else if (targetId === "panel-projects") viewDesc = "Simulador financiero y sandbox de proyectos independientes";
                else if (targetId === "panel-investments") viewDesc = "Cartera de inversión, rentabilidades y planes de futuro";
                else if (targetId === "panel-utilities") viewDesc = "Herramientas de cálculo, simulador de IRPF y recursos financieros";
                
                subtitleEl.textContent = viewDesc;
            }
            
            // Si volvemos al listado de proyectos, resetear la vista detallada y de carpetas
            if (targetId === "panel-projects") {
                const listView = document.getElementById("project-list-view");
                const folderView = document.getElementById("project-folder-view");
                const detailsView = document.getElementById("project-details-view");
                const formAddProj = document.getElementById("form-add-project");
                const formAddFolder = document.getElementById("form-add-folder");
                const formAddSubproj = document.getElementById("form-add-subproject");

                if (listView) listView.classList.remove("hidden");
                if (folderView) folderView.classList.add("hidden");
                if (detailsView) detailsView.classList.add("hidden");
                if (formAddProj) formAddProj.classList.add("hidden");
                if (formAddFolder) formAddFolder.classList.add("hidden");
                if (formAddSubproj) formAddSubproj.classList.add("hidden");

                currentActiveProjectId = null;
                currentActiveFolderId = null;
                renderProjectsList();
            }

            // Si volvemos al panel de utilidades, mostrar el catálogo principal
            if (targetId === "panel-utilities") {
                closeUtilityView();
            }

            // Lanzar actualización de gráficos al cambiar a la pestaña de rendimiento
            if (targetId === "panel-performance") {
                renderPerformanceModule();
            }

            // Lanzar gráficas de cierre al cambiar a dicha pestaña
        });
    });

    // Navegación automática si hay un hash en la URL (por ejemplo: index.html#projects)
    const checkHashNavigation = () => {
        const hash = window.location.hash;
        if (hash) {
            let targetTab = null;
            if (hash === "#dashboard" || hash === "#tab-dashboard") targetTab = document.getElementById("tab-dashboard");
            else if (hash === "#expenses" || hash === "#tab-expenses") targetTab = document.getElementById("tab-expenses");
            else if (hash === "#closure" || hash === "#tab-closure") targetTab = document.getElementById("tab-closure");
            else if (hash === "#performance" || hash === "#tab-performance") targetTab = document.getElementById("tab-performance");
            else if (hash === "#investments" || hash === "#tab-investments") targetTab = document.getElementById("tab-investments");
            else if (hash === "#projects" || hash === "#tab-projects") targetTab = document.getElementById("tab-projects");
            else if (hash === "#utilities" || hash === "#tab-utilities") targetTab = document.getElementById("tab-utilities");
            
            if (targetTab) {
                targetTab.click();
            }
        }
    };
    
    // Ejecutar al cargar la navegación
    checkHashNavigation();
    
    // Escuchar cambios de hash dinámicos
    window.addEventListener("hashchange", checkHashNavigation);
}

// ----------------------------------------------------
// 4. SISTEMA DE TOASTS (NOTIFICACIONES)
// ----------------------------------------------------

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'danger') {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ----------------------------------------------------
// 5. GESTIÓN DEL TIEMPO (CAMBIO DE MES Y AUTOMATISMO)
// ----------------------------------------------------

function getPreviousMonthString(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

function getNextMonthString(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth === 13) {
        nextMonth = 1;
        nextYear += 1;
    }
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

function formatMonthString(monthStr) {
    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const [year, month] = monthStr.split('-');
    return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function initMonthSelector() {
    const display = document.getElementById("current-month-display");
    const btnPrev = document.getElementById("btn-prev-month");
    const btnNext = document.getElementById("btn-next-month");

    function updateMonthDisplay() {
        display.textContent = formatMonthString(state.currentMonth);
    }

    btnPrev.addEventListener("click", () => {
        const prev = getPreviousMonthString(state.currentMonth);
        changeMonth(prev);
    });

    btnNext.addEventListener("click", () => {
        const next = getNextMonthString(state.currentMonth);
        changeMonth(next);
    });

    updateMonthDisplay();
}

function changeMonth(newMonth) {
    const oldMonth = state.currentMonth;
    state.currentMonth = newMonth;
    
    // AUTOMATISMO DE PRESUPUESTO (CLONACIÓN DESDE MES ANTERIOR)
    // Si no existen presupuestos creados para el mes al que viajamos, los clonamos.
    if (!state.budgets[newMonth]) {
        state.budgets[newMonth] = {};
        const previousMonth = getPreviousMonthString(newMonth);
        const prevBudgets = state.budgets[previousMonth] || {};
        
        state.banks.forEach(bank => {
            state.budgets[newMonth][bank.id] = {
                expectedIncome: prevBudgets[bank.id] ? prevBudgets[bank.id].expectedIncome : 0,
                expectedExpense: prevBudgets[bank.id] ? prevBudgets[bank.id].expectedExpense : 0
            };
        });
        showToast(`Estimaciones clonadas automáticamente desde ${formatMonthString(previousMonth)}`, 'info');
    }
    
    saveState();
    showToast(`Visualizando el mes de ${formatMonthString(newMonth)}`, 'success');
}

// ----------------------------------------------------
// 6. MÓDULO 1: TABLERO - GESTIÓN DE BANCOS
// ----------------------------------------------------

function renderDepositDestBanksOptions(selectElementId, currentSelectedId = null, excludeBankId = null) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = "";
    const eligibleBanks = state.banks.filter(b => b.id !== excludeBankId && b.bankType !== "deposit" && b.bankType !== "pension" && b.bankType !== "investment");
    if (eligibleBanks.length === 0) {
        select.innerHTML = `<option value="">-- Sin cuentas disponibles --</option>`;
        return;
    }
    eligibleBanks.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = b.name;
        if (b.id === currentSelectedId) opt.selected = true;
        select.appendChild(opt);
    });
}


// ----------------------------------------------------
// 12.5. ERGONOMÍA Y CONTROL DIARIO DEL TABLERO
// ----------------------------------------------------

window.navigateToTab = function(tabId) {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
        tabEl.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.quickTransferToCoverMinimum = function(toBankId, missingAmount) {
    const formTransfer = document.getElementById("form-transfer-money");
    if (!formTransfer) return;
    
    // Abrir formulario
    formTransfer.classList.remove("hidden");
    renderTransferDropdowns();
    
    const toBankSelect = document.getElementById("transfer-to-bank");
    const fromBankSelect = document.getElementById("transfer-from-bank");
    const amountInput = document.getElementById("transfer-amount");
    const dateInput = document.getElementById("transfer-date");
    const descInput = document.getElementById("transfer-desc");
    
    if (toBankSelect) toBankSelect.value = toBankId;
    if (amountInput) amountInput.value = missingAmount.toFixed(2);
    if (dateInput) dateInput.value = getTodayString();
    
    const targetBank = state.banks.find(b => b.id === toBankId);
    if (descInput) descInput.value = `Traspaso para cubrir saldo mínimo de "${targetBank ? targetBank.name : 'cuenta'}"`;
    
    // Escoger como origen la cuenta líquida con mayor saldo que no sea toBankId
    const candidates = state.banks.filter(b => b.id !== toBankId && b.bankType !== 'deposit' && b.balance > 0);
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.balance - a.balance);
        if (fromBankSelect) fromBankSelect.value = candidates[0].id;
    }
    
    formTransfer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`Preparado traspaso de ${formatCurrency(missingAmount)} hacia "${targetBank ? targetBank.name : 'cuenta'}". Pulsa "Realizar Traspaso" para confirmar.`, "info");
};

function initDashboardRightTabs() {
    const btnOverview = document.getElementById("btn-subtab-dash-overview");
    const btnFunnel = document.getElementById("btn-subtab-dash-funnel");
    const btnOpenFunnel = document.getElementById("btn-dash-open-funnel");
    const btnCtaOpenFunnel = document.getElementById("btn-dash-cta-open-funnel");
    const containerOverview = document.getElementById("container-dash-overview");
    const containerFunnel = document.getElementById("container-dash-funnel");
    
    if (!btnOverview || !btnFunnel || !containerOverview || !containerFunnel) return;
    
    const setTab = (tab) => {
        if (tab === 'overview') {
            btnOverview.classList.add("active");
            btnFunnel.classList.remove("active");
            containerOverview.classList.remove("hidden");
            containerFunnel.classList.add("hidden");
            renderDashboardOverview();
        } else {
            btnOverview.classList.remove("active");
            btnFunnel.classList.add("active");
            containerOverview.classList.add("hidden");
            containerFunnel.classList.remove("hidden");
        }
    };
    
    btnOverview.addEventListener("click", () => setTab('overview'));
    btnFunnel.addEventListener("click", () => setTab('funnel'));
    if (btnOpenFunnel) btnOpenFunnel.addEventListener("click", () => setTab('funnel'));
    if (btnCtaOpenFunnel) btnCtaOpenFunnel.addEventListener("click", () => setTab('funnel'));
}

function renderDashboardOverview() {
    const containerOverview = document.getElementById("container-dash-overview");
    if (!containerOverview || containerOverview.classList.contains("hidden")) return;
    
    // 1. Ritmo de Gasto y Presupuesto Restante
    const [currY, currM] = state.currentMonth.split("-").map(Number);
    const totalDaysInMonth = new Date(currY, currM, 0).getDate();
    const today = new Date();
    const isCurrent = (today.getFullYear() === currY && today.getMonth() + 1 === currM);
    const currentDay = isCurrent ? today.getDate() : totalDaysInMonth;
    const remainingDays = isCurrent ? Math.max(1, totalDaysInMonth - currentDay + 1) : 1;
    
    const monthlyIncomes = (state.transactions || [])
        .filter(t => t.type === "income" && t.subtype !== "Traspaso" && t.month === state.currentMonth)
        .reduce((sum, t) => sum + t.amount, 0);
        
    const monthlyExpenses = (state.transactions || [])
        .filter(t => t.type === "expense" && t.subtype !== "Traspaso" && t.month === state.currentMonth)
        .reduce((sum, t) => sum + t.amount, 0);
        
    // Gastos fijos aplicables este mes según periodicidad
    const currentMNum = String(currM).padStart(2, "0");
    const applicableFixed = (state.fixedExpenses || []).filter(fe => {
        const per = fe.periodicity || "Mensual";
        const refM = parseInt(fe.chargeMonth || "01");
        if (per === "Mensual") return true;
        if (per === "Trimestral") return Math.abs(currM - refM) % 3 === 0;
        if (per === "Semestral") return Math.abs(currM - refM) % 6 === 0;
        if (per === "Anual") return fe.chargeMonth === currentMNum;
        return true;
    });

    const totalFixedCommitted = applicableFixed.reduce((sum, fe) => sum + (parseFloat(fe.amount) || 0), 0);
        
    // Presupuesto manual explícito por bancos (si existe en Cierre de Mes)
    let explicitBudget = 0;
    if (state.budgets && state.budgets[state.currentMonth]) {
        Object.values(state.budgets[state.currentMonth]).forEach(b => {
            explicitBudget += (parseFloat(b.expectedExpense) || 0);
        });
    }

    // Nómina / Ingreso planificado en el Embudo
    const plan = state.plannedIncomes && state.plannedIncomes[state.currentMonth];
    const plannedSalary = plan && plan.amount > 0 ? parseFloat(plan.amount) : 0;
    
    const paceAmountEl = document.getElementById("dash-pace-amount");
    const paceLabelEl = document.getElementById("dash-pace-label");
    const remainingBudgetEl = document.getElementById("dash-remaining-budget");
    const remainingBudgetLabelEl = document.getElementById("dash-remaining-budget-label");
    const paceProgressBar = document.getElementById("dash-pace-progress-bar");
    const paceDescEl = document.getElementById("dash-pace-description");

    const dayProgressPct = Math.min(100, Math.round((currentDay / totalDaysInMonth) * 100));
    if (paceProgressBar) paceProgressBar.style.width = `${dayProgressPct}%`;

    if (explicitBudget > 0) {
        // Opción 1: Presupuesto configurado explícitamente en Cierre de Mes
        const remainingBudget = Math.max(0, explicitBudget - monthlyExpenses);
        const dailyPace = isCurrent ? (remainingBudget / remainingDays) : 0;
        
        if (paceLabelEl) paceLabelEl.textContent = "Ritmo de Gasto Disponible";
        if (paceAmountEl) paceAmountEl.textContent = isCurrent ? `${formatCurrency(dailyPace)} / día` : "Mes finalizado";
        if (remainingBudgetLabelEl) remainingBudgetLabelEl.textContent = "Presupuesto Restante";
        if (remainingBudgetEl) remainingBudgetEl.textContent = formatCurrency(remainingBudget);
        
        if (paceDescEl) {
            if (isCurrent) {
                paceDescEl.innerHTML = `Día <strong>${currentDay}</strong> de ${totalDaysInMonth} (quedan <strong>${remainingDays} días</strong>). Llevas gastados <strong>${formatCurrency(monthlyExpenses)}</strong> de ${formatCurrency(explicitBudget)} presupuestados.`;
            } else {
                paceDescEl.textContent = `Resumen de ${formatMonthString(state.currentMonth)}: Gastados ${formatCurrency(monthlyExpenses)} de ${formatCurrency(explicitBudget)} presupuestados.`;
            }
        }
    } else if (plannedSalary > 0) {
        // Opción 2: Nómina o ingreso mensual previsto registrado en el Embudo
        const remainingSalary = Math.max(0, plannedSalary - monthlyExpenses);
        const dailyPace = isCurrent ? (remainingSalary / remainingDays) : 0;
        
        if (paceLabelEl) paceLabelEl.textContent = "Margen Diario Disponible";
        if (paceAmountEl) paceAmountEl.textContent = isCurrent ? `${formatCurrency(dailyPace)} / día` : "Mes finalizado";
        if (remainingBudgetLabelEl) remainingBudgetLabelEl.textContent = "Disponible de Nómina";
        if (remainingBudgetEl) remainingBudgetEl.textContent = formatCurrency(remainingSalary);
        
        if (paceDescEl) {
            if (isCurrent) {
                paceDescEl.innerHTML = `Día <strong>${currentDay}</strong> de ${totalDaysInMonth} (quedan <strong>${remainingDays} días</strong>). Llevas gastados <strong>${formatCurrency(monthlyExpenses)}</strong> sobre tu nómina prevista de ${formatCurrency(plannedSalary)}.`;
            } else {
                paceDescEl.textContent = `Resumen de ${formatMonthString(state.currentMonth)}: Gastados ${formatCurrency(monthlyExpenses)} de ${formatCurrency(plannedSalary)} previstos.`;
            }
        }
    } else {
        // Opción 3: Sin presupuesto fijado aún. Mostramos el gasto medio diario real y los fijos previstos
        const avgDailySpent = currentDay > 0 ? (monthlyExpenses / currentDay) : 0;
        
        if (paceLabelEl) paceLabelEl.textContent = "Gasto Diario Medio";
        if (paceAmountEl) paceAmountEl.textContent = isCurrent ? `${formatCurrency(avgDailySpent)} / día` : `${formatCurrency(monthlyExpenses / totalDaysInMonth)} / día`;
        if (remainingBudgetLabelEl) remainingBudgetLabelEl.textContent = "Fijos Comprometidos";
        if (remainingBudgetEl) remainingBudgetEl.textContent = formatCurrency(totalFixedCommitted);
        
        if (paceDescEl) {
            if (isCurrent) {
                paceDescEl.innerHTML = `Día <strong>${currentDay}</strong> de ${totalDaysInMonth} (quedan <strong>${remainingDays} días</strong>). Llevas gastados <strong>${formatCurrency(monthlyExpenses)}</strong> en ${currentDay} días. Fijos comprometidos del mes: <strong>${formatCurrency(totalFixedCommitted)}</strong>.`;
            } else {
                paceDescEl.textContent = `Total gastado en ${formatMonthString(state.currentMonth)}: ${formatCurrency(monthlyExpenses)}. Gastos fijos: ${formatCurrency(totalFixedCommitted)}.`;
            }
        }
    }
    
    // 2. Próximos Recibos Fijos (Pendientes de cobro en el mes)
    const upcomingContainer = document.getElementById("dash-upcoming-fixed-list");
    const upcomingBadge = document.getElementById("dash-upcoming-count-badge");
    
    if (upcomingContainer) {
        upcomingContainer.innerHTML = "";
        
        // Identificar cuáles ya han sido cobrados/pasados a transacciones este mes
        const pendingFixed = applicableFixed.filter(fe => {
            const feNameLower = (fe.name || "").toLowerCase().trim();
            const isPaid = (state.transactions || []).some(t => {
                if (t.type !== "expense" || t.month !== state.currentMonth) return false;
                
                const tDescLower = (t.description || "").toLowerCase().trim();
                const isFixedSubtype = (t.subtype === "Fixed" || t.subtype === "Fijo");
                
                // 1. Coincidencia exacta por nombre y banco
                if (t.description === fe.name && (!fe.bankId || t.bankId === fe.bankId)) return true;
                
                // 2. Coincidencia por subtipo Fixed y nombre contenido
                if (isFixedSubtype && (tDescLower.includes(feNameLower) || feNameLower.includes(tDescLower))) return true;
                
                // 3. Coincidencia exacta de concepto (ej: usuario apuntó "Netflix" o "YouTube")
                if (tDescLower === feNameLower) return true;
                
                // 4. Coincidencia si el concepto contiene el nombre del gasto fijo e importe coincide
                if ((tDescLower.includes(feNameLower) || feNameLower.includes(tDescLower)) && Math.abs(t.amount - fe.amount) < 0.01) return true;
                
                return false;
            });
            return !isPaid;
        });
        
        // Ordenar: Próximos (día de hoy o futuro) primero, y pasados pendientes al final
        pendingFixed.sort((a, b) => {
            const dayA = parseInt(a.day || a.chargeDay || 1);
            const dayB = parseInt(b.day || b.chargeDay || 1);
            const isPastA = isCurrent && (dayA < currentDay);
            const isPastB = isCurrent && (dayB < currentDay);
            
            if (isPastA !== isPastB) {
                return isPastA ? 1 : -1; // Los que están por venir van primero
            }
            return dayA - dayB;
        });
        
        if (upcomingBadge) upcomingBadge.textContent = pendingFixed.length;
        
        if (pendingFixed.length === 0) {
            upcomingContainer.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; text-align: center; color: var(--success-light); font-size: 0.8rem; font-weight: 600;">
                    🎉 ¡Todos los recibos fijos previstos de este mes están cobrados!
                </div>
            `;
        } else {
            pendingFixed.slice(0, 5).forEach(fe => {
                const bank = state.banks.find(b => b.id === fe.bankId);
                const bankName = bank ? bank.name : "Cuenta";
                const day = parseInt(fe.day || fe.chargeDay || 1);
                const isPast = isCurrent && (day < currentDay);
                const isUrgent = isCurrent && (day >= currentDay && day <= currentDay + 3);
                
                let dayBadgeHTML = "";
                if (isPast) {
                    dayBadgeHTML = `<span style="font-weight: 700; font-size: 0.72rem; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 6px; padding: 2px 6px;" title="Fecha de cobro prevista anterior a hoy">Día ${day} (Pendiente)</span>`;
                } else if (isUrgent) {
                    dayBadgeHTML = `<span style="font-weight: 700; font-size: 0.72rem; background: rgba(244, 63, 94, 0.2); color: var(--danger-light); border: 1px solid rgba(244, 63, 94, 0.4); border-radius: 6px; padding: 2px 6px;" title="Vence en los próximos 3 días">Día ${day}</span>`;
                } else {
                    dayBadgeHTML = `<span style="font-weight: 700; font-size: 0.72rem; background: rgba(0, 229, 255, 0.12); color: var(--primary-light); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 6px; padding: 2px 6px;">Día ${day}</span>`;
                }
                
                const item = document.createElement("div");
                item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); font-size: 0.82rem;";
                
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${dayBadgeHTML}
                        <div>
                            <strong style="color: var(--text-primary); display: block;">${fe.name}</strong>
                            <span style="font-size: 0.7rem; color: var(--text-muted);">${bankName}</span>
                        </div>
                    </div>
                    <span style="font-weight: 700; color: var(--danger-light); font-size: 0.9rem;">
                        -${formatCurrency(fe.amount)}
                    </span>
                `;
                upcomingContainer.appendChild(item);
            });
        }
    }
    
    // 3. Últimos Movimientos del Mes
    const recentTxContainer = document.getElementById("dash-recent-tx-list");
    if (recentTxContainer) {
        recentTxContainer.innerHTML = "";
        
        const monthTx = (state.transactions || [])
            .filter(t => t.month === state.currentMonth)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            
        if (monthTx.length === 0) {
            recentTxContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 0.78rem; padding: 10px;">
                    Aún no hay movimientos registrados este mes.
                </div>
            `;
        } else {
            monthTx.slice(0, 4).forEach(tx => {
                const bank = state.banks.find(b => b.id === tx.bankId);
                const bankName = bank ? bank.name : "";
                const isExpense = tx.type === "expense";
                const color = isExpense ? "var(--danger-light)" : "var(--success-light)";
                const sign = isExpense ? "-" : "+";
                
                const row = document.createElement("div");
                row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem;";
                
                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                        <span style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; flex-shrink: 0;">${tx.date ? tx.date.substring(8, 10) + '/' + tx.date.substring(5, 7) : '--/--'}</span>
                        <span style="font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tx.description}</span>
                        ${bankName ? `<span style="font-size: 0.66rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 1px 5px; border-radius: 4px; flex-shrink: 0;">${bankName}</span>` : ""}
                    </div>
                    <span style="font-weight: 700; color: ${color}; margin-left: 8px; flex-shrink: 0;">
                        ${sign}${formatCurrency(tx.amount)}
                    </span>
                `;
                recentTxContainer.appendChild(row);
            });
        }
    }
}

function initQuickExpenseModal() {
    const btnOpen = document.getElementById("btn-quick-add-expense-dash");
    const modal = document.getElementById("modal-quick-expense");
    const btnClose = document.getElementById("btn-close-quick-expense");
    const btnCancel = document.getElementById("btn-cancel-quick-expense");
    const form = document.getElementById("form-quick-expense-modal");
    
    if (!btnOpen || !modal || !form) return;
    
    const openModal = () => {
        modal.classList.remove("hidden");
        const dateInput = document.getElementById("quick-expense-date");
        if (dateInput) dateInput.value = getTodayString();
        
        const catSelect = document.getElementById("quick-expense-category");
        if (catSelect) {
            const categories = ["Alimentación / Super", "Ocio / Salidas", "Transporte / Gasolina", "Hogar / Compras", "Salud / Farmacia", "Suscripciones", "Restaurantes", "Ropa / Calzado", "Educación", "Mascotas", "Regalos", "Otros"];
            catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join("");
        }
        
        const bankSelect = document.getElementById("quick-expense-bank");
        if (bankSelect) {
            const normalBanks = state.banks.filter(b => b.bankType === "normal" || !b.bankType);
            bankSelect.innerHTML = normalBanks.map(b => `<option value="${b.id}">${b.name} (${formatCurrency(b.balance)})` + `</option>`).join("");
        }
        
        const amountInput = document.getElementById("quick-expense-amount");
        if (amountInput) {
            amountInput.value = "";
            setTimeout(() => amountInput.focus(), 100);
        }
        const descInput = document.getElementById("quick-expense-desc");
        if (descInput) descInput.value = "";
    };
    
    const closeModal = () => {
        modal.classList.add("hidden");
        form.reset();
    };
    
    btnOpen.addEventListener("click", openModal);
    if (btnClose) btnClose.addEventListener("click", closeModal);
    if (btnCancel) btnCancel.addEventListener("click", closeModal);
    
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
    
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById("quick-expense-amount").value);
        const desc = document.getElementById("quick-expense-desc").value.trim();
        const category = document.getElementById("quick-expense-category").value;
        const bankId = document.getElementById("quick-expense-bank").value;
        const date = document.getElementById("quick-expense-date").value;
        
        if (isNaN(amount) || amount <= 0 || !desc || !bankId || !date) {
            showToast("Por favor complete todos los datos requeridos.", "danger");
            return;
        }
        
        const bank = state.banks.find(b => b.id === bankId);
        if (!bank) return;
        
        bank.balance = parseFloat((bank.balance - amount).toFixed(2));
        
        const txMonth = date.substring(0, 7);
        const newTx = {
            id: "tx_quick_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            type: "expense",
            subtype: "Variable",
            category: category,
            description: desc,
            amount: amount,
            bankId: bankId,
            date: date,
            month: txMonth
        };
        
        state.transactions.push(newTx);
        saveState();
        closeModal();
        showToast(`Gasto de ${formatCurrency(amount)} restado de "${bank.name}".`, "success");
    });
}


function initBanksManager() {
    const btnShowAdd = document.getElementById("btn-show-add-bank");
    const formAdd = document.getElementById("form-add-bank");
    const btnCancel = document.getElementById("btn-cancel-add-bank");

    btnShowAdd.addEventListener("click", () => {
        formAdd.classList.toggle("hidden");
        if (!formAdd.classList.contains("hidden")) {
            renderDepositDestBanksOptions("bank-deposit-dest-bank");
            const startDateEl = document.getElementById("bank-deposit-start-date");
            if (startDateEl && !startDateEl.value) {
                startDateEl.value = getTodayString();
            }
        }
    });

    const bankTypeEl = document.getElementById("bank-type");
    if (bankTypeEl) {
        bankTypeEl.addEventListener("change", () => {
            const isPension = bankTypeEl.value === 'pension' || bankTypeEl.value === 'investment';
            const isDeposit = bankTypeEl.value === 'deposit';
            
            document.getElementById('pension-hint').classList.toggle('hidden', !isPension);
            const depHint = document.getElementById('deposit-hint');
            if (depHint) depHint.classList.toggle('hidden', !isDeposit);

            const depFields = document.getElementById('deposit-fields-container');
            if (depFields) depFields.classList.toggle('hidden', !isDeposit);

            const minBalGroup = document.getElementById('bank-min-balance-group');
            if (minBalGroup) minBalGroup.classList.toggle('hidden', isDeposit);

            if (isDeposit) {
                renderDepositDestBanksOptions("bank-deposit-dest-bank");
                const startDateEl = document.getElementById("bank-deposit-start-date");
                if (startDateEl && !startDateEl.value) {
                    startDateEl.value = getTodayString();
                }
            }

            const labelEl = document.getElementById('pension-balance-label');
            if (labelEl) {
                const config = CURRENCY_CONFIGS[state.currency || 'EUR'] || CURRENCY_CONFIGS.EUR;
                labelEl.textContent = isPension ? `Aportación Inicial (${config.symbol})` : (isDeposit ? `Capital a Depositar (${config.symbol})` : `Saldo Inicial (${config.symbol})`);
                labelEl.dataset.baseText = isPension ? 'Aportación Inicial' : (isDeposit ? 'Capital a Depositar' : 'Saldo Inicial');
            }
        });
    }

    // Inicializar el selector de categorías/propósitos al arrancar
    initTagSelector("bank-purpose-tags-container");

    btnCancel.addEventListener("click", () => {
        formAdd.classList.add("hidden");
        formAdd.reset();
        if (bankTypeEl) bankTypeEl.value = "normal";
        document.getElementById("pension-hint").classList.add("hidden");
        const depHint = document.getElementById("deposit-hint");
        if (depHint) depHint.classList.add("hidden");
        const depFields = document.getElementById("deposit-fields-container");
        if (depFields) depFields.classList.add("hidden");
        const minBalGroup = document.getElementById('bank-min-balance-group');
        if (minBalGroup) minBalGroup.classList.remove('hidden');

        // Forzar actualización de etiquetas de divisa en el formulario resetado
        const config = CURRENCY_CONFIGS[state.currency || 'EUR'] || CURRENCY_CONFIGS.EUR;
        const labelEl = document.getElementById('pension-balance-label');
        if (labelEl) {
            labelEl.textContent = `Saldo Inicial (${config.symbol})`;
            labelEl.dataset.baseText = 'Saldo Inicial';
        }
        // Resetear selector de etiquetas
        initTagSelector("bank-purpose-tags-container");
    });

    formAdd.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("bank-name").value.trim();
        const initialBalance = parseFloat(document.getElementById("bank-initial-balance").value);
        const bankType = document.getElementById("bank-type").value || "normal";
        const purpose = document.getElementById("bank-purpose-tags-container-value")?.value.trim() || "";
        const minVal = document.getElementById("bank-min-balance")?.value;
        const minBalance = (minVal !== undefined && minVal !== "") ? parseFloat(minVal) : null;

        if (!name || isNaN(initialBalance)) {
            showToast("Por favor complete los campos correctamente.", "danger");
            return;
        }

        let depositData = null;
        if (bankType === "deposit") {
            const tae = parseFloat(document.getElementById("bank-deposit-tae").value);
            const durationMonths = parseInt(document.getElementById("bank-deposit-duration").value);
            const startDate = document.getElementById("bank-deposit-start-date").value || getTodayString();
            const taxRateVal = document.getElementById("bank-deposit-tax-rate").value;
            const taxRate = taxRateVal !== "" ? parseFloat(taxRateVal) : 19;
            const destinationBankId = document.getElementById("bank-deposit-dest-bank").value;

            if (isNaN(tae) || isNaN(durationMonths) || durationMonths <= 0 || !destinationBankId) {
                showToast("Por favor complete los datos del depósito (TAE, plazo y cuenta destino).", "danger");
                return;
            }

            depositData = {
                tae: tae,
                durationMonths: durationMonths,
                startDate: startDate,
                taxRate: isNaN(taxRate) ? 19 : taxRate,
                destinationBankId: destinationBankId
            };
        }

        const newBank = {
            id: "b_" + Date.now(),
            name: name,
            balance: initialBalance,
            bankType: bankType,
            purpose: purpose,
            minBalance: isNaN(minBalance) ? null : minBalance,
            targetBalance: null,
            estimatedValue: (bankType === "pension" || bankType === "investment") ? initialBalance : null,
            valuations: (bankType === "pension" || bankType === "investment") ? [{ date: new Date().toISOString().split('T')[0], balance: initialBalance, estimatedValue: initialBalance }] : null,
            tae: depositData ? depositData.tae : null,
            durationMonths: depositData ? depositData.durationMonths : null,
            startDate: depositData ? depositData.startDate : null,
            taxRate: depositData ? depositData.taxRate : null,
            destinationBankId: depositData ? depositData.destinationBankId : null,
            maturedTransferDone: false,
            createdAt: new Date().toISOString()
        };

        state.banks.push(newBank);

        // Inicializar su presupuesto en el mes activo para evitar inconsistencias
        if (!state.budgets[state.currentMonth]) {
            state.budgets[state.currentMonth] = {};
        }
        state.budgets[state.currentMonth][newBank.id] = {
            expectedIncome: 0,
            expectedExpense: 0
        };

        formAdd.classList.add("hidden");
        formAdd.reset();
        // Restaurar tipo a normal tras el reset
        if (bankTypeEl) bankTypeEl.value = "normal";
        document.getElementById("pension-hint").classList.add("hidden");
        const depHint = document.getElementById("deposit-hint");
        if (depHint) depHint.classList.add("hidden");
        const depFields = document.getElementById("deposit-fields-container");
        if (depFields) depFields.classList.add("hidden");
        const minBalGroup = document.getElementById('bank-min-balance-group');
        if (minBalGroup) minBalGroup.classList.remove('hidden');

        // Resetear el selector de etiquetas
        initTagSelector("bank-purpose-tags-container");

        let typeLabel = "Banco";
        if (bankType === "pension" || bankType === "investment") typeLabel = "Plan/Inversión";
        else if (bankType === "deposit") typeLabel = "Depósito a Plazo Fijo";

        showToast(`${typeLabel} "${name}" creado con éxito.`, "success");
        saveState();
    });
}

function initTransferForm() {
    const btnShowTransfer = document.getElementById("btn-show-transfer");
    const formTransfer = document.getElementById("form-transfer-money");
    const btnCancel = document.getElementById("btn-cancel-transfer");

    if (!btnShowTransfer || !formTransfer || !btnCancel) return;

    btnShowTransfer.addEventListener("click", () => {
        formTransfer.classList.toggle("hidden");
        if (!formTransfer.classList.contains("hidden")) {
            // Rellenar fecha de hoy por defecto
            document.getElementById("transfer-date").value = new Date().toISOString().split('T')[0];
            renderTransferDropdowns();
        }
    });

    btnCancel.addEventListener("click", () => {
        formTransfer.classList.add("hidden");
        formTransfer.reset();
    });

    formTransfer.addEventListener("submit", (e) => {
        e.preventDefault();
        const fromBankId = document.getElementById("transfer-from-bank").value;
        const toBankId = document.getElementById("transfer-to-bank").value;
        const amount = parseFloat(document.getElementById("transfer-amount").value);
        const date = document.getElementById("transfer-date").value;
        const desc = document.getElementById("transfer-desc").value.trim() || "Traspaso de fondos";

        if (!fromBankId || !toBankId || isNaN(amount) || amount <= 0 || !date) {
            showToast("Por favor, complete todos los campos correctamente.", "danger");
            return;
        }

        if (fromBankId === toBankId) {
            showToast("La cuenta de origen y destino no pueden ser la misma.", "danger");
            return;
        }

        const fromBank = state.banks.find(b => b.id === fromBankId);
        const toBank = state.banks.find(b => b.id === toBankId);

        if (!fromBank || !toBank) {
            showToast("Una de las cuentas seleccionadas no existe.", "danger");
            return;
        }

        if (fromBank.balance < amount) {
            if (!confirm(`El saldo disponible en "${fromBank.name}" (${formatCurrency(fromBank.balance)}) es menor que el importe a traspasar (${formatCurrency(amount)}). ¿Desea continuar de todos modos?`)) {
                return;
            }
        }

        // Obtener mes a partir de la fecha seleccionada
        const dateObj = new Date(date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const txMonth = `${yyyy}-${mm}`;

        // 1. Modificar saldos de las cuentas
        fromBank.balance -= amount;
        toBank.balance += amount;

        // Si son de tipo inversión/pensión, también actualizamos su estimatedValue si no tiene historial, o agregamos una valoración si procede
        if (fromBank.bankType === "pension" || fromBank.bankType === "investment") {
            fromBank.estimatedValue = (fromBank.estimatedValue ?? fromBank.balance) - amount;
            if (fromBank.valuations) {
                fromBank.valuations.push({ date, balance: fromBank.balance, estimatedValue: fromBank.estimatedValue });
                fromBank.valuations.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        }
        if (toBank.bankType === "pension" || toBank.bankType === "investment") {
            toBank.estimatedValue = (toBank.estimatedValue ?? toBank.balance) + amount;
            if (toBank.valuations) {
                toBank.valuations.push({ date, balance: toBank.balance, estimatedValue: toBank.estimatedValue });
                toBank.valuations.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        }

        // 2. Crear las dos transacciones recíprocas tipo Traspaso
        const txExpense = {
            id: "tx_" + Date.now() + "_1",
            type: "expense",
            subtype: "Traspaso",
            description: `${desc} (Hacia ${toBank.name})`,
            amount: amount,
            bankId: fromBankId,
            date: date,
            month: txMonth,
            createdAt: new Date().toISOString()
        };

        const txIncome = {
            id: "tx_" + Date.now() + "_2",
            type: "income",
            subtype: "Traspaso",
            description: `${desc} (Desde ${fromBank.name})`,
            amount: amount,
            bankId: toBankId,
            date: date,
            month: txMonth,
            createdAt: new Date().toISOString()
        };

        state.transactions.push(txExpense);
        state.transactions.push(txIncome);

        showToast(`Traspaso de ${formatCurrency(amount)} realizado con éxito.`, "success");
        formTransfer.classList.add("hidden");
        formTransfer.reset();
        
        renderAll();
        saveState();
    });
}

function renderTransferDropdowns() {
    const fromSelect = document.getElementById("transfer-from-bank");
    const toSelect = document.getElementById("transfer-to-bank");

    if (!fromSelect || !toSelect) return;

    fromSelect.innerHTML = `<option value="">-- Seleccione Origen --</option>`;
    toSelect.innerHTML = `<option value="">-- Seleccione Destino --</option>`;

    state.banks.forEach(bank => {
        const typeText = bank.bankType === "pension" ? "Plan" : bank.bankType === "investment" ? "Inv." : "CC";
        const opt = `<option value="${bank.id}">${bank.name} (${typeText}: ${formatCurrency(bank.balance)})</option>`;
        fromSelect.insertAdjacentHTML("beforeend", opt);
        toSelect.insertAdjacentHTML("beforeend", opt);
    });
}

function deleteBank(bankId) {
    const bank = state.banks.find(b => b.id === bankId);
    if (!bank) return;

    if (confirm(`¿Está seguro de que desea eliminar el banco "${bank.name}"?\nSe borrarán permanentemente sus saldos y asignaciones, pero el histórico de transacciones se conservará.`)) {
        // Eliminar banco
        state.banks = state.banks.filter(b => b.id !== bankId);
        
        // Limpiar su presupuesto en todos los meses
        Object.keys(state.budgets).forEach(month => {
            if (state.budgets[month][bankId]) {
                delete state.budgets[month][bankId];
            }
        });

        // Limpiar gastos fijos vinculados obligatoriamente a este banco
        state.fixedExpenses = state.fixedExpenses.filter(fe => fe.bankId !== bankId);

        showToast(`Banco "${bank.name}" eliminado correctamente.`, "danger");
        saveState();
    }
}

// ----------------------------------------------------
// 7. MÓDULO 1: TABLERO - EL EMBUDO DE INGRESOS (THE FUNNEL)
// ----------------------------------------------------

let funnelMode = "percent"; // "percent" o "euro"

function initIncomeFunnel() {
    const form = document.getElementById("form-income-funnel");
    const amountInput = document.getElementById("income-amount");
    const modePercentBtn = document.getElementById("btn-mode-percent");
    const modeEuroBtn = document.getElementById("btn-mode-euro");
    const equalBtn = document.getElementById("btn-funnel-equal");
    const clearBtn = document.getElementById("btn-funnel-clear");

    // Conmutadores de Modo
    modePercentBtn.addEventListener("click", () => {
        funnelMode = "percent";
        modePercentBtn.classList.add("active");
        modeEuroBtn.classList.remove("active");
        renderFunnelInputs();
        validateFunnel();
    });

    modeEuroBtn.addEventListener("click", () => {
        funnelMode = "euro";
        modeEuroBtn.classList.add("active");
        modePercentBtn.classList.remove("active");
        renderFunnelInputs();
        validateFunnel();
    });

    // Escuchar el importe principal para cálculos en tiempo real
    amountInput.addEventListener("input", () => {
        document.getElementById("funnel-source-display").textContent = formatCurrency(parseFloat(amountInput.value) || 0);
        validateFunnel();
    });

    // Reparto Equitativo
    equalBtn.addEventListener("click", () => {
        const totalAmount = parseFloat(amountInput.value) || 0;
        if (totalAmount <= 0) {
            showToast("Introduce un importe a ingresar válido antes de repartir.", "danger");
            return;
        }

        const count = state.banks.length;
        if (count === 0) return;

        if (funnelMode === "percent") {
            const equalShare = parseFloat((100 / count).toFixed(2));
            state.banks.forEach((bank, idx) => {
                const input = document.getElementById(`funnel-input-${bank.id}`);
                if (input) {
                    // Compensar el redondeo en el último banco
                    if (idx === count - 1) {
                        input.value = (100 - (equalShare * (count - 1))).toFixed(2);
                    } else {
                        input.value = equalShare;
                    }
                }
            });
        } else {
            const equalShare = parseFloat((totalAmount / count).toFixed(2));
            state.banks.forEach((bank, idx) => {
                const input = document.getElementById(`funnel-input-${bank.id}`);
                if (input) {
                    if (idx === count - 1) {
                        input.value = (totalAmount - (equalShare * (count - 1))).toFixed(2);
                    } else {
                        input.value = equalShare;
                    }
                }
            });
        }
        validateFunnel();
    });

    // Cubrir Mínimos de Seguridad de forma inteligente y priorizada
    const fillMinBtn = document.getElementById("btn-funnel-fill-min");
    if (fillMinBtn) {
        fillMinBtn.addEventListener("click", () => {
            const totalAmount = parseFloat(amountInput.value) || 0;
            if (totalAmount <= 0) {
                showToast("Introduce un importe a ingresar válido antes de cubrir mínimos.", "danger");
                return;
            }

            const allocations = {};
            state.banks.forEach(b => allocations[b.id] = 0);

            // Cuentas con déficit de mínimos de seguridad
            const deficitBanks = state.banks
                .filter(b => b.minBalance !== null && b.minBalance !== undefined && b.balance < b.minBalance)
                .map(b => ({ id: b.id, deficit: b.minBalance - b.balance }))
                .sort((a, b) => b.deficit - a.deficit);

            if (deficitBanks.length === 0) {
                showToast("Todas tus cuentas cumplen con sus mínimos de seguridad.", "success");
                return;
            }

            let remaining = totalAmount;
            for (const item of deficitBanks) {
                if (remaining <= 0) break;
                const toAssign = Math.min(remaining, item.deficit);
                allocations[item.id] = parseFloat(toAssign.toFixed(2));
                remaining -= toAssign;
            }

            // Aplicar allocations a los inputs
            state.banks.forEach(bank => {
                const input = document.getElementById(`funnel-input-${bank.id}`);
                if (input) {
                    const allocatedAmount = allocations[bank.id] || 0;
                    if (allocatedAmount > 0) {
                        if (funnelMode === "percent") {
                            input.value = ((allocatedAmount / totalAmount) * 100).toFixed(2);
                        } else {
                            input.value = allocatedAmount.toFixed(2);
                        }
                    } else {
                        input.value = "";
                    }
                }
            });

            validateFunnel();

            const coveredSum = totalAmount - remaining;
            if (remaining > 0) {
                showToast(`Se han asignado ${formatCurrency(coveredSum)} para cubrir mínimos. Quedan ${formatCurrency(remaining)} por distribuir manualmente.`, "success");
            } else {
                const totalDeficit = deficitBanks.reduce((sum, b) => sum + b.deficit, 0);
                if (totalDeficit > totalAmount) {
                    showToast(`Se asignó todo el capital (${formatCurrency(totalAmount)}) a cubrir mínimos de seguridad. Faltan ${formatCurrency(totalDeficit - totalAmount)} para cubrirlos todos.`, "warning");
                } else {
                    showToast("¡Mínimos de seguridad cubiertos al 100%!", "success");
                }
            }
        });
    }

    // Limpiar Reparto
    clearBtn.addEventListener("click", () => {
        state.banks.forEach(bank => {
            const input = document.getElementById(`funnel-input-${bank.id}`);
            if (input) input.value = "";
        });
        validateFunnel();
    });

    // Enviar el Formulario del Embudo
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
            showToast("Este mes está cerrado y consolidado. No se pueden registrar ingresos.", "danger");
            return;
        }
        const totalAmount = parseFloat(amountInput.value);
        const type = document.getElementById("income-type").value;
        const description = document.getElementById("income-description").value.trim();

        if (isNaN(totalAmount) || totalAmount <= 0 || !description) {
            showToast("Complete los datos del ingreso.", "danger");
            return;
        }

        // Obtener distribuciones reales
        const distributions = [];
        state.banks.forEach(bank => {
            const input = document.getElementById(`funnel-input-${bank.id}`);
            const val = parseFloat(input.value) || 0;
            let allocatedAmount = 0;

            if (funnelMode === "percent") {
                allocatedAmount = parseFloat(((val / 100) * totalAmount).toFixed(2));
            } else {
                allocatedAmount = val;
            }

            if (allocatedAmount > 0) {
                distributions.push({
                    bankId: bank.id,
                    amount: allocatedAmount
                });
            }
        });

        // Aplicar a los bancos e inyectar balances
        distributions.forEach(dist => {
            const bank = state.banks.find(b => b.id === dist.bankId);
            if (bank) {
                bank.balance = parseFloat((bank.balance + dist.amount).toFixed(2));
            }
        });

        // Registrar transacción principal
        const newTx = {
            id: "tx_" + Date.now(),
            type: "income",
            subtype: type,
            description: description,
            amount: totalAmount,
            date: getTodayString(),
            month: state.currentMonth,
            distributions: distributions
        };

        state.transactions.push(newTx);
        form.reset();
        document.getElementById("funnel-source-display").textContent = "0.00 €";
        
        showToast("¡Ingreso canalizado por el embudo y distribuido con éxito!", "success");
        saveState();
    });

    // ── GUARDAR COMO PREVISTO ──
    const btnSavePlanned = document.getElementById("btn-save-planned");
    if (btnSavePlanned) {
        btnSavePlanned.addEventListener("click", () => {
            const totalAmount = parseFloat(amountInput.value);
            const type = document.getElementById("income-type").value;
            const description = document.getElementById("income-description").value.trim();

            if (isNaN(totalAmount) || totalAmount <= 0) {
                showToast("Introduce un importe válido antes de guardar como Previsto.", "danger");
                return;
            }

            // Guardar los valores actuales de los inputs del embudo
            const distValues = [];
            state.banks.forEach(bank => {
                const input = document.getElementById(`funnel-input-${bank.id}`);
                distValues.push({ bankId: bank.id, value: parseFloat(input?.value) || 0 });
            });

            if (!state.plannedIncomes) state.plannedIncomes = {};
            state.plannedIncomes[state.currentMonth] = {
                amount: totalAmount,
                type: type,
                description: description || "Sin descripción",
                distributions: distValues,
                mode: funnelMode
            };

            saveState();
            renderPlannedIncomeBanner();
            showToast("Plan de ingreso guardado correctamente. Se puede cargar en cualquier momento.", "success");
        });
    }

    // ── CARGAR PLAN PREVISTO ──
    const btnLoadPlanned = document.getElementById("btn-load-planned");
    if (btnLoadPlanned) {
        btnLoadPlanned.addEventListener("click", () => {
            const plan = state.plannedIncomes && state.plannedIncomes[state.currentMonth];
            if (!plan) return;

            // Restaurar modo
            if (plan.mode === "euro") {
                funnelMode = "euro";
                document.getElementById("btn-mode-euro").classList.add("active");
                document.getElementById("btn-mode-percent").classList.remove("active");
            } else {
                funnelMode = "percent";
                document.getElementById("btn-mode-percent").classList.add("active");
                document.getElementById("btn-mode-euro").classList.remove("active");
            }

            // Restaurar campos del formulario
            amountInput.value = plan.amount;
            document.getElementById("funnel-source-display").textContent = formatCurrency(plan.amount);
            document.getElementById("income-type").value = plan.type;
            document.getElementById("income-description").value = plan.description;

            // Regenerar inputs con el modo correcto y luego rellenar valores
            renderFunnelInputs();
            plan.distributions.forEach(d => {
                const input = document.getElementById(`funnel-input-${d.bankId}`);
                if (input) input.value = d.value || "";
            });

            validateFunnel();
            showToast("Plan previsto cargado en el embudo. Revísalo y aplica el ingreso real cuando quieras.", "success");
        });
    }

    // ── ELIMINAR PLAN PREVISTO ──
    const btnDeletePlanned = document.getElementById("btn-delete-planned");
    if (btnDeletePlanned) {
        btnDeletePlanned.addEventListener("click", () => {
            if (state.plannedIncomes) {
                delete state.plannedIncomes[state.currentMonth];
                saveState();
            }
            renderPlannedIncomeBanner();
            showToast("Plan previsto eliminado.", "warning");
        });
    }
}

// Muestra u oculta el banner de "Ingreso Previsto" según si hay un plan guardado para el mes actual
function renderPlannedIncomeBanner() {
    const banner = document.getElementById("planned-income-banner");
    if (!banner) return;

    const plan = state.plannedIncomes && state.plannedIncomes[state.currentMonth];

    if (plan) {
        banner.classList.remove("hidden");
        const labelEl = document.getElementById("planned-income-label");
        const descEl = document.getElementById("planned-income-desc");
        if (labelEl) labelEl.textContent = `Previsto: ${formatCurrency(plan.amount)}`;
        if (descEl) descEl.textContent = plan.description || "Sin descripción";
    } else {
        banner.classList.add("hidden");
    }
}

// Renderizar dinámicamente las entradas del embudo para los bancos creados
function renderFunnelInputs() {

    const listContainer = document.getElementById("funnel-distribution-list");
    const pipesContainer = document.getElementById("funnel-pipes-container");
    
    listContainer.innerHTML = "";
    pipesContainer.innerHTML = "";

    if (state.banks.length === 0) {
        document.getElementById("funnel-warning-no-banks").classList.remove("hidden");
        document.getElementById("form-income-funnel").classList.add("hidden");
        return;
    } else {
        document.getElementById("funnel-warning-no-banks").classList.add("hidden");
        document.getElementById("form-income-funnel").classList.remove("hidden");
    }

    state.banks.forEach(bank => {
        const isPension = bank.bankType === "pension" || bank.bankType === "investment";
        const labelPrefix = isPension ? "Aportado: " : "Saldo: ";
        // 1. Crear el Input en la lista con vista previa de saldo
        const item = document.createElement("div");
        item.className = "funnel-dist-item";
        item.innerHTML = `
            <div class="funnel-bank-label">
                <div class="funnel-bank-name">${bank.name} ${isPension ? '<span style="font-size: 0.7em;">(Inversión)</span>' : ''}</div>
                <div id="funnel-balance-preview-${bank.id}" class="funnel-balance-preview">
                    <span class="balance-current">${labelPrefix}${formatCurrency(bank.balance)}</span>
                </div>
            </div>
            <div class="dist-input-wrapper">
                <input type="number" id="funnel-input-${bank.id}" step="0.01" min="0" placeholder="0" class="funnel-bank-input" data-bank-id="${bank.id}">
                <span class="addon">${funnelMode === 'percent' ? '%' : '€'}</span>
            </div>
        `;
        listContainer.appendChild(item);

        // 2. Crear la Tubería Visual con saldo resultante sobre la columna
        const pipe = document.createElement("div");
        pipe.className = "funnel-pipe-column";
        pipe.innerHTML = `
            <div id="funnel-pipe-val-${bank.id}" class="funnel-pipe-val"></div>
            <div id="funnel-pipe-fill-${bank.id}" class="funnel-pipe-fill" style="height: 0%"></div>
            <div class="funnel-pipe-label">${bank.name.split(' ')[0]}</div>
        `;
        pipesContainer.appendChild(pipe);
    });

    // Añadir escuchadores a las nuevas entradas creadas
    const inputs = document.querySelectorAll(".funnel-bank-input");
    inputs.forEach(input => {
        input.addEventListener("input", () => {
            validateFunnel();
        });
    });
}

// Realiza cálculos de cuadre y actualiza la animación de las tuberías en tiempo real
function validateFunnel() {
    const totalIncome = parseFloat(document.getElementById("income-amount").value) || 0;
    const inputs = document.querySelectorAll(".funnel-bank-input");
    const validatorBar = document.getElementById("funnel-validator-bar");
    const statusText = document.getElementById("funnel-status-text");
    const progressBar = document.getElementById("funnel-validator-progress-bar");
    const submitBtn = document.getElementById("btn-submit-income");

    let sum = 0;
    inputs.forEach(input => {
        sum += parseFloat(input.value) || 0;
    });

    // Redondear sumas para evitar problemas de precisión en JS decimal
    sum = parseFloat(sum.toFixed(2));

    let isValid = false;
    let progressPercent = 0;
    let text = "";

    if (totalIncome <= 0) {
        text = "Ingrese un importe total de ingresos para iniciar el embudo.";
        isValid = false;
        progressPercent = 0;
    } else if (funnelMode === "percent") {
        progressPercent = Math.min((sum / 100) * 100, 100);
        if (sum === 100) {
            text = "¡Excelente! El reparto por porcentajes está completamente equilibrado (100%).";
            isValid = true;
        } else if (sum < 100) {
            text = `Llevas asignado un ${sum}%. Falta por repartir un ${(100 - sum).toFixed(2)}%.`;
        } else {
            text = `¡Exceso en el reparto! Te has pasado en un ${(sum - 100).toFixed(2)}%.`;
        }
    } else { // Modo Euros
        progressPercent = Math.min((sum / totalIncome) * 100, 100);
        if (sum === totalIncome) {
            text = `¡Excelente! El reparto coincide perfectamente con el importe total (${formatCurrency(totalIncome)}).`;
            isValid = true;
        } else if (sum < totalIncome) {
            text = `Asignado: ${formatCurrency(sum)}. Pendiente de asignar: ${formatCurrency(totalIncome - sum)}.`;
        } else {
            text = `¡Exceso en el reparto! Has distribuido ${formatCurrency(sum)} (${formatCurrency(sum - totalIncome)} de más).`;
        }
    }

    // Actualizar barra de progreso y clases de estado
    progressBar.style.width = `${progressPercent}%`;
    if (isValid) {
        validatorBar.className = "funnel-validator balanced";
        submitBtn.removeAttribute("disabled");
    } else {
        validatorBar.className = "funnel-validator error";
        submitBtn.setAttribute("disabled", "true");
    }
    statusText.textContent = text;

    // ACTUALIZAR LAS TUBERÍAS DEL EMBUDO FÍSICO Y VISTA PREVIA DE SALDO
    state.banks.forEach(bank => {
        const input = document.getElementById(`funnel-input-${bank.id}`);
        const fill = document.getElementById(`funnel-pipe-fill-${bank.id}`);
        const previewDiv = document.getElementById(`funnel-balance-preview-${bank.id}`);
        const pipeValDiv = document.getElementById(`funnel-pipe-val-${bank.id}`);
        if (!input || !fill) return;

        const val = parseFloat(input.value) || 0;
        let pipeHeight = 0;
        let allocatedAmount = 0;

        if (totalIncome > 0) {
            if (funnelMode === "percent") {
                pipeHeight = Math.min(val, 100);
                allocatedAmount = parseFloat(((val / 100) * totalIncome).toFixed(2));
            } else {
                pipeHeight = Math.min((val / totalIncome) * 100, 100);
                allocatedAmount = val;
            }
        }
        fill.style.height = `${pipeHeight}%`;

        const currentBalance = bank.balance || 0;
        const projectedBalance = parseFloat((currentBalance + allocatedAmount).toFixed(2));

        const isPension = bank.bankType === "pension" || bank.bankType === "investment";
        const labelPrefix = isPension ? "Aportado: " : "Saldo: ";

        // 1. Actualizar la vista previa de saldo en la lista de reparto
        if (previewDiv) {
            if (allocatedAmount > 0) {
                previewDiv.innerHTML = `
                    <span class="balance-current">${formatCurrency(currentBalance)}</span>
                    <span class="balance-arrow">→</span>
                    <span class="balance-projected" style="color: var(--success-light); font-weight: bold;">${formatCurrency(projectedBalance)}</span>
                `;
            } else {
                previewDiv.innerHTML = `
                    <span class="balance-current">${labelPrefix}${formatCurrency(currentBalance)}</span>
                `;
            }
        }

        // 2. Actualizar el valor proyectado sobre las columnas/tuberías visuales
        if (pipeValDiv) {
            pipeValDiv.textContent = formatCurrency(projectedBalance);
            if (allocatedAmount > 0) {
                pipeValDiv.classList.add("visible");
                pipeValDiv.classList.add("highlighted");
            } else {
                pipeValDiv.classList.add("visible");
                pipeValDiv.classList.remove("highlighted");
            }
        }
    });
}

// ----------------------------------------------------
// 8. MÓDULO 2: GASTOS FIJOS (MATRIZ)
// ----------------------------------------------------

function initFixedExpenses() {
    const btnShow = document.getElementById("btn-show-add-fixed");
    const form = document.getElementById("form-add-fixed-expense");
    const btnCancel = document.getElementById("btn-cancel-add-fixed");
    const btnApply = document.getElementById("btn-execute-fixed-expenses");

    btnShow.addEventListener("click", () => {
        form.classList.toggle("hidden");
    });

    btnCancel.addEventListener("click", () => {
        form.classList.add("hidden");
        form.reset();
        document.getElementById("fixed-charge-month-group").classList.add("hidden");
    });

    // Toggle reactivo para el mes de cobro si no es Mensual
    const periodicitySelect = document.getElementById("fixed-periodicity");
    const chargeMonthGroup = document.getElementById("fixed-charge-month-group");
    if (periodicitySelect && chargeMonthGroup) {
        periodicitySelect.addEventListener("change", () => {
            if (periodicitySelect.value !== "Mensual") {
                chargeMonthGroup.classList.remove("hidden");
            } else {
                chargeMonthGroup.classList.add("hidden");
            }
        });
    }

    // Formulario de guardar gasto fijo en la matriz
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
            showToast("Este mes está cerrado y consolidado. No se pueden añadir gastos fijos.", "danger");
            return;
        }
        const name = document.getElementById("fixed-name").value.trim();
        const amount = parseFloat(document.getElementById("fixed-amount").value);
        const bankId = document.getElementById("fixed-bank-id").value;
        const day = parseInt(document.getElementById("fixed-day").value) || 1;
        const periodicity = document.getElementById("fixed-periodicity").value;
        const chargeMonth = periodicity !== "Mensual" ? document.getElementById("fixed-charge-month").value : null;
        const destBankId = document.getElementById("fixed-dest-bank-id")?.value || null;

        if (!name || isNaN(amount) || amount <= 0 || !bankId || isNaN(day) || day < 1 || day > 31) {
            showToast("Complete todos los campos del gasto fijo correctamente.", "danger");
            return;
        }

        const newFE = {
            id: "fe_" + Date.now(),
            name: name,
            amount: amount,
            bankId: bankId,
            destBankId: destBankId,
            day: day,
            periodicity: periodicity,
            chargeMonth: chargeMonth
        };

        state.fixedExpenses.push(newFE);
        form.classList.add("hidden");
        form.reset();
        if (chargeMonthGroup) chargeMonthGroup.classList.add("hidden");

        showToast(`Gasto fijo "${name}" añadido a la plantilla de matriz.`, "success");
        saveState();
    });

    // APLICAR GASTOS FIJOS DEL MES AL SALDO REAL
    btnApply.addEventListener("click", () => {
        if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
            showToast("Este mes está cerrado y consolidado. No se pueden aplicar gastos recurrentes.", "danger");
            return;
        }
        if (state.fixedExpenses.length === 0) {
            showToast("No hay gastos fijos registrados en la matriz.", "danger");
            return;
        }

        let appliedCount = 0;
        let skippedCount = 0;
        const currentMonthNumber = state.currentMonth.split("-")[1]; // "MM"
        const currentM = parseInt(currentMonthNumber);

        const sysDate = new Date();
        const sysMonthStr = `${sysDate.getFullYear()}-${String(sysDate.getMonth() + 1).padStart(2, '0')}`;
        const isCurrentMonth = (state.currentMonth === sysMonthStr);
        const isFutureMonth = (state.currentMonth > sysMonthStr);
        const currentDay = sysDate.getDate();

        state.fixedExpenses.forEach(fe => {
            // Verificar si corresponde cobrar este mes
            const periodicity = fe.periodicity || "Mensual";
            const refM = parseInt(fe.chargeMonth || "01");

            let appliesThisMonth = false;
            if (periodicity === "Mensual") {
                appliesThisMonth = true;
            } else if (periodicity === "Trimestral") {
                appliesThisMonth = (Math.abs(currentM - refM) % 3 === 0);
            } else if (periodicity === "Semestral") {
                appliesThisMonth = (Math.abs(currentM - refM) % 6 === 0);
            } else if (periodicity === "Anual") {
                appliesThisMonth = (fe.chargeMonth === currentMonthNumber);
            }

            if (!appliesThisMonth) {
                return; // No corresponde cobrar en este mes
            }

            // Calcular la fecha exacta del cargo acotándola a la cantidad de días del mes
            const [year, month] = state.currentMonth.split("-").map(Number);
            const maxDays = new Date(year, month, 0).getDate();
            const targetDay = Math.min(fe.day || 1, maxDays);

            // Si es un mes futuro, no aplicar ninguno
            if (isFutureMonth) {
                return;
            }

            // Si es el mes actual, solo aplicar si el día ya llegó o pasó
            if (isCurrentMonth && targetDay > currentDay) {
                return;
            }

            const alreadyApplied = state.transactions.some(tx => 
                tx.type === "expense" &&
                tx.subtype === "Fixed" &&
                tx.description === fe.name &&
                tx.bankId === fe.bankId &&
                tx.month === state.currentMonth
            );

            if (!alreadyApplied) {
                const bank = state.banks.find(b => b.id === fe.bankId);
                if (bank) {
                    bank.balance = parseFloat((bank.balance - fe.amount).toFixed(2));
                    const txDate = `${state.currentMonth}-${String(targetDay).padStart(2, "0")}`;

                    // Crear transacción de gasto fijo aplicado (salida)
                    const newTx = {
                        id: "tx_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                        type: "expense",
                        subtype: "Fixed",
                        description: fe.name,
                        amount: fe.amount,
                        bankId: fe.bankId,
                        date: txDate,
                        month: state.currentMonth
                    };
                    state.transactions.push(newTx);

                    // Si tiene un destino de inversión asociado, aplicar transferencia automática
                    if (fe.destBankId) {
                        const destBank = state.banks.find(b => b.id === fe.destBankId);
                        if (destBank) {
                            destBank.balance = parseFloat((destBank.balance + fe.amount).toFixed(2));
                            if (destBank.estimatedValue !== null && destBank.estimatedValue !== undefined) {
                                destBank.estimatedValue = parseFloat((destBank.estimatedValue + fe.amount).toFixed(2));
                            }
                            // Crear transacción recíproca (entrada) en la cuenta de destino
                            const destTx = {
                                id: "tx_" + Date.now() + "_dest_" + Math.random().toString(36).substr(2, 5),
                                type: "income",
                                subtype: "Aportación",
                                description: `Aportación: ${fe.name}`,
                                amount: fe.amount,
                                bankId: fe.destBankId,
                                date: txDate,
                                month: state.currentMonth
                            };
                            state.transactions.push(destTx);
                        }
                    }

                    appliedCount++;
                }
            } else {
                skippedCount++;
            }
        });

        if (appliedCount > 0) {
            showToast(`Se han aplicado con éxito ${appliedCount} gastos recurrentes a sus respectivos bancos.`, "success");
            saveState();
        } else {
            showToast("Todos los gastos recurrentes que aplican a este mes ya están cobrados.", "warning");
        }
    });
}

function deleteFixedExpense(feId) {
    const fe = state.fixedExpenses.find(f => f.id === feId);
    if (!fe) return;

    if (confirm(`¿Desea eliminar el gasto fijo "${fe.name}" de la matriz?`)) {
        state.fixedExpenses = state.fixedExpenses.filter(f => f.id !== feId);
        showToast("Gasto fijo eliminado de la matriz.", "danger");
        saveState();
    }
}

// ----------------------------------------------------
// 9. MÓDULO 2: GASTOS VARIABLES (REGISTRO RÁPIDO)
// ----------------------------------------------------

function initVariableExpenses() {
    const form = document.getElementById("form-variable-expense");
    const dateInput = document.getElementById("var-date");
    
    // Set default date picker to today
    dateInput.value = getTodayString();

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
            showToast("Este mes está cerrado y consolidado. No se pueden añadir gastos variables.", "danger");
            return;
        }
        const description = document.getElementById("var-description").value.trim();
        const amount = parseFloat(document.getElementById("var-amount").value);
        const bankId = document.getElementById("var-bank-id").value;
        const date = dateInput.value;

        if (!description || isNaN(amount) || amount <= 0 || !bankId || !date) {
            showToast("Complete los datos del gasto variable.", "danger");
            return;
        }

        const bank = state.banks.find(b => b.id === bankId);
        if (!bank) {
            showToast("El banco seleccionado no existe.", "danger");
            return;
        }

        // Validar que el mes del selector global coincida con el mes de la transacción
        const txMonth = date.substring(0, 7); // Extrae "YYYY-MM"

        // Restar del saldo disponible
        bank.balance = parseFloat((bank.balance - amount).toFixed(2));

        // Registrar transacción de gasto variable
        const newTx = {
            id: "tx_" + Date.now(),
            type: "expense",
            subtype: "Variable",
            description: description,
            amount: amount,
            bankId: bankId,
            date: date,
            month: txMonth
        };

        state.transactions.push(newTx);
        form.reset();
        dateInput.value = getTodayString();

        showToast(`Gasto de ${formatCurrency(amount)} restado de "${bank.name}".`, "success");
        saveState();
    });

    // ----------------------------------------------------
    // NUEVO: SUB-PESTAÑAS DE SELECCIÓN Y FORMULARIO DE AJUSTE DE SALDO
    // ----------------------------------------------------
    const btnSubtabItem = document.getElementById("btn-subtab-item");
    const btnSubtabBalance = document.getElementById("btn-subtab-balance");
    const formItem = document.getElementById("form-variable-expense");
    const formAdjustment = document.getElementById("form-balance-adjustment");
    const adjDateInput = document.getElementById("adj-date");

    if (adjDateInput) {
        adjDateInput.value = getTodayString();
    }

    if (btnSubtabItem && btnSubtabBalance && formItem && formAdjustment) {
        btnSubtabItem.addEventListener("click", () => {
            btnSubtabItem.classList.add("active");
            btnSubtabBalance.classList.remove("active");
            formItem.classList.remove("hidden");
            formAdjustment.classList.add("hidden");
        });

        btnSubtabBalance.addEventListener("click", () => {
            btnSubtabBalance.classList.add("active");
            btnSubtabItem.classList.remove("active");
            formAdjustment.classList.remove("hidden");
            formItem.classList.add("hidden");
        });
    }

    if (formAdjustment) {
        formAdjustment.addEventListener("submit", (e) => {
            e.preventDefault();
            if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
                showToast("Este mes está cerrado y consolidado. No se pueden realizar ajustes de saldo.", "danger");
                return;
            }
            const bankId = document.getElementById("adj-bank-id").value;
            const newBalance = parseFloat(document.getElementById("adj-new-balance").value);
            const date = adjDateInput.value;

            if (!bankId || isNaN(newBalance) || newBalance < 0 || !date) {
                showToast("Complete todos los campos de ajuste de saldo.", "danger");
                return;
            }

            const bank = state.banks.find(b => b.id === bankId);
            if (!bank) {
                showToast("El banco seleccionado no existe.", "danger");
                return;
            }

            const currentBalance = bank.balance;
            const diff = parseFloat((currentBalance - newBalance).toFixed(2));
            const txMonth = date.substring(0, 7);

            if (diff === 0) {
                showToast("El nuevo saldo es idéntico al registrado. No se requiere ajuste.", "warning");
                return;
            }

            if (diff > 0) {
                // El saldo ingresado es MENOR, por lo tanto se restó dinero (Gasto Variable)
                const newTx = {
                    id: "tx_" + Date.now(),
                    type: "expense",
                    subtype: "Variable",
                    description: "Ajuste de Saldo (Gastos Variables Consolidados)",
                    amount: diff,
                    bankId: bankId,
                    date: date,
                    month: txMonth
                };
                state.transactions.push(newTx);
                bank.balance = newBalance;
                
                showToast(`Ajuste aplicado: se creó un gasto variable de ${formatCurrency(diff)} en "${bank.name}".`, "success");
            } else {
                // El saldo ingresado es MAYOR, por lo tanto se sumó dinero (Ingreso Extra)
                const absDiff = Math.abs(diff);
                const newTx = {
                    id: "tx_" + Date.now(),
                    type: "income",
                    subtype: "Extras",
                    description: "Ajuste de Saldo (Ingreso Extra Consolidado)",
                    amount: absDiff,
                    bankId: bankId,
                    date: date,
                    month: txMonth
                };
                state.transactions.push(newTx);
                bank.balance = newBalance;

                showToast(`Ajuste aplicado: se creó un ingreso extra de ${formatCurrency(absDiff)} en "${bank.name}".`, "success");
            }

            formAdjustment.reset();
            adjDateInput.value = getTodayString();
            saveState();
        });
    }
}

// ----------------------------------------------------
// 10. MÓDULO 3: CIERRE DE MES (PREVISTO VS REALIDAD)
// ----------------------------------------------------

function initBudgetClosure() {
    const btnSave = document.getElementById("btn-save-all-budgets");

    btnSave.addEventListener("click", () => {
        if (state.banks.length === 0) return;

        if (!state.budgets[state.currentMonth]) {
            state.budgets[state.currentMonth] = {};
        }

        state.banks.forEach(bank => {
            const expIncomeInput = document.getElementById(`budget-expected-income-${bank.id}`);
            const expExpenseInput = document.getElementById(`budget-expected-expense-${bank.id}`);

            if (expIncomeInput && expExpenseInput) {
                state.budgets[state.currentMonth][bank.id] = {
                    expectedIncome: parseFloat(expIncomeInput.value) || 0,
                    expectedExpense: parseFloat(expExpenseInput.value) || 0
                };
            }
        });

        showToast("Estimaciones del presupuesto guardadas con éxito.", "success");
        saveState();
    });
}

// Renderiza los campos editables del presupuesto esperado por banco
function renderBudgetEstimationsForm() {
    const container = document.getElementById("budget-editor-container");
    container.innerHTML = "";

    if (state.banks.length === 0) {
        document.getElementById("budget-no-banks").classList.remove("hidden");
        document.getElementById("btn-save-all-budgets").classList.add("hidden");
        return;
    } else {
        document.getElementById("budget-no-banks").classList.add("hidden");
        // Ocultar botón de guardar manual ya que ahora el guardado es completamente automático
        document.getElementById("btn-save-all-budgets").classList.add("hidden");
    }

    const currentBudgets = state.budgets[state.currentMonth] || {};

    state.banks.forEach(bank => {
        const expected = currentBudgets[bank.id] || { expectedIncome: 0, expectedExpense: 0 };
        
        const item = document.createElement("div");
        item.className = "budget-editor-item";
        item.innerHTML = `
            <div class="budget-bank-title">${bank.name}</div>
            <div class="budget-inputs-row">
                <div class="form-group">
                    <label>Ingreso Previsto (€)</label>
                    <input type="number" id="budget-expected-income-${bank.id}" class="budget-auto-save" data-bank-id="${bank.id}" data-type="expectedIncome" step="0.01" min="0" placeholder="0.00" value="${expected.expectedIncome}">
                </div>
                <div class="form-group">
                    <label>Gasto Previsto (€)</label>
                    <input type="number" id="budget-expected-expense-${bank.id}" class="budget-auto-save" data-bank-id="${bank.id}" data-type="expectedExpense" step="0.01" min="0" placeholder="0.00" value="${expected.expectedExpense}">
                </div>
            </div>
        `;
        container.appendChild(item);
    });

    // Escuchadores de guardado automático (sin re-renderizar para no perder el foco)
    container.querySelectorAll(".budget-auto-save").forEach(input => {
        input.addEventListener("change", (e) => {
            if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
                showToast("Este mes está cerrado y consolidado. Las estimaciones están bloqueadas.", "danger");
                e.target.value = e.target.defaultValue;
                return;
            }
            const bankId = e.target.dataset.bankId;
            const type = e.target.dataset.type;
            const value = parseFloat(e.target.value) || 0;

            if (!state.budgets[state.currentMonth]) {
                state.budgets[state.currentMonth] = {};
            }
            if (!state.budgets[state.currentMonth][bankId]) {
                state.budgets[state.currentMonth][bankId] = { expectedIncome: 0, expectedExpense: 0 };
            }

            state.budgets[state.currentMonth][bankId][type] = value;

            // Guardar directamente en base de datos en segundo plano
            if (profilesState.currentProfileId) {
                const profileKey = "finanzas_db_" + profilesState.currentProfileId;
                dbStorage.setItem(profileKey, state).catch(err => console.error(err));
            }

            logActivity(`Autoguardado de presupuesto (${type === "expectedIncome" ? "Ingreso previsto" : "Gasto previsto"}) para ${bankId}: ${value} €`);
            
            // Actualizar la tabla de desviación en tiempo real sin recargar todo el formulario
            renderDeviationAnalysisTable();
        });
    });
}

// ----------------------------------------------------
// 11. MÓDULO 4: PROYECTOS (ENTORNO AISLADO / SANDBOX)
// ----------------------------------------------------

let currentActiveProjectId = null;
let currentActiveFolderId = null;

function renderProjectFolderSelectOptions(selectElementId, selectedFolderId = null) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = `<option value="">-- Sin Carpeta (Proyecto Independiente) --</option>`;
    if (state.projectFolders && state.projectFolders.length > 0) {
        state.projectFolders.forEach(folder => {
            const opt = document.createElement("option");
            opt.value = folder.id;
            opt.textContent = `📁 ${folder.name}`;
            if (folder.id === selectedFolderId) opt.selected = true;
            select.appendChild(opt);
        });
    }
}

function initProjectsSandbox() {
    const btnShowAdd = document.getElementById("btn-show-add-project");
    const formAdd = document.getElementById("form-add-project");
    const btnCancel = document.getElementById("btn-cancel-add-project");

    const btnShowAddFolder = document.getElementById("btn-show-add-project-folder");
    const formAddFolder = document.getElementById("form-add-project-folder");
    const btnCancelAddFolder = document.getElementById("btn-cancel-add-project-folder");

    const btnBack = document.getElementById("btn-back-to-projects");
    const btnDelete = document.getElementById("btn-delete-project");
    const btnEdit = document.getElementById("btn-edit-project");

    const btnBackFromFolder = document.getElementById("btn-back-from-folder");
    const btnShowAddSubproject = document.getElementById("btn-show-add-subproject");
    const formAddSubproject = document.getElementById("form-add-subproject");
    const btnCancelAddSubproject = document.getElementById("btn-cancel-add-subproject");
    const btnEditFolder = document.getElementById("btn-edit-folder");
    const btnDeleteFolder = document.getElementById("btn-delete-folder");

    // --- CARPETAS DE PROYECTOS ---
    if (btnShowAddFolder && formAddFolder) {
        btnShowAddFolder.addEventListener("click", () => {
            formAddFolder.classList.toggle("hidden");
            if (formAdd) formAdd.classList.add("hidden");
        });
    }

    if (btnCancelAddFolder && formAddFolder) {
        btnCancelAddFolder.addEventListener("click", () => {
            formAddFolder.classList.add("hidden");
            formAddFolder.reset();
        });
    }

    if (formAddFolder) {
        formAddFolder.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("project-folder-name").value.trim();
            const desc = document.getElementById("project-folder-description").value.trim();

            if (!name || !desc) {
                showToast("Complete los datos de la carpeta.", "danger");
                return;
            }

            if (!state.projectFolders) state.projectFolders = [];
            const newFolder = {
                id: "f_" + Date.now(),
                name: name,
                description: desc,
                createdAt: getTodayString()
            };

            state.projectFolders.push(newFolder);
            formAddFolder.classList.add("hidden");
            formAddFolder.reset();

            showToast(`Carpeta "${name}" creada con éxito.`, "success");
            saveState();
            renderProjectsList();
        });
    }

    if (btnBackFromFolder) {
        btnBackFromFolder.addEventListener("click", () => {
            document.getElementById("project-list-view").classList.remove("hidden");
            document.getElementById("project-folder-view").classList.add("hidden");
            document.getElementById("project-details-view").classList.add("hidden");
            currentActiveFolderId = null;
            renderProjectsList();
        });
    }

    if (btnShowAddSubproject && formAddSubproject) {
        btnShowAddSubproject.addEventListener("click", () => {
            formAddSubproject.classList.toggle("hidden");
        });
    }

    if (btnCancelAddSubproject && formAddSubproject) {
        btnCancelAddSubproject.addEventListener("click", () => {
            formAddSubproject.classList.add("hidden");
            formAddSubproject.reset();
        });
    }

    if (formAddSubproject) {
        formAddSubproject.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!currentActiveFolderId) return;

            const name = document.getElementById("subproject-name").value.trim();
            const desc = document.getElementById("subproject-description").value.trim();

            if (!name || !desc) {
                showToast("Complete los datos del subproyecto.", "danger");
                return;
            }

            const newProj = {
                id: "p_" + Date.now(),
                name: name,
                description: desc,
                folderId: currentActiveFolderId,
                createdAt: getTodayString(),
                investments: [],
                earnings: []
            };

            state.projects.push(newProj);
            formAddSubproject.classList.add("hidden");
            formAddSubproject.reset();

            showToast(`Subproyecto "${name}" añadido a la carpeta.`, "success");
            saveState();
            renderProjectFolderView(currentActiveFolderId);
        });
    }

    if (btnEditFolder) {
        btnEditFolder.addEventListener("click", () => {
            if (currentActiveFolderId) {
                openEditModal('projectFolder', currentActiveFolderId);
            }
        });
    }

    if (btnDeleteFolder) {
        btnDeleteFolder.addEventListener("click", () => {
            if (!currentActiveFolderId) return;
            const folder = (state.projectFolders || []).find(f => f.id === currentActiveFolderId);
            if (!folder) return;
            const subCount = state.projects.filter(p => p.folderId === currentActiveFolderId).length;
            const msg = subCount > 0 
                ? `¿Desea eliminar la carpeta "${folder.name}" y todos sus ${subCount} subproyectos?` 
                : `¿Desea eliminar la carpeta "${folder.name}"?`;
            if (confirm(msg)) {
                state.projects = state.projects.filter(p => p.folderId !== currentActiveFolderId);
                state.projectFolders = (state.projectFolders || []).filter(f => f.id !== currentActiveFolderId);
                document.getElementById("project-list-view").classList.remove("hidden");
                document.getElementById("project-folder-view").classList.add("hidden");
                document.getElementById("project-details-view").classList.add("hidden");
                currentActiveFolderId = null;
                showToast("Carpeta eliminada.", "danger");
                saveState();
                renderProjectsList();
            }
        });
    }

    // --- PROYECTOS SANDBOX INDIVIDUALES ---
    btnEdit.addEventListener("click", () => {
        if (currentActiveProjectId) {
            openEditModal('project', currentActiveProjectId);
        }
    });

    // Formulario de Inversión en Proyecto
    const formInv = document.getElementById("form-proj-investment");
    formInv.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!currentActiveProjectId) return;

        const desc = document.getElementById("proj-inv-desc").value.trim();
        const amount = parseFloat(document.getElementById("proj-inv-amount").value);
        const dateInput = document.getElementById("proj-inv-date");
        const date = dateInput ? dateInput.value : getTodayString();

        if (!desc || isNaN(amount) || amount <= 0 || !date) return;

        const proj = state.projects.find(p => p.id === currentActiveProjectId);
        if (proj) {
            proj.investments.push({
                id: "inv_" + Date.now(),
                description: desc,
                amount: amount,
                date: date
            });
            formInv.reset();
            if (dateInput) dateInput.value = getTodayString();
            showToast("Inversión registrada en el sandbox del proyecto.", "success");
            saveState();
            renderProjectDetailView(currentActiveProjectId);
        }
    });

    // Formulario de Ganancia en Proyecto
    const formEar = document.getElementById("form-proj-earning");
    formEar.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!currentActiveProjectId) return;

        const desc = document.getElementById("proj-ear-desc").value.trim();
        const amount = parseFloat(document.getElementById("proj-ear-amount").value);
        const dateInput = document.getElementById("proj-ear-date");
        const date = dateInput ? dateInput.value : getTodayString();

        if (!desc || isNaN(amount) || amount <= 0 || !date) return;

        const proj = state.projects.find(p => p.id === currentActiveProjectId);
        if (proj) {
            proj.earnings.push({
                id: "ear_" + Date.now(),
                description: desc,
                amount: amount,
                date: date
            });
            formEar.reset();
            if (dateInput) dateInput.value = getTodayString();
            showToast("Ganancia registrada en el sandbox del proyecto.", "success");
            saveState();
            renderProjectDetailView(currentActiveProjectId);
        }
    });

    btnShowAdd.addEventListener("click", () => {
        formAdd.classList.toggle("hidden");
        if (formAddFolder) formAddFolder.classList.add("hidden");
        if (!formAdd.classList.contains("hidden")) {
            renderProjectFolderSelectOptions("project-folder-id");
        }
    });

    btnCancel.addEventListener("click", () => {
        formAdd.classList.add("hidden");
        formAdd.reset();
    });

    btnBack.addEventListener("click", () => {
        const proj = state.projects.find(p => p.id === currentActiveProjectId);
        const parentFolderId = proj?.folderId;
        currentActiveProjectId = null;

        document.getElementById("project-details-view").classList.add("hidden");

        if (parentFolderId && (state.projectFolders || []).some(f => f.id === parentFolderId)) {
            currentActiveFolderId = parentFolderId;
            document.getElementById("project-folder-view").classList.remove("hidden");
            document.getElementById("project-list-view").classList.add("hidden");
            renderProjectFolderView(parentFolderId);
        } else {
            currentActiveFolderId = null;
            document.getElementById("project-list-view").classList.remove("hidden");
            document.getElementById("project-folder-view").classList.add("hidden");
            renderProjectsList();
        }
    });

    btnDelete.addEventListener("click", () => {
        if (!currentActiveProjectId) return;
        const proj = state.projects.find(p => p.id === currentActiveProjectId);
        if (proj) {
            if (confirm(`¿Desea eliminar definitivamente el proyecto "${proj.name}" y todos sus movimientos aislados?`)) {
                const parentFolderId = proj.folderId;
                state.projects = state.projects.filter(p => p.id !== currentActiveProjectId);
                document.getElementById("project-details-view").classList.add("hidden");
                currentActiveProjectId = null;

                if (parentFolderId && (state.projectFolders || []).some(f => f.id === parentFolderId)) {
                    currentActiveFolderId = parentFolderId;
                    document.getElementById("project-folder-view").classList.remove("hidden");
                    renderProjectFolderView(parentFolderId);
                } else {
                    currentActiveFolderId = null;
                    document.getElementById("project-list-view").classList.remove("hidden");
                }

                showToast("Proyecto eliminado.", "danger");
                saveState();
                renderProjectsList();
            }
        }
    });

    formAdd.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("project-name").value.trim();
        const desc = document.getElementById("project-description").value.trim();
        const folderId = document.getElementById("project-folder-id")?.value || null;

        if (!name || !desc) {
            showToast("Complete los datos del proyecto.", "danger");
            return;
        }

        const newProj = {
            id: "p_" + Date.now(),
            name: name,
            description: desc,
            folderId: folderId,
            createdAt: getTodayString(),
            investments: [],
            earnings: []
        };

        state.projects.push(newProj);
        formAdd.classList.add("hidden");
        formAdd.reset();

        showToast(`Proyecto "${name}" inicializado correctamente en entorno Sandbox.`, "success");
        saveState();
        renderProjectsList();
    });
}

function openProjectFolder(folderId) {
    currentActiveFolderId = folderId;
    currentActiveProjectId = null;
    document.getElementById("project-list-view").classList.add("hidden");
    document.getElementById("project-details-view").classList.add("hidden");
    document.getElementById("project-folder-view").classList.remove("hidden");
    renderProjectFolderView(folderId);
}


// ====================================================
// GESTIÓN DE ORDENACIÓN Y DRAG & DROP DE PROYECTOS / SUBPROYECTOS
// ====================================================

let _draggedProjectItem = null;

function setupDraggableCard(cardElement, itemType, itemId, parentFolderId = null) {
    cardElement.setAttribute("draggable", "true");
    cardElement.dataset.dragType = itemType;
    cardElement.dataset.dragId = itemId;
    if (parentFolderId) cardElement.dataset.folderId = parentFolderId;

    cardElement.addEventListener("dragstart", (e) => {
        _draggedProjectItem = { type: itemType, id: itemId, folderId: parentFolderId };
        cardElement.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", itemId);
    });

    cardElement.addEventListener("dragend", () => {
        cardElement.classList.remove("is-dragging");
        document.querySelectorAll(".is-drag-over").forEach(el => el.classList.remove("is-drag-over"));
        _draggedProjectItem = null;
    });

    cardElement.addEventListener("dragover", (e) => {
        if (!_draggedProjectItem) return;
        if (_draggedProjectItem.type !== itemType) return;
        if (_draggedProjectItem.id === itemId) return;
        if (itemType === 'subproject' && _draggedProjectItem.folderId !== parentFolderId) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        cardElement.classList.add("is-drag-over");
    });

    cardElement.addEventListener("dragleave", () => {
        cardElement.classList.remove("is-drag-over");
    });

    cardElement.addEventListener("drop", (e) => {
        if (!_draggedProjectItem) return;
        if (_draggedProjectItem.type !== itemType) return;
        if (_draggedProjectItem.id === itemId) return;
        if (itemType === 'subproject' && _draggedProjectItem.folderId !== parentFolderId) return;

        e.preventDefault();
        e.stopPropagation();
        cardElement.classList.remove("is-drag-over");

        const sourceId = _draggedProjectItem.id;
        const targetId = itemId;

        if (itemType === 'folder') {
            const folders = state.projectFolders || [];
            const srcIdx = folders.findIndex(f => f.id === sourceId);
            const tgtIdx = folders.findIndex(f => f.id === targetId);
            if (srcIdx !== -1 && tgtIdx !== -1) {
                const [moved] = folders.splice(srcIdx, 1);
                folders.splice(tgtIdx, 0, moved);
                saveState();
                renderProjectsList();
            }
        } else {
            const srcIdx = state.projects.findIndex(p => p.id === sourceId);
            const tgtIdx = state.projects.findIndex(p => p.id === targetId);
            if (srcIdx !== -1 && tgtIdx !== -1) {
                const [moved] = state.projects.splice(srcIdx, 1);
                state.projects.splice(tgtIdx, 0, moved);
                saveState();
                if (itemType === 'subproject') {
                    renderProjectFolderView(parentFolderId);
                } else {
                    renderProjectsList();
                }
            }
        }
    });
}

function moveSubprojectOrder(projectId, delta) {
    const proj = state.projects.find(p => p.id === projectId);
    if (!proj || !proj.folderId) return;

    const folderId = proj.folderId;
    const subprojects = state.projects.filter(p => p.folderId === folderId);
    const currIdx = subprojects.findIndex(p => p.id === projectId);
    if (currIdx === -1) return;

    const targetIdx = currIdx + delta;
    if (targetIdx < 0 || targetIdx >= subprojects.length) return;

    const targetProj = subprojects[targetIdx];

    const realIdxA = state.projects.findIndex(p => p.id === projectId);
    const realIdxB = state.projects.findIndex(p => p.id === targetProj.id);

    if (realIdxA !== -1 && realIdxB !== -1) {
        const temp = state.projects[realIdxA];
        state.projects[realIdxA] = state.projects[realIdxB];
        state.projects[realIdxB] = temp;

        saveState();
        renderProjectFolderView(folderId);
    }
}

function moveStandaloneProjectOrder(projectId, delta) {
    const folders = state.projectFolders || [];
    const validFolderIds = new Set(folders.map(f => f.id));
    const standalones = state.projects.filter(p => !p.folderId || !validFolderIds.has(p.folderId));
    
    const currIdx = standalones.findIndex(p => p.id === projectId);
    if (currIdx === -1) return;

    const targetIdx = currIdx + delta;
    if (targetIdx < 0 || targetIdx >= standalones.length) return;

    const targetProj = standalones[targetIdx];

    const realIdxA = state.projects.findIndex(p => p.id === projectId);
    const realIdxB = state.projects.findIndex(p => p.id === targetProj.id);

    if (realIdxA !== -1 && realIdxB !== -1) {
        const temp = state.projects[realIdxA];
        state.projects[realIdxA] = state.projects[realIdxB];
        state.projects[realIdxB] = temp;

        saveState();
        renderProjectsList();
    }
}

function moveFolderOrder(folderId, delta) {
    const folders = state.projectFolders || [];
    const currIdx = folders.findIndex(f => f.id === folderId);
    if (currIdx === -1) return;

    const targetIdx = currIdx + delta;
    if (targetIdx < 0 || targetIdx >= folders.length) return;

    const temp = state.projectFolders[currIdx];
    state.projectFolders[currIdx] = state.projectFolders[targetIdx];
    state.projectFolders[targetIdx] = temp;

    saveState();
    renderProjectsList();
}

function renderProjectFolderView(folderId) {
    const folder = (state.projectFolders || []).find(f => f.id === folderId);
    if (!folder) return;

    document.getElementById("folder-detail-title").textContent = folder.name;
    document.getElementById("folder-detail-desc").textContent = folder.description;

    const subprojects = state.projects.filter(p => p.folderId === folderId);

    let totalInvested = 0;
    let totalEarned = 0;

    subprojects.forEach(p => {
        (p.investments || []).forEach(i => totalInvested += i.amount);
        (p.earnings || []).forEach(e => totalEarned += e.amount);
    });

    const netProfit = totalEarned - totalInvested;
    const roi = totalInvested > 0 ? ((netProfit / totalInvested) * 100) : 0;

    document.getElementById("folder-total-invested").textContent = formatCurrency(totalInvested);
    document.getElementById("folder-total-earned").textContent = formatCurrency(totalEarned);

    const netEl = document.getElementById("folder-net-profit");
    const netCard = document.getElementById("folder-card-net-profit");
    netEl.textContent = (netProfit >= 0 ? '+' : '') + formatCurrency(netProfit);
    netCard.className = "proj-stat-card card-net-profit " + (netProfit >= 0 ? "plus" : "minus");

    const roiEl = document.getElementById("folder-roi");
    const roiCard = document.getElementById("folder-card-roi");
    if (totalInvested === 0) {
        roiEl.textContent = "Sin Inversión";
        roiCard.className = "proj-stat-card card-roi zero";
    } else {
        roiEl.textContent = (roi >= 0 ? '+' : '') + roi.toFixed(1) + "%";
        roiCard.className = "proj-stat-card card-roi " + (roi >= 0 ? "plus" : "minus");
    }

    const grid = document.getElementById("folder-subprojects-grid");
    grid.innerHTML = "";

    if (subprojects.length === 0) {
        grid.innerHTML = `<div class="alert-info" style="grid-column: 1 / -1;">No hay subproyectos en esta carpeta todavía. Usa el botón "+ Añadir Subproyecto" para crear uno.</div>`;
        return;
    }

    subprojects.forEach((proj, index) => {
        let subInv = 0;
        let subEar = 0;
        (proj.investments || []).forEach(i => subInv += i.amount);
        (proj.earnings || []).forEach(e => subEar += e.amount);
        const subNet = subEar - subInv;
        const subRoi = subInv > 0 ? ((subNet / subInv) * 100) : 0;

        const isFirst = index === 0;
        const isLast = index === subprojects.length - 1;

        const card = document.createElement("div");
        card.className = "project-item-card";
        card.setAttribute("onclick", `openProjectSandbox('${proj.id}')`);
        card.innerHTML = `
            <div class="project-card-header">
                <div class="project-card-top-row">
                    <h3 title="${escapeHtml(proj.name)}">${escapeHtml(proj.name)}</h3>
                    <div class="card-reorder-controls" onclick="event.stopPropagation()">
                        <button type="button" class="btn-card-move" onclick="event.stopPropagation(); moveSubprojectOrder('${proj.id}', -1)" ${isFirst ? 'disabled' : ''} title="Mover a la izquierda / antes">◀</button>
                        <button type="button" class="btn-card-move" onclick="event.stopPropagation(); moveSubprojectOrder('${proj.id}', 1)" ${isLast ? 'disabled' : ''} title="Mover a la derecha / después">▶</button>
                        <span class="card-drag-handle" title="Arrastra para reordenar">⠿</span>
                    </div>
                </div>
                <p title="${escapeHtml(proj.description || '')}">${escapeHtml(proj.description || '')}</p>
            </div>
            <div class="project-card-footer">
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase;">Beneficio Neto</span>
                    <span class="project-badge-profit ${subNet >= 0 ? 'plus' : 'minus'}">${subNet >= 0 ? '+' : ''}${formatCurrency(subNet)}</span>
                </div>
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase; text-align: right;">ROI</span>
                    <span class="project-badge-roi ${subInv === 0 ? 'zero' : (subRoi >= 0 ? 'plus' : 'minus')}">${subInv === 0 ? 'Sin Inversión' : subRoi.toFixed(1) + '%'}</span>
                </div>
            </div>
        `;
        setupDraggableCard(card, 'subproject', proj.id, folderId);
        grid.appendChild(card);
    });
}

function openProjectSandbox(projectId) {
    currentActiveProjectId = projectId;
    const proj = state.projects.find(p => p.id === projectId);
    const parentFolder = proj?.folderId ? (state.projectFolders || []).find(f => f.id === proj.folderId) : null;

    const backTextEl = document.getElementById("btn-back-to-projects-text");
    if (backTextEl) {
        backTextEl.textContent = parentFolder ? `Volver a Carpeta (${parentFolder.name})` : "Volver a Proyectos";
    }

    document.getElementById("project-list-view").classList.add("hidden");
    document.getElementById("project-folder-view").classList.add("hidden");
    document.getElementById("project-details-view").classList.remove("hidden");
    const dateInvInput = document.getElementById("proj-inv-date");
    const dateEarInput = document.getElementById("proj-ear-date");
    if (dateInvInput) dateInvInput.value = getTodayString();
    if (dateEarInput) dateEarInput.value = getTodayString();
    renderProjectDetailView(projectId);
}

function deleteProjectInvestment(projId, invId) {
    const proj = state.projects.find(p => p.id === projId);
    if (!proj) return;

    proj.investments = proj.investments.filter(i => i.id !== invId);
    saveState();
    renderProjectDetailView(projId);
    if (proj.folderId && currentActiveFolderId === proj.folderId) {
        renderProjectFolderView(proj.folderId);
    }
    showToast("Inversión eliminada del Sandbox.", "danger");
}

function deleteProjectEarning(projId, earId) {
    const proj = state.projects.find(p => p.id === projId);
    if (!proj) return;

    proj.earnings = proj.earnings.filter(e => e.id !== earId);
    saveState();
    renderProjectDetailView(projId);
    if (proj.folderId && currentActiveFolderId === proj.folderId) {
        renderProjectFolderView(proj.folderId);
    }
    showToast("Ganancia eliminada del Sandbox.", "danger");
}

function checkMaturedDeposits() {
    if (!state.currentMonth || !state.banks) return;
    
    const sysDate = new Date();
    const todayStr = `${sysDate.getFullYear()}-${String(sysDate.getMonth() + 1).padStart(2, '0')}-${String(sysDate.getDate()).padStart(2, '0')}`;
    
    let stateChanged = false;
    
    state.banks.forEach(bank => {
        if (bank.bankType === "deposit" && !bank.maturedTransferDone && bank.balance > 0) {
            if (!bank.startDate || !bank.durationMonths) return;
            
            const startParts = bank.startDate.split("-").map(Number);
            if (startParts.length !== 3) return;
            
            const endDate = new Date(startParts[0], startParts[1] - 1 + parseInt(bank.durationMonths), startParts[2]);
            const endYear = endDate.getFullYear();
            const endMonth = endDate.getMonth(); // 0-indexed
            const endDay = endDate.getDate();
            
            const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
            const endMonthStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}`;
            
            // Comprobación de vencimiento rigurosa:
            // Solo vence si el día actual es igual o posterior al día exacto de vencimiento (todayStr >= endDateStr)
            // o si el mes consultado/cerrado es estrictamente posterior al mes de vencimiento.
            const hasMatured = (todayStr >= endDateStr) || (state.currentMonth > endMonthStr);
            
            if (hasMatured) {
                const destBank = state.banks.find(b => b.id === bank.destinationBankId);
                if (destBank) {
                    const principal = bank.balance;
                    const tae = parseFloat(bank.tae) || 0;
                    const durationMonths = parseInt(bank.durationMonths) || 12;
                    const years = durationMonths / 12;
                    
                    const grossInterest = principal * (tae / 100) * years;
                    const taxRate = bank.taxRate !== undefined && bank.taxRate !== null ? parseFloat(bank.taxRate) / 100 : 0.19;
                    const taxes = grossInterest * taxRate;
                    const netInterest = grossInterest - taxes;
                    const totalPayout = parseFloat((principal + netInterest).toFixed(2));
                    
                    destBank.balance = parseFloat((destBank.balance + totalPayout).toFixed(2));
                    bank.balance = 0;
                    bank.maturedTransferDone = true;
                    
                    state.transactions.push({
                        id: "tx_dep_out_" + Date.now() + "_" + Math.floor(Math.random()*1000),
                        type: "expense",
                        subtype: "Traspaso",
                        description: `Vencimiento Depósito "${bank.name}" -> Transferido a "${destBank.name}"`,
                        amount: principal,
                        bankId: bank.id,
                        date: endDateStr,
                        month: endMonthStr
                    });
                    
                    state.transactions.push({
                        id: "tx_dest_in_" + Date.now() + "_" + Math.floor(Math.random()*1000),
                        type: "income",
                        subtype: "Traspaso",
                        description: `Vencimiento Depósito "${bank.name}" (Principal ${formatCurrency(principal)} + Int. Netos ${formatCurrency(netInterest)})`,
                        amount: totalPayout,
                        bankId: destBank.id,
                        date: endDateStr,
                        month: endMonthStr
                    });
                    
                    showToast(`¡El depósito "${bank.name}" ha vencido! Se han transferido ${formatCurrency(totalPayout)} a "${destBank.name}".`, "success");
                    stateChanged = true;
                }
            }
        }
    });
    
    if (stateChanged) {
        saveState();
    }
}

// ----------------------------------------------------
// 12. SISTEMA DE RENDERIZACIÓN REACTIVA (DOM UPDATES)
// ----------------------------------------------------

function renderAll() {
    const isDashboard = !!document.getElementById("panel-dashboard");
    if (!isDashboard) return;
    
    // Comprobar vencimiento automático de depósitos
    checkMaturedDeposits();

    // Actualizar el selector de mes global en la cabecera
    const monthDisplay = document.getElementById("current-month-display");
    if (monthDisplay) {
        monthDisplay.textContent = formatMonthString(state.currentMonth);
    }

    // Actualizar visualizaciones por módulo
    renderGlobalStats();
    renderBanksList();
    renderInvestmentsList();
    renderDashboardOverview();
    renderFunnelInputs();
    renderPlannedIncomeBanner();
    renderExpensesDropdowns();
    renderFixedExpensesTable();
    renderTransactionsTable();
    renderBudgetEstimationsForm();
    renderDeviationAnalysisTable();
    renderProjectsList();
    renderProfileWidget();
    
    // Validar el estado del embudo por si cambiaron los bancos
    validateFunnel();
    
    // Si hay un proyecto o carpeta en detalle activo, actualizarlo
    if (currentActiveProjectId) {
        renderProjectDetailView(currentActiveProjectId);
    } else if (currentActiveFolderId) {
        renderProjectFolderView(currentActiveFolderId);
    }

    // Actualizar módulo de rendimiento si está visible
    const perfPanel = document.getElementById("panel-performance");
    if (perfPanel && perfPanel.style.display === "block") {
        renderPerformanceModule();
    }

    // --- CARACTERÍSTICAS PREMIUM ---

    // 1. Actualizar Modo Incógnito / Máscara
    document.body.classList.toggle("mask-active", !!state.maskMode);
    const iconVisible = document.getElementById("icon-mask-visible");
    const iconHidden = document.getElementById("icon-mask-hidden");
    if (iconVisible && iconHidden) {
        if (state.maskMode) {
            iconVisible.classList.add("hidden");
            iconHidden.classList.remove("hidden");
        } else {
            iconVisible.classList.remove("hidden");
            iconHidden.classList.add("hidden");
        }
    }

    // 2. Renderizar Metas de Ahorro
    renderSavingGoals();

    // 3. Renderizar Calendario de cobros si su pestaña está activa
    const btnCal = document.getElementById("btn-subtab-fixed-calendar");
    if (btnCal && btnCal.classList.contains("active")) {
        renderFixedCalendar();
    }

    // 4. Lógica de Consolidación y bloqueo de Mes Cerrado
    const isClosed = state.closedMonths && state.closedMonths.includes(state.currentMonth);
    const banner = document.getElementById("closed-month-banner");
    if (banner) {
        banner.classList.toggle("hidden", !isClosed);
    }

    const btnCloseMonth = document.getElementById("btn-close-month");
    const btnCloseMonthText = document.getElementById("btn-close-month-text");
    if (btnCloseMonth && btnCloseMonthText) {
        if (isClosed) {
            btnCloseMonth.classList.add("disabled");
            btnCloseMonth.disabled = true;
            btnCloseMonthText.textContent = "Mes Cerrado";
        } else {
            btnCloseMonth.classList.remove("disabled");
            btnCloseMonth.disabled = false;
            btnCloseMonthText.textContent = "Cerrar Mes";
        }
    }

    // Bloquear/desbloquear formularios e inputs de acciones
    const formsToLock = [
        "form-add-income", "form-add-fixed-expense", "form-variable-expense", 
        "form-adjust-balance", "form-budget-estimations", "form-add-saving-goal"
    ];
    formsToLock.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            // Aplicar estilo de deshabilitado visual al formulario
            if (isClosed) {
                form.style.opacity = "0.65";
                form.style.cursor = "not-allowed";
                form.setAttribute("title", "Mes consolidado y cerrado: formulario bloqueado.");
            } else {
                form.style.opacity = "";
                form.style.cursor = "";
                form.removeAttribute("title");
            }

            // Prepend/remove candado dinámicamente en el título del formulario
            const titleEl = form.querySelector("h2, h3");
            if (titleEl) {
                const baseText = titleEl.textContent.replace("🔒 ", "");
                titleEl.textContent = isClosed ? "🔒 " + baseText : baseText;
            }

            const inputs = form.querySelectorAll("input, select, textarea, button");
            inputs.forEach(el => {
                if (el.id !== "btn-cancel-add-fixed" && el.id !== "btn-cancel-add-goal" && el.id !== "btn-cancel-add-income" && el.id !== "btn-cancel-add-variable") {
                    el.disabled = isClosed;
                    if (isClosed) {
                        el.style.cursor = "not-allowed";
                    } else {
                        el.style.cursor = "";
                    }
                }
            });
        }
    });

    const buttonsToLock = [
        "btn-execute-fixed-expenses", "btn-show-add-fixed", "btn-show-add-goal", 
        "btn-show-add-income", "btn-show-add-variable", "btn-show-adjust"
    ];
    buttonsToLock.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = isClosed;
            if (isClosed) {
                btn.classList.add("disabled");
            } else {
                btn.classList.remove("disabled");
            }
        }
    });

    updateDOMCurrencySymbols();
}

// MÓDULO 1: ESTADÍSTICAS GLOBALES DEL TABLERO
function renderGlobalStats() {
    // 1. Balance total: para planes de pensión usa el valor estimado (con interés)
    let totalBanks = 0;
    state.banks.forEach(b => {
        if (b.bankType === "pension" || b.bankType === "investment") {
            totalBanks += (b.estimatedValue ?? b.balance);
        } else {
            totalBanks += b.balance;
        }
    });
    document.getElementById("global-total-balance").textContent = formatCurrency(totalBanks);

    // 2. Ingresos del mes en curso
    const monthlyIncomeTx = state.transactions.filter(tx => tx.type === "income" && tx.subtype !== "Traspaso" && tx.month === state.currentMonth);
    let totalIncome = 0;
    monthlyIncomeTx.forEach(tx => totalIncome += tx.amount);
    document.getElementById("global-monthly-income").textContent = formatCurrency(totalIncome);
    document.getElementById("global-monthly-income-details").textContent = `Recibidos en ${formatMonthString(state.currentMonth)}`;

    // 3. Gastos del mes en curso
    const monthlyExpenseTx = state.transactions.filter(tx => tx.type === "expense" && tx.subtype !== "Traspaso" && tx.month === state.currentMonth);
    let totalExpense = 0;
    monthlyExpenseTx.forEach(tx => totalExpense += tx.amount);
    document.getElementById("global-monthly-expense").textContent = formatCurrency(totalExpense);
    document.getElementById("global-monthly-expense-details").textContent = `Debites de ${formatMonthString(state.currentMonth)}`;

    // 4. Ahorro Neto del mes
    const netSavings = totalIncome - totalExpense;
    const netEl = document.getElementById("global-monthly-net");
    const netCard = netEl.closest(".stat-card");
    const netInfo = netCard.querySelector(".stat-info");

    netEl.textContent = formatCurrency(netSavings);
    if (netSavings >= 0) {
        netCard.className = "stat-card card-net savings-plus";
        if (netInfo) netInfo.textContent = "Ingresos menos gastos en el mes actual";
    } else {
        if (totalIncome === 0 && totalExpense > 0) {
            netCard.className = "stat-card card-net";
            if (netInfo) netInfo.textContent = "Pendiente de recibir los ingresos del mes";
        } else {
            netCard.className = "stat-card card-net savings-minus";
            if (netInfo) netInfo.textContent = "Ingresos menos gastos en el mes actual";
        }
    }
}

// MÓDULO 1: RENDER DE LISTA DE BANCOS
function renderBanksList() {
    const container = document.getElementById("banks-list-container");
    container.innerHTML = "";

    const activeNormalBanks = state.banks.filter(b => b.bankType === "normal" || b.bankType === "deposit" || !b.bankType);

    if (activeNormalBanks.length === 0) {
        container.innerHTML = `<div class="alert-info">No hay cuentas bancarias corrientes o depósitos. Use el botón superior para añadir una.</div>`;
        return;
    }

    activeNormalBanks.forEach(bank => {
        const tags = bank.purpose ? bank.purpose.split(",").map(t => t.trim()).filter(t => t !== "") : [];
        const purposeHTML = tags.length > 0
            ? `<div class="bank-meta-tags" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; margin-bottom:4px;">
                ${tags.map(t => `<span class="badge-tag" style="background:rgba(255,255,255,0.06); border:1px solid var(--border-color); color:var(--text-secondary); padding:2px 8px; border-radius:4px; font-size:0.68rem; font-weight:500;">🏷️ ${t}</span>`).join("")}
               </div>`
            : "";

        // ── Card de Depósito a Plazo Fijo ──
        if (bank.bankType === "deposit") {
            const principal = bank.balance;
            const tae = parseFloat(bank.tae) || 0;
            const durationMonths = parseInt(bank.durationMonths) || 12;
            const years = durationMonths / 12;
            const gross = principal * (tae / 100) * years;
            const taxRate = bank.taxRate !== undefined && bank.taxRate !== null ? parseFloat(bank.taxRate) / 100 : 0.19;
            const taxes = gross * taxRate;
            const netInterest = gross - taxes;
            const totalPayout = principal + netInterest;

            const destBank = state.banks.find(b => b.id === bank.destinationBankId);
            const destName = destBank ? destBank.name : "Cuenta Destino";

            let maturityText = "";
            if (bank.startDate) {
                const parts = bank.startDate.split("-").map(Number);
                if (parts.length === 3) {
                    const endDate = new Date(parts[0], parts[1] - 1 + durationMonths, parts[2]);
                    maturityText = `Vence el ${formatDate(endDate.toISOString().split('T')[0])}`;
                }
            }

            const card = document.createElement("div");
            card.className = "bank-item-card bank-deposit-card";

            let statusHTML = "";
            if (bank.maturedTransferDone) {
                statusHTML = `
                    <div style="margin-top: 6px;">
                        <span class="deposit-status-matured">✓ Vencido & Transferido a ${destName}</span>
                    </div>
                `;
            } else {
                statusHTML = `
                    <div style="font-size: 0.74rem; color: var(--text-secondary); margin-top: 6px; display: flex; flex-direction: column; gap: 2px;">
                        <div>Rendimiento Neto Est.: <strong style="color: var(--success-light);">+${formatCurrency(netInterest)}</strong> <span style="font-size: 0.68rem; color: var(--text-muted);">(Impuestos ${taxRate*100}%: ${formatCurrency(taxes)})</span></div>
                        <div>Al vencimiento: <strong>${formatCurrency(totalPayout)}</strong> → <em>${destName}</em></div>
                        <div style="color: var(--primary-light); font-weight: 600; margin-top: 2px;">📅 ${maturityText}</div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="bank-card-info" style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3>${bank.name}</h3>
                        <span class="deposit-badge-tae">🔒 ${tae}% TAE</span>
                    </div>
                    ${purposeHTML}
                    <div class="bank-meta" style="margin-top: 2px;">Contratado el ${formatDate(bank.startDate || bank.createdAt)} (${durationMonths} Meses)</div>
                    ${statusHTML}
                </div>
                <div class="bank-card-balance-section" style="gap: 8px; flex-direction: row; align-items: center; align-self: flex-start;">
                    <span class="bank-card-balance" style="margin-right: 8px;">${formatCurrency(bank.balance)}</span>
                    <button onclick="openEditModal('bank', '${bank.id}')" class="btn-edit-icon" title="Editar Depósito">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="deleteBank('${bank.id}')" class="btn-delete-icon" title="Eliminar Depósito">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            container.appendChild(card);
            return;
        }

        // ── Card normal ──
        let pendingFixedSum = 0;
        let pendingExpensesNames = [];
        const [year, month] = state.currentMonth.split("-").map(Number);
        const currentMonthNumber = String(month).padStart(2, "0");
        const currentM = month;

        state.fixedExpenses.filter(fe => fe.bankId === bank.id).forEach(fe => {
            const periodicity = fe.periodicity || "Mensual";
            const refM = parseInt(fe.chargeMonth || "01");

            let appliesThisMonth = false;
            if (periodicity === "Mensual") {
                appliesThisMonth = true;
            } else if (periodicity === "Trimestral") {
                appliesThisMonth = (Math.abs(currentM - refM) % 3 === 0);
            } else if (periodicity === "Semestral") {
                appliesThisMonth = (Math.abs(currentM - refM) % 6 === 0);
            } else if (periodicity === "Anual") {
                appliesThisMonth = (fe.chargeMonth === currentMonthNumber);
            }

            if (!appliesThisMonth) return;

            const alreadyApplied = state.transactions.some(tx => 
                tx.type === "expense" &&
                tx.subtype === "Fixed" &&
                tx.description === fe.name &&
                tx.bankId === fe.bankId &&
                tx.month === state.currentMonth
            );

            if (!alreadyApplied) {
                pendingFixedSum += fe.amount;
                pendingExpensesNames.push(`${fe.name} (${formatCurrency(fe.amount)})`);
            }
        });

        let alertsHTML = "";
        if (bank.balance < pendingFixedSum) {
            const neededAmount = pendingFixedSum - bank.balance;
            const tooltipText = `Faltan ${formatCurrency(neededAmount)} para cubrir cobros fijos pendientes este mes:&#10;• ` + pendingExpensesNames.join("&#10;• ");
            alertsHTML += `
                <div class="alert-overdraft" onclick="quickTransferToCoverMinimum('${bank.id}', ${neededAmount})" title="${tooltipText} (Clic para preparar traspaso)" style="margin-top: 4px; cursor: pointer; transition: var(--transition-smooth);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>Faltan ${formatCurrency(neededAmount)} (Fijos) <strong style="text-decoration: underline; margin-left: 2px;">Cubrir ↗</strong></span>
                </div>
            `;
        }

        if (bank.minBalance !== null && bank.minBalance !== undefined) {
            if (bank.balance < bank.minBalance) {
                const deficit = bank.minBalance - bank.balance;
                alertsHTML += `
                    <div class="alert-overdraft" onclick="quickTransferToCoverMinimum('${bank.id}', ${deficit})" title="Por debajo de tu mínimo de seguridad. Clic para preparar traspaso de ${formatCurrency(deficit)} y cubrir el mínimo." style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.2); margin-top: 4px; cursor: pointer; transition: var(--transition-smooth);">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span>Mínimo: Faltan ${formatCurrency(deficit)} <strong style="text-decoration: underline; margin-left: 2px;">Cubrir ↗</strong></span>
                    </div>
                `;
            } else {
                alertsHTML += `
                    <div class="alert-overdraft" title="Por encima de tu mínimo de seguridad de ${formatCurrency(bank.minBalance)}" style="background: rgba(16, 185, 129, 0.08); color: var(--success-light); border-color: rgba(16, 185, 129, 0.2); margin-top: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>Mínimo: ${formatCurrency(bank.minBalance)} (Óptimo)</span>
                    </div>
                `;
            }
        }

        const card = document.createElement("div");
        card.className = "bank-item-card";
        card.innerHTML = `
            <div class="bank-card-info" style="flex:1;">
                <h3>${bank.name}</h3>
                ${purposeHTML}
                <div class="bank-meta" style="margin-top: 4px;">Creado el ${formatDate(bank.createdAt)}</div>
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                    ${alertsHTML}
                </div>
            </div>
            <div class="bank-card-balance-section" style="gap: 8px; flex-direction: row; align-items: center; align-self: flex-start;">
                <span class="bank-card-balance" style="margin-right: 8px;">${formatCurrency(bank.balance)}</span>
                <button onclick="openEditModal('bank', '${bank.id}')" class="btn-edit-icon" title="Editar Banco">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button onclick="deleteBank('${bank.id}')" class="btn-delete-icon" title="Eliminar Banco">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderInvestmentsList() {
    const container = document.getElementById("investments-list-container");
    if (!container) return;
    container.innerHTML = "";

    const activeInvestments = state.banks.filter(b => b.bankType === "pension" || b.bankType === "investment");

    // Calcular agregados
    let totalContributed = 0;
    let currentValue = 0;

    activeInvestments.forEach(b => {
        totalContributed += b.balance || 0;
        currentValue += b.estimatedValue ?? b.balance ?? 0;
    });

    const totalYield = currentValue - totalContributed;
    const roi = totalContributed > 0 ? (totalYield / totalContributed) * 100 : 0;

    const contributedEl = document.getElementById("investments-total-contributed");
    const valueEl = document.getElementById("investments-current-value");
    const yieldEl = document.getElementById("investments-total-yield");

    if (contributedEl) contributedEl.textContent = formatCurrency(totalContributed);
    if (valueEl) valueEl.textContent = formatCurrency(currentValue);
    
    if (yieldEl) {
        const sign = totalYield >= 0 ? "+" : "";
        yieldEl.textContent = `${sign}${formatCurrency(totalYield)} (${sign}${roi.toFixed(1)}%)`;
        yieldEl.style.color = totalYield >= 0 ? "var(--success-light)" : "#ef4444";
    }

    if (activeInvestments.length === 0) {
        container.innerHTML = `<div class="alert-info" style="grid-column: 1 / -1;">No hay planes de pensiones o fondos de inversión registrados. Usa el botón superior para añadir uno.</div>`;
        return;
    }

    activeInvestments.forEach(bank => {
        const estimatedValue = bank.estimatedValue ?? bank.balance;
        const gains = estimatedValue - bank.balance;
        const gainsClass = gains >= 0 ? "pension-gains-pos" : "pension-gains-neg";
        const gainsSign = gains >= 0 ? "+" : "";
        const bankRoi = bank.balance > 0 ? (gains / bank.balance) * 100 : 0;

        const tags = bank.purpose ? bank.purpose.split(",").map(t => t.trim()).filter(t => t !== "") : [];
        const purposeHTML = tags.length > 0
            ? `<div class="bank-meta-tags" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; margin-bottom:4px;">
                ${tags.map(t => `<span class="badge-tag" style="background:rgba(255,255,255,0.06); border:1px solid var(--border-color); color:var(--text-secondary); padding:2px 8px; border-radius:4px; font-size:0.68rem; font-weight:500;">🏷️ ${t}</span>`).join("")}
               </div>`
            : "";

        // Calcular barra comparativa (Aportado vs Interés)
        let progressBarHTML = "";
        if (estimatedValue > 0) {
            const contributedPercent = Math.min(100, Math.max(0, (bank.balance / estimatedValue) * 100));
            const gainsPercent = 100 - contributedPercent;
            progressBarHTML = `
                <div class="investment-split-bar" style="margin-top:14px; width:100%;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">
                        <span>Invertido: ${contributedPercent.toFixed(0)}%</span>
                        <span>Ganado: ${gainsPercent.toFixed(0)}%</span>
                    </div>
                    <div class="progress-bar-bg" style="background: rgba(255,255,255,0.05); border-radius: 4px; height: 8px; overflow: hidden; display: flex; border: 1px solid var(--border-color);">
                        <div style="background: var(--primary-light); width: ${contributedPercent}%; height: 100%; transition: width 0.3s;" title="Principal Aportado: ${formatCurrency(bank.balance)}"></div>
                        ${gains > 0 ? `<div style="background: var(--success-light); width: ${gainsPercent}%; height: 100%; transition: width 0.3s;" title="Ganancias por Interés: ${formatCurrency(gains)}"></div>` : ""}
                    </div>
                </div>
            `;
        }

        // Alerta de Mínimo de Seguridad (si lo tuviera)
        let minAlertHTML = "";
        if (bank.minBalance !== null && bank.minBalance !== undefined) {
            if (bank.balance < bank.minBalance) {
                const deficit = bank.minBalance - bank.balance;
                minAlertHTML = `
                    <div class="alert-overdraft" title="Por debajo de tu mínimo de seguridad de ${formatCurrency(bank.minBalance)}" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.2); margin-top: 6px; display:inline-flex;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span style="margin-left:4px;">Mínimo: Faltan ${formatCurrency(deficit)}</span>
                    </div>
                `;
            } else {
                minAlertHTML = `
                    <div class="alert-overdraft" title="Por encima de tu mínimo de seguridad de ${formatCurrency(bank.minBalance)}" style="background: rgba(16, 185, 129, 0.08); color: var(--success-light); border-color: rgba(16, 185, 129, 0.2); margin-top: 6px; display:inline-flex;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span style="margin-left:4px;">Mínimo: ${formatCurrency(bank.minBalance)} (Óptimo)</span>
                    </div>
                `;
            }
        }

        const card = document.createElement("div");
        card.className = "bank-item-card bank-pension-card";
        card.style.borderLeft = "4px solid var(--primary-light)";
        card.innerHTML = `
            <div class="bank-card-info" style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap: wrap;">
                    <h3>${bank.name}</h3>
                    <span class="badge-pension" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary-light); border: 1px solid rgba(var(--primary-rgb), 0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">📈 Inversión / Plan</span>
                </div>
                ${purposeHTML}
                <div class="bank-meta" style="margin-top: 4px;">Creado el ${formatDate(bank.createdAt)}</div>
                
                <div class="pension-stats" style="margin-top: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                    <div class="pension-stat">
                        <span class="pension-stat-label" style="display:block; font-size:0.7rem; color:var(--text-muted);">Total Invertido</span>
                        <span class="pension-stat-value" style="font-weight:600; font-size:0.9rem; color:var(--text-light);">${formatCurrency(bank.balance)}</span>
                    </div>
                    <div class="pension-stat">
                        <span class="pension-stat-label" style="display:block; font-size:0.7rem; color:var(--text-muted);">Valoración Actual</span>
                        <span class="pension-stat-value" style="font-weight:600; font-size:0.9rem; color:var(--primary-light);">${formatCurrency(estimatedValue)}</span>
                    </div>
                    <div class="pension-stat">
                        <span class="pension-stat-label" style="display:block; font-size:0.7rem; color:var(--text-muted);">Diferencia / ROI</span>
                        <span class="pension-stat-value ${gainsClass}" style="font-weight:600; font-size:0.9rem;">${gainsSign}${formatCurrency(gains)} (${gainsSign}${bankRoi.toFixed(1)}%)</span>
                    </div>
                </div>
                
                ${progressBarHTML}
                ${generateSparklineSVG(bank.valuations, bank.id)}
                ${minAlertHTML}
            </div>
            <div class="bank-card-balance-section" style="gap:8px; flex-direction:column; align-items:flex-end; align-self: flex-start;">
                <button onclick="openValuationModal('${bank.id}')" class="btn-edit-icon" title="Actualizar Valoración" style="color: var(--success-light); background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.15);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                </button>
                <button onclick="openEditModal('bank', '${bank.id}')" class="btn-edit-icon" title="Editar Inversión">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button onclick="deleteBank('${bank.id}')" class="btn-delete-icon" title="Eliminar Inversión">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    // Inicializar gráficos Chart.js para cada cartera
    if (!window.investmentCharts) window.investmentCharts = {};
    
    activeInvestments.forEach(bank => {
        if (!bank.valuations || bank.valuations.length < 2) return;
        const canvasId = `chart-investment-${bank.id}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (window.investmentCharts[bank.id]) {
            window.investmentCharts[bank.id].destroy();
        }

        const labels = bank.valuations.map(v => {
            const parts = v.date.split("-");
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}`;
            }
            return v.date;
        });
        const dataContrib = bank.valuations.map(v => v.balance || 0);
        const dataEst = bank.valuations.map(v => v.estimatedValue ?? v.balance ?? 0);

        // Determinar color de tendencia (ganancia o pérdida)
        const isGain = dataEst[dataEst.length - 1] >= dataContrib[dataContrib.length - 1];
        const estColor = isGain ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
        const estBg = isGain ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';

        window.investmentCharts[bank.id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Aportado',
                        data: dataContrib,
                        borderColor: 'rgba(0, 229, 255, 0.85)',
                        backgroundColor: 'rgba(0, 229, 255, 0.03)',
                        borderWidth: 1.8,
                        pointBackgroundColor: '#111827',
                        pointBorderColor: 'rgba(0, 229, 255, 0.95)',
                        pointBorderWidth: 1.5,
                        pointRadius: 3.5,
                        pointHoverRadius: 5,
                        tension: 0.25,
                        fill: false
                    },
                    {
                        label: 'Valor Real',
                        data: dataEst,
                        borderColor: estColor,
                        backgroundColor: estBg,
                        borderWidth: 2,
                        pointBackgroundColor: '#111827',
                        pointBorderColor: estColor,
                        pointBorderWidth: 1.5,
                        pointRadius: 3.5,
                        pointHoverRadius: 5,
                        tension: 0.25,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        padding: 8,
                        titleFont: { size: 9, family: 'Outfit, sans-serif' },
                        bodyFont: { size: 9, family: 'Outfit, sans-serif' }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.02)'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 8,
                                family: 'Outfit, sans-serif'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.02)'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 8,
                                family: 'Outfit, sans-serif'
                            }
                        }
                    }
                }
            }
        });
    });
}

// MÓDULO 2: ACTUALIZAR SELECTORES DE BANCOS EN GASTOS
function renderExpensesDropdowns() {
    const fixedSelect = document.getElementById("fixed-bank-id");
    const varSelect = document.getElementById("var-bank-id");
    const adjSelect = document.getElementById("adj-bank-id");
    const destSelect = document.getElementById("fixed-dest-bank-id");

    fixedSelect.innerHTML = "";
    varSelect.innerHTML = "";
    if (adjSelect) adjSelect.innerHTML = "";
    if (destSelect) destSelect.innerHTML = `<option value="">-- Ninguno (Gasto Ordinario) --</option>`;

    if (state.banks.length === 0) {
        const opt = `<option value="">-- Cree un banco primero --</option>`;
        fixedSelect.innerHTML = opt;
        varSelect.innerHTML = opt;
        if (adjSelect) adjSelect.innerHTML = opt;
        return;
    }

    state.banks.forEach(bank => {
        // Los planes de pensiones e inversiones no participan en el sistema de gastos como origen, sino como destino
        if (bank.bankType === "pension" || bank.bankType === "investment") {
            if (destSelect) {
                const valShow = bank.estimatedValue ?? bank.balance;
                destSelect.innerHTML += `<option value="${bank.id}">${bank.name} (Valor: ${formatCurrency(valShow)})</option>`;
            }
            return;
        }
        const option = `<option value="${bank.id}">${bank.name} (Saldo: ${formatCurrency(bank.balance)})</option>`;
        fixedSelect.innerHTML += option;
        varSelect.innerHTML += option;
        if (adjSelect) adjSelect.innerHTML += option;
    });
    renderTransferDropdowns();
}

// MÓDULO 2: TABLA DE GASTOS FIJOS (MATRIZ)
// Variable para almacenar el filtro de banco seleccionado en la matriz
let selectedFixedBankFilter = 'all';

function renderFixedExpensesTable() {
    const tbody = document.getElementById("tbody-fixed-expenses");
    const tfoot = document.getElementById("tfoot-fixed-expenses");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (tfoot) tfoot.innerHTML = "";

    const btnApply = document.getElementById("btn-execute-fixed-expenses");
    const btnText = document.getElementById("btn-execute-fixed-text");

    const currentMonthNumber = state.currentMonth.split("-")[1]; // "MM"
    const currentM = parseInt(currentMonthNumber);

    // 1. Cálculos globales de gastos fijos y por banco (KPIs y periodicidades)
    let totalThisMonthCommitted = 0;
    let totalThisMonthPaid = 0;
    let totalAnnualCost = 0;

    const bankStats = {};
    const applicableList = [];

    state.fixedExpenses.forEach(fe => {
        const bId = fe.bankId || "other";
        if (!bankStats[bId]) {
            bankStats[bId] = { count: 0, monthTotal: 0, monthPaid: 0, annualTotal: 0 };
        }
        bankStats[bId].count++;

        const periodicity = fe.periodicity || "Mensual";
        const refM = parseInt(fe.chargeMonth || "01");

        let appliesThisMonth = false;
        let factorAnnual = 12; // Número de veces que se cobra al año

        if (periodicity === "Mensual") {
            appliesThisMonth = true;
            factorAnnual = 12;
        } else if (periodicity === "Trimestral") {
            appliesThisMonth = (Math.abs(currentM - refM) % 3 === 0);
            factorAnnual = 4;
        } else if (periodicity === "Semestral") {
            appliesThisMonth = (Math.abs(currentM - refM) % 6 === 0);
            factorAnnual = 2;
        } else if (periodicity === "Anual") {
            appliesThisMonth = (fe.chargeMonth === currentMonthNumber);
            factorAnnual = 1;
        }

        const feAnnualCost = fe.amount * factorAnnual;
        totalAnnualCost += feAnnualCost;
        bankStats[bId].annualTotal += feAnnualCost;

        // Comprobar si ya se aplicó/cobró en el mes en curso
        const feNameLower = (fe.name || "").toLowerCase().trim();
        const isPaid = (state.transactions || []).some(t => {
            if (t.type !== "expense" || t.month !== state.currentMonth) return false;
            const tDescLower = (t.description || "").toLowerCase().trim();
            const isFixedSubtype = (t.subtype === "Fixed" || t.subtype === "Fijo");
            
            if (t.description === fe.name && (!fe.bankId || t.bankId === fe.bankId)) return true;
            if (isFixedSubtype && (tDescLower.includes(feNameLower) || feNameLower.includes(tDescLower))) return true;
            if (tDescLower === feNameLower) return true;
            if ((tDescLower.includes(feNameLower) || feNameLower.includes(tDescLower)) && Math.abs(t.amount - fe.amount) < 0.01) return true;
            return false;
        });

        if (appliesThisMonth) {
            totalThisMonthCommitted += fe.amount;
            bankStats[bId].monthTotal += fe.amount;
            if (isPaid) {
                totalThisMonthPaid += fe.amount;
                bankStats[bId].monthPaid += fe.amount;
            }
        }

        applicableList.push({
            fe,
            appliesThisMonth,
            isPaid,
            factorAnnual,
            monthlyEquiv: (fe.amount * factorAnnual) / 12
        });
    });

    // 2. Determinar métricas activas para las Tarjetas KPI según la cuenta seleccionada
    let activeMonthCommitted = 0;
    let activeMonthPaid = 0;
    let activeMonthPending = 0;
    let activeAnnualTotal = 0;
    let activeMonthlyAvg = 0;
    let activeCount = 0;

    let monthLabel = "Comprometido Este Mes";
    let yearLabel = "Coste Total Anual";
    let yearSub = "";
    let avgLabel = "Media Mensual Teórica";
    let avgSub = "";

    if (selectedFixedBankFilter === 'all') {
        activeMonthCommitted = totalThisMonthCommitted;
        activeMonthPaid = totalThisMonthPaid;
        activeMonthPending = Math.max(0, totalThisMonthCommitted - totalThisMonthPaid);
        activeAnnualTotal = totalAnnualCost;
        activeMonthlyAvg = state.fixedExpenses.length > 0 ? (totalAnnualCost / 12) : 0;
        activeCount = state.fixedExpenses.length;

        monthLabel = "Comprometido Este Mes";
        yearLabel = "Coste Total Anual";
        yearSub = `Suma anualizada de ${activeCount} fijos`;
        avgLabel = "Media Mensual Teórica";
        avgSub = "Media de todas las cuentas";
    } else {
        const activeBank = state.banks.find(b => b.id === selectedFixedBankFilter);
        const activeBankName = activeBank ? activeBank.name : "Cuenta";
        const stat = bankStats[selectedFixedBankFilter] || { count: 0, monthTotal: 0, monthPaid: 0, annualTotal: 0 };

        activeMonthCommitted = stat.monthTotal;
        activeMonthPaid = stat.monthPaid;
        activeMonthPending = Math.max(0, stat.monthTotal - stat.monthPaid);
        activeAnnualTotal = stat.annualTotal;
        activeMonthlyAvg = stat.count > 0 ? (stat.annualTotal / 12) : 0;
        activeCount = stat.count;

        monthLabel = `Comprometido · ${escapeHtml(activeBankName)}`;
        yearLabel = `Coste Anual · ${escapeHtml(activeBankName)}`;
        yearSub = `${activeCount} fijos en esta cuenta`;
        avgLabel = `Media Mensual · ${escapeHtml(activeBankName)}`;
        avgSub = `Media mensual en ${escapeHtml(activeBankName)}`;
    }

    // Actualizar Tarjetas KPI en la cabecera
    const kpiMonthLabelEl = document.getElementById("fixed-kpi-month-label");
    const kpiMonthTotalEl = document.getElementById("fixed-kpi-month-total");
    const kpiMonthStatusEl = document.getElementById("fixed-kpi-month-status");
    const kpiYearLabelEl = document.getElementById("fixed-kpi-year-label");
    const kpiYearTotalEl = document.getElementById("fixed-kpi-year-total");
    const kpiYearSubEl = document.getElementById("fixed-kpi-year-sub");
    const kpiAvgLabelEl = document.getElementById("fixed-kpi-avg-label");
    const kpiAvgMonthlyEl = document.getElementById("fixed-kpi-avg-monthly");
    const kpiCountEl = document.getElementById("fixed-kpi-count");

    if (kpiMonthLabelEl) kpiMonthLabelEl.innerHTML = monthLabel;
    if (kpiMonthTotalEl) kpiMonthTotalEl.textContent = formatCurrency(activeMonthCommitted);
    if (kpiMonthStatusEl) {
        kpiMonthStatusEl.innerHTML = `✓ <span style="color:var(--success-light); font-weight:600;">${formatCurrency(activeMonthPaid)}</span> cobrado · ⏳ <span style="color:${activeMonthPending > 0 ? '#f59e0b' : 'var(--text-muted)'}; font-weight:600;">${formatCurrency(activeMonthPending)}</span> pendiente`;
    }

    if (kpiYearLabelEl) kpiYearLabelEl.innerHTML = yearLabel;
    if (kpiYearTotalEl) kpiYearTotalEl.textContent = `${formatCurrency(activeAnnualTotal)} / año`;
    if (kpiYearSubEl) kpiYearSubEl.textContent = yearSub;

    if (kpiAvgLabelEl) kpiAvgLabelEl.innerHTML = avgLabel;
    if (kpiAvgMonthlyEl) kpiAvgMonthlyEl.textContent = `${formatCurrency(activeMonthlyAvg)} / mes`;
    if (kpiCountEl) kpiCountEl.textContent = avgSub;

    // 3. Renderizar Filtros de Matriz por Banco (Dropdown select y Segmented buttons sincronizados)
    const selectEl = document.getElementById("filter-fixed-bank-select");
    const chipsContainer = document.getElementById("fixed-bank-filter-chips");
    const filterFeedback = document.getElementById("fixed-filter-feedback");

    if (selectEl) {
        selectEl.innerHTML = "";

        // Opción Todas las Cuentas
        const optAll = document.createElement("option");
        optAll.value = "all";
        optAll.textContent = `Todas las Cuentas (${state.fixedExpenses.length} fijos · ${formatCurrency(totalThisMonthCommitted)}/mes)`;
        if (selectedFixedBankFilter === 'all') optAll.selected = true;
        selectEl.appendChild(optAll);

        Object.keys(bankStats).forEach(bId => {
            const bank = state.banks.find(b => b.id === bId);
            const bName = bank ? bank.name : "Otros";
            const stat = bankStats[bId];

            const opt = document.createElement("option");
            opt.value = bId;
            opt.textContent = `${bName} (${stat.count} fijos · ${formatCurrency(stat.monthTotal)}/mes · ${formatCurrency(stat.annualTotal)}/año)`;
            if (selectedFixedBankFilter === bId) opt.selected = true;
            selectEl.appendChild(opt);
        });

        if (!selectEl.dataset.listenerAttached) {
            selectEl.addEventListener("change", (e) => {
                selectedFixedBankFilter = e.target.value;
                renderFixedExpensesTable();
            });
            selectEl.dataset.listenerAttached = "true";
        }
    }

    if (chipsContainer) {
        chipsContainer.innerHTML = "";

        // Chip "Todos"
        const chipAll = document.createElement("button");
        chipAll.type = "button";
        chipAll.className = `btn-filter-chip ${selectedFixedBankFilter === 'all' ? 'active' : ''}`;
        chipAll.innerHTML = `<span>Todos</span> <span class="chip-count">${state.fixedExpenses.length}</span>`;
        chipAll.title = `Todas las cuentas (${state.fixedExpenses.length} fijos · ${formatCurrency(totalThisMonthCommitted)} este mes · ${formatCurrency(totalAnnualCost)}/año)`;
        chipAll.addEventListener("click", () => {
            selectedFixedBankFilter = 'all';
            renderFixedExpensesTable();
        });
        chipsContainer.appendChild(chipAll);

        // Chips por cada banco que tenga fijos
        Object.keys(bankStats).forEach(bId => {
            const bank = state.banks.find(b => b.id === bId);
            const bName = bank ? bank.name : "Otros";
            const stat = bankStats[bId];

            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `btn-filter-chip ${selectedFixedBankFilter === bId ? 'active' : ''}`;
            chip.innerHTML = `<span>${escapeHtml(bName)}</span> <span class="chip-count">${stat.count}</span>`;
            chip.title = `${escapeHtml(bName)}: ${stat.count} fijos (${formatCurrency(stat.monthTotal)} este mes · ${formatCurrency(stat.annualTotal)}/año)`;
            chip.addEventListener("click", () => {
                selectedFixedBankFilter = bId;
                renderFixedExpensesTable();
            });
            chipsContainer.appendChild(chip);
        });
    }

    if (filterFeedback) {
        if (selectedFixedBankFilter === 'all') {
            filterFeedback.innerHTML = `Mostrando <strong>todas las cuentas</strong> (${state.fixedExpenses.length} fijos)`;
        } else {
            const b = state.banks.find(x => x.id === selectedFixedBankFilter);
            const stat = bankStats[selectedFixedBankFilter] || { count: 0, monthTotal: 0, annualTotal: 0 };
            filterFeedback.innerHTML = `Filtrado por <strong>${escapeHtml(b ? b.name : 'Cuenta')}</strong>: ${stat.count} fijos · ${formatCurrency(stat.monthTotal)} este mes`;
        }
    }

    // 4. Filtrar y Ordenar Filas de la Tabla
    let displayList = applicableList;
    if (selectedFixedBankFilter !== 'all') {
        displayList = displayList.filter(item => (item.fe.bankId || 'other') === selectedFixedBankFilter);
    }

    // Ordenar por día de cobro
    displayList.sort((a, b) => (a.fe.day || 1) - (b.fe.day || 1));

    if (state.fixedExpenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No hay gastos recurrentes definidos en la matriz. Use el botón superior para añadir uno.</td></tr>`;
        if (btnApply && btnText) {
            btnApply.className = "btn-action-apply applied";
            btnText.textContent = "Aplicar Gastos Fijos (0 pendientes)";
            btnApply.setAttribute("disabled", "true");
        }
        return;
    }

    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No hay gastos fijos registrados en la cuenta seleccionada.</td></tr>`;
    } else {
        let visibleMonthSum = 0;
        let visibleMonthlyEquivSum = 0;
        let visiblePaidSum = 0;
        let visibleAnnualSum = 0;

        const monthsNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthsNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        displayList.forEach(item => {
            const { fe, appliesThisMonth, isPaid, factorAnnual, monthlyEquiv } = item;
            const bank = state.banks.find(b => b.id === fe.bankId);
            const bankName = bank ? bank.name : "Desconocido";
            const destBank = fe.destBankId ? state.banks.find(b => b.id === fe.destBankId) : null;
            const destBankHTML = destBank ? `<div style="font-size:0.7rem; color:var(--success-light); margin-top:4px; font-weight:500;">➡️ Destino: ${escapeHtml(destBank.name)}</div>` : "";

            if (appliesThisMonth) {
                visibleMonthSum += fe.amount;
                if (isPaid) visiblePaidSum += fe.amount;
            }
            visibleMonthlyEquivSum += monthlyEquiv;
            visibleAnnualSum += (fe.amount * factorAnnual);

            const periodicity = fe.periodicity || "Mensual";
            const refM = parseInt(fe.chargeMonth || "01");

            // Formatear descripción del estado
            let statusText = "";
            if (isPaid) {
                statusText = `<span style="color: var(--success-light); font-weight: 600;">✓ Cobrado este mes</span>`;
            } else if (!appliesThisMonth) {
                if (periodicity === "Anual") {
                    const mName = monthsNames[refM - 1] || "Otro";
                    statusText = `<span style="color: var(--text-muted); font-size: 0.72rem;">💤 Anual - Cobro en ${mName}</span>`;
                } else if (periodicity === "Trimestral") {
                    const month2 = (refM + 3 - 1) % 12 + 1;
                    const month3 = (refM + 6 - 1) % 12 + 1;
                    const month4 = (refM + 9 - 1) % 12 + 1;
                    const mText = [refM, month2, month3, month4].map(m => monthsNamesShort[m - 1]).join(", ");
                    statusText = `<span style="color: var(--text-muted); font-size: 0.72rem;">💤 Trimestral - Meses: ${mText}</span>`;
                } else if (periodicity === "Semestral") {
                    const month2 = (refM + 6 - 1) % 12 + 1;
                    const mText = [refM, month2].map(m => monthsNamesShort[m - 1]).join(", ");
                    statusText = `<span style="color: var(--text-muted); font-size: 0.72rem;">💤 Semestral - Meses: ${mText}</span>`;
                }
            } else {
                statusText = `<span style="color: #f59e0b; font-weight: 600;">⚡ Pendiente de cobro</span>`;
            }

            // Badge de periodicidad
            let periodicityBadge = "";
            if (periodicity === "Mensual") {
                periodicityBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success-light); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Mensual</span>`;
            } else if (periodicity === "Trimestral") {
                const mShort = monthsNamesShort[refM - 1] || "Ene";
                periodicityBadge = `<span class="badge" style="background: rgba(0, 229, 255, 0.15); color: var(--primary-light); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Trim. (Ref: ${mShort})</span>`;
            } else if (periodicity === "Semestral") {
                const mShort = monthsNamesShort[refM - 1] || "Ene";
                periodicityBadge = `<span class="badge" style="background: rgba(255, 115, 0, 0.15); color: var(--accent-light); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Sem. (Ref: ${mShort})</span>`;
            } else if (periodicity === "Anual") {
                const mShort = monthsNamesShort[refM - 1] || "Ene";
                periodicityBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--warning-light); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Anual (${mShort})</span>`;
            }

            // Prorrateo si no es mensual
            let prorateHTML = "";
            if (periodicity !== "Mensual") {
                prorateHTML = `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;" title="Coste mensual prorrateado">(${formatCurrency(monthlyEquiv)}/mes)</div>`;
            }

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(fe.name)}</div>
                    <div style="font-size: 0.72rem; margin-top: 2px;">
                        ${statusText}
                    </div>
                </td>
                <td>
                    <span class="bank-tag" style="background: rgba(0, 229, 255, 0.15); color: var(--primary-light); padding: 4px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 600;">
                        ${escapeHtml(bankName)}
                    </span>
                    ${destBankHTML}
                </td>
                <td style="font-weight: 500; color: var(--text-primary);">Día ${fe.day || 1}</td>
                <td>${periodicityBadge}</td>
                <td class="amount-col" style="font-weight:700; color: var(--danger-light);">
                    ${formatCurrency(fe.amount)}
                    ${prorateHTML}
                </td>
                <td class="actions-col">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button onclick="openEditModal('fixedExpense', '${fe.id}')" class="btn-edit-mini-icon" title="Editar Gasto Fijo">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="deleteFixedExpense('${fe.id}')" class="btn-delete-mini-icon" title="Borrar de la matriz">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Fila de Totales Dinámica (tfoot)
        if (tfoot) {
            const selectedBank = state.banks.find(b => b.id === selectedFixedBankFilter);
            const filterLabel = selectedFixedBankFilter === 'all' 
                ? 'TOTAL GENERAL' 
                : `TOTAL (${escapeHtml(selectedBank ? selectedBank.name : 'Cuenta')})`;
            const pendingSum = Math.max(0, visibleMonthSum - visiblePaidSum);

            tfoot.innerHTML = `
                <tr>
                    <td style="color: var(--primary-light); font-weight: 700;">
                        ${filterLabel}
                        <div style="font-size: 0.70rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                            ${displayList.length} recibos en plantilla
                        </div>
                    </td>
                    <td colspan="3" style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 500;">
                        Este mes aplica: <strong style="color: var(--text-primary); font-weight: 700;">${formatCurrency(visibleMonthSum)}</strong> 
                        <span style="color: var(--text-muted); font-size: 0.74rem;">(✓ ${formatCurrency(visiblePaidSum)} cobrado · ⏳ ${formatCurrency(pendingSum)} pendiente)</span>
                    </td>
                    <td class="amount-col" style="text-align: right;">
                        <div style="font-weight: 800; color: var(--danger-light); font-size: 1.15rem; white-space: nowrap;">
                            ${formatCurrency(visibleMonthSum)}
                        </div>
                    </td>
                    <td></td>
                </tr>
            `;
        }
    }

    // 5. Configurar estado del botón de aplicación global
    let pendingToApplyGlobal = 0;
    applicableList.forEach(item => {
        if (item.appliesThisMonth && !item.isPaid) {
            pendingToApplyGlobal++;
        }
    });

    if (btnApply && btnText) {
        if (pendingToApplyGlobal > 0) {
            btnApply.className = "btn-action-apply pending";
            btnText.textContent = `Aplicar Gastos Fijos (${pendingToApplyGlobal} pendientes)`;
            btnApply.removeAttribute("disabled");
        } else {
            btnApply.className = "btn-action-apply applied";
            btnText.textContent = "Gastos Fijos Aplicados ✓";
            btnApply.setAttribute("disabled", "true");
        }
    }
}



// MÓDULO 2: HISTORIAL DE TRANSACCIONES DEL MES
function renderTransactionsTable() {
    const tbody = document.getElementById("tbody-transactions");
    const filterType = document.getElementById("filter-tx-type").value;
    
    tbody.innerHTML = "";
    document.getElementById("transactions-month-title").textContent = formatMonthString(state.currentMonth);

    // Filtrar por el mes actual
    let txs = state.transactions.filter(tx => tx.month === state.currentMonth);

    // Aplicar buscador de movimientos
    const searchInput = document.getElementById("search-tx");
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
    if (searchVal) {
        txs = txs.filter(tx => {
            let bankName = "";
            if (tx.bankId) {
                const bank = state.banks.find(b => b.id === tx.bankId);
                if (bank) bankName = bank.name.toLowerCase();
            } else if (tx.distributions) {
                bankName = tx.distributions.map(d => {
                    const b = state.banks.find(bankObj => bankObj.id === d.bankId);
                    return b ? b.name.toLowerCase() : "";
                }).join(" ");
            }
            const description = tx.description ? tx.description.toLowerCase() : "";
            const subtype = tx.subtype ? tx.subtype.toLowerCase() : "";
            return description.includes(searchVal) || bankName.includes(searchVal) || subtype.includes(searchVal);
        });
    }

    // Aplicar filtros por tipo
    if (filterType === "income") {
        txs = txs.filter(tx => tx.type === "income");
    } else if (filterType === "expense") {
        txs = txs.filter(tx => tx.type === "expense");
    } else if (filterType === "fixed") {
        txs = txs.filter(tx => tx.type === "expense" && tx.subtype === "Fixed");
    } else if (filterType === "variable") {
        txs = txs.filter(tx => tx.type === "expense" && tx.subtype === "Variable");
    }

    // Ordenar transacciones por fecha descendente (más nuevas primero)
    txs.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No se registran movimientos en el mes de ${formatMonthString(state.currentMonth)} para esta selección.</td></tr>`;
        return;
    }

    txs.forEach(tx => {
        // Encontrar bancos
        let bankName = "-";
        if (tx.bankId) {
            const bank = state.banks.find(b => b.id === tx.bankId);
            bankName = bank ? bank.name : "Desconocido";
        } else if (tx.distributions) {
            // Es un ingreso distribuido en múltiples bancos
            bankName = tx.distributions.map(d => {
                const b = state.banks.find(bankObj => bankObj.id === d.bankId);
                return b ? `${b.name.split(' ')[0]} (${formatCurrency(d.amount)})` : `Err (${formatCurrency(d.amount)})`;
            }).join(', ');
        }

        let typeClass = "";
        let subtypeBadge = "";
        let amountFormatted = "";

        if (tx.type === "income") {
            typeClass = "row-income";
            subtypeBadge = `<span class="badge-tx income">${tx.subtype || 'Ingreso'}</span>`;
            amountFormatted = `<span class="cell-amount-income">+${formatCurrency(tx.amount)}</span>`;
        } else {
            if (tx.subtype === "Fixed") {
                typeClass = "row-expense-fixed";
                subtypeBadge = `<span class="badge-tx fixed">Fijo</span>`;
            } else {
                typeClass = "row-expense-var";
                subtypeBadge = `<span class="badge-tx var">Variable</span>`;
            }
            amountFormatted = `<span class="cell-amount-expense">-${formatCurrency(tx.amount)}</span>`;
        }

        const row = document.createElement("tr");
        row.className = typeClass;
        row.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td>${subtypeBadge}</td>
            <td style="font-weight: 500;">${escapeHtml(tx.description)}</td>
            <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(bankName)}</td>
            <td class="amount-col">${amountFormatted}</td>
            <td class="actions-col">
                <button onclick="deleteTransaction('${tx.id}')" class="btn-delete-mini-icon" title="Revertir Transacción">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Escuchador de filtro
const filterTxTypeEl = document.getElementById("filter-tx-type");
if (filterTxTypeEl) {
    filterTxTypeEl.addEventListener("change", renderTransactionsTable);
}

function deleteTransaction(txId) {
    if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
        showToast("Este mes está cerrado y consolidado. No se pueden eliminar transacciones.", "danger");
        return;
    }
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;

    if (confirm(`¿Está seguro de que desea revertir la transacción "${tx.description}"?\nEl saldo de los bancos vinculados se reajustará de inmediato.`)) {
        // Deshacer flujos monetarios
        if (tx.type === "income") {
            if (tx.distributions) {
                tx.distributions.forEach(dist => {
                    const bank = state.banks.find(b => b.id === dist.bankId);
                    if (bank) {
                        bank.balance = parseFloat((bank.balance - dist.amount).toFixed(2));
                    }
                });
            }
        } else {
            // Gasto fijos o variables
            const bank = state.banks.find(b => b.id === tx.bankId);
            if (bank) {
                bank.balance = parseFloat((bank.balance + tx.amount).toFixed(2));
            }
        }

        // Eliminar transacción
        state.transactions = state.transactions.filter(t => t.id !== txId);
        showToast("Transacción revertida y balances bancarios restaurados.", "danger");
        saveState();
    }
}

// MÓDULO 3: TABLA DE ANÁLISIS DE DESVIACIÓN (PREVISTO VS REAL)
// Registro de instancias de Chart.js para el módulo de cierre
window._closureCharts = {};

// Estado de la pestaña activa en Cierre de Mes ('global' o bank.id)
let selectedClosureBankTab = 'global';

window.switchClosureBankTab = function(tabId) {
    selectedClosureBankTab = tabId;
    renderClosureCharts();
};

function renderDeviationAnalysisTable() {
    // Alias de compatibilidad — redirige a la nueva función de gráficas
    renderClosureCharts();
}

// ----------------------------------------------------
// MÓDULO 3: CIERRE DE MES — GRÁFICAS Y CONSOLIDADO
// ----------------------------------------------------

function renderClosureCharts() {
    const container = document.getElementById("closure-charts-container");
    const noBanks = document.getElementById("closure-no-banks");
    const badge = document.getElementById("closure-month-badge");
    const toolbar = document.getElementById("closure-bank-filter-toolbar");

    if (badge) badge.textContent = formatMonthString(state.currentMonth);

    if (!container) return;

    if (!state.banks || state.banks.length === 0) {
        container.innerHTML = "";
        if (toolbar) toolbar.style.display = "none";
        if (noBanks) noBanks.classList.remove("hidden");
        return;
    }

    if (toolbar) toolbar.style.display = "";
    if (noBanks) noBanks.classList.add("hidden");

    // Destruir gráficas anteriores
    Object.values(window._closureCharts).forEach(ch => { try { ch.destroy(); } catch(e){} });
    window._closureCharts = {};

    // Validar pestaña activa seleccionada
    if (selectedClosureBankTab !== 'global' && !state.banks.some(b => b.id === selectedClosureBankTab)) {
        selectedClosureBankTab = 'global';
    }

    // ── 1. Renderizar Barra Selectora de Cuentas (Chips desktop + Select móvil) ──
    const chipsContainer = document.getElementById("closure-bank-filter-chips");
    const selectEl = document.getElementById("closure-bank-filter-select");
    const feedbackEl = document.getElementById("closure-filter-feedback");

    if (chipsContainer) {
        chipsContainer.innerHTML = "";

        // Chip Global
        const chipGlobal = document.createElement("button");
        chipGlobal.type = "button";
        chipGlobal.className = `btn-filter-chip ${selectedClosureBankTab === 'global' ? 'active' : ''}`;
        chipGlobal.innerHTML = `<span>🌐 Vista Global</span> <span class="chip-count">${state.banks.length}</span>`;
        chipGlobal.title = `Vista consolidada de todas las cuentas (${state.banks.length})`;
        chipGlobal.addEventListener("click", () => {
            selectedClosureBankTab = 'global';
            renderClosureCharts();
        });
        chipsContainer.appendChild(chipGlobal);

        // Chip por cada banco
        state.banks.forEach(bank => {
            const chipBank = document.createElement("button");
            chipBank.type = "button";
            chipBank.className = `btn-filter-chip ${selectedClosureBankTab === bank.id ? 'active' : ''}`;
            chipBank.innerHTML = `<span>🏦 ${escapeHtml(bank.name)}</span>`;
            chipBank.title = `Ver cierre individual para ${bank.name}`;
            chipBank.addEventListener("click", () => {
                selectedClosureBankTab = bank.id;
                renderClosureCharts();
            });
            chipsContainer.appendChild(chipBank);
        });
    }

    if (selectEl) {
        selectEl.innerHTML = "";

        const optGlobal = document.createElement("option");
        optGlobal.value = "global";
        optGlobal.textContent = `🌐 Vista Global Consolidada (${state.banks.length} cuentas)`;
        if (selectedClosureBankTab === 'global') optGlobal.selected = true;
        selectEl.appendChild(optGlobal);

        state.banks.forEach(bank => {
            const opt = document.createElement("option");
            opt.value = bank.id;
            opt.textContent = `🏦 ${bank.name} (${formatCurrency(bank.balance)})`;
            if (selectedClosureBankTab === bank.id) opt.selected = true;
            selectEl.appendChild(opt);
        });

        if (!selectEl.dataset.listenerAttached) {
            selectEl.addEventListener("change", (e) => {
                selectedClosureBankTab = e.target.value;
                renderClosureCharts();
            });
            selectEl.dataset.listenerAttached = "true";
        }
    }

    if (feedbackEl) {
        if (selectedClosureBankTab === 'global') {
            feedbackEl.textContent = `Mostrando consolidado global de las ${state.banks.length} cuentas`;
        } else {
            const activeBank = state.banks.find(b => b.id === selectedClosureBankTab);
            feedbackEl.textContent = `Mostrando cuenta individual: ${activeBank ? activeBank.name : ''}`;
        }
    }

    container.innerHTML = "";

    // ── 2. Cálculos y Métricas por Banco y Consolidadas ──
    const [year, month] = state.currentMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthTransactions = state.transactions.filter(tx => tx.month === state.currentMonth);
    const today = new Date();
    const currentDay = (today.getFullYear() === year && today.getMonth() + 1 === month)
        ? today.getDate()
        : daysInMonth;

    const DONUT_PALETTE = [
        "rgba(0, 210, 255, 0.85)",
        "rgba(123, 97, 255, 0.85)",
        "rgba(255, 106, 0, 0.85)",
        "rgba(16, 213, 145, 0.85)",
        "rgba(255, 193, 7, 0.85)",
        "rgba(236, 72, 153, 0.85)",
        "rgba(59, 130, 246, 0.85)",
        "rgba(249, 115, 22, 0.85)",
        "rgba(139, 92, 246, 0.85)",
        "rgba(20, 184, 166, 0.85)",
    ];

    const balanceLabels = [];
    for (let d = 1; d <= daysInMonth; d++) balanceLabels.push(d);

    const bankDataMap = {};

    state.banks.forEach(bank => {
        const bankTxs = monthTransactions.filter(tx => tx.bankId === bank.id);
        const deltaByDay = {};
        for (let d = 1; d <= daysInMonth; d++) deltaByDay[d] = 0;

        bankTxs.forEach(tx => {
            const txDay = tx.date ? parseInt(tx.date.split("-")[2]) : null;
            if (!txDay) return;
            if (tx.type === "expense") {
                deltaByDay[txDay] -= tx.amount;
            } else if (tx.type === "income") {
                deltaByDay[txDay] += tx.amount;
            }
        });

        monthTransactions.forEach(tx => {
            if (tx.type === "income" && tx.distributions) {
                const dist = tx.distributions.find(d => d.bankId === bank.id);
                if (dist) {
                    const txDay = tx.date ? parseInt(tx.date.split("-")[2]) : null;
                    if (txDay) deltaByDay[txDay] += dist.amount;
                }
            }
        });

        const totalDeltaMonth = Object.values(deltaByDay).reduce((a, b) => a + b, 0);
        const initialBalance = parseFloat((bank.balance - totalDeltaMonth).toFixed(2));

        const balanceData = [];
        let runningBalance = initialBalance;
        for (let d = 1; d <= daysInMonth; d++) {
            runningBalance = parseFloat((runningBalance + deltaByDay[d]).toFixed(2));
            balanceData.push(d <= currentDay ? runningBalance : null);
        }

        const expenseTxs = bankTxs.filter(tx => tx.type === "expense" && tx.subtype !== "Traspaso");
        const expenseMap = {};
        expenseTxs.forEach(tx => {
            const key = tx.description || "Sin categoría";
            expenseMap[key] = (expenseMap[key] || 0) + tx.amount;
        });

        let expenseEntries = Object.entries(expenseMap).sort((a, b) => b[1] - a[1]);
        const MAX_CATEGORIES = 8;
        if (expenseEntries.length > MAX_CATEGORIES) {
            const topEntries = expenseEntries.slice(0, MAX_CATEGORIES - 1);
            const otrosSum = expenseEntries.slice(MAX_CATEGORIES - 1).reduce((s, [, v]) => s + v, 0);
            topEntries.push(["Otros", otrosSum]);
            expenseEntries = topEntries;
        }

        const donutLabels = expenseEntries.map(([k]) => k);
        const donutData = expenseEntries.map(([, v]) => parseFloat(v.toFixed(2)));
        const donutColors = donutLabels.map((_, i) => DONUT_PALETTE[i % DONUT_PALETTE.length]);
        const totalExpenses = donutData.reduce((a, b) => a + b, 0);

        let totalIncome = 0;
        bankTxs.forEach(tx => {
            if (tx.type === "income" && tx.subtype !== "Traspaso") totalIncome += tx.amount;
        });
        monthTransactions.forEach(tx => {
            if (tx.type === "income" && tx.subtype !== "Traspaso" && tx.distributions) {
                const dist = tx.distributions.find(d => d.bankId === bank.id);
                if (dist) totalIncome += dist.amount;
            }
        });

        const netBalance = totalIncome - totalExpenses;

        bankDataMap[bank.id] = {
            bank,
            initialBalance,
            currentBalance: bank.balance,
            balanceData,
            donutLabels,
            donutData,
            donutColors,
            totalIncome,
            totalExpenses,
            netBalance
        };
    });

    // ── Helper: Crear Gráfica de Línea de Saldo ──
    function renderLineChart(canvasId, labels, data, tooltipLabel) {
        const ctxLine = document.getElementById(canvasId);
        if (!ctxLine) return;
        const lineCtx = ctxLine.getContext("2d");
        const gradLine = lineCtx.createLinearGradient(0, 0, 0, 220);
        gradLine.addColorStop(0, "rgba(0, 210, 255, 0.30)");
        gradLine.addColorStop(1, "rgba(0, 210, 255, 0.00)");

        window._closureCharts[canvasId] = new Chart(lineCtx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Saldo (€)",
                    data: data,
                    borderColor: "rgba(0, 210, 255, 0.9)",
                    backgroundColor: gradLine,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "rgba(0, 210, 255, 1)",
                    fill: true,
                    tension: 0.35,
                    spanGaps: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 700, easing: "easeInOutQuart" },
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderColor: "rgba(0, 210, 255, 0.5)",
                        borderWidth: 1,
                        titleColor: "rgba(0, 210, 255, 0.9)",
                        bodyColor: "rgba(226, 232, 240, 1)",
                        titleFont: { family: "var(--font-header, 'Outfit', sans-serif)", size: 12, weight: "700" },
                        bodyFont: { family: "var(--font-header, 'Outfit', sans-serif)", size: 13, weight: "700" },
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: ctx => `📅 Día ${ctx[0].label} de ${formatMonthString(state.currentMonth)}`,
                            label: ctx => ctx.parsed.y !== null ? ` ${tooltipLabel}: ${formatCurrency(ctx.parsed.y)}` : ""
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: { color: "rgba(148,163,184,0.8)", font: { size: 10 }, maxTicksLimit: 10 }
                    },
                    y: {
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: { color: "rgba(148,163,184,0.8)", font: { size: 10 }, callback: v => formatCurrency(v) }
                    }
                }
            }
        });
    }

    // ── Helper: Crear Gráfica Donut de Gastos con Leyenda ──
    function renderDonutChart(canvasId, legendId, labels, data, colors, totalExp) {
        if (!data || data.length === 0) return;
        const ctxDonut = document.getElementById(canvasId);
        if (!ctxDonut) return;
        window._closureCharts[canvasId] = new Chart(ctxDonut.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: "rgba(15, 23, 42, 0.8)",
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 700, easing: "easeInOutQuart" },
                cutout: "62%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderColor: "rgba(123, 97, 255, 0.3)",
                        borderWidth: 1,
                        titleColor: "rgba(148, 163, 184, 1)",
                        bodyColor: "rgba(226, 232, 240, 1)",
                        padding: 10,
                        callbacks: {
                            label: ctx => {
                                const pct = totalExp > 0 ? ((ctx.parsed / totalExp) * 100).toFixed(1) : 0;
                                return ` ${formatCurrency(ctx.parsed)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        const legendEl = document.getElementById(legendId);
        if (legendEl) {
            legendEl.innerHTML = labels.map((label, i) => {
                const pct = totalExp > 0 ? ((data[i] / totalExp) * 100).toFixed(1) : 0;
                return `
                    <div class="closure-legend-item">
                        <span class="closure-legend-dot" style="background:${colors[i]};"></span>
                        <span class="closure-legend-label" title="${label}">${label}</span>
                        <span class="closure-legend-amount">${formatCurrency(data[i])}</span>
                        <span class="closure-legend-pct">${pct}%</span>
                    </div>
                `;
            }).join("");
        }
    }

    // ── 3. VISTA 1: CONSOLIDADO GLOBAL ──
    if (selectedClosureBankTab === 'global') {
        let globalInitial = 0;
        let globalCurrent = 0;
        let globalIncome = 0;
        let globalExpenses = 0;

        state.banks.forEach(b => {
            const d = bankDataMap[b.id];
            if (d) {
                globalInitial += d.initialBalance;
                globalCurrent += d.currentBalance;
                globalIncome += d.totalIncome;
                globalExpenses += d.totalExpenses;
            }
        });

        const globalNet = globalIncome - globalExpenses;
        const globalNetClass = globalNet >= 0 ? "closure-stat-positive" : "closure-stat-negative";
        const globalNetSign = globalNet >= 0 ? "+" : "";

        // Evolución consolidada del patrimonio líquido (suma diaria)
        const globalBalanceData = [];
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            if (dayIdx + 1 <= currentDay) {
                let daySum = 0;
                state.banks.forEach(b => {
                    const d = bankDataMap[b.id];
                    if (d && d.balanceData[dayIdx] !== null) {
                        daySum += d.balanceData[dayIdx];
                    }
                });
                globalBalanceData.push(parseFloat(daySum.toFixed(2)));
            } else {
                globalBalanceData.push(null);
            }
        }

        // Desglose global de gastos consolidado
        const globalExpenseMap = {};
        monthTransactions.forEach(tx => {
            if (tx.type === "expense" && tx.subtype !== "Traspaso") {
                const key = tx.description || "Sin categoría";
                globalExpenseMap[key] = (globalExpenseMap[key] || 0) + tx.amount;
            }
        });

        let globalExpenseEntries = Object.entries(globalExpenseMap).sort((a, b) => b[1] - a[1]);
        const MAX_CATEGORIES = 8;
        if (globalExpenseEntries.length > MAX_CATEGORIES) {
            const topEntries = globalExpenseEntries.slice(0, MAX_CATEGORIES - 1);
            const otrosSum = globalExpenseEntries.slice(MAX_CATEGORIES - 1).reduce((s, [, v]) => s + v, 0);
            topEntries.push(["Otros", otrosSum]);
            globalExpenseEntries = topEntries;
        }

        const globalDonutLabels = globalExpenseEntries.map(([k]) => k);
        const globalDonutData = globalExpenseEntries.map(([, v]) => parseFloat(v.toFixed(2)));
        const globalDonutColors = globalDonutLabels.map((_, i) => DONUT_PALETTE[i % DONUT_PALETTE.length]);
        const globalDonutTotal = globalDonutData.reduce((a, b) => a + b, 0);

        const card = document.createElement("div");
        card.className = "closure-bank-card shadow-glass";
        card.innerHTML = `
            <div class="closure-bank-card-header">
                <div class="closure-bank-title">
                    <div class="closure-bank-icon" style="background: linear-gradient(135deg, var(--primary), var(--secondary));">🌐</div>
                    <div>
                        <div class="closure-bank-name">Consolidado Global (Todas las Cuentas)</div>
                        <div class="closure-bank-month">${formatMonthString(state.currentMonth)} · ${state.banks.length} entidades bancarias</div>
                    </div>
                </div>
                <div class="closure-bank-stats">
                    <div class="closure-stat">
                        <span class="closure-stat-label">Ingresos Totales</span>
                        <span class="closure-stat-value closure-stat-positive">+${formatCurrency(globalIncome)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Gastos Totales</span>
                        <span class="closure-stat-value closure-stat-negative">-${formatCurrency(globalExpenses)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Neto Consolidado</span>
                        <span class="closure-stat-value ${globalNetClass}">${globalNetSign}${formatCurrency(globalNet)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Patrimonio Líquido</span>
                        <span class="closure-stat-value" style="color:var(--text-primary); font-weight: 800;">${formatCurrency(globalCurrent)}</span>
                    </div>
                </div>
            </div>
            <div class="closure-bank-charts">
                <div class="closure-chart-panel">
                    <div class="closure-chart-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        Evolución Patrimonio Líquido Global (€)
                    </div>
                    <div class="closure-chart-canvas-wrap">
                        <canvas id="closure-line-global"></canvas>
                    </div>
                </div>
                <div class="closure-chart-panel">
                    <div class="closure-chart-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
                        Desglose Global de Gastos
                    </div>
                    ${globalDonutData.length === 0
                        ? `<div class="closure-no-expenses">Sin gastos registrados este mes</div>`
                        : `<div class="closure-donut-layout">
                                <div class="closure-donut-canvas-wrap">
                                    <canvas id="closure-donut-global"></canvas>
                                </div>
                                <div class="closure-donut-legend" id="closure-legend-global"></div>
                           </div>`
                    }
                </div>
            </div>
            <div class="closure-global-table-container">
                <div class="closure-global-table-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                    <span>Resumen Comparativo por Cuenta Bancaria a Cierre de Mes</span>
                </div>
                <div style="overflow-x: auto;">
                    <table class="closure-global-table">
                        <thead>
                            <tr>
                                <th>Cuenta Bancaria</th>
                                <th class="text-right">Saldo Inicial</th>
                                <th class="text-right">Ingresos (+)</th>
                                <th class="text-right">Gastos (-)</th>
                                <th class="text-right">Neto Mes</th>
                                <th class="text-right">Saldo Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${state.banks.map(bank => {
                                const d = bankDataMap[bank.id];
                                const netCls = d.netBalance >= 0 ? "closure-stat-positive" : "closure-stat-negative";
                                const netSgn = d.netBalance >= 0 ? "+" : "";
                                return `
                                    <tr onclick="switchClosureBankTab('${bank.id}')" style="cursor: pointer;" title="Haz clic para ver el detalle de esta cuenta">
                                        <td style="font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--primary);"></span>
                                            <span>${escapeHtml(bank.name)}</span>
                                            <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 4px;">🔍 Ver detalle</span>
                                        </td>
                                        <td class="text-right">${formatCurrency(d.initialBalance)}</td>
                                        <td class="text-right closure-stat-positive">+${formatCurrency(d.totalIncome)}</td>
                                        <td class="text-right closure-stat-negative">-${formatCurrency(d.totalExpenses)}</td>
                                        <td class="text-right ${netCls}">${netSgn}${formatCurrency(d.netBalance)}</td>
                                        <td class="text-right" style="font-weight: 700; color: var(--text-primary);">${formatCurrency(d.currentBalance)}</td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>Total Consolidado</td>
                                <td class="text-right">${formatCurrency(globalInitial)}</td>
                                <td class="text-right closure-stat-positive">+${formatCurrency(globalIncome)}</td>
                                <td class="text-right closure-stat-negative">-${formatCurrency(globalExpenses)}</td>
                                <td class="text-right ${globalNetClass}">${globalNetSign}${formatCurrency(globalNet)}</td>
                                <td class="text-right" style="color:var(--primary); font-size: 0.92rem;">${formatCurrency(globalCurrent)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
        container.appendChild(card);

        renderLineChart("closure-line-global", balanceLabels, globalBalanceData, "💰 Patrimonio Líquido");
        renderDonutChart("closure-donut-global", "closure-legend-global", globalDonutLabels, globalDonutData, globalDonutColors, globalDonutTotal);

    } else {
        // ── 4. VISTA 2: CUENTA INDIVIDUAL SELECCIONADA ──
        const d = bankDataMap[selectedClosureBankTab] || Object.values(bankDataMap)[0];
        if (!d) return;

        const bank = d.bank;
        const netClass = d.netBalance >= 0 ? "closure-stat-positive" : "closure-stat-negative";
        const netSign = d.netBalance >= 0 ? "+" : "";

        const lineCanvasId = `closure-line-${bank.id}`;
        const donutCanvasId = `closure-donut-${bank.id}`;

        const card = document.createElement("div");
        card.className = "closure-bank-card shadow-glass";
        card.innerHTML = `
            <div class="closure-bank-card-header">
                <div class="closure-bank-title">
                    <div class="closure-bank-icon">${bank.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="closure-bank-name">${escapeHtml(bank.name)}</div>
                        <div class="closure-bank-month">${formatMonthString(state.currentMonth)}</div>
                    </div>
                </div>
                <div class="closure-bank-stats">
                    <div class="closure-stat">
                        <span class="closure-stat-label">Ingresos</span>
                        <span class="closure-stat-value closure-stat-positive">+${formatCurrency(d.totalIncome)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Gastos</span>
                        <span class="closure-stat-value closure-stat-negative">-${formatCurrency(d.totalExpenses)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Neto</span>
                        <span class="closure-stat-value ${netClass}">${netSign}${formatCurrency(d.netBalance)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Saldo Actual</span>
                        <span class="closure-stat-value" style="color:var(--text-primary); font-weight: 800;">${formatCurrency(d.currentBalance)}</span>
                    </div>
                </div>
            </div>
            <div class="closure-bank-charts">
                <div class="closure-chart-panel">
                    <div class="closure-chart-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        Evolución del Saldo (€)
                    </div>
                    <div class="closure-chart-canvas-wrap">
                        <canvas id="${lineCanvasId}"></canvas>
                    </div>
                </div>
                <div class="closure-chart-panel">
                    <div class="closure-chart-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
                        Desglose de Gastos
                    </div>
                    ${d.donutData.length === 0
                        ? `<div class="closure-no-expenses">Sin gastos registrados este mes</div>`
                        : `<div class="closure-donut-layout">
                                <div class="closure-donut-canvas-wrap">
                                    <canvas id="${donutCanvasId}"></canvas>
                                </div>
                                <div class="closure-donut-legend" id="closure-legend-${bank.id}"></div>
                           </div>`
                    }
                </div>
            </div>
        `;
        container.appendChild(card);

        renderLineChart(lineCanvasId, balanceLabels, d.balanceData, "💰 Saldo");
        renderDonutChart(donutCanvasId, `closure-legend-${bank.id}`, d.donutLabels, d.donutData, d.donutColors, d.totalExpenses);
    }
}


// MÓDULO 4: RENDERIZACIÓN DE PROYECTOS (LISTA GENERAL)
function renderProjectsList() {
    renderProjectFolderSelectOptions("project-folder-id");

    const foldersSection = document.getElementById("projects-folders-section");
    const foldersContainer = document.getElementById("project-folders-grid-container");
    const standaloneContainer = document.getElementById("projects-grid-container");
    const standaloneTitle = document.getElementById("projects-standalone-title");

    if (foldersContainer) foldersContainer.innerHTML = "";
    if (standaloneContainer) standaloneContainer.innerHTML = "";

    const folders = state.projectFolders || [];
    const allProjects = state.projects || [];
    const validFolderIds = new Set(folders.map(f => f.id));

    // Renderizar Sección de Carpetas
    if (folders.length > 0) {
        if (foldersSection) foldersSection.classList.remove("hidden");
        folders.forEach((folder, index) => {
            const subprojects = allProjects.filter(p => p.folderId === folder.id);

            let totalInvested = 0;
            let totalEarned = 0;
            subprojects.forEach(p => {
                (p.investments || []).forEach(i => totalInvested += i.amount);
                (p.earnings || []).forEach(e => totalEarned += e.amount);
            });

            const netProfit = totalEarned - totalInvested;
            const roi = totalInvested > 0 ? ((netProfit / totalInvested) * 100) : 0;

            const isFirstFolder = index === 0;
            const isLastFolder = index === folders.length - 1;

            const folderCard = document.createElement("div");
            folderCard.className = "project-folder-card";
            folderCard.setAttribute("onclick", `openProjectFolder('${folder.id}')`);
            folderCard.innerHTML = `
                <div class="project-folder-header">
                    <div class="project-folder-title-row">
                        <h3 title="${escapeHtml(folder.name)}"><span>📁</span> <span class="folder-name-text">${escapeHtml(folder.name)}</span></h3>
                        <div class="card-reorder-controls" onclick="event.stopPropagation()">
                            <button type="button" class="btn-card-move" onclick="event.stopPropagation(); moveFolderOrder('${folder.id}', -1)" ${isFirstFolder ? 'disabled' : ''} title="Mover antes">◀</button>
                            <button type="button" class="btn-card-move" onclick="event.stopPropagation(); moveFolderOrder('${folder.id}', 1)" ${isLastFolder ? 'disabled' : ''} title="Mover después">▶</button>
                            <span class="card-drag-handle" title="Arrastra para reordenar">⠿</span>
                        </div>
                    </div>
                    <div class="folder-badge-row">
                        <span class="folder-badge-count">${subprojects.length} ${subprojects.length === 1 ? 'subproyecto' : 'subproyectos'}</span>
                    </div>
                    <p title="${escapeHtml(folder.description || '')}">${escapeHtml(folder.description || '')}</p>
                </div>
                <div class="project-card-footer">
                    <div>
                        <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase;">Beneficio Consolidado</span>
                        <span class="project-badge-profit ${netProfit >= 0 ? 'plus' : 'minus'}">${netProfit >= 0 ? '+' : ''}${formatCurrency(netProfit)}</span>
                    </div>
                    <div>
                        <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase; text-align: right;">ROI Grupo</span>
                        <span class="project-badge-roi ${totalInvested === 0 ? 'zero' : (roi >= 0 ? 'plus' : 'minus')}">${totalInvested === 0 ? 'Sin Inversión' : roi.toFixed(1) + '%'}</span>
                    </div>
                </div>
            `;
            setupDraggableCard(folderCard, 'folder', folder.id);
            if (foldersContainer) foldersContainer.appendChild(folderCard);
        });
    } else {
        if (foldersSection) foldersSection.classList.add("hidden");
    }

    // Filtrar proyectos independientes (sin folderId o con folderId inexistente)
    const standaloneProjects = allProjects.filter(p => !p.folderId || !validFolderIds.has(p.folderId));

    if (standaloneTitle) {
        standaloneTitle.textContent = folders.length > 0 ? "🚀 Proyectos Independientes (Sin Carpeta)" : "🚀 Mis Proyectos";
    }

    if (allProjects.length === 0 && folders.length === 0) {
        if (standaloneContainer) {
            standaloneContainer.innerHTML = `<div class="alert-info" style="grid-column: 1 / -1;">No has creado ningún proyecto ni carpeta de simulación aún. Diseña uno con los botones superiores.</div>`;
        }
        return;
    }

    if (standaloneProjects.length === 0 && folders.length > 0) {
        if (standaloneContainer) {
            standaloneContainer.innerHTML = `<div class="alert-info" style="grid-column: 1 / -1; font-size: 0.8rem; padding: 12px 16px;">Todos tus proyectos están organizados dentro de carpetas.</div>`;
        }
        return;
    }

    standaloneProjects.forEach((proj, index) => {
        let totalInvested = 0;
        (proj.investments || []).forEach(i => totalInvested += i.amount);

        let totalEarned = 0;
        (proj.earnings || []).forEach(e => totalEarned += e.amount);

        const netProfit = totalEarned - totalInvested;
        const roi = totalInvested > 0 ? ((netProfit / totalInvested) * 100) : 0;

        let profitClass = "plus";
        if (netProfit < 0) profitClass = "minus";

        let roiClass = "plus";
        if (totalInvested === 0) roiClass = "zero";
        else if (roi < 0) roiClass = "minus";

        const isFirstProj = index === 0;
        const isLastProj = index === standaloneProjects.length - 1;

        const card = document.createElement("div");
        card.className = "project-item-card";
        card.setAttribute("onclick", `openProjectSandbox('${proj.id}')`);
        card.innerHTML = `
            <div class="project-card-header">
                <div class="project-card-top-row">
                    <h3 title="${escapeHtml(proj.name)}">${escapeHtml(proj.name)}</h3>
                    <div class="card-reorder-controls" onclick="event.stopPropagation()">
                        <button type="button" class="btn-card-move" onclick="event.stopPropagation(); moveStandaloneProjectOrder('${proj.id}', -1)" ${isFirstProj ? 'disabled' : ''} title="Mover antes">◀</button>
                        <button type="button" class="btn-card-move" onclick="event.stopPropagation(); moveStandaloneProjectOrder('${proj.id}', 1)" ${isLastProj ? 'disabled' : ''} title="Mover después">▶</button>
                        <span class="card-drag-handle" title="Arrastra para reordenar">⠿</span>
                    </div>
                </div>
                <p title="${escapeHtml(proj.description || '')}">${escapeHtml(proj.description || '')}</p>
            </div>
            <div class="project-card-footer">
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase;">Beneficio Neto</span>
                    <span class="project-badge-profit ${profitClass}">${netProfit >= 0 ? '+' : ''}${formatCurrency(netProfit)}</span>
                </div>
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase; text-align: right;">ROI</span>
                    <span class="project-badge-roi ${roiClass}">${totalInvested === 0 ? 'Sin Inversión' : (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%'}</span>
                </div>
            </div>
        `;
        setupDraggableCard(card, 'standalone', proj.id);
        if (standaloneContainer) standaloneContainer.appendChild(card);
    });
}

// MÓDULO 4: DETALLE DE PROYECTO (SANDBOX INDEPENDIENTE)
function renderProjectDetailView(projId) {
    const proj = state.projects.find(p => p.id === projId);
    if (!proj) return;

    document.getElementById("project-detail-title").textContent = proj.name;
    document.getElementById("project-detail-desc").textContent = proj.description;

    // Calcular estadísticas
    let totalInvested = 0;
    proj.investments.forEach(i => totalInvested += i.amount);

    let totalEarned = 0;
    proj.earnings.forEach(e => totalEarned += e.amount);

    const netProfit = totalEarned - totalInvested;
    const roi = totalInvested > 0 ? ((netProfit / totalInvested) * 100) : 0;

    // Rellenar widgets
    document.getElementById("proj-total-invested").textContent = formatCurrency(totalInvested);
    document.getElementById("proj-total-earned").textContent = formatCurrency(totalEarned);

    const netEl = document.getElementById("proj-net-profit");
    const netCard = document.getElementById("proj-card-net-profit");
    netEl.textContent = (netProfit >= 0 ? '+' : '') + formatCurrency(netProfit);
    if (netProfit >= 0) {
        netCard.className = "proj-stat-card card-net-profit plus";
    } else {
        netCard.className = "proj-stat-card card-net-profit minus";
    }

    const roiEl = document.getElementById("proj-roi");
    const roiCard = document.getElementById("proj-card-roi");
    if (totalInvested === 0) {
        roiEl.textContent = "Sin Inversión";
        roiCard.className = "proj-stat-card card-roi zero";
    } else {
        roiEl.textContent = (roi >= 0 ? '+' : '') + roi.toFixed(1) + "%";
        if (roi >= 0) {
            roiCard.className = "proj-stat-card card-roi plus";
        } else {
            roiCard.className = "proj-stat-card card-roi minus";
        }
    }

    // Inyectar Tabla Inversiones del Sandbox
    const tbodyInv = document.getElementById("tbody-proj-investments");
    tbodyInv.innerHTML = "";
    if (proj.investments.length === 0) {
        tbodyInv.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); font-size: 0.78rem;">No hay gastos de inversión.</td></tr>`;
    } else {
        // Ordenar inversiones de más nuevas a más viejas
        const sortedInv = [...proj.investments].sort((a,b) => new Date(b.date) - new Date(a.date));
        sortedInv.forEach(inv => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDate(inv.date)}</td>
                <td style="font-weight: 500;">${inv.description}</td>
                <td class="amount-col" style="color: var(--danger-light); font-weight:700;">-${formatCurrency(inv.amount)}</td>
                <td class="actions-col">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button onclick="openEditModal('projectInvestment', '${inv.id}', '${proj.id}')" class="btn-edit-mini-icon" title="Editar inversión">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="deleteProjectInvestment('${proj.id}', '${inv.id}')" class="btn-delete-mini-icon" title="Eliminar inversión">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </td>
            `;
            tbodyInv.appendChild(row);
        });
    }

    // Inyectar Tabla Ganancias del Sandbox
    const tbodyEar = document.getElementById("tbody-proj-earnings");
    tbodyEar.innerHTML = "";
    if (proj.earnings.length === 0) {
        tbodyEar.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); font-size: 0.78rem;">No hay ingresos simulados.</td></tr>`;
    } else {
        // Ordenar ganancias de más nuevas a más viejas
        const sortedEar = [...proj.earnings].sort((a,b) => new Date(b.date) - new Date(a.date));
        sortedEar.forEach(ear => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDate(ear.date)}</td>
                <td style="font-weight: 500;">${ear.description}</td>
                <td class="amount-col" style="color: var(--success-light); font-weight:700;">+${formatCurrency(ear.amount)}</td>
                <td class="actions-col">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button onclick="openEditModal('projectEarning', '${ear.id}', '${proj.id}')" class="btn-edit-mini-icon" title="Editar ganancia">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="deleteProjectEarning('${proj.id}', '${ear.id}')" class="btn-delete-mini-icon" title="Eliminar ganancia">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </td>
            `;
            tbodyEar.appendChild(row);
        });
    }
}

// ----------------------------------------------------
// 13. MÉTODOS DE FORMATEO AUXILIARES (UTILS)
// ----------------------------------------------------

function formatCurrency(value) {
    const currencyKey = state.currency || 'EUR';
    const config = CURRENCY_CONFIGS[currencyKey] || CURRENCY_CONFIGS.EUR;
    return new Intl.NumberFormat(config.locale, { style: 'currency', currency: config.code }).format(value);
}

function updateDOMCurrencySymbols() {
    const currencyKey = state.currency || 'EUR';
    const config = CURRENCY_CONFIGS[currencyKey] || CURRENCY_CONFIGS.EUR;
    const symbol = config.symbol;
    const name = config.name;

    // 1. Actualizar todas las etiquetas con clase .currency-label
    document.querySelectorAll(".currency-label").forEach(el => {
        if (!el.dataset.baseText) {
            el.dataset.baseText = el.textContent.replace(/\s*\([^)]*\)\s*$/, '');
        }
        el.textContent = `${el.dataset.baseText} (${symbol})`;
    });

    // 2. Actualizar los placeholders de los inputs
    const invInput = document.getElementById("proj-inv-amount");
    if (invInput) invInput.setAttribute("placeholder", `Importe (${symbol})`);
    
    const earInput = document.getElementById("proj-ear-amount");
    if (earInput) earInput.setAttribute("placeholder", `Importe (${symbol})`);

    // 3. Actualizar el texto del botón del embudo
    const btnModeEuro = document.getElementById("btn-mode-euro");
    if (btnModeEuro) {
        btnModeEuro.textContent = `${name} (${symbol})`;
    }
}

function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // Retorna DD/MM/YYYY
}

// ----------------------------------------------------
// 13B. SISTEMA DE EDICIÓN GLOBAL (MODAL EDIT)
// ----------------------------------------------------
let currentEditingItem = null;

function initEditModal() {
    const modal = document.getElementById("modal-edit");
    const form = document.getElementById("form-edit-global");
    const btnClose = document.getElementById("btn-close-modal");
    const btnCancel = document.getElementById("btn-cancel-edit");

    const closeModal = () => {
        modal.classList.add("hidden");
        currentEditingItem = null;
        form.reset();
    };

    btnClose.addEventListener("click", closeModal);
    btnCancel.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!currentEditingItem) return;

        const { type, id, extraId } = currentEditingItem;
        let updatedName = "";
        let success = false;

        if (type === "bank") {
            const bank = state.banks.find(b => b.id === id);
            if (bank) {
                const newName = document.getElementById("edit-bank-name").value.trim();
                const newBalance = parseFloat(document.getElementById("edit-bank-balance").value);
                if (newName && !isNaN(newBalance)) {
                    bank.name = newName;
                    bank.balance = newBalance;
                    
                    if (bank.bankType === "deposit") {
                        const newTae = parseFloat(document.getElementById("edit-bank-deposit-tae").value);
                        const newDuration = parseInt(document.getElementById("edit-bank-deposit-duration").value);
                        const newStart = document.getElementById("edit-bank-deposit-start-date").value;
                        const newTax = parseFloat(document.getElementById("edit-bank-deposit-tax-rate").value);
                        const newDest = document.getElementById("edit-bank-deposit-dest-bank").value;

                        if (!isNaN(newTae) && !isNaN(newDuration) && newDuration > 0 && newStart && newDest) {
                            bank.tae = newTae;
                            bank.durationMonths = newDuration;
                            bank.startDate = newStart;
                            bank.taxRate = isNaN(newTax) ? 19 : newTax;
                            bank.destinationBankId = newDest;
                        }
                    } else {
                        const purposeVal = document.getElementById("edit-bank-purpose-tags-container-value")?.value.trim() || "";
                        const minVal = document.getElementById("edit-bank-min")?.value;
                        const minBalance = (minVal !== undefined && minVal !== "") ? parseFloat(minVal) : null;
                        
                        bank.purpose = purposeVal;
                        bank.minBalance = isNaN(minBalance) ? null : minBalance;
                        bank.targetBalance = null;
                    }

                    // Actualizar valor estimado si es plan de pensiones o inversión
                    if (bank.bankType === "pension" || bank.bankType === "investment") {
                        const newEst = parseFloat(document.getElementById("edit-bank-estimated")?.value);
                        if (!isNaN(newEst) && newEst >= 0) {
                            bank.estimatedValue = newEst;
                        }
                    }
                    updatedName = newName;
                    success = true;
                }
            }
        } else if (type === "fixedExpense") {
            const fe = state.fixedExpenses.find(f => f.id === id);
            if (fe) {
                const newName = document.getElementById("edit-fe-name").value.trim();
                const newBankId = document.getElementById("edit-fe-bank").value;
                const newDestBankId = document.getElementById("edit-fe-dest-bank")?.value || null;
                const newAmount = parseFloat(document.getElementById("edit-fe-amount").value);
                const newDay = parseInt(document.getElementById("edit-fe-day").value);
                const newPeriodicity = document.getElementById("edit-fe-periodicity").value;
                const newChargeMonth = newPeriodicity !== "Mensual" ? document.getElementById("edit-fe-charge-month").value : null;

                if (newName && newBankId && !isNaN(newAmount) && newAmount > 0 && !isNaN(newDay) && newDay >= 1 && newDay <= 31) {
                    fe.name = newName;
                    fe.bankId = newBankId;
                    fe.destBankId = newDestBankId;
                    fe.amount = newAmount;
                    fe.day = newDay;
                    fe.periodicity = newPeriodicity;
                    fe.chargeMonth = newChargeMonth;
                    updatedName = newName;
                    success = true;
                }
            }
        } else if (type === "projectFolder") {
            const folder = (state.projectFolders || []).find(f => f.id === id);
            if (folder) {
                const newName = document.getElementById("edit-pfolder-name").value.trim();
                const newDesc = document.getElementById("edit-pfolder-desc").value.trim();
                if (newName && newDesc) {
                    folder.name = newName;
                    folder.description = newDesc;
                    updatedName = newName;
                    success = true;
                    if (currentActiveFolderId === id) {
                        renderProjectFolderView(id);
                    }
                }
            }
        } else if (type === "project") {
            const proj = state.projects.find(p => p.id === id);
            if (proj) {
                const newName = document.getElementById("edit-proj-name").value.trim();
                const newDesc = document.getElementById("edit-proj-desc").value.trim();
                const newFolderId = document.getElementById("edit-proj-folder")?.value || null;
                if (newName && newDesc) {
                    proj.name = newName;
                    proj.description = newDesc;
                    proj.folderId = newFolderId;
                    updatedName = newName;
                    success = true;
                    if (currentActiveProjectId === id) {
                        renderProjectDetailView(id);
                        const parentFolder = newFolderId ? (state.projectFolders || []).find(f => f.id === newFolderId) : null;
                        const backTextEl = document.getElementById("btn-back-to-projects-text");
                        if (backTextEl) {
                            backTextEl.textContent = parentFolder ? `Volver a Carpeta (${parentFolder.name})` : "Volver a Proyectos";
                        }
                    }
                    if (currentActiveFolderId) {
                        renderProjectFolderView(currentActiveFolderId);
                    }
                }
            }
        } else if (type === "projectInvestment") {
            const proj = state.projects.find(p => p.id === extraId);
            if (proj) {
                const inv = proj.investments.find(i => i.id === id);
                if (inv) {
                    const newDesc = document.getElementById("edit-pinv-desc").value.trim();
                    const newAmount = parseFloat(document.getElementById("edit-pinv-amount").value);
                    const newDate = document.getElementById("edit-pinv-date").value;
                    if (newDesc && !isNaN(newAmount) && newAmount > 0 && newDate) {
                        inv.description = newDesc;
                        inv.amount = newAmount;
                        inv.date = newDate;
                        updatedName = newDesc;
                        success = true;
                    }
                }
            }
        } else if (type === "projectEarning") {
            const proj = state.projects.find(p => p.id === extraId);
            if (proj) {
                const ear = proj.earnings.find(e => e.id === id);
                if (ear) {
                    const newDesc = document.getElementById("edit-pear-desc").value.trim();
                    const newAmount = parseFloat(document.getElementById("edit-pear-amount").value);
                    const newDate = document.getElementById("edit-pear-date").value;
                    if (newDesc && !isNaN(newAmount) && newAmount > 0 && newDate) {
                        ear.description = newDesc;
                        ear.amount = newAmount;
                        ear.date = newDate;
                        updatedName = newDesc;
                        success = true;
                    }
                }
            }
        }

        if (success) {
            showToast(`"${updatedName}" editado con éxito.`, "success");
            closeModal();
            saveState();
        } else {
            showToast("Error al guardar los cambios. Verifique los campos.", "danger");
        }
    });
}

// --- MODAL DE VALORACIONES ---
let currentValuationBankId = null;

function initValuationModal() {
    const modal = document.getElementById("modal-valuation");
    const form = document.getElementById("form-valuation-global");
    const btnCancel = document.getElementById("btn-cancel-val");
    const btnClose = document.getElementById("btn-close-val-modal");

    if (!modal || !form) return;

    function closeValModal() {
        modal.classList.add("hidden");
        form.reset();
        currentValuationBankId = null;
    }

    btnCancel.addEventListener("click", closeValModal);
    btnClose.addEventListener("click", closeValModal);

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const bankId = document.getElementById("val-bank-id").value;
        const date = document.getElementById("val-date").value;
        const balance = parseFloat(document.getElementById("val-balance").value);
        const estimated = parseFloat(document.getElementById("val-estimated").value);

        if (!bankId || !date || isNaN(balance) || isNaN(estimated)) {
            showToast("Complete los campos de valoración correctamente.", "danger");
            return;
        }

        const bank = state.banks.find(b => b.id === bankId);
        if (bank) {
            if (!bank.valuations) bank.valuations = [];
            
            // Si ya existe valoración para esta fecha, la reemplazamos
            const existingIndex = bank.valuations.findIndex(v => v.date === date);
            if (existingIndex !== -1) {
                bank.valuations[existingIndex] = { date, balance, estimatedValue: estimated };
            } else {
                bank.valuations.push({ date, balance, estimatedValue: estimated });
            }

            // Ordenar por fecha
            bank.valuations.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Actualizar la última valoración como la valoración real actual
            const latest = bank.valuations[bank.valuations.length - 1];
            bank.balance = latest.balance;
            bank.estimatedValue = latest.estimatedValue;

            showToast(`Valoración para "${bank.name}" registrada correctamente.`, "success");
            closeValModal();
            renderAll();
            saveState();
        }
    });
}

function openValuationModal(bankId) {
    const bank = state.banks.find(b => b.id === bankId);
    if (!bank) return;

    currentValuationBankId = bankId;
    document.getElementById("val-bank-id").value = bankId;
    document.getElementById("modal-val-title").textContent = `Valoración: ${bank.name}`;
    
    // Rellenar con la valoración actual
    document.getElementById("val-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("val-balance").value = bank.balance;
    document.getElementById("val-estimated").value = bank.estimatedValue ?? bank.balance;

    const modal = document.getElementById("modal-valuation");
    modal.classList.remove("hidden");
}

function generateSparklineSVG(valuations, bankId) {
    if (!Array.isArray(valuations) || valuations.length < 2) {
        // Línea base gris neutra
        return `
        <svg viewBox="0 0 100 20" width="100%" height="30" style="display:block; overflow:visible; margin-top: 10px; opacity: 0.5;">
            <line x1="0" y1="10" x2="100" y2="10" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" />
            <text x="50" y="14" fill="var(--text-muted)" font-size="4" text-anchor="middle" font-family="var(--font-primary)">Esperando histórico de valoraciones para graficar...</text>
        </svg>`;
    }
    return `
    <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 10px; margin-top: 12px; height: 165px; position: relative; width: 100%;">
        <canvas id="chart-investment-${bankId}" style="width: 100%; height: 100%;"></canvas>
    </div>`;
}

function openEditModal(type, id, extraId = null) {
    currentEditingItem = { type, id, extraId };
    const modal = document.getElementById("modal-edit");
    const titleEl = document.getElementById("modal-edit-title");
    const fieldsContainer = document.getElementById("modal-edit-fields");

    fieldsContainer.innerHTML = "";

    if (type === "bank") {
        const bank = state.banks.find(b => b.id === id);
        if (!bank) return;
        const isPension = bank.bankType === "pension" || bank.bankType === "investment";
        const isDeposit = bank.bankType === "deposit";
        titleEl.textContent = isPension ? "Editar Plan / Cartera de Inversiones" : (isDeposit ? "Editar Depósito a Plazo Fijo" : "Editar Cuenta Bancaria");
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="edit-bank-name">Nombre ${isPension ? "del Plan" : (isDeposit ? "del Depósito" : "del Banco")}</label>
                <input type="text" id="edit-bank-name" value="${bank.name}" required>
            </div>
            <div class="form-group">
                <label for="edit-bank-balance" class="currency-label">${isPension ? "Total Aportado (€)" : (isDeposit ? "Capital Depositado (€)" : "Saldo Real (€)")}</label>
                <input type="number" id="edit-bank-balance" step="0.01" value="${bank.balance}" required>
            </div>
            ${isDeposit ? `
            <div class="form-group">
                <label for="edit-bank-deposit-tae">Interés TAE (%)</label>
                <input type="number" id="edit-bank-deposit-tae" step="0.01" min="0" value="${bank.tae || 0}" required>
            </div>
            <div class="form-group">
                <label for="edit-bank-deposit-duration">Plazo (Meses)</label>
                <input type="number" id="edit-bank-deposit-duration" min="1" step="1" value="${bank.durationMonths || 12}" required>
            </div>
            <div class="form-group">
                <label for="edit-bank-deposit-start-date">Fecha de Contratación</label>
                <input type="date" id="edit-bank-deposit-start-date" value="${bank.startDate || getTodayString()}" required>
            </div>
            <div class="form-group">
                <label for="edit-bank-deposit-tax-rate">Retención Fiscal (%)</label>
                <input type="number" id="edit-bank-deposit-tax-rate" step="0.1" min="0" max="100" value="${bank.taxRate !== undefined && bank.taxRate !== null ? bank.taxRate : 19}" required>
            </div>
            <div class="form-group">
                <label for="edit-bank-deposit-dest-bank">Cuenta Destino al Vencimiento</label>
                <select id="edit-bank-deposit-dest-bank" required></select>
            </div>
            ` : `
            <div class="form-group">
                <label>Propósito / Uso de la Cuenta (Categorías)</label>
                <div id="edit-bank-purpose-tags-container"></div>
            </div>
            <div class="form-group">
                <label for="edit-bank-min" class="currency-label">Mínimo de Seguridad (€)</label>
                <input type="number" id="edit-bank-min" step="0.01" min="0" value="${bank.minBalance !== null && bank.minBalance !== undefined ? bank.minBalance : ''}" placeholder="Opcional (Ej. 500.00)">
            </div>
            `}
            ${isPension ? `
            <div class="form-group">
                <label for="edit-bank-estimated" class="currency-label">Valor Estimado con Interés (€)</label>
                <input type="number" id="edit-bank-estimated" step="0.01" min="0" value="${bank.estimatedValue ?? bank.balance}">
                <small style="color:var(--text-muted); font-size:0.72rem; margin-top:4px; display:block;">Introduce el valor actual del plan según tu entidad (incluye rentabilidad). No afecta al saldo aportado.</small>
            </div>` : ""}
        `;
        if (isDeposit) {
            renderDepositDestBanksOptions("edit-bank-deposit-dest-bank", bank.destinationBankId, bank.id);
        } else {
            initTagSelector("edit-bank-purpose-tags-container", bank.purpose ? bank.purpose.split(",") : []);
        }
    } else if (type === "fixedExpense") {
        const fe = state.fixedExpenses.find(f => f.id === id);
        if (!fe) return;
        titleEl.textContent = "Editar Gasto Fijo Matriz";
        const bankOptions = state.banks.filter(b => b.bankType !== "pension" && b.bankType !== "investment").map(b => `<option value="${b.id}" ${b.id === fe.bankId ? 'selected' : ''}>${b.name}</option>`).join('');
        const investments = state.banks.filter(b => b.bankType === "pension" || b.bankType === "investment");
        const destBankOptions = `<option value="">-- Ninguno (Gasto Ordinario) --</option>` + investments.map(b => `<option value="${b.id}" ${b.id === fe.destBankId ? 'selected' : ''}>${b.name}</option>`).join('');
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="edit-fe-name">Concepto</label>
                <input type="text" id="edit-fe-name" value="${fe.name}" required>
            </div>
            <div class="form-group">
                <label for="edit-fe-bank">Banco de Cargo Obligatorio</label>
                <select id="edit-fe-bank" required>${bankOptions}</select>
            </div>
            <div class="form-group">
                <label for="edit-fe-dest-bank">Destino de Inversión (Opcional)</label>
                <select id="edit-fe-dest-bank">${destBankOptions}</select>
            </div>
            <div class="form-group">
                <label for="edit-fe-amount" class="currency-label">Importe (€)</label>
                <input type="number" id="edit-fe-amount" step="0.01" min="0.01" value="${fe.amount}" required>
            </div>
            <div class="form-group">
                <label for="edit-fe-day">Día de Cobro (1-31)</label>
                <input type="number" id="edit-fe-day" min="1" max="31" value="${fe.day || 1}" required>
            </div>
            <div class="form-group">
                <label for="edit-fe-periodicity">Periodicidad</label>
                <select id="edit-fe-periodicity" required>
                    <option value="Mensual" ${fe.periodicity === 'Mensual' ? 'selected' : ''}>Mensual</option>
                    <option value="Trimestral" ${fe.periodicity === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
                    <option value="Semestral" ${fe.periodicity === 'Semestral' ? 'selected' : ''}>Semestral</option>
                    <option value="Anual" ${fe.periodicity === 'Anual' ? 'selected' : ''}>Anual</option>
                </select>
            </div>
            <div class="form-group ${fe.periodicity && fe.periodicity !== 'Mensual' ? '' : 'hidden'}" id="edit-fe-charge-month-group">
                <label for="edit-fe-charge-month">Mes de Cobro (Mes Referencia)</label>
                <select id="edit-fe-charge-month">
                    <option value="01" ${fe.chargeMonth === '01' ? 'selected' : ''}>Enero</option>
                    <option value="02" ${fe.chargeMonth === '02' ? 'selected' : ''}>Febrero</option>
                    <option value="03" ${fe.chargeMonth === '03' ? 'selected' : ''}>Marzo</option>
                    <option value="04" ${fe.chargeMonth === '04' ? 'selected' : ''}>Abril</option>
                    <option value="05" ${fe.chargeMonth === '05' ? 'selected' : ''}>Mayo</option>
                    <option value="06" ${fe.chargeMonth === '06' ? 'selected' : ''}>Junio</option>
                    <option value="07" ${fe.chargeMonth === '07' ? 'selected' : ''}>Julio</option>
                    <option value="08" ${fe.chargeMonth === '08' ? 'selected' : ''}>Agosto</option>
                    <option value="09" ${fe.chargeMonth === '09' ? 'selected' : ''}>Septiembre</option>
                    <option value="10" ${fe.chargeMonth === '10' ? 'selected' : ''}>Octubre</option>
                    <option value="11" ${fe.chargeMonth === '11' ? 'selected' : ''}>Noviembre</option>
                    <option value="12" ${fe.chargeMonth === '12' ? 'selected' : ''}>Diciembre</option>
                </select>
            </div>
        `;

        // Toggle reactivo para el mes de cobro dentro del modal
        const editPeriodicity = document.getElementById("edit-fe-periodicity");
        const editChargeMonthGroup = document.getElementById("edit-fe-charge-month-group");
        if (editPeriodicity && editChargeMonthGroup) {
            editPeriodicity.addEventListener("change", () => {
                if (editPeriodicity.value !== "Mensual") {
                    editChargeMonthGroup.classList.remove("hidden");
                } else {
                    editChargeMonthGroup.classList.add("hidden");
                }
            });
        }
    } else if (type === "projectFolder") {
        const folder = (state.projectFolders || []).find(f => f.id === id);
        if (!folder) return;
        titleEl.textContent = "Editar Carpeta / Grupo de Proyectos";
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="edit-pfolder-name">Nombre de la Carpeta</label>
                <input type="text" id="edit-pfolder-name" value="${folder.name}" required>
            </div>
            <div class="form-group">
                <label for="edit-pfolder-desc">Descripción / Notas del Grupo</label>
                <textarea id="edit-pfolder-desc" rows="5" placeholder="Escribe aquí la descripción, notas o detalles del grupo de proyectos..." required>${folder.description}</textarea>
            </div>
        `;
    } else if (type === "project") {
        const proj = state.projects.find(p => p.id === id);
        if (!proj) return;
        titleEl.textContent = "Editar Ficha de Proyecto";
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="edit-proj-name">Nombre del Proyecto</label>
                <input type="text" id="edit-proj-name" value="${proj.name}" required>
            </div>
            <div class="form-group">
                <label for="edit-proj-desc">Descripción / Objetivo</label>
                <input type="text" id="edit-proj-desc" value="${proj.description}" required>
            </div>
            <div class="form-group">
                <label for="edit-proj-folder">Carpeta / Grupo</label>
                <select id="edit-proj-folder"></select>
            </div>
        `;
        renderProjectFolderSelectOptions("edit-proj-folder", proj.folderId);
    } else if (type === "projectInvestment") {
        const proj = state.projects.find(p => p.id === extraId);
        if (!proj) return;
        const inv = proj.investments.find(i => i.id === id);
        if (!inv) return;
        titleEl.textContent = "Editar Gasto de Inversión";
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="edit-pinv-desc">Concepto de Inversión</label>
                <input type="text" id="edit-pinv-desc" value="${inv.description}" required>
            </div>
            <div class="form-group">
                <label for="edit-pinv-amount" class="currency-label">Importe (€)</label>
                <input type="number" id="edit-pinv-amount" step="0.01" min="0.01" value="${inv.amount}" required>
            </div>
            <div class="form-group">
                <label for="edit-pinv-date">Fecha de Inversión</label>
                <input type="date" id="edit-pinv-date" value="${inv.date || getTodayString()}" required>
            </div>
        `;
    } else if (type === "projectEarning") {
        const proj = state.projects.find(p => p.id === extraId);
        if (!proj) return;
        const ear = proj.earnings.find(e => e.id === id);
        if (!ear) return;
        titleEl.textContent = "Editar Ingreso / Ganancia";
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="edit-pear-desc">Concepto de Ganancia</label>
                <input type="text" id="edit-pear-desc" value="${ear.description}" required>
            </div>
            <div class="form-group">
                <label for="edit-pear-amount" class="currency-label">Importe (€)</label>
                <input type="number" id="edit-pear-amount" step="0.01" min="0.01" value="${ear.amount}" required>
            </div>
            <div class="form-group">
                <label for="edit-pear-date">Fecha de Ganancia</label>
                <input type="date" id="edit-pear-date" value="${ear.date || getTodayString()}" required>
            </div>
        `;
    }

    updateDOMCurrencySymbols();
    modal.classList.remove("hidden");
}

// ----------------------------------------------------
// 13C. MÓDULO DE RENDIMIENTO Y GRÁFICOS (ANALÍTICAS BI)
// ----------------------------------------------------
window.myMainEvolutionChart = null;
window.mySecondaryBreakdownChart = null;
let currentPerfSelectedBankId = "all";
let currentPerfTimeRange = 6; // 3, 6, 12 meses
window.currentSecondaryChartMode = "flow"; // "flow" (Ingresos vs Gastos) o "distribution" (Bancos)

window.setPerformanceTimeRange = function(range) {
    currentPerfTimeRange = parseInt(range, 10);
    renderPerformanceModule();
};

function initPerformanceTab() {
    // 1. Selector de Rango Temporal (3M · 6M · 12M)
    const rangeGroup = document.getElementById("perf-timerange-chips");
    if (rangeGroup && !rangeGroup.dataset.listenerAttached) {
        rangeGroup.addEventListener("click", (e) => {
            const btn = e.target.closest(".btn-filter-chip");
            if (!btn || !btn.dataset.range) return;
            currentPerfTimeRange = parseInt(btn.dataset.range, 10);
            rangeGroup.querySelectorAll(".btn-filter-chip").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderPerformanceModule();
        });
        rangeGroup.dataset.listenerAttached = "true";
    }

    // 2. Control segmentado de la gráfica secundaria (Flujo Mensual vs Reparto Capital)
    document.addEventListener("click", (e) => {
        const btnFlow = e.target.closest("#btn-perf-show-flow") || e.target.closest("#btn-perf-show-expenses");
        const btnDist = e.target.closest("#btn-perf-show-distribution");

        if (btnFlow) {
            const bFlow = document.getElementById("btn-perf-show-flow") || document.getElementById("btn-perf-show-expenses");
            const bDist = document.getElementById("btn-perf-show-distribution");
            if (bFlow) bFlow.classList.add("active");
            if (bDist) bDist.classList.remove("active");
            window.currentSecondaryChartMode = "flow";
            renderSecondaryBreakdownChart();
        }

        if (btnDist) {
            const bFlow = document.getElementById("btn-perf-show-flow") || document.getElementById("btn-perf-show-expenses");
            const bDist = document.getElementById("btn-perf-show-distribution");
            if (bFlow) bFlow.classList.remove("active");
            if (bDist) bDist.classList.add("active");
            window.currentSecondaryChartMode = "distribution";
            renderSecondaryBreakdownChart();
        }
    });
}

function renderPerformanceSelectorOptions() {
    const chipsContainer = document.getElementById("perf-bank-filter-chips");
    const selectEl = document.getElementById("perf-bank-filter-select") || document.getElementById("perf-bank-selector");
    const feedbackEl = document.getElementById("perf-filter-feedback");
    const rangeGroup = document.getElementById("perf-timerange-chips");

    // Sincronizar botones de rango temporal
    if (rangeGroup) {
        rangeGroup.querySelectorAll(".btn-filter-chip").forEach(btn => {
            if (parseInt(btn.dataset.range, 10) === currentPerfTimeRange) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    // Validar selección de banco
    if (currentPerfSelectedBankId !== "all" && !state.banks.some(b => b.id === currentPerfSelectedBankId)) {
        currentPerfSelectedBankId = "all";
    }

    // Renderizar chips de escritorio
    if (chipsContainer) {
        chipsContainer.innerHTML = "";

        const chipAll = document.createElement("button");
        chipAll.type = "button";
        chipAll.className = `btn-filter-chip ${currentPerfSelectedBankId === 'all' ? 'active' : ''}`;
        chipAll.innerHTML = `<span>🌐 Consolidado</span> <span class="chip-count">${state.banks.length}</span>`;
        chipAll.title = `Consolidado de todas las cuentas (${state.banks.length})`;
        chipAll.addEventListener("click", () => {
            currentPerfSelectedBankId = "all";
            renderPerformanceModule();
        });
        chipsContainer.appendChild(chipAll);

        state.banks.forEach(bank => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `btn-filter-chip ${currentPerfSelectedBankId === bank.id ? 'active' : ''}`;
            chip.innerHTML = `<span>🏦 ${escapeHtml(bank.name)}</span>`;
            chip.title = `Analizar únicamente ${bank.name}`;
            chip.addEventListener("click", () => {
                currentPerfSelectedBankId = bank.id;
                renderPerformanceModule();
            });
            chipsContainer.appendChild(chip);
        });
    }

    // Renderizar select móvil
    if (selectEl) {
        selectEl.innerHTML = "";

        const optAll = document.createElement("option");
        optAll.value = "all";
        optAll.textContent = `🌐 Consolidado (${state.banks.length} cuentas)`;
        if (currentPerfSelectedBankId === "all") optAll.selected = true;
        selectEl.appendChild(optAll);

        state.banks.forEach(bank => {
            const opt = document.createElement("option");
            opt.value = bank.id;
            opt.textContent = `🏦 ${bank.name} (${formatCurrency(bank.balance)})`;
            if (currentPerfSelectedBankId === bank.id) opt.selected = true;
            selectEl.appendChild(opt);
        });

        if (!selectEl.dataset.listenerAttached) {
            selectEl.addEventListener("change", (e) => {
                currentPerfSelectedBankId = e.target.value;
                renderPerformanceModule();
            });
            selectEl.dataset.listenerAttached = "true";
        }
    }

    // Feedback visual
    if (feedbackEl) {
        if (currentPerfSelectedBankId === "all") {
            feedbackEl.textContent = `Analizando consolidado global (${state.banks.length} cuentas) · Últimos ${currentPerfTimeRange} meses`;
        } else {
            const activeBank = state.banks.find(b => b.id === currentPerfSelectedBankId);
            feedbackEl.textContent = `Analizando cuenta: ${activeBank ? activeBank.name : ''} · Últimos ${currentPerfTimeRange} meses`;
        }
    }
}

function getMonthsPeriodList(endMonthStr, count = 6) {
    const list = [endMonthStr];
    let current = endMonthStr;
    for (let i = 0; i < count - 1; i++) {
        current = getPreviousMonthString(current);
        list.unshift(current);
    }
    return list;
}

function getLast6MonthsList(endMonthStr) {
    return getMonthsPeriodList(endMonthStr, currentPerfTimeRange || 6);
}

function getHistoricalBalancesForBank(bankId, monthsList) {
    const balances = {};
    const bank = state.banks.find(b => b.id === bankId);
    if (!bank) return monthsList.map(() => 0);

    const n = monthsList.length;
    let currentBal = bank.balance;
    balances[monthsList[n - 1]] = currentBal;

    for (let i = n - 2; i >= 0; i--) {
        const targetMonth = monthsList[i];
        const nextMonth = monthsList[i + 1];

        const nextMonthTxs = state.transactions.filter(tx => tx.month === nextMonth);

        let nextMonthIncomes = 0;
        let nextMonthExpenses = 0;

        nextMonthTxs.forEach(tx => {
            if (tx.type === "income") {
                if (tx.distributions) {
                    const dist = tx.distributions.find(d => d.bankId === bankId);
                    if (dist) nextMonthIncomes += dist.amount;
                } else if (tx.bankId === bankId) {
                    nextMonthIncomes += tx.amount;
                }
            } else if (tx.type === "expense" && tx.bankId === bankId) {
                nextMonthExpenses += tx.amount;
            }
        });

        currentBal = parseFloat((currentBal - nextMonthIncomes + nextMonthExpenses).toFixed(2));
        balances[targetMonth] = currentBal;
    }

    return monthsList.map(m => balances[m]);
}

function getConsolidatedHistoricalBalances(monthsList) {
    const totals = monthsList.map(() => 0);
    state.banks.forEach(bank => {
        const history = getHistoricalBalancesForBank(bank.id, monthsList);
        for (let i = 0; i < monthsList.length; i++) {
            totals[i] = parseFloat((totals[i] + history[i]).toFixed(2));
        }
    });
    return totals;
}

function renderPerformanceModule() {
    renderPerformanceSelectorOptions();

    const bankId = currentPerfSelectedBankId;
    const monthsList = getMonthsPeriodList(state.currentMonth, currentPerfTimeRange);
    const monthsLabels = monthsList.map(formatMonthString);

    let balancesData = [];
    let selectedBankName = "";

    if (bankId === "all") {
        balancesData = getConsolidatedHistoricalBalances(monthsList);
        selectedBankName = "Consolidado";
    } else {
        balancesData = getHistoricalBalancesForBank(bankId, monthsList);
        const bank = state.banks.find(b => b.id === bankId);
        selectedBankName = bank ? bank.name : "Banco";
    }

    // ── Cálculos Financieros Consistentes sobre todo el Periodo ──
    let totalPeriodIncome = 0;
    let totalPeriodExpenses = 0;
    window._perfMonthlyFlow = {};

    monthsList.forEach(m => {
        window._perfMonthlyFlow[m] = { income: 0, expenses: 0 };
        const txs = state.transactions.filter(tx => tx.month === m);
        txs.forEach(tx => {
            if (tx.subtype === "Traspaso") return;
            if (tx.type === "income") {
                if (bankId === "all") {
                    window._perfMonthlyFlow[m].income += tx.amount;
                } else {
                    if (tx.distributions) {
                        const d = tx.distributions.find(dist => dist.bankId === bankId);
                        if (d) window._perfMonthlyFlow[m].income += d.amount;
                    } else if (tx.bankId === bankId) {
                        window._perfMonthlyFlow[m].income += tx.amount;
                    }
                }
            } else if (tx.type === "expense") {
                if (bankId === "all" || tx.bankId === bankId) {
                    window._perfMonthlyFlow[m].expenses += tx.amount;
                }
            }
        });
        totalPeriodIncome += window._perfMonthlyFlow[m].income;
        totalPeriodExpenses += window._perfMonthlyFlow[m].expenses;
    });

    const totalNetSavingsPeriod = totalPeriodIncome - totalPeriodExpenses;
    const avgMonthlySavings = parseFloat((totalNetSavingsPeriod / monthsList.length).toFixed(2));
    const avgMonthlyExpenses = parseFloat((totalPeriodExpenses / monthsList.length).toFixed(2));
    const avgMonthlyIncome = parseFloat((totalPeriodIncome / monthsList.length).toFixed(2));

    const oldestBalance = balancesData[0];
    const latestBalance = balancesData[balancesData.length - 1];
    const netGrowth = parseFloat((latestBalance - oldestBalance).toFixed(2));

    // Ratio de Gasto / Ingreso en el periodo
    let expenseRatio = 0;
    if (totalPeriodIncome > 0) {
        expenseRatio = parseFloat(((totalPeriodExpenses / totalPeriodIncome) * 100).toFixed(1));
    } else {
        expenseRatio = totalPeriodExpenses > 0 ? 100 : 0;
    }

    // Tasa Media de Ahorro en el periodo
    let savingsRate = 0;
    if (totalPeriodIncome > 0) {
        savingsRate = parseFloat(((totalNetSavingsPeriod / totalPeriodIncome) * 100).toFixed(1));
    } else {
        savingsRate = totalPeriodExpenses > 0 ? -100 : 0;
    }

    // Meses de Colchón (Runway de Fondo de Emergencia)
    let runwayMonths = 0;
    if (avgMonthlyExpenses > 0) {
        runwayMonths = parseFloat((latestBalance / avgMonthlyExpenses).toFixed(1));
    } else {
        runwayMonths = latestBalance > 0 ? 99 : 0;
    }

    // ── Actualizar las 5 Tarjetas de Indicadores ──
    const titleSavingsEl = document.getElementById("perf-metric-title-savings");
    if (titleSavingsEl) titleSavingsEl.textContent = `Ahorro Promedio (${currentPerfTimeRange}m)`;

    const avgSavingsEl = document.getElementById("perf-metric-avg-savings");
    if (avgSavingsEl) {
        avgSavingsEl.textContent = `${formatCurrency(avgMonthlySavings)} / mes`;
        avgSavingsEl.className = avgMonthlySavings >= 0 ? "metric-value plus" : "metric-value minus";
    }

    const titleGrowthEl = document.getElementById("perf-metric-title-growth");
    if (titleGrowthEl) titleGrowthEl.textContent = `Crecimiento Neto (${currentPerfTimeRange}m)`;

    const netGrowthEl = document.getElementById("perf-metric-net-growth");
    if (netGrowthEl) {
        netGrowthEl.textContent = (netGrowth >= 0 ? '+' : '') + formatCurrency(netGrowth);
        netGrowthEl.className = netGrowth >= 0 ? "metric-value plus" : "metric-value minus";
    }

    const titleRatioEl = document.getElementById("perf-metric-title-ratio");
    if (titleRatioEl) titleRatioEl.textContent = `Ratio Gasto/Ingreso (${currentPerfTimeRange}m)`;

    const expenseRatioEl = document.getElementById("perf-metric-expense-ratio");
    if (expenseRatioEl) {
        expenseRatioEl.textContent = expenseRatio + "%";
        if (expenseRatio < 60) {
            expenseRatioEl.className = "metric-value plus";
        } else if (expenseRatio < 80) {
            expenseRatioEl.className = "metric-value";
        } else {
            expenseRatioEl.className = "metric-value minus";
        }
    }

    const titleSaveRateEl = document.getElementById("perf-metric-title-saverate");
    if (titleSaveRateEl) titleSaveRateEl.textContent = `Tasa Media Ahorro (${currentPerfTimeRange}m)`;

    const savingsRateEl = document.getElementById("perf-metric-savings-rate");
    if (savingsRateEl) {
        savingsRateEl.textContent = savingsRate + "%";
        if (savingsRate >= 20) {
            savingsRateEl.className = "metric-value plus";
        } else if (savingsRate >= 0) {
            savingsRateEl.className = "metric-value";
        } else {
            savingsRateEl.className = "metric-value minus";
        }
    }

    const runwayEl = document.getElementById("perf-metric-runway");
    if (runwayEl) {
        runwayEl.textContent = `${runwayMonths} meses`;
        runwayEl.title = `Gasto medio: ${formatCurrency(avgMonthlyExpenses)}/mes · Previsión a 90d: ${formatCurrency(latestBalance + (avgMonthlySavings * 3))}`;
        if (runwayMonths >= 6) {
            runwayEl.className = "metric-value plus";
        } else if (runwayMonths >= 3) {
            runwayEl.className = "metric-value";
        } else {
            runwayEl.className = "metric-value minus";
        }
    }

    // ── Renderizar Asistente Financiero Inteligente ──
    renderFinancialInsights(avgMonthlySavings, netGrowth, expenseRatio, savingsRate, avgMonthlyIncome, avgMonthlyExpenses, latestBalance, runwayMonths);

    // ── GRÁFICO 1: EVOLUCIÓN MENSUAL (LÍNEA GRADIENTE) ──
    const mainChartTitleEl = document.getElementById("perf-chart-title");
    if (mainChartTitleEl) {
        mainChartTitleEl.textContent = `Histórico de Saldos (${currentPerfTimeRange}m): ${selectedBankName}`;
    }

    if (window.myMainEvolutionChart) {
        window.myMainEvolutionChart.destroy();
    }

    const canvasMain = document.getElementById('chart-main-evolution');
    if (canvasMain) {
        const ctxMain = canvasMain.getContext('2d');
        const gradientFill = ctxMain.createLinearGradient(0, 0, 0, 300);
        gradientFill.addColorStop(0, 'rgba(0, 210, 255, 0.35)');
        gradientFill.addColorStop(1, 'rgba(0, 210, 255, 0.00)');

        window.myMainEvolutionChart = new Chart(ctxMain, {
            type: 'line',
            data: {
                labels: monthsLabels,
                datasets: [{
                    label: 'Saldo',
                    data: balancesData,
                    borderColor: '#00d2ff',
                    borderWidth: 3,
                    backgroundColor: gradientFill,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#00d2ff',
                    pointBorderColor: 'rgba(255,255,255,0.8)',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#ff7300'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
                        bodyFont: { family: 'Inter', size: 12 },
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return ' Saldo: ' + formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { family: 'Inter', size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: { family: 'Inter', size: 11 },
                            callback: function(value) {
                                return formatCurrency(value).replace(',00', '');
                            }
                        }
                    }
                }
            }
        });
    }

    // ── GRÁFICO 2: FLUJO MENSUAL (INGRESOS VS GASTOS) O REPARTO CAPITAL ──
    renderSecondaryBreakdownChart();
}

function renderSecondaryBreakdownChart() {
    const canvasSec = document.getElementById('chart-secondary-breakdown');
    if (!canvasSec) return;

    const ctxSec = canvasSec.getContext('2d');

    if (window.mySecondaryBreakdownChart) {
        window.mySecondaryBreakdownChart.destroy();
    }

    const breakdownTitleEl = document.getElementById("perf-breakdown-title");
    const monthsList = getMonthsPeriodList(state.currentMonth, currentPerfTimeRange);
    const monthsLabels = monthsList.map(formatMonthString);

    if (window.currentSecondaryChartMode === "flow") {
        // MODO "FLOW": Barras de Ingresos vs Gastos mes a mes
        if (breakdownTitleEl) {
            breakdownTitleEl.textContent = `Flujo Mensual: Ingresos vs Gastos (${currentPerfTimeRange}m)`;
        }

        const flow = window._perfMonthlyFlow || {};
        const incomeData = monthsList.map(m => (flow[m] ? parseFloat(flow[m].income.toFixed(2)) : 0));
        const expenseData = monthsList.map(m => (flow[m] ? parseFloat(flow[m].expenses.toFixed(2)) : 0));

        window.mySecondaryBreakdownChart = new Chart(ctxSec, {
            type: 'bar',
            data: {
                labels: monthsLabels,
                datasets: [
                    {
                        label: 'Ingresos (€)',
                        data: incomeData,
                        backgroundColor: 'rgba(16, 213, 145, 0.85)',
                        borderColor: 'rgba(16, 213, 145, 1)',
                        borderWidth: 1,
                        borderRadius: 6,
                        maxBarThickness: 32
                    },
                    {
                        label: 'Gastos (€)',
                        data: expenseData,
                        backgroundColor: 'rgba(255, 99, 132, 0.85)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                        borderRadius: 6,
                        maxBarThickness: 32
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: { family: 'Outfit', size: 11, weight: '600' },
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { family: 'Outfit', size: 12, weight: 'bold' },
                        bodyFont: { family: 'Inter', size: 11 },
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                            },
                            footer: function(tooltipItems) {
                                let inc = 0, exp = 0;
                                tooltipItems.forEach(item => {
                                    if (item.datasetIndex === 0) inc = item.parsed.y;
                                    if (item.datasetIndex === 1) exp = item.parsed.y;
                                });
                                const net = inc - exp;
                                const sign = net >= 0 ? '+' : '';
                                return `💰 Ahorro Neto: ${sign}${formatCurrency(net)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { family: 'Inter', size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: { family: 'Inter', size: 10 },
                            callback: v => formatCurrency(v).replace(',00', '')
                        }
                    }
                }
            }
        });

    } else {
        // MODO "DISTRIBUTION": Distribución de saldos por entidad bancaria
        if (breakdownTitleEl) {
            breakdownTitleEl.textContent = `Distribución de Saldos por Entidad`;
        }

        const activeBanks = state.banks.filter(b => {
            const val = (b.bankType === "pension" || b.bankType === "investment") ? (b.estimatedValue ?? b.balance) : b.balance;
            return val > 0;
        });
        const labels = activeBanks.map(b => b.name);
        const values = activeBanks.map(b => (b.bankType === "pension" || b.bankType === "investment") ? (b.estimatedValue ?? b.balance) : b.balance);

        if (values.length === 0) {
            window.mySecondaryBreakdownChart = new Chart(ctxSec, {
                type: 'doughnut',
                data: {
                    labels: ["Sin Saldo Registrado"],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['rgba(255, 255, 255, 0.07)'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: 'rgba(255, 255, 255, 0.4)', font: { family: 'Inter', size: 11 } } },
                        tooltip: { enabled: false }
                    }
                }
            });
        } else {
            window.mySecondaryBreakdownChart = new Chart(ctxSec, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: [
                            '#00d2ff', '#ff7300', '#10b981', '#7b61ff', '#ec4899', '#f59e0b', '#3b82f6', '#14b8a6'
                        ],
                        borderWidth: 2,
                        borderColor: 'rgba(15, 23, 42, 0.8)',
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.8)',
                                font: { family: 'Outfit', size: 11, weight: '600' },
                                boxWidth: 10
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleFont: { family: 'Outfit', size: 12, weight: 'bold' },
                            bodyFont: { family: 'Inter', size: 12 },
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                    return ` ${context.label}: ${formatCurrency(context.parsed)} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
}

function renderFinancialInsights(avgSavings, netGrowth, expenseRatio, savingsRate, avgIncome, avgExpenses, latestBalance, runwayMonths) {
    const container = document.getElementById("perf-insights-container");
    if (!container) return;

    container.innerHTML = "";

    // 1. Tasa de Ahorro Media del Periodo
    const cardSavings = document.createElement("div");
    if (savingsRate >= 25) {
        cardSavings.className = "insight-card success";
        cardSavings.innerHTML = `
            <div class="insight-icon success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div class="insight-content">
                <h4>¡Tasa de Ahorro Sobresaliente! (${savingsRate}%)</h4>
                <p>Estás reteniendo más de una cuarta parte de tus ingresos de forma consistente durante estos ${currentPerfTimeRange} meses. Tu ritmo de capitalización es óptimo para nutrir inversiones y acelerar objetivos financieros.</p>
            </div>
        `;
    } else if (savingsRate >= 10) {
        cardSavings.className = "insight-card info";
        cardSavings.innerHTML = `
            <div class="insight-icon info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            <div class="insight-content">
                <h4>Ahorro Positivo y Saludable (${savingsRate}%)</h4>
                <p>Tu flujo de ahorro medio es positivo (+${formatCurrency(avgSavings)}/mes). Si buscas alcanzar la regla 50/30/20 (20% de ahorro), puedes revisar si hay un 5% de gastos variables prescindibles.</p>
            </div>
        `;
    } else if (savingsRate >= 0) {
        cardSavings.className = "insight-card tip";
        cardSavings.innerHTML = `
            <div class="insight-icon tip">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <div class="insight-content">
                <h4>Margen de Ahorro Ajustado (${savingsRate}%)</h4>
                <p>Estás prácticamente en equilibrio operativo. Cualquier gasto extraordinario podría desestabilizar tu patrimonio. Te recomendamos auditar recibos fijos recurrentes para abrir mayor margen.</p>
            </div>
        `;
    } else {
        cardSavings.className = "insight-card warning";
        cardSavings.innerHTML = `
            <div class="insight-icon warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div class="insight-content">
                <h4>⚠️ Déficit Operativo en el Periodo (${savingsRate}%)</h4>
                <p>En los últimos ${currentPerfTimeRange} meses tus gastos han superado a los ingresos por una media de ${formatCurrency(Math.abs(avgSavings))}/mes. Es prioritario detener la erosión de capital revisando compras variables.</p>
            </div>
        `;
    }
    container.appendChild(cardSavings);

    // 2. Fondo de Emergencia y Runway (Meses de Colchón)
    const cardRunway = document.createElement("div");
    if (runwayMonths >= 6) {
        cardRunway.className = "insight-card success";
        cardRunway.innerHTML = `
            <div class="insight-icon success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div class="insight-content">
                <h4>Fondo de Emergencia Muy Robusto (${runwayMonths} meses)</h4>
                <p>Tu saldo actual te confiere ${runwayMonths} meses de supervivencia financiera completa cubriendo tu gasto mensual medio (${formatCurrency(avgExpenses)}/mes). Tienes una gran tranquilidad ante imprevistos.</p>
            </div>
        `;
    } else if (runwayMonths >= 3) {
        cardRunway.className = "insight-card info";
        cardRunway.innerHTML = `
            <div class="insight-icon info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div class="insight-content">
                <h4>Colchón Financiero Aceptable (${runwayMonths} meses)</h4>
                <p>Tu reserva cubre ${runwayMonths} meses de tus gastos medios habituales. La recomendación de los expertos es alcanzar entre 3 y 6 meses antes de destinar excedentes a inversiones de mayor riesgo.</p>
            </div>
        `;
    } else {
        cardRunway.className = "insight-card warning";
        cardRunway.innerHTML = `
            <div class="insight-icon warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <div class="insight-content">
                <h4>Colchón Reducido (${runwayMonths} meses de cobertura)</h4>
                <p>Tu liquidez disponible cubre menos de un trimestre de tu ritmo de vida habitual (${formatCurrency(avgExpenses)}/mes). Construir tu fondo de emergencia debe ser la máxima prioridad financiera ahora mismo.</p>
            </div>
        `;
    }
    container.appendChild(cardRunway);

    // 3. Proyección Patrimonial a 90 Días
    const cardForecast = document.createElement("div");
    const forecast90d = parseFloat((latestBalance + (avgSavings * 3)).toFixed(2));
    if (avgSavings > 0) {
        cardForecast.className = "insight-card success";
        cardForecast.innerHTML = `
            <div class="insight-icon success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            </div>
            <div class="insight-content">
                <h4>Proyección Favorable a 90 Días</h4>
                <p>Manteniendo el ritmo medio de ahorro de estos ${currentPerfTimeRange} meses (+${formatCurrency(avgSavings)}/mes), tu saldo estimado en 3 meses alcanzará los <strong>${formatCurrency(forecast90d)}</strong>. ¡Trayectoria de crecimiento sólida!</p>
            </div>
        `;
    } else if (avgSavings < 0) {
        cardForecast.className = "insight-card warning";
        cardForecast.innerHTML = `
            <div class="insight-icon warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
            </div>
            <div class="insight-content">
                <h4>Proyección en Riesgo a 90 Días</h4>
                <p>Si se prolonga el desvío medio actual (${formatCurrency(avgSavings)}/mes), tu capital podría descender a <strong>${formatCurrency(forecast90d)}</strong> en 90 días. Reajustar el ritmo de gasto evitará comprometer reservas.</p>
            </div>
        `;
    } else {
        cardForecast.className = "insight-card info";
        cardForecast.innerHTML = `
            <div class="insight-icon info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            <div class="insight-content">
                <h4>Trayectoria Neutra a 90 Días</h4>
                <p>Con un flujo neto en equilibrio, tu saldo dentro de 90 días se mantendrá en torno a los ${formatCurrency(forecast90d)}. Para activar la creación de riqueza, busca aumentar tus ingresos o reducir gastos fijos.</p>
            </div>
        `;
    }
    container.appendChild(cardForecast);
}


// ----------------------------------------------------
// 13C. SISTEMA DE CONSEJO DIARIO
// ----------------------------------------------------

function initDailyAdvice() {
    const btnOpen = document.getElementById("btn-daily-advice");
    const modal = document.getElementById("modal-daily-advice");
    const btnClose = document.getElementById("btn-close-daily-advice");
    const btnCloseOk = document.getElementById("btn-close-daily-advice-ok");
    const btnNext = document.getElementById("btn-next-advice");

    if (!btnOpen || !modal) return;

    const getDayOfYear = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    };

    const displayAdvice = (index) => {
        if (typeof CONSEJOS === 'undefined' || !CONSEJOS.length) return;
        const rawAdvice = CONSEJOS[index];
        let title = "";
        let text = rawAdvice;

        const colonIndex = rawAdvice.indexOf(':');
        if (colonIndex > 0 && colonIndex < 100 && !rawAdvice.substring(0, colonIndex).includes('.')) {
            title = rawAdvice.substring(0, colonIndex).trim();
            text = rawAdvice.substring(colonIndex + 1).trim();
        }

        if (title) {
            document.getElementById("daily-advice-number").textContent = `Consejo nº ${index + 1}: ${title}`;
        } else {
            document.getElementById("daily-advice-number").textContent = `Consejo nº ${index + 1}`;
        }
        document.getElementById("daily-advice-text").textContent = text;
    };

    const openModal = () => {
        if (typeof CONSEJOS !== 'undefined' && CONSEJOS.length) {
            const index = getDayOfYear() % CONSEJOS.length;
            displayAdvice(index);
        }
        modal.classList.remove("hidden");
    };

    const closeModal = () => {
        modal.classList.add("hidden");
    };

    btnOpen.addEventListener("click", openModal);
    btnClose.addEventListener("click", closeModal);
    btnCloseOk.addEventListener("click", closeModal);

    btnNext.addEventListener("click", () => {
        if (typeof CONSEJOS !== 'undefined' && CONSEJOS.length) {
            const randomIndex = Math.floor(Math.random() * CONSEJOS.length);
            displayAdvice(randomIndex);
        }
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Auto-abrir el consejo del día una vez al día si ya se mostró la guía de inicio
    dbStorage.getItem("finanzas_onboarding_shown").then(onboardingShown => {
        if (onboardingShown) {
            const todayStr = new Date().toDateString();
            dbStorage.getItem("last_daily_advice_shown_date").then(lastShownDate => {
                if (lastShownDate !== todayStr) {
                    setTimeout(openModal, 1200);
                    dbStorage.setItem("last_daily_advice_shown_date", todayStr);
                }
            });
        }
    });
}

// ----------------------------------------------------
// 13.5. GUÍA DE INICIO (ONBOARDING)
// ----------------------------------------------------

function initOnboarding() {
    const modal = document.getElementById("modal-onboarding");
    const btnClose = document.getElementById("btn-close-onboarding");
    const btnPrev = document.getElementById("btn-onboarding-prev");
    const btnNext = document.getElementById("btn-onboarding-next");
    const btnOpenHelp = document.getElementById("btn-onboarding-help");
    const dots = document.querySelectorAll(".onboarding-dot");
    const slides = document.querySelectorAll(".onboarding-slide");
    
    if (!modal || !btnClose || !btnPrev || !btnNext || !btnOpenHelp) return;
    
    let currentStep = 1;
    const totalSteps = slides.length;
    
    const showStep = (step) => {
        currentStep = step;
        slides.forEach(slide => {
            const slideStep = parseInt(slide.getAttribute("data-step"), 10);
            if (slideStep === step) {
                slide.classList.remove("hidden");
            } else {
                slide.classList.add("hidden");
            }
        });
        
        dots.forEach(dot => {
            const dotStep = parseInt(dot.getAttribute("data-step"), 10);
            if (dotStep === step) {
                dot.classList.add("active");
            } else {
                dot.classList.remove("active");
            }
        });
        
        // Controlar visibilidad del botón Anterior
        if (step === 1) {
            btnPrev.style.visibility = "hidden";
        } else {
            btnPrev.style.visibility = "visible";
        }
        
        // Cambiar texto de botón Siguiente en el último paso
        if (step === totalSteps) {
            btnNext.textContent = "Entendido";
        } else {
            btnNext.textContent = "Siguiente";
        }
    };
    
    const openOnboarding = () => {
        showStep(1);
        modal.classList.remove("hidden");
    };
    
    const closeOnboarding = () => {
        modal.classList.add("hidden");
        dbStorage.setItem("finanzas_onboarding_shown", "true");
    };
    
    btnPrev.addEventListener("click", () => {
        if (currentStep > 1) {
            showStep(currentStep - 1);
        }
    });
    
    btnNext.addEventListener("click", () => {
        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        } else {
            closeOnboarding();
        }
    });
    
    btnClose.addEventListener("click", closeOnboarding);
    
    btnOpenHelp.addEventListener("click", openOnboarding);
    
    dots.forEach(dot => {
        dot.addEventListener("click", () => {
            const targetStep = parseInt(dot.getAttribute("data-step"), 10);
            showStep(targetStep);
        });
    });
    
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeOnboarding();
        }
    });
    
    // Auto abrir si no se ha mostrado antes
    dbStorage.getItem("finanzas_onboarding_shown").then(onboardingShown => {
        if (!onboardingShown) {
            setTimeout(openOnboarding, 800);
        }
    });
}

// ----------------------------------------------------
// 14. INICIO DE LA APLICACIÓN AL CARGAR EL DOM
// ----------------------------------------------------

function initMobileMenu() {
    const sidebar = document.querySelector('.app-sidebar');
    const toggleBtn = document.getElementById('btn-mobile-menu-toggle');
    const backdrop = document.getElementById('sidebar-backdrop');
    const navElements = document.querySelectorAll('.app-sidebar .nav-btn, .app-sidebar .nav-link, .app-sidebar .profile-active-btn, .app-sidebar .btn-lock-session');

    if (toggleBtn && sidebar && backdrop) {
        if (toggleBtn.dataset.menuBound === "true") return;
        toggleBtn.dataset.menuBound = "true";

        const toggleSidebar = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const isActive = sidebar.classList.toggle('active');
            backdrop.classList.toggle('active');
            toggleBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        };

        const closeSidebar = () => {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
            toggleBtn.setAttribute('aria-expanded', 'false');
        };

        toggleBtn.addEventListener('click', toggleSidebar);
        backdrop.addEventListener('click', closeSidebar);

        navElements.forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(closeSidebar, 150);
            });
        });
    }
}

// ----------------------------------------------------
// 13.5. DYNAMIC CONTACT MODAL
// ----------------------------------------------------
function initContactModal() {
    // 0. Check if document.body exists, if not wait for DOMContentLoaded
    if (!document.body) {
        document.addEventListener("DOMContentLoaded", () => {
            try {
                initContactModal();
            } catch (err) {
                console.error("Deferred initContactModal failed:", err);
            }
        });
        return;
    }

    // 1. Inject contact modal HTML to body if not already present
    if (!document.getElementById("modal-contact")) {
        const modalHtml = `
            <div id="modal-contact" class="modal hidden" style="z-index: 14000;">
                <div class="modal-content shadow-glass" style="max-width: 550px; border: 1.5px solid var(--border-glass-focus); background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(25px); padding: 30px; position: relative;">
                    <div class="modal-header" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="font-family: var(--font-header); font-weight: 700; color: white; margin: 0; display: flex; align-items: center; gap: 8px;">📬 Sugerencias y Soporte</h3>
                        <button id="btn-close-contact" class="btn-close" style="background: transparent; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.4;">
                        ¿Has encontrado un fallo en la web? ¿Tienes alguna duda o sugerencia para mejorar la aplicación? Escríbenos directamente y te responderemos lo antes posible.
                    </p>
                    <form id="contact-modal-form" action="https://api.web3forms.com/submit" method="POST" target="_blank" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <!-- Configuración adicional de Web3Forms -->
                        <input type="hidden" name="access_key" value="28c43d5e-e420-40e7-8a90-29e6de315007">
                        <input type="hidden" name="subject" value="📬 Nuevo mensaje de Soporte - Mi Hucha">
                        <input type="hidden" name="botcheck" style="display:none">
                        
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                            <label for="contact-modal-name" class="form-label" style="color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;">Nombre</label>
                            <input type="text" id="contact-modal-name" name="Nombre" class="form-input" style="width: 100%; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-glass); border-radius: 8px; color: var(--text-primary); font-size: 0.9rem;" placeholder="Tu nombre" required>
                        </div>
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
                            <label for="contact-modal-email" class="form-label" style="color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;">Correo Electrónico</label>
                            <input type="email" id="contact-modal-email" name="Email" class="form-input" style="width: 100%; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-glass); border-radius: 8px; color: var(--text-primary); font-size: 0.9rem;" placeholder="tu@email.com" required>
                        </div>
                        <div class="form-group-full" style="grid-column: span 2; display: flex; flex-direction: column; gap: 6px;">
                            <label for="contact-modal-reason" class="form-label" style="color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;">Motivo de la consulta</label>
                            <select id="contact-modal-reason" name="Motivo" class="form-select" style="width: 100%; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-glass); border-radius: 8px; color: var(--text-primary); font-size: 0.9rem;" required>
                                <option value="" disabled selected>Selecciona una opción</option>
                                <option value="Sugerencia">Sugerencia o Idea de mejora</option>
                                <option value="Fallo en la web">Fallo o error en la web</option>
                                <option value="Problema">Problema con mis datos / Uso de la app</option>
                                <option value="Duda">Duda general</option>
                                <option value="Otro">Otro motivo</option>
                            </select>
                        </div>
                        <div class="form-group-full" style="grid-column: span 2; display: flex; flex-direction: column; gap: 6px;">
                            <label for="contact-modal-message" class="form-label" style="color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;">Mensaje</label>
                            <textarea id="contact-modal-message" name="Mensaje" class="form-textarea" style="width: 100%; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-glass); border-radius: 8px; color: var(--text-primary); font-size: 0.9rem; resize: vertical; min-height: 100px;" placeholder="Escribe aquí tu sugerencia, fallo o consulta..." required></textarea>
                        </div>
                        <div id="contact-modal-success" style="display: none; grid-column: span 2; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--success, #10b981); color: var(--success-light, #34d399); padding: 12px; border-radius: 8px; text-align: center; font-size: 0.85rem; margin-top: 5px; animation: fadeIn 0.3s ease;">
                            ¡Gracias! Se está procesando el envío a través de Web3Forms hacia <strong>Consultasydudasvarias@hotmail.com</strong>.
                        </div>
                        <div class="submit-container" style="grid-column: span 2; display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                            <button type="button" id="btn-cancel-contact" class="btn-secondary" style="padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">Cancelar</button>
                            <button type="submit" class="btn-submit" style="padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; border: none; color: #02040a;">
                                <span>Enviar Correo</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const modal = document.getElementById("modal-contact");
    const openTriggers = document.querySelectorAll(".btn-contact-modal");
    const btnClose = document.getElementById("btn-close-contact");
    const btnCancel = document.getElementById("btn-cancel-contact");
    const form = document.getElementById("contact-modal-form");
    const successDiv = document.getElementById("contact-modal-success");

    // Close function
    const closeModal = () => {
        modal.classList.add("hidden");
        form.reset();
        successDiv.style.display = "none";
    };

    // Open listener for all triggers (sidebar contact button)
    openTriggers.forEach(trigger => {
        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            modal.classList.remove("hidden");
            
            // Focus on first input
            const nameInput = document.getElementById("contact-modal-name");
            if (nameInput) setTimeout(() => nameInput.focus(), 100);
        });
    });

    // Close events
    [btnClose, btnCancel].forEach(btn => {
        if (btn) btn.addEventListener("click", closeModal);
    });

    // Close on background click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    // Form submit logic
    if (form) {
        form.addEventListener("submit", () => {
            // Mostrar estado de envío e instrucciones
            successDiv.style.display = 'block';
            successDiv.style.background = 'rgba(16, 185, 129, 0.1)';
            successDiv.style.borderColor = 'var(--success, #10b981)';
            successDiv.style.color = 'var(--success-light, #34d399)';
            successDiv.innerHTML = '<strong>¡Procesando envío!</strong> Se ha abierto una nueva pestaña. Confirma que no eres un robot en ella para completar el envío.';
            
            // Limpiar y cerrar el modal tras unos segundos
            setTimeout(() => {
                form.reset();
                closeModal();
            }, 8000);
        });
    }
}

async function startApp() {
    if (typeof window !== "undefined") {
        if (window._finanzasAppStarted) return;
        window._finanzasAppStarted = true;
        window.finanzasAppLoaded = true;
    }
    try {
        await loadState();
        initContactModal();
        
        // Check if we are on the main dashboard page
        const isDashboard = !!document.getElementById("panel-dashboard");
        
        if (isDashboard) {
            initNavigation();
            initMonthSelector();
            initBanksManager();
            initTransferForm();
            initIncomeFunnel();
            initFixedExpenses();
            initDashboardRightTabs();
            initQuickExpenseModal();
            initVariableExpenses();
            initBudgetClosure();
            initProjectsSandbox();
            initEditModal();
            initValuationModal();
            initPerformanceTab();
            initDailyAdvice();
            initOnboarding();
        }
        
        // Perfiles y seguridad siempre se inician si existe el modal
        const hasProfileModal = !!document.getElementById("modal-profiles");
        if (hasProfileModal) {
            initProfilesManager();
            initPinVerifyManager();
            initAdvancedSecurity();
            initPremiumFeatures();
        } else {
            initUtilities();
        }

        // Inicializar menú móvil en cualquier página que tenga el botón
        initMobileMenu();

        // Registrar rastreador de actividad global en cualquier página (tablero o artículos)
        resetActivityTimer();
        const activityEvents = ["mousemove", "keydown", "mousedown", "click", "scroll"];
        activityEvents.forEach(evtName => {
            window.addEventListener(evtName, resetActivityTimer, { passive: true });
        });

        // Si no está en el dashboard, también iniciamos el chequeo de inactividad de fondo para actualizar el localStorage
        if (!isDashboard) {
            if (autoLockInterval) clearInterval(autoLockInterval);
            autoLockInterval = setInterval(checkInactivity, 10000);
        }
        
        // Bloquear inmediatamente al cargar si la cuenta tiene PIN
        const activeProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
        let isUnlocked = sessionStorage.getItem("finanzas_unlocked") === "true";

        if (activeProfile && activeProfile.pin && isUnlocked) {
            const storedLastActivity = parseInt(localStorage.getItem("finanzas_last_activity_time") || "0", 10);
            if (storedLastActivity > 0) {
                const tenMinutes = 10 * 60 * 1000;
                if (Date.now() - storedLastActivity > tenMinutes) {
                    isUnlocked = false;
                    sessionStorage.removeItem("finanzas_unlocked");
                }
            }
        }
        
        if (activeProfile && activeProfile.pin && !isUnlocked) {
            lockSession(true);
        }
        
        // Renderizado
        if (isDashboard) {
            renderProfileWidget();
            renderProfilesList();
            renderAll();
        } else if (hasProfileModal) {
            renderProfileWidget();
            renderProfilesList();
        }
    } catch (e) {
        alert("Error en startApp:\n" + e.message + "\n\nStack:\n" + e.stack);
    }
}

// Iniciar aplicación
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
} else {
    startApp();
}

// ----------------------------------------------------
// 15. GESTIÓN DE PERFILES MULTI-USUARIO Y ARCHIVOS
// ----------------------------------------------------

function getInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().substring(0, 2).toUpperCase();
}

// Genera dinámicamente un degradado de color (gradient) HSL único y vibrante basado en el nombre de usuario
function getAvatarGradient(username) {
    if (!username) return "linear-gradient(135deg, #00e5ff, #ca9365)";
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = Math.abs(hash) % 360;
    const hue2 = (hue1 + 45) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 45%), hsl(${hue2}, 75%, 35%))`;
}

// Mostrar un diálogo personalizado (Confirmación o Prompt) que retorna una Promesa (Evita bugs de foco en Electron)
function showCustomDialog({ title, message, isPrompt = false, isPassword = false, promptLabel = "", confirmText = "Confirmar", cancelText = "Cancelar", isDestructive = false }) {
    return new Promise((resolve) => {
        const modal = document.getElementById("modal-custom-dialog");
        const titleEl = document.getElementById("custom-dialog-title");
        const msgEl = document.getElementById("custom-dialog-message");
        const inputContainer = document.getElementById("custom-dialog-input-container");
        const inputLabel = document.getElementById("custom-dialog-input-label");
        const input = document.getElementById("custom-dialog-input");
        const btnCancel = document.getElementById("btn-custom-dialog-cancel");
        const btnConfirm = document.getElementById("btn-custom-dialog-confirm");
        
        if (!modal) {
            // Fallback en caso de que no exista el modal en el DOM
            if (isPrompt) {
                resolve(prompt(message));
            } else {
                resolve(confirm(message));
            }
            return;
        }
        
        titleEl.textContent = title || "Confirmación";
        msgEl.textContent = message || "";
        btnConfirm.textContent = confirmText;
        btnCancel.textContent = cancelText;
        
        if (isDestructive) {
            btnConfirm.style.background = "linear-gradient(135deg, var(--danger), hsl(340, 80%, 45%))";
            btnConfirm.style.boxShadow = "0 4px 12px var(--danger-glow)";
        } else {
            btnConfirm.style.background = "linear-gradient(135deg, var(--primary), hsl(265, 80%, 55%))";
            btnConfirm.style.boxShadow = "0 4px 12px var(--primary-glow)";
        }
        
        if (isPrompt) {
            inputContainer.classList.remove("hidden");
            inputLabel.textContent = promptLabel || "Escribe aquí:";
            input.value = "";
            input.type = isPassword ? "password" : "text";
            setTimeout(() => input.focus(), 50);
        } else {
            inputContainer.classList.add("hidden");
        }
        
        modal.classList.remove("hidden");
        
        const cleanup = () => {
            modal.classList.add("hidden");
            // Eliminar event listeners clonando botones
            const newCancel = btnCancel.cloneNode(true);
            const newConfirm = btnConfirm.cloneNode(true);
            btnCancel.parentNode.replaceChild(newCancel, btnCancel);
            btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        };
        
        document.getElementById("btn-custom-dialog-cancel").addEventListener("click", () => {
            cleanup();
            resolve(isPrompt ? null : false);
        });
        
        document.getElementById("btn-custom-dialog-confirm").addEventListener("click", () => {
            const val = isPrompt ? input.value : true;
            cleanup();
            resolve(val);
        });
        
        // Soporte para Enter en el input de tipo prompt
        if (isPrompt) {
            const handleEnter = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    input.removeEventListener("keydown", handleEnter);
                    document.getElementById("btn-custom-dialog-confirm").click();
                }
            };
            input.addEventListener("keydown", handleEnter);
        }
    });
}

// Obtiene estadísticas clave resumidas de un perfil (saldo neto total y cantidad de bancos)
function getProfileSummaryStats(profileId) {
    const profileKey = "finanzas_db_" + profileId;
    const stored = localStorage.getItem(profileKey);
    if (!stored) return { totalBalance: 0, bankCount: 0, currency: "EUR" };
    try {
        const parsedState = JSON.parse(stored);
        if (parsedState && Array.isArray(parsedState.banks)) {
            const totalBalance = parsedState.banks.reduce((sum, b) => sum + (b.balance || 0), 0);
            const bankCount = parsedState.banks.length;
            const currency = parsedState.currency || "EUR";
            return { totalBalance, bankCount, currency };
        }
    } catch (e) {
        console.error("Error al leer estadísticas rápidas del perfil " + profileId, e);
    }
    return { totalBalance: 0, bankCount: 0, currency: "EUR" };
}

// Renderiza el botón del perfil en el Header
function renderProfileWidget() {
    const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
    if (!currentProfile) return;
    
    const initialsEl = document.getElementById("profile-avatar-initials");
    const nameEl = document.getElementById("profile-display-name");
    
    if (initialsEl) {
        initialsEl.textContent = getInitials(currentProfile.username);
        initialsEl.style.background = getAvatarGradient(currentProfile.username);
    }
    if (nameEl) nameEl.textContent = currentProfile.username;
}

// Inicializa toda la lógica y eventos del Gestor de Perfiles
function initProfilesManager() {
    const btnMenu = document.getElementById("btn-profile-menu");
    const modalProfiles = document.getElementById("modal-profiles");
    const btnClose = document.getElementById("btn-close-profiles");
    const btnToggleAdd = document.getElementById("btn-toggle-add-profile");
    const formCreate = document.getElementById("form-create-profile");
    const btnCancelCreate = document.getElementById("btn-cancel-create-profile");
    
    const btnExport = document.getElementById("btn-export-profile");
    const btnTriggerImport = document.getElementById("btn-trigger-import");
    const fileImport = document.getElementById("file-import-profile");
    
    // Abrir Modal de Perfiles
    if (btnMenu) {
        btnMenu.addEventListener("click", () => {
            renderProfilesList();
            modalProfiles.classList.remove("hidden");
        });
    }
    
    // Cerrar Modal
    if (btnClose) {
        btnClose.addEventListener("click", () => {
            modalProfiles.classList.add("hidden");
            formCreate.classList.add("hidden");
            formCreate.reset();
        });
    }

    // Cerrar modal al hacer clic en el fondo borroso (fuera de la tarjeta)
    if (modalProfiles) {
        modalProfiles.addEventListener("click", (e) => {
            if (e.target === modalProfiles) {
                modalProfiles.classList.add("hidden");
                formCreate.classList.add("hidden");
                formCreate.reset();
            }
        });
    }
    
    // Toggle Formulario Nuevo Perfil
    if (btnToggleAdd) {
        btnToggleAdd.addEventListener("click", () => {
            formCreate.classList.toggle("hidden");
        });
    }
    
    if (btnCancelCreate) {
        btnCancelCreate.addEventListener("click", () => {
            formCreate.classList.add("hidden");
            formCreate.reset();
        });
    }
    
    // Crear Nuevo Perfil
    if (formCreate) {
        formCreate.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = document.getElementById("new-profile-username").value.trim();
            const pinVal = document.getElementById("new-profile-pin").value.trim();
            
            if (!username) {
                showToast("Por favor ingresa un nombre de usuario.", "danger");
                return;
            }
            
            // Validar que el nombre no esté duplicado
            const isDuplicate = profilesState.profiles.some(p => p.username.toLowerCase() === username.toLowerCase());
            if (isDuplicate) {
                showToast("Ya existe un usuario con este nombre.", "danger");
                return;
            }
            
            // Validar PIN/Contraseña (mínimo 3 caracteres si existe)
            if (pinVal && pinVal.length < 3) {
                showToast("La contraseña o PIN debe tener al menos 3 caracteres.", "danger");
                return;
            }
            
            const autolockVal = document.getElementById("new-profile-autolock").checked;
            const newProfileId = "p_user_" + Date.now();
            const newProfile = {
                id: newProfileId,
                username: username,
                pin: pinVal || null,
                autoLockEnabled: autolockVal,
                createdAt: new Date().toISOString()
            };
            
            profilesState.profiles.push(newProfile);
            localStorage.setItem("finanzas_profiles", JSON.stringify(profilesState.profiles));
            
            // Cambiar automáticamente al nuevo perfil recién creado
            profilesState.currentProfileId = newProfileId;
            localStorage.setItem("finanzas_current_profile_id", newProfileId);
            
            // Inicializar la base de datos de esta nueva cuenta completamente VACÍA y LIMPIA
            const currencyVal = document.getElementById("new-profile-currency")?.value || "EUR";
            const emptyDb = {
                banks: [],
                fixedExpenses: [],
                transactions: [],
                budgets: {},
                projects: [],
                activityLog: [],
                currentMonth: getSystemCurrentMonth(),
                currency: currencyVal
            };
            localStorage.setItem("finanzas_db_" + newProfileId, JSON.stringify(emptyDb));
            
            // Cargar base de datos vacía
            loadState();
            logActivity(`Cuenta creada y sesión iniciada para el usuario "${username}".`);
            renderAll();
            renderProfileWidget(); // Actualizar el widget del pie de página de la barra lateral izquierda
            
            // Cerrar e inicializar formulario
            formCreate.classList.add("hidden");
            formCreate.reset();
            modalProfiles.classList.add("hidden");
            
            showToast(`¡Cuenta de "${username}" creada e iniciada!`, "success");
        });
    }
    
    // EXPORTAR / GUARDAR COPIA EN ARCHIVO (.JSON)
    if (btnExport) {
        btnExport.addEventListener("click", async () => {
            const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
            if (!currentProfile) return;
            
            try {
                let backupData;
                let isEncrypted = false;
                
                // Si la cuenta tiene contraseña/PIN, cifrar la copia de seguridad
                if (currentProfile.pin) {
                    const plaintext = JSON.stringify(state, null, 2);
                    backupData = await encryptData(plaintext, currentProfile.pin);
                    isEncrypted = true;
                } else {
                    backupData = state;
                }
                
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                
                // Reemplazar espacios y caracteres raros en el nombre de archivo
                const safeName = currentProfile.username.toLowerCase().replace(/[^a-z0-9]/gi, '_');
                const suffix = isEncrypted ? "_cifrada" : "";
                downloadAnchor.setAttribute("download", `finanzas_copia_${safeName}${suffix}_${state.currentMonth}.json`);
                
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                
                if (isEncrypted) {
                    logActivity("Copia de seguridad cifrada exportada correctamente.");
                    showToast("Copia de seguridad cifrada exportada correctamente.", "success");
                } else {
                    logActivity("Copia de seguridad estándar exportada correctamente.");
                    showToast("Copia de seguridad (.json) exportada correctamente.", "success");
                }
            } catch (err) {
                console.error("Error al exportar copia de seguridad:", err);
                showToast("Error al exportar copia de seguridad.", "danger");
            }
        });
    }
    
    // RECUPERAR / ABRIR COPIA DESDE ARCHIVO (.JSON)
    if (btnTriggerImport) {
        btnTriggerImport.addEventListener("click", () => {
            fileImport.click();
        });
    }
    
    if (fileImport) {
        fileImport.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async function(evt) {
                try {
                    const importedObj = JSON.parse(evt.target.result);
                    
                    const restoreState = (targetState) => {
                        if (
                            targetState &&
                            Array.isArray(targetState.banks) &&
                            Array.isArray(targetState.fixedExpenses) &&
                            Array.isArray(targetState.transactions) &&
                            typeof targetState.budgets === "object"
                        ) {
                            showCustomDialog({
                                title: "📥 Recuperar Copia de Seguridad",
                                message: "¿Estás seguro de que deseas recuperar esta copia de seguridad? Se sobrescribirán todos los datos del perfil activo actual.",
                                confirmText: "Recuperar copia",
                                isDestructive: true
                            }).then(confirmed => {
                                if (confirmed) {
                                    state = targetState;
                                    saveState();
                                    logActivity("Base de datos restaurada con éxito desde copia de seguridad.");
                                    modalProfiles.classList.add("hidden");
                                    showToast("¡Base de datos importada y restaurada con éxito!", "success");
                                }
                            });
                        } else {
                            showToast("El archivo seleccionado no contiene una estructura de base de datos válida.", "danger");
                        }
                    };

                    if (importedObj && importedObj.encrypted === true) {
                        showCustomDialog({
                            title: "🔑 Copia de Seguridad Cifrada",
                            message: "Este archivo está cifrado. Ingresa la contraseña o PIN original para desencriptar:",
                            isPrompt: true,
                            isPassword: true,
                            promptLabel: "Contraseña / PIN:",
                            confirmText: "Desencriptar",
                            cancelText: "Cancelar"
                        }).then(async (password) => {
                            if (password === null) return;
                            try {
                                const decryptedText = await decryptData(importedObj, password);
                                const decryptedState = JSON.parse(decryptedText);
                                restoreState(decryptedState);
                            } catch (err) {
                                showToast("Contraseña incorrecta o archivo corrupto.", "danger");
                            }
                        });
                    } else {
                        restoreState(importedObj);
                    }
                } catch (err) {
                    console.error("Error al leer archivo JSON:", err);
                    showToast("Error de lectura: Formato de archivo JSON inválido.", "danger");
                }
                fileImport.value = "";
            };
            reader.readAsText(file);
        });
    }
    
    // BORRAR POR COMPLETO LOS DATOS DE LA CUENTA ACTIVA (EMPEZAR DE CERO) - DELEGACIÓN DE EVENTOS DE ALTA FIABILIDAD
    document.addEventListener("click", (e) => {
        const btnResetData = e.target.closest("#btn-reset-profile-data");
        if (!btnResetData) return;
        
        const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
        if (!currentProfile) return;
        
        showCustomDialog({
            title: "⚠️ Borrado de Datos de Cuenta",
            message: `¿Estás seguro de que deseas BORRAR POR COMPLETO todos los datos (bancos, transacciones, presupuestos, gastos fijos y proyectos) de la cuenta de "${currentProfile.username}"?\n\nEsta acción es irreversible y no afectará a otros usuarios.`,
            confirmText: "Continuar",
            isDestructive: true
        }).then(confirm1 => {
            if (!confirm1) return;
            
            showCustomDialog({
                title: "🔒 Confirmación Requerida",
                message: `Para confirmar el borrado total de la cuenta "${currentProfile.username}", por favor escribe la palabra "ELIMINAR" a continuación:`,
                isPrompt: true,
                promptLabel: "Escribe ELIMINAR para continuar",
                confirmText: "Borrar Datos",
                isDestructive: true
            }).then(doubleCheck => {
                if (doubleCheck === "ELIMINAR") {
                    // Resetear el estado a vacío
                    state = {
                        banks: [],
                        fixedExpenses: [],
                        transactions: [],
                        budgets: {},
                        projects: [],
                        currentMonth: getSystemCurrentMonth()
                    };
                    saveState();
                    renderProfilesList(); // Actualizar listado de perfiles para reflejar saldos a 0 €
                    
                    const modalProfiles = document.getElementById("modal-profiles");
                    if (modalProfiles) modalProfiles.classList.add("hidden");
                    
                    showToast("¡Todos los datos de esta cuenta han sido borrados por completo!", "success");
                } else {
                    showToast("Borrado cancelado o confirmación incorrecta.", "info");
                }
            });
        });
    });
    
    // ====================================================
    // EDITAR PERFIL ACTIVO (CAMBIAR NOMBRE Y CONTRASEÑA/PIN)
    // ====================================================
    const btnEditActive = document.getElementById("btn-edit-active-profile");
    const formEdit = document.getElementById("form-edit-profile");
    const btnCancelEditActive = document.getElementById("btn-cancel-edit-profile");
    
    if (btnEditActive && formEdit) {
        btnEditActive.addEventListener("click", () => {
            const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
            if (!currentProfile) return;
            
            document.getElementById("edit-profile-username").value = currentProfile.username;
            document.getElementById("edit-profile-pin").value = currentProfile.pin || "";
            document.getElementById("edit-profile-autolock").checked = currentProfile.autoLockEnabled !== false;
            document.getElementById("edit-profile-currency").value = state.currency || "EUR";
            
            formEdit.classList.toggle("hidden");
            if (formCreate) formCreate.classList.add("hidden"); // Cerrar el de creación si está abierto
        });
    }
    
    if (btnCancelEditActive && formEdit) {
        btnCancelEditActive.addEventListener("click", () => {
            formEdit.classList.add("hidden");
            formEdit.reset();
        });
    }
    
    if (formEdit) {
        formEdit.addEventListener("submit", (e) => {
            e.preventDefault();
            const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
            if (!currentProfile) return;
            
            const newUsername = document.getElementById("edit-profile-username").value.trim();
            const newPin = document.getElementById("edit-profile-pin").value.trim();
            const newAutolock = document.getElementById("edit-profile-autolock").checked;
            const newCurrency = document.getElementById("edit-profile-currency").value;
            
            if (!newUsername) {
                showToast("El nombre de usuario no puede estar vacío.", "danger");
                return;
            }
            
            // Validar que el nombre no esté duplicado con OTRO perfil
            const isDuplicate = profilesState.profiles.some(p => p.id !== currentProfile.id && p.username.toLowerCase() === newUsername.toLowerCase());
            if (isDuplicate) {
                showToast("Ya existe otra cuenta con este nombre.", "danger");
                return;
            }
            
            if (newPin && newPin.length < 3) {
                showToast("La contraseña o PIN debe tener al menos 3 caracteres.", "danger");
                return;
            }
            
            const pinChanged = currentProfile.pin !== (newPin || null);
            currentProfile.username = newUsername;
            currentProfile.pin = newPin || null;
            currentProfile.autoLockEnabled = newAutolock;
            
            // Guardar la nueva moneda en el estado
            state.currency = newCurrency;
            
            // Guardar cambios en LocalStorage
            localStorage.setItem("finanzas_profiles", JSON.stringify(profilesState.profiles));
            
            let logMsg = `Perfil de usuario editado.`;
            if (pinChanged) {
                logMsg += ` Contraseña/PIN cambiada o removida.`;
            }
            logActivity(logMsg);
            
            saveState(); // Guarda base de datos activa y actualiza widget del header
            renderProfilesList(); // Actualiza el modal de perfiles
            
            formEdit.classList.add("hidden");
            formEdit.reset();
            
            showToast("¡Tu perfil se ha actualizado correctamente!", "success");
        });
    }
    
    renderProfileWidget();
}



// Renderiza dinámicamente la lista de perfiles dentro del modal de gestión
function renderProfilesList() {
    const container = document.getElementById("profiles-list-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    // Perfil Activo
    const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
    if (currentProfile) {
        document.getElementById("modal-current-name").textContent = currentProfile.username;
        const avatarLarge = document.getElementById("modal-current-avatar");
        if (avatarLarge) {
            avatarLarge.textContent = getInitials(currentProfile.username);
            avatarLarge.style.background = getAvatarGradient(currentProfile.username);
        }
        
        const stats = getProfileSummaryStats(currentProfile.id);
        const configCur = CURRENCY_CONFIGS[stats.currency || 'EUR'] || CURRENCY_CONFIGS.EUR;
        const balanceFormatted = new Intl.NumberFormat(configCur.locale, { style: 'currency', currency: configCur.code }).format(stats.totalBalance);
        const dateStr = currentProfile.createdAt ? new Date(currentProfile.createdAt).toLocaleDateString() : "--/--/----";
        
        document.getElementById("modal-current-meta").innerHTML = `
            Perfil activo • Creado el ${dateStr}<br>
            <span style="color: var(--primary-light); font-weight: 600; font-size: 0.82rem; display: inline-block; margin-top: 4px;">
                Saldo Neto: ${balanceFormatted} (${stats.bankCount} bancos)
            </span>
        `;
    }
    
    const otherProfiles = profilesState.profiles.filter(p => p.id !== profilesState.currentProfileId);
    
    if (otherProfiles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); font-size: 0.84rem; padding: 20px 0;">
                No hay otras cuentas registradas en este navegador.
            </div>
        `;
        return;
    }
    
    otherProfiles.forEach(prof => {
        const initials = getInitials(prof.username);
        const gradient = getAvatarGradient(prof.username);
        const dateStr = prof.createdAt ? new Date(prof.createdAt).toLocaleDateString() : "--/--/----";
        const hasPin = !!prof.pin;
        const stats = getProfileSummaryStats(prof.id);
        const configOther = CURRENCY_CONFIGS[stats.currency || 'EUR'] || CURRENCY_CONFIGS.EUR;
        const balanceFormatted = new Intl.NumberFormat(configOther.locale, { style: 'currency', currency: configOther.code }).format(stats.totalBalance);
        
        const card = document.createElement("div");
        card.className = "profile-item-card";
        
        card.innerHTML = `
            <div class="profile-item-left" data-id="${prof.id}">
                <div class="profile-avatar-small" style="background: ${gradient};">${initials}</div>
                <div class="profile-item-info">
                    <span class="name" style="font-family: var(--font-header); font-weight: 600; color: white;">${prof.username}</span>
                    <span class="meta" style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.3;">
                        Creado el ${dateStr}<br>
                        <span style="color: var(--text-secondary); font-weight: 500;">${balanceFormatted} (${stats.bankCount} bancos)</span>
                    </span>
                </div>
            </div>
            <div class="profile-item-actions">
                ${hasPin ? `
                    <div class="badge-pin-protected" title="Cuenta protegida con PIN de privacidad">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                ` : ''}
                <button class="btn-delete-icon btn-delete-profile" data-id="${prof.id}" title="Eliminar cuenta y borrar todos sus datos">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
        
        card.querySelector(".profile-item-left").addEventListener("click", () => {
            attemptSwitchProfile(prof.id);
        });
        
        card.querySelector(".btn-delete-profile").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteProfile(prof.id);
        });
        
        container.appendChild(card);
    });
}

// Iniciar intento de cambiar de cuenta
function attemptSwitchProfile(profileId) {
    const prof = profilesState.profiles.find(p => p.id === profileId);
    if (!prof) return;
    
    if (prof.pin) {
        pendingProfileId = profileId;
        document.getElementById("pin-target-username").textContent = prof.username;
        const errEl = document.getElementById("pin-error-message");
        if (errEl) errEl.classList.add("hidden");
        
        const pwdInput = document.getElementById("profile-access-password");
        if (pwdInput) {
            pwdInput.value = "";
        }
        
        document.getElementById("modal-pin").classList.remove("hidden");
        if (pwdInput) pwdInput.focus();
    } else {
        switchProfile(profileId);
    }
}

// Cambiar de cuenta realmente (una vez validado el PIN si existía)
async function switchProfile(profileId) {
    const prof = profilesState.profiles.find(p => p.id === profileId);
    if (!prof) return;
    
    profilesState.currentProfileId = profileId;
    await dbStorage.setItem("finanzas_current_profile_id", profileId);
    
    await loadState();
    logActivity(`Sesión iniciada correctamente como "${prof.username}".`);
    renderAll();
    renderProfileWidget(); // Actualizar reactivamente el widget de la barra lateral izquierda
    
    document.getElementById("modal-profiles").classList.add("hidden");
    document.getElementById("modal-pin").classList.add("hidden");
    
    showToast(`Sesión iniciada correctamente como "${prof.username}"`, 'success');
}

// Eliminar un perfil
function deleteProfile(profileId) {
    const prof = profilesState.profiles.find(p => p.id === profileId);
    if (!prof) return;
    
    showCustomDialog({
        title: "❌ Eliminar Perfil de Usuario",
        message: `¿Estás completamente seguro de que deseas eliminar permanentemente el perfil de "${prof.username}"?\nSe borrarán TODOS sus bancos, transacciones, presupuestos y proyectos de forma irreversible.`,
        confirmText: "Eliminar Perfil",
        isDestructive: true
    }).then(async (confirmed) => {
        if (confirmed) {
            await dbStorage.removeItem("finanzas_db_" + profileId);
            
            profilesState.profiles = profilesState.profiles.filter(p => p.id !== profileId);
            await dbStorage.setItem("finanzas_profiles", profilesState.profiles);
            
            showToast(`Perfil de "${prof.username}" eliminado correctamente.`, 'danger');
            renderProfilesList();
        }
    });
}

// Lógica y eventos del Modal de PIN
function initPinVerifyManager() {
    const modalPin = document.getElementById("modal-pin");
    const btnCancel = document.getElementById("btn-cancel-pin");
    const btnClose = document.getElementById("btn-close-pin");
    const formPin = document.getElementById("form-pin-verify");
    const passwordInput = document.getElementById("profile-access-password");
    
    const closePinModal = () => {
        modalPin.classList.add("hidden");
        pendingProfileId = null;
        if (passwordInput) passwordInput.value = "";
    };
    
    if (btnCancel) btnCancel.addEventListener("click", closePinModal);
    if (btnClose) btnClose.addEventListener("click", closePinModal);

    // Cerrar modal al hacer clic en el fondo borroso (fuera de la tarjeta)
    if (modalPin) {
        modalPin.addEventListener("click", (e) => {
            if (e.target === modalPin) {
                closePinModal();
            }
        });
    }
    
    if (formPin && passwordInput) {
        formPin.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const prof = profilesState.profiles.find(p => p.id === pendingProfileId);
            if (!prof) return;
            
            const enteredPin = passwordInput.value;
            
            if (enteredPin === prof.pin) {
                switchProfile(pendingProfileId);
            } else {
                const errorEl = document.getElementById("pin-error-message");
                if (errorEl) errorEl.classList.remove("hidden");
                
                passwordInput.value = "";
                passwordInput.focus();
            }
        });
    }
}

// ====================================================
// SEGURIDAD AVANZADA: BLOQUEO, INACTIVIDAD, CONTRASEÑAS
// ====================================================

function initAdvancedSecurity() {
    // 1. Mostrar/Ocultar contraseña (eye toggles)
    document.querySelectorAll(".btn-toggle-password").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const wrapper = btn.closest(".password-field-wrapper");
            const input = wrapper ? wrapper.querySelector("input") : null;
            if (!input) return;
            
            const eyeOpen = btn.querySelector(".eye-open");
            const eyeClosed = btn.querySelector(".eye-closed");
            
            if (input.type === "password") {
                input.type = "text";
                if (eyeOpen) eyeOpen.classList.add("hidden");
                if (eyeClosed) eyeClosed.classList.remove("hidden");
            } else {
                input.type = "password";
                if (eyeOpen) eyeOpen.classList.remove("hidden");
                if (eyeClosed) eyeClosed.classList.add("hidden");
            }
        });
    });

    // 2. Botón de bloqueo rápido
    const btnLock = document.getElementById("btn-lock-session");
    if (btnLock) {
        btnLock.addEventListener("click", () => {
            lockSession();
            logActivity("Sesión bloqueada manualmente por el usuario.");
        });
    }

    // 3. Formulario de desbloqueo de pantalla
    const formUnlock = document.getElementById("form-screen-unlock");
    const lockPassInput = document.getElementById("lock-password");
    const lockErrorMsg = document.getElementById("lock-error-message");
    const btnSwitchUser = document.getElementById("btn-lock-switch-user");

    if (formUnlock) {
        formUnlock.addEventListener("submit", (e) => {
            e.preventDefault();
            const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
            if (!currentProfile) return;

            const entered = lockPassInput.value;
            // Si el perfil no tiene PIN/contraseña, desbloquea de inmediato
            if (!currentProfile.pin || entered === currentProfile.pin) {
                unlockSession();
                logActivity("Sesión desbloqueada con éxito.");
            } else {
                lockErrorMsg.classList.remove("hidden");
                lockPassInput.focus();
                logActivity("Fallo de desbloqueo: contraseña/PIN incorrecto.");
            }
        });
    }

    if (btnSwitchUser) {
        btnSwitchUser.addEventListener("click", () => {
            // Abrir el selector de perfiles directamente
            unlockSession(); // Ocultar el lock screen
            const modalProfiles = document.getElementById("modal-profiles");
            if (modalProfiles) {
                modalProfiles.classList.remove("hidden");
                renderProfilesList();
            }
        });
    }

    // 4. Lógica de inactividad (Auto-lock)
    resetActivityTimer();
    const activityEvents = ["mousemove", "keydown", "mousedown", "click", "scroll"];
    activityEvents.forEach(evtName => {
        window.addEventListener(evtName, resetActivityTimer, { passive: true });
    });

    if (autoLockInterval) clearInterval(autoLockInterval);
    autoLockInterval = setInterval(checkInactivity, 10000); // Comprobar cada 10 segundos

    // 5. Botones de bitácora
    const btnViewLog = document.getElementById("btn-view-activity-log");
    const modalLog = document.getElementById("modal-activity-log");
    const btnCloseLog1 = document.getElementById("btn-close-activity-log");
    const btnCloseLog2 = document.getElementById("btn-close-activity-log-ok");
    const btnClearLog = document.getElementById("btn-clear-activity-log");

    if (btnViewLog && modalLog) {
        btnViewLog.addEventListener("click", () => {
            renderActivityLog();
            modalLog.classList.remove("hidden");
        });
    }

    [btnCloseLog1, btnCloseLog2].forEach(btn => {
        if (btn && modalLog) {
            btn.addEventListener("click", () => {
                modalLog.classList.add("hidden");
            });
        }
    });

    if (btnClearLog) {
        btnClearLog.addEventListener("click", () => {
            showCustomDialog({
                title: "⚠️ Borrar Bitácora de Actividad",
                message: "¿Estás seguro de que deseas eliminar permanentemente todo el historial de auditoría de esta cuenta?",
                confirmText: "Eliminar historial",
                isDestructive: true
            }).then(confirmed => {
                if (confirmed) {
                    state.activityLog = [];
                    logActivity("Historial de actividad limpiado por el usuario.");
                    renderActivityLog();
                    showToast("Historial de actividad borrado.", "success");
                }
            });
        });
    }
}

// Bloquear la aplicación
function lockSession(immediate = false) {
    const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
    if (!currentProfile) return;

    isLocked = true;
    sessionStorage.removeItem("finanzas_unlocked");
    const lockScreen = document.getElementById("screen-lock");
    const lockUsername = document.getElementById("lock-username");
    const lockAvatar = document.getElementById("lock-avatar");
    const lockPassword = document.getElementById("lock-password");
    const lockErrorMsg = document.getElementById("lock-error-message");
    const lockHelper = document.getElementById("lock-helper-text");

    if (lockScreen) {
        lockUsername.textContent = currentProfile.username;
        lockAvatar.textContent = getInitials(currentProfile.username);
        
        // Calcular color del avatar basado en el nombre para coherencia
        let hash = 0;
        for (let i = 0; i < currentProfile.username.length; i++) {
            hash = currentProfile.username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        lockAvatar.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 60) % 360}, 80%, 35%))`;
        
        lockPassword.value = "";
        lockErrorMsg.classList.add("hidden");

        if (currentProfile.pin) {
            lockHelper.textContent = "Ingresa tu contraseña o PIN para desbloquear:";
            lockPassword.placeholder = "Contraseña o PIN...";
            lockPassword.disabled = false;
        } else {
            lockHelper.textContent = "Esta cuenta no está protegida con contraseña.";
            lockPassword.placeholder = "Haz clic en Desbloquear para ingresar...";
            lockPassword.disabled = true;
        }

        // Si se carga la app por primera vez, no aplicar transición/animación brusca
        if (immediate) {
            lockScreen.style.transition = "none";
            lockScreen.classList.remove("hidden");
            setTimeout(() => { lockScreen.style.transition = ""; }, 50);
        } else {
            lockScreen.classList.remove("hidden");
        }
        
        if (!currentProfile.pin) {
            // Foco en el botón de desbloqueo si no hay contraseña
            const submitBtn = document.querySelector("#form-screen-unlock button[type='submit']");
            if (submitBtn) submitBtn.focus();
        } else {
            setTimeout(() => lockPassword.focus(), 80);
        }
    }
}

// Desbloquear la aplicación
function unlockSession() {
    isLocked = false;
    sessionStorage.setItem("finanzas_unlocked", "true");
    const lockScreen = document.getElementById("screen-lock");
    if (lockScreen) {
        lockScreen.classList.add("hidden");
    }
    resetActivityTimer();
}

function resetActivityTimer() {
    lastActivityTime = Date.now();
    localStorage.setItem("finanzas_last_activity_time", lastActivityTime.toString());
}

// Comprobar inactividad
function checkInactivity() {
    if (isLocked) return;
    
    const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
    if (!currentProfile) return;

    // Si el usuario tiene habilitado el bloqueo automático (por defecto true si tiene PIN)
    if (currentProfile.autoLockEnabled === undefined) {
        currentProfile.autoLockEnabled = currentProfile.pin ? true : false;
    }

    if (currentProfile.autoLockEnabled) {
        const storedLastActivity = parseInt(localStorage.getItem("finanzas_last_activity_time") || Date.now().toString(), 10);
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - storedLastActivity > fiveMinutes) {
            lockSession();
            logActivity("Sesión bloqueada automáticamente por inactividad (5 minutos).");
        }
    }
}

// Renderizar la lista de eventos de la bitácora

// ====================================================
// GESTOR DE COPIAS DE SEGURIDAD Y RECORDATORIO AUTOMÁTICO
// ====================================================

async function exportBackupFile() {
    const currentProfile = profilesState.profiles.find(p => p.id === profilesState.currentProfileId);
    if (!currentProfile) return;
    
    try {
        let backupData;
        let isEncrypted = false;
        
        // Si la cuenta tiene contraseña/PIN, cifrar la copia de seguridad
        if (currentProfile.pin) {
            const plaintext = JSON.stringify(state, null, 2);
            backupData = await encryptData(plaintext, currentProfile.pin);
            isEncrypted = true;
        } else {
            backupData = state;
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        
        // Reemplazar espacios y caracteres raros en el nombre de archivo
        const safeName = currentProfile.username.toLowerCase().replace(/[^a-z0-9]/gi, '_');
        const suffix = isEncrypted ? "_cifrada" : "";
        downloadAnchor.setAttribute("download", `finanzas_copia_${safeName}${suffix}_${state.currentMonth}.json`);
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        // Registrar timestamp de última copia de seguridad
        const now = Date.now();
        localStorage.setItem("finanzas_last_backup_time", now.toString());
        
        // Ocultar banner de recordatorio si estaba visible
        const reminderBanner = document.getElementById("backup-reminder-banner");
        if (reminderBanner) reminderBanner.remove();
        
        if (isEncrypted) {
            logActivity("Copia de seguridad cifrada exportada correctamente.");
            showToast("Copia de seguridad cifrada exportada correctamente.", "success");
        } else {
            logActivity("Copia de seguridad estándar exportada correctamente.");
            showToast("Copia de seguridad (.json) exportada correctamente.", "success");
        }
    } catch (err) {
        console.error("Error al exportar copia de seguridad:", err);
        showToast("Error al exportar copia de seguridad.", "danger");
    }
}

function checkBackupReminder() {
    const dashboardPanel = document.getElementById("panel-dashboard");
    if (!dashboardPanel) return;

    // Si el usuario no tiene datos (no hay bancos ni transacciones), no avisar
    const hasData = (state.banks && state.banks.length > 0) || (state.transactions && state.transactions.length > 0);
    if (!hasData) return;

    const lastBackup = parseInt(localStorage.getItem("finanzas_last_backup_time") || "0", 10);
    const dismissedTime = parseInt(localStorage.getItem("finanzas_dismissed_backup_time") || "0", 10);
    const now = Date.now();

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Si fue pospuesto en los últimos 7 días, no molestar
    if (dismissedTime > 0 && (now - dismissedTime) < sevenDaysMs) {
        return;
    }

    // Si nunca ha hecho backup o han pasado más de 30 días
    const shouldShow = (lastBackup === 0) || ((now - lastBackup) > thirtyDaysMs);
    if (!shouldShow) return;

    // Evitar duplicados en DOM
    if (document.getElementById("backup-reminder-banner")) return;

    const daysSinceText = lastBackup === 0 
        ? "más de 30 días" 
        : `${Math.floor((now - lastBackup) / (24 * 60 * 60 * 1000))} días`;

    const banner = document.createElement("div");
    banner.id = "backup-reminder-banner";
    banner.className = "backup-reminder-banner";
    banner.innerHTML = `
        <div class="backup-reminder-content">
            <div class="backup-reminder-icon">💾</div>
            <div class="backup-reminder-text">
                <strong>Recordatorio de Seguridad:</strong> 
                <span>Han pasado ${daysSinceText} sin respaldar tus datos financieros en un archivo descargable. Guarda una copia de seguridad para mantener tu historial a salvo.</span>
            </div>
        </div>
        <div class="backup-reminder-actions">
            <button type="button" class="btn-backup-now" id="btn-backup-now-action">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Descargar Copia Ahora
            </button>
            <button type="button" class="btn-backup-snooze" id="btn-backup-snooze-action">Recordar en 7 días</button>
            <button type="button" class="btn-backup-close" id="btn-backup-close-action" aria-label="Cerrar aviso">&times;</button>
        </div>
    `;

    dashboardPanel.prepend(banner);

    document.getElementById("btn-backup-now-action")?.addEventListener("click", () => {
        exportBackupFile();
    });

    document.getElementById("btn-backup-snooze-action")?.addEventListener("click", () => {
        localStorage.setItem("finanzas_dismissed_backup_time", Date.now().toString());
        banner.remove();
        showToast("Recordatorio de copia pospuesto por 7 días.", "info");
    });

    document.getElementById("btn-backup-close-action")?.addEventListener("click", () => {
        banner.remove();
    });
}

function renderActivityLog() {
    const container = document.getElementById("activity-log-container");
    if (!container) return;

    if (!state.activityLog || state.activityLog.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.82rem;">Ninguna actividad registrada aún en esta cuenta.</div>`;
        return;
    }

    let html = "";
    state.activityLog.forEach(act => {
        const date = new Date(act.timestamp);
        const formattedTime = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        html += `
            <div class="activity-log-item">
                <div class="activity-log-desc">${escapeHtml(act.description)}</div>
                <div class="activity-log-time">${formattedTime}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ====================================================
// CRIPTOGRAFÍA NATIVA PARA COPIAS DE SEGURIDAD CIFRADAS
// ====================================================
const ENCRYPTION_ALGO = "AES-GCM";
const KEY_DERIVATION_ALGO = "PBKDF2";

function stringToArrayBuffer(str) {
    return new TextEncoder().encode(str);
}

function arrayBufferToString(buf) {
    return new TextDecoder().decode(buf);
}

function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function deriveKeyFromPassword(password, salt) {
    const passwordBuffer = stringToArrayBuffer(password);
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        { name: KEY_DERIVATION_ALGO },
        false,
        ["deriveKey"]
    );
    
    return await window.crypto.subtle.deriveKey(
        {
            name: KEY_DERIVATION_ALGO,
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        baseKey,
        { name: ENCRYPTION_ALGO, length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptData(plaintext, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const key = await deriveKeyFromPassword(password, salt);
    const plaintextBuffer = stringToArrayBuffer(plaintext);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
            name: ENCRYPTION_ALGO,
            iv: iv
        },
        key,
        plaintextBuffer
    );
    
    return {
        encrypted: true,
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(ciphertextBuffer)
    };
}

async function decryptData(encryptedObj, password) {
    try {
        const salt = base64ToArrayBuffer(encryptedObj.salt);
        const iv = base64ToArrayBuffer(encryptedObj.iv);
        const ciphertext = base64ToArrayBuffer(encryptedObj.ciphertext);
        
        const key = await deriveKeyFromPassword(password, salt);
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: ENCRYPTION_ALGO,
                iv: iv
            },
            key,
            ciphertext
        );
        
        return arrayBufferToString(decryptedBuffer);
    } catch (e) {
        console.error("Error en la desencriptación:", e);
        throw new Error("Contraseña incorrecta o archivo de copia corrupto.");
    }
}

// ====================================================
// CARACTERÍSTICAS PREMIUM: LÓGICA E INICIALIZACIONES
// ====================================================

function initPremiumFeatures() {
    initMaskMode();
    initSearchAndExport();
    initKeyboardShortcuts();
    initFixedExpensesTabs();
    initSavingGoals();
    initCloseMonthManager();
    initShortcutsHelpModal();
    initUtilities();
}

function initMaskMode() {
    const btnToggle = document.getElementById("btn-toggle-mask");
    if (btnToggle) {
        btnToggle.addEventListener("click", () => {
            state.maskMode = !state.maskMode;
            saveState();
            showToast(state.maskMode ? "Modo Incógnito activado (Saldos ocultos)" : "Modo Incógnito desactivado", "info");
        });
    }
}

function initSearchAndExport() {
    const searchInput = document.getElementById("search-tx");
    const btnClear = document.getElementById("btn-clear-search");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderTransactionsTable();
            if (btnClear) {
                if (searchInput.value.trim().length > 0) {
                    btnClear.classList.remove("hidden");
                } else {
                    btnClear.classList.add("hidden");
                }
            }
        });
    }

    if (btnClear && searchInput) {
        btnClear.addEventListener("click", () => {
            searchInput.value = "";
            btnClear.classList.add("hidden");
            renderTransactionsTable();
            searchInput.focus();
        });
    }

    const btnExport = document.getElementById("btn-export-csv");
    if (btnExport) {
        btnExport.addEventListener("click", exportTransactionsToCSV);
    }
}

function initKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
        // ESC Key: Cerrar cualquier modal abierto (excepto pantalla de bloqueo) y menú móvil
        if (e.key === "Escape") {
            const openModals = document.querySelectorAll('.modal:not(.hidden):not(#screen-lock)');
            openModals.forEach(modalEl => {
                modalEl.classList.add("hidden");
                logActivity(`Modal ${modalEl.id} cerrado mediante atajo de teclado.`);
            });

            // Cerrar menú móvil si está desplegado
            const sidebar = document.querySelector('.app-sidebar.active');
            const backdrop = document.getElementById('sidebar-backdrop');
            const toggleBtn = document.getElementById('btn-mobile-menu-toggle');
            if (sidebar) {
                sidebar.classList.remove('active');
                if (backdrop) backdrop.classList.remove('active');
                if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
            }
        }

        // Ignorar atajos si está bloqueada la sesión
        const lockScreen = document.getElementById("screen-lock");
        if (lockScreen && !lockScreen.classList.contains("hidden")) {
            return;
        }

        // Navegación de meses
        if (e.key === "ArrowLeft") {
            if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
                const prev = getPreviousMonthString(state.currentMonth);
                changeMonth(prev);
            }
        }
        if (e.key === "ArrowRight") {
            if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
                const next = getNextMonthString(state.currentMonth);
                changeMonth(next);
            }
        }
    });
}

function initFixedExpensesTabs() {
    const btnList = document.getElementById("btn-subtab-fixed-list");
    const btnCal = document.getElementById("btn-subtab-fixed-calendar");
    const containerList = document.getElementById("container-fixed-list");
    const containerCal = document.getElementById("container-fixed-calendar");

    if (btnList && btnCal && containerList && containerCal) {
        btnList.addEventListener("click", () => {
            btnList.classList.add("active");
            btnCal.classList.remove("active");
            containerList.classList.remove("hidden");
            containerCal.classList.add("hidden");
        });

        btnCal.addEventListener("click", () => {
            btnCal.classList.add("active");
            btnList.classList.remove("active");
            containerCal.classList.remove("hidden");
            containerList.classList.add("hidden");
            renderFixedCalendar();
        });
    }
}

function initSavingGoals() {
    const btnShow = document.getElementById("btn-show-add-goal");
    const form = document.getElementById("form-add-saving-goal");
    const btnCancel = document.getElementById("btn-cancel-add-goal");

    if (btnShow && form && btnCancel) {
        btnShow.addEventListener("click", () => {
            form.classList.toggle("hidden");
            populateSavingGoalBanks();
        });

        btnCancel.addEventListener("click", () => {
            form.classList.add("hidden");
            form.reset();
        });

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("goal-name").value.trim();
            const targetAmount = parseFloat(document.getElementById("goal-target-amount").value);
            const bankId = document.getElementById("goal-bank-id").value;
            const deadline = document.getElementById("goal-deadline").value;

            if (!name || isNaN(targetAmount) || targetAmount <= 0 || !bankId || !deadline) {
                showToast("Por favor, rellene todos los campos correctamente.", "danger");
                return;
            }

            if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
                showToast("Este mes está consolidado y cerrado. No se pueden añadir metas.", "danger");
                return;
            }

            const newGoal = {
                id: "g_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                name: name,
                targetAmount: targetAmount,
                bankId: bankId,
                deadline: deadline
            };

            state.savingGoals.push(newGoal);
            saveState();

            form.classList.add("hidden");
            form.reset();
            showToast(`Meta de ahorro "${name}" guardada con éxito.`, "success");
            logActivity(`Creada meta de ahorro "${name}" vinculada a banco.`);
        });
    }
}

function populateSavingGoalBanks() {
    const select = document.getElementById("goal-bank-id");
    if (!select) return;
    select.innerHTML = `<option value="" disabled selected>Selecciona cuenta...</option>`;
    state.banks.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = `${b.name} (${formatCurrency(b.balance)})`;
        select.appendChild(opt);
    });
}

function deleteSavingGoal(id) {
    const goal = state.savingGoals.find(g => g.id === id);
    if (!goal) return;

    if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
        showToast("Este mes está consolidado y cerrado. No se pueden eliminar metas.", "danger");
        return;
    }

    showCustomDialog({
        title: "⚠️ Eliminar Meta de Ahorro",
        message: `¿Estás seguro de que deseas eliminar la meta de ahorro "${goal.name}"?`,
        confirmText: "Eliminar",
        isDestructive: true
    }).then(confirmed => {
        if (confirmed) {
            state.savingGoals = state.savingGoals.filter(g => g.id !== id);
            saveState();
            showToast(`Meta de ahorro "${goal.name}" eliminada.`, "success");
            logActivity(`Meta de ahorro "${goal.name}" eliminada.`);
        }
    });
}
window.deleteSavingGoal = deleteSavingGoal;

function initCloseMonthManager() {
    const btnClose = document.getElementById("btn-close-month");
    if (btnClose) {
        btnClose.addEventListener("click", closeCurrentMonth);
    }
}

function closeCurrentMonth() {
    if (state.closedMonths && state.closedMonths.includes(state.currentMonth)) {
        showToast("Este mes ya está cerrado y consolidado.", "info");
        return;
    }

    showCustomDialog({
        title: "🔒 Consolidar y Cerrar Mes",
        message: `¿Estás seguro de que deseas consolidar y cerrar el mes de ${formatMonthString(state.currentMonth)}?\n\nUna vez cerrado, se bloquearán todas las operaciones de registro y edición para este período.`,
        confirmText: "Cerrar Mes",
        isDestructive: true
    }).then(confirmed => {
        if (confirmed) {
            if (!state.closedMonths) {
                state.closedMonths = [];
            }
            state.closedMonths.push(state.currentMonth);
            saveState();
            showToast(`Mes de ${formatMonthString(state.currentMonth)} cerrado y consolidado.`, "success");
            logActivity(`Mes ${state.currentMonth} cerrado y consolidado.`);
        }
    });
}

function exportTransactionsToCSV() {
    let txs = state.transactions.filter(tx => tx.month === state.currentMonth);
    txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Fecha;Tipo;Categoría;Concepto;Banco;Importe\n";
    
    txs.forEach(tx => {
        const dateStr = formatDate(tx.date);
        const typeStr = tx.type === "income" ? "Ingreso" : "Gasto";
        const catStr = tx.subtype || "";
        const descStr = (tx.description || "").replace(/"/g, '""');
        
        let bankName = "-";
        if (tx.bankId) {
            const bank = state.banks.find(b => b.id === tx.bankId);
            bankName = bank ? bank.name : "Desconocido";
        } else if (tx.distributions) {
            bankName = tx.distributions.map(d => {
                const b = state.banks.find(bankObj => bankObj.id === d.bankId);
                return b ? b.name : "Desconocido";
            }).join(', ');
        }
        const bankStr = bankName.replace(/"/g, '""');
        const amountStr = (tx.type === "income" ? "+" : "-") + tx.amount.toFixed(2);
        
        csvContent += `"${dateStr}";"${typeStr}";"${catStr}";"${descStr}";"${bankStr}";"${amountStr}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mi_hucha_movimientos_${state.currentMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Historial exportado a CSV con éxito", "success");
    logActivity(`Exportado historial de movimientos de ${state.currentMonth} a CSV.`);
}

function renderFixedCalendar() {
    const grid = document.getElementById("fixed-calendar-grid");
    if (!grid) return;

    grid.innerHTML = "";

    const [year, month] = state.currentMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let firstDayIndex = new Date(year, month - 1, 1).getDay();
    let adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    for (let i = 0; i < adjustedFirstDay; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day empty";
        grid.appendChild(emptyCell);
    }

    const sysDate = new Date();
    const sysMonthStr = `${sysDate.getFullYear()}-${String(sysDate.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = (sysMonthStr === state.currentMonth);
    const todayDay = sysDate.getDate();

    for (let d = 1; d <= daysInMonth; d++) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day";
        if (isCurrentMonth && d === todayDay) {
            dayCell.className += " today";
        }

        const dayNumSpan = document.createElement("span");
        dayNumSpan.className = "calendar-day-num";
        dayNumSpan.textContent = d;
        dayCell.appendChild(dayNumSpan);

        const currentMonthNumber = String(month).padStart(2, "0");
        const currentM = month;

        const dayExpenses = state.fixedExpenses.filter(fe => {
            const periodicity = fe.periodicity || "Mensual";
            const refM = parseInt(fe.chargeMonth || "01");

            let appliesThisMonth = false;
            if (periodicity === "Mensual") {
                appliesThisMonth = true;
            } else if (periodicity === "Trimestral") {
                appliesThisMonth = (Math.abs(currentM - refM) % 3 === 0);
            } else if (periodicity === "Semestral") {
                appliesThisMonth = (Math.abs(currentM - refM) % 6 === 0);
            } else if (periodicity === "Anual") {
                appliesThisMonth = (fe.chargeMonth === currentMonthNumber);
            }

            if (!appliesThisMonth) return false;

            const maxDays = new Date(year, month, 0).getDate();
            const targetDay = Math.min(fe.day || 1, maxDays);
            return targetDay === d;
        });

        if (dayExpenses.length > 0) {
            const eventsContainer = document.createElement("div");
            eventsContainer.className = "calendar-day-events";

            const tooltipEl = document.createElement("div");
            tooltipEl.className = "calendar-day-tooltip";
            tooltipEl.innerHTML = `<div class="tooltip-title">Día ${d} - Gastos recurrentes</div>`;

            dayExpenses.forEach(fe => {
                const alreadyApplied = state.transactions.some(tx => 
                    tx.type === "expense" &&
                    tx.subtype === "Fixed" &&
                    tx.description === fe.name &&
                    tx.bankId === fe.bankId &&
                    tx.month === state.currentMonth
                );

                const dot = document.createElement("div");
                dot.className = `calendar-event-dot ${alreadyApplied ? 'applied' : 'pending'}`;
                dot.title = `${fe.name}: ${formatCurrency(fe.amount)}`;
                eventsContainer.appendChild(dot);

                const bank = state.banks.find(b => b.id === fe.bankId);
                const bankName = bank ? bank.name.split(' ')[0] : "Desconocido";

                const tooltipItem = document.createElement("div");
                tooltipItem.className = "tooltip-event-item";
                tooltipItem.innerHTML = `
                    <span style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:110px;">${fe.name}</span>
                    <span style="color:${alreadyApplied ? 'var(--success-light)' : 'var(--warning-light)'}">${formatCurrency(fe.amount)} (${bankName})</span>
                `;
                tooltipEl.appendChild(tooltipItem);
            });

            dayCell.appendChild(eventsContainer);
            dayCell.appendChild(tooltipEl);
        }

        grid.appendChild(dayCell);
    }
}

function renderSavingGoals() {
    const container = document.getElementById("saving-goals-list-container");
    if (!container) return;

    if (!state.savingGoals || state.savingGoals.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 10px; font-size: 0.8rem;">No tienes metas de ahorro activas.</div>`;
        return;
    }

    let html = "";
    state.savingGoals.forEach(goal => {
        const bank = state.banks.find(b => b.id === goal.bankId);
        const currentVal = bank ? bank.balance : 0;
        const targetVal = goal.targetAmount;
        const percent = Math.min(100, Math.max(0, (currentVal / targetVal) * 100));
        const isCompleted = percent >= 100;

        const deadlineDate = new Date(goal.deadline);
        const formattedDeadline = deadlineDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });

        html += `
            <div class="goal-item-card">
                <div class="goal-card-header">
                    <h3>${escapeHtml(goal.name)}</h3>
                    <button onclick="deleteSavingGoal('${goal.id}')" class="btn-delete-goal" title="Eliminar Meta">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div class="goal-progress-container">
                    <div class="goal-progress-bar-bg">
                        <div class="goal-progress-bar-fill ${isCompleted ? 'completed' : ''}" style="width: ${percent.toFixed(1)}%;"></div>
                    </div>
                    <div class="goal-progress-text">
                        <span>${formatCurrency(currentVal)} / ${formatCurrency(targetVal)}</span>
                        <span>${percent.toFixed(0)}%</span>
                    </div>
                </div>
                <div class="goal-meta">
                    <span>Cuenta: ${bank ? escapeHtml(bank.name) : 'Desconocida'}</span>
                    <span>Límite: ${formattedDeadline}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function initShortcutsHelpModal() {
    const btnHelp = document.getElementById("btn-keyboard-help");
    const modalHelp = document.getElementById("modal-shortcuts");
    const btnClose = document.getElementById("btn-close-shortcuts");
    const btnCloseOk = document.getElementById("btn-close-shortcuts-ok");

    if (btnHelp && modalHelp) {
        btnHelp.addEventListener("click", () => {
            modalHelp.classList.remove("hidden");
        });
    }

    [btnClose, btnCloseOk].forEach(btn => {
        if (btn && modalHelp) {
            btn.addEventListener("click", () => {
                modalHelp.classList.add("hidden");
            });
        }
    });
}

// ====================================================
// MÓDULO DE UTILIDADES Y CALCULADORAS
// ====================================================

let calcCurrentVal = "0";
let calcPrevVal = null;
let calcOp = null;
let calcResetOnNext = false;
let calcHistory = [];

try {
    const savedHistory = localStorage.getItem("mihucha_calc_history");
    if (savedHistory) calcHistory = JSON.parse(savedHistory);
} catch (e) {
    calcHistory = [];
}

function initUtilities() {
    initIRPFCalculator();
    initStandardCalculator();
    initCurrencyConverter();
    initProfitCalculator();
    initFiniquitoCalculator();
}

function initIRPFCalculator() {
    const grossInput = document.getElementById("calc-gross-salary");
    const grossSlider = document.getElementById("calc-gross-slider");
    const paySelect = document.getElementById("calc-payments-num");
    const famSelect = document.getElementById("calc-family-situation");

    if (grossInput) {
        grossInput.addEventListener("input", () => {
            if (grossSlider) grossSlider.value = grossInput.value;
            calculateSalaryIRPF();
        });
    }
    if (grossSlider) {
        grossSlider.addEventListener("input", () => {
            if (grossInput) grossInput.value = grossSlider.value;
            calculateSalaryIRPF();
        });
    }
    if (paySelect) {
        paySelect.addEventListener("change", calculateSalaryIRPF);
    }
    if (famSelect) {
        famSelect.addEventListener("change", calculateSalaryIRPF);
    }

    calculateSalaryIRPF();
}

function setSalaryPreset(amount) {
    const grossInput = document.getElementById("calc-gross-salary");
    const grossSlider = document.getElementById("calc-gross-slider");
    if (grossInput) grossInput.value = amount;
    if (grossSlider) grossSlider.value = amount;
    calculateSalaryIRPF();
}

function calculateSalaryIRPF() {
    const grossInput = document.getElementById("calc-gross-salary");
    const paySelect = document.getElementById("calc-payments-num");
    const famSelect = document.getElementById("calc-family-situation");

    if (!grossInput) return;

    const gross = Math.max(0, parseFloat(grossInput.value) || 0);
    const payments = parseInt(paySelect?.value || "12");
    const fam = famSelect?.value || "single";

    // 1. Cotización a la Seguridad Social (Régimen General trabajador: 6.35% con tope de base máxima 56.600€)
    const ssMaxBase = 56600;
    const ssTaxableBase = Math.min(gross, ssMaxBase);
    const ssRate = 0.0635;
    const ssAmount = ssTaxableBase * ssRate;

    // 2. Mínimo personal y familiar (España)
    let personalMin = 5550; // Base general
    if (fam === "kids1") personalMin += 2400;
    else if (fam === "kids2") personalMin += 2400 + 2700;
    else if (fam === "dependent") personalMin += 1150;

    // Gastos deducibles generales
    const generalDeduction = 2000;

    // Reducción por rendimientos del trabajo para rentas bajas (SMI y tramos de protección)
    let lowIncomeReduction = 0;
    if (gross <= 14049) {
        lowIncomeReduction = 6498;
    } else if (gross < 19747.5) {
        lowIncomeReduction = Math.max(0, 6498 - 1.14 * (gross - 14049));
    }

    // Base liquidable
    const taxableBase = Math.max(0, gross - ssAmount - generalDeduction - lowIncomeReduction);

    // 3. Tramos de IRPF (Escala combinada Estatal + Autonómica media)
    function calcTaxOnAmount(amount) {
        let tax = 0;
        const brackets = [
            { limit: 12450, rate: 0.19 },
            { limit: 20200, rate: 0.24 },
            { limit: 35200, rate: 0.30 },
            { limit: 60000, rate: 0.37 },
            { limit: 300000, rate: 0.45 },
            { limit: Infinity, rate: 0.47 }
        ];

        let prevLimit = 0;
        for (const b of brackets) {
            if (amount > prevLimit) {
                const chunk = Math.min(amount, b.limit) - prevLimit;
                tax += chunk * b.rate;
                prevLimit = b.limit;
            } else {
                break;
            }
        }
        return tax;
    }

    const taxOnBase = calcTaxOnAmount(taxableBase);
    const taxOnMin = calcTaxOnAmount(personalMin);
    let irpfAmount = Math.max(0, taxOnBase - taxOnMin);

    // Si no llega al límite exento de IRPF (15.876€ para soltero sin hijos)
    if (gross <= 15876 && fam === "single") {
        irpfAmount = 0;
    }

    const netAnnual = Math.max(0, gross - ssAmount - irpfAmount);
    const netMonthly = netAnnual / payments;
    const irpfPct = gross > 0 ? (irpfAmount / gross) * 100 : 0;

    // Tramo marginal
    let marginalBracketText = "0% (Exento)";
    if (gross > 300000) marginalBracketText = "47% (> 300.000€)";
    else if (gross > 60000) marginalBracketText = "45% (60.000€ a 300.000€)";
    else if (gross > 35200) marginalBracketText = "37% (35.200€ a 60.000€)";
    else if (gross > 20200) marginalBracketText = "30% (20.200€ a 35.200€)";
    else if (gross > 12450) marginalBracketText = "24% (12.450€ a 20.200€)";
    else if (gross > 0) marginalBracketText = "19% (Hasta 12.450€)";

    // Tipo IRPF recomendado y consejo
    const recommendedRate = irpfPct;
    let twoPayersRate = recommendedRate + (recommendedRate > 0 ? Math.min(2.5, Math.max(1.2, recommendedRate * 0.12)) : 0);
    if (twoPayersRate > 47) twoPayersRate = 47;

    let adviceText = "";
    if (recommendedRate === 0) {
        adviceText = `Tu salario de <strong>${formatCurrency(gross)}</strong> está por debajo o en el umbral mínimo exento. Tu retención recomendada es del <strong>0.0%</strong>.`;
    } else if (recommendedRate < 10) {
        adviceText = `Para tu salario de <strong>${formatCurrency(gross)}</strong>, el tipo recomendado es del <strong>${recommendedRate.toFixed(1)}%</strong>. Al ser una retención moderada, si tienes dos pagadores te aconsejamos subirla al <strong>${twoPayersRate.toFixed(1)}%</strong>.`;
    } else {
        adviceText = `Para evitar tener que pagar en tu Declaración de la Renta anual, asegúrate de que tu nómina aplique al menos el <strong>${recommendedRate.toFixed(1)}%</strong> de retención.`;
    }

    updateIRPFUI(gross, netAnnual, netMonthly, irpfAmount, irpfPct, ssAmount, payments, marginalBracketText, recommendedRate, twoPayersRate, adviceText);
}

function updateIRPFUI(gross, netAnnual, netMonthly, irpfAmount, irpfPct, ssAmount, payments, marginalBracketText, recommendedRate, twoPayersRate, adviceText) {
    const grossDisplayTag = document.getElementById("gross-salary-display-tag");
    const resMonthly = document.getElementById("res-monthly-net");
    const resAnnual = document.getElementById("res-annual-net");
    const resPaymentsLabel = document.getElementById("res-payments-label");
    const resIrpfPctBadge = document.getElementById("res-irpf-pct-badge");
    const resIrpfAmount = document.getElementById("res-irpf-amount");
    const resIrpfMonthly = document.getElementById("res-irpf-monthly");
    const resSsAmount = document.getElementById("res-ss-amount");
    const resSsMonthly = document.getElementById("res-ss-monthly");
    const resMarginal = document.getElementById("res-marginal-bracket");

    // Recomendación
    const recRateDisplay = document.getElementById("rec-irpf-rate-display");
    const recAdviceText = document.getElementById("rec-irpf-advice-text");
    const recMinLegal = document.getElementById("rec-min-legal");
    const recTwoPayers = document.getElementById("rec-twopayers-rate");

    // Barra
    const barNet = document.getElementById("bar-net");
    const barIrpf = document.getElementById("bar-irpf");
    const barSs = document.getElementById("bar-ss");
    const barNetLabel = document.getElementById("bar-net-label");
    const barIrpfLabel = document.getElementById("bar-irpf-label");
    const barSsLabel = document.getElementById("bar-ss-label");

    if (grossDisplayTag) grossDisplayTag.textContent = formatCurrency(gross);
    if (resMonthly) resMonthly.textContent = formatCurrency(netMonthly);
    if (resAnnual) resAnnual.textContent = formatCurrency(netAnnual);
    if (resPaymentsLabel) resPaymentsLabel.textContent = `${payments} pagas`;

    if (resIrpfPctBadge) resIrpfPctBadge.textContent = (irpfPct || 0).toFixed(1) + "%";
    if (resIrpfAmount) resIrpfAmount.textContent = "-" + formatCurrency(irpfAmount || 0);
    if (resIrpfMonthly) resIrpfMonthly.textContent = `-${formatCurrency((irpfAmount || 0) / payments)} / mes`;

    if (resSsAmount) resSsAmount.textContent = "-" + formatCurrency(ssAmount || 0);
    if (resSsMonthly) resSsMonthly.textContent = `-${formatCurrency((ssAmount || 0) / payments)} / mes`;

    if (resMarginal && marginalBracketText) resMarginal.textContent = marginalBracketText;

    if (recRateDisplay && recommendedRate !== undefined) recRateDisplay.textContent = recommendedRate.toFixed(1) + "%";
    if (recAdviceText && adviceText) recAdviceText.innerHTML = adviceText;
    if (recMinLegal && recommendedRate !== undefined) recMinLegal.textContent = recommendedRate.toFixed(1) + "%";
    if (recTwoPayers && twoPayersRate !== undefined) recTwoPayers.textContent = `${twoPayersRate.toFixed(1)}% (+${(twoPayersRate - recommendedRate).toFixed(1)}%)`;

    if (barNet && barIrpf && barSs) {
        if (gross > 0) {
            const netPct = (netAnnual / gross) * 100;
            const taxPct = (irpfAmount / gross) * 100;
            const ssPct = (ssAmount / gross) * 100;

            barNet.style.width = netPct.toFixed(1) + "%";
            barIrpf.style.width = taxPct.toFixed(1) + "%";
            barSs.style.width = ssPct.toFixed(1) + "%";

            if (barNetLabel) barNetLabel.textContent = netPct.toFixed(1) + "%";
            if (barIrpfLabel) barIrpfLabel.textContent = taxPct.toFixed(1) + "%";
            if (barSsLabel) barSsLabel.textContent = ssPct.toFixed(1) + "%";
        } else {
            barNet.style.width = "0%";
            barIrpf.style.width = "0%";
            barSs.style.width = "0%";
        }
    }
}

function initStandardCalculator() {
    updateCalcDisplay();
    renderCalcHistory();
    initCalcKeyboard();
}

function updateCalcDisplay() {
    const curEl = document.getElementById("calc-current");
    const histEl = document.getElementById("calc-history");
    if (curEl) curEl.textContent = calcCurrentVal;
    if (histEl) {
        if (calcPrevVal !== null && calcOp) {
            histEl.textContent = `${calcPrevVal} ${calcOp}`;
        } else {
            histEl.textContent = "";
        }
    }
}

function calcAction(action, val) {
    if (action === "num") {
        if (calcCurrentVal === "0" || calcResetOnNext) {
            calcCurrentVal = val;
            calcResetOnNext = false;
        } else {
            if (calcCurrentVal.length < 14) {
                calcCurrentVal += val;
            }
        }
    } else if (action === "dot") {
        if (calcResetOnNext) {
            calcCurrentVal = "0.";
            calcResetOnNext = false;
        } else if (!calcCurrentVal.includes(".")) {
            calcCurrentVal += ".";
        }
    } else if (action === "sign") {
        if (calcCurrentVal !== "0") {
            if (calcCurrentVal.startsWith("-")) {
                calcCurrentVal = calcCurrentVal.substring(1);
            } else {
                calcCurrentVal = "-" + calcCurrentVal;
            }
        }
    } else if (action === "percent") {
        const num = parseFloat(calcCurrentVal);
        if (!isNaN(num)) {
            const res = num / 100;
            addCalcHistoryItem(`${num}%`, res);
            calcCurrentVal = String(res);
            calcResetOnNext = true;
        }
    } else if (action === "sqrt") {
        const num = parseFloat(calcCurrentVal);
        if (!isNaN(num)) {
            if (num < 0) {
                calcCurrentVal = "Error";
                calcResetOnNext = true;
            } else {
                const res = Math.round(Math.sqrt(num) * 100000000) / 100000000;
                addCalcHistoryItem(`√(${num})`, res);
                calcCurrentVal = String(res);
                calcResetOnNext = true;
            }
        }
    } else if (action === "clear") {
        calcCurrentVal = "0";
        calcPrevVal = null;
        calcOp = null;
        calcResetOnNext = false;
    } else if (action === "backspace") {
        if (calcCurrentVal.length > 1 && calcCurrentVal !== "Error") {
            calcCurrentVal = calcCurrentVal.slice(0, -1);
        } else {
            calcCurrentVal = "0";
        }
    } else if (action === "operator") {
        if (calcPrevVal !== null && calcOp && !calcResetOnNext) {
            calcCompute();
        }
        calcPrevVal = calcCurrentVal;
        calcOp = val;
        calcResetOnNext = true;
    } else if (action === "equals") {
        if (calcPrevVal !== null && calcOp) {
            const prev = calcPrevVal;
            const op = calcOp;
            const curr = calcCurrentVal;
            calcCompute();
            addCalcHistoryItem(`${prev} ${op === '*' ? '×' : op === '/' ? '÷' : op} ${curr}`, calcCurrentVal);
            calcPrevVal = null;
            calcOp = null;
            calcResetOnNext = true;
        }
    }
    updateCalcDisplay();
}

function calcCompute() {
    const prev = parseFloat(calcPrevVal);
    const curr = parseFloat(calcCurrentVal);
    if (isNaN(prev) || isNaN(curr)) return;

    let res = 0;
    if (calcOp === "+") res = prev + curr;
    else if (calcOp === "-") res = prev - curr;
    else if (calcOp === "*") res = prev * curr;
    else if (calcOp === "/") {
        if (curr === 0) {
            calcCurrentVal = "Error";
            calcResetOnNext = true;
            return;
        }
        res = prev / curr;
    }

    // Redondear para evitar errores flotantes
    res = Math.round(res * 100000000) / 100000000;
    calcCurrentVal = String(res);
}

function calcQuickTax(pct) {
    const num = parseFloat(calcCurrentVal);
    if (isNaN(num)) return;

    let res = 0;
    let label = "";
    if (pct === 21) {
        res = Math.round((num * 1.21) * 100) / 100;
        label = `${num} + 21% IVA`;
    } else if (pct === -21) {
        res = Math.round((num / 1.21) * 100) / 100;
        label = `${num} sin 21% IVA`;
    } else if (pct === 10) {
        res = Math.round((num * 1.10) * 100) / 100;
        label = `${num} + 10%`;
    }

    addCalcHistoryItem(label, res);
    calcCurrentVal = String(res);
    calcResetOnNext = true;
    updateCalcDisplay();
}

function addCalcHistoryItem(expr, result) {
    if (!expr || result === undefined || result === "Error") return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    calcHistory.unshift({
        expr: expr,
        result: String(result),
        time: timeStr
    });
    if (calcHistory.length > 30) {
        calcHistory = calcHistory.slice(0, 30);
    }
    saveCalcHistory();
    renderCalcHistory();
}

function saveCalcHistory() {
    try {
        localStorage.setItem("mihucha_calc_history", JSON.stringify(calcHistory));
    } catch (e) {}
}

function renderCalcHistory() {
    const listEl = document.getElementById("calc-history-list");
    if (!listEl) return;

    if (!calcHistory || calcHistory.length === 0) {
        listEl.innerHTML = `
            <div class="calc-history-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>No hay operaciones recientes</span>
                <span style="font-size: 0.72rem; opacity: 0.7;">Realiza cálculos con los botones o con tu teclado físico</span>
            </div>
        `;
        return;
    }

    listEl.innerHTML = calcHistory.map((item) => `
        <div class="calc-history-item" onclick="restoreHistoryResult('${item.result}')" title="Haz clic para cargar este resultado">
            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis;">
                <div class="calc-history-expr">${item.expr} =</div>
                <div class="calc-history-result">${item.result}</div>
            </div>
            <div class="calc-history-meta">
                <span>${item.time}</span>
                <span style="color: var(--primary-light); font-size: 0.65rem; margin-top: 2px;">Usar ↗</span>
            </div>
        </div>
    `).join("");
}

function clearCalcHistory() {
    calcHistory = [];
    saveCalcHistory();
    renderCalcHistory();
    showToast("Historial de la calculadora borrado", "info");
}

function restoreHistoryResult(res) {
    calcCurrentVal = String(res);
    calcResetOnNext = true;
    updateCalcDisplay();
    showToast(`Cargado: ${res}`, "info");
}

let calcKeyboardInitialized = false;
function initCalcKeyboard() {
    if (calcKeyboardInitialized) return;
    calcKeyboardInitialized = true;

    document.addEventListener("keydown", (e) => {
        const calcView = document.getElementById("utility-view-calc");
        if (!calcView || calcView.classList.contains("hidden")) return;

        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

        let keyToHighlight = null;

        if (e.key >= "0" && e.key <= "9") {
            calcAction("num", e.key);
            keyToHighlight = e.key;
        } else if (e.key === "." || e.key === ",") {
            calcAction("dot");
            keyToHighlight = ".";
        } else if (e.key === "+") {
            calcAction("operator", "+");
            keyToHighlight = "+";
        } else if (e.key === "-") {
            calcAction("operator", "-");
            keyToHighlight = "-";
        } else if (e.key === "*" || e.key === "x" || e.key === "X") {
            calcAction("operator", "*");
            keyToHighlight = "*";
        } else if (e.key === "/") {
            e.preventDefault();
            calcAction("operator", "/");
            keyToHighlight = "/";
        } else if (e.key === "%") {
            calcAction("percent");
            keyToHighlight = "%";
        } else if (e.key === "Enter" || e.key === "=") {
            e.preventDefault();
            calcAction("equals");
            keyToHighlight = "Enter";
        } else if (e.key === "Backspace") {
            e.preventDefault();
            calcAction("backspace");
            keyToHighlight = "Backspace";
        } else if (e.key === "Escape" || e.key === "Delete" || e.key.toLowerCase() === "c") {
            calcAction("clear");
            keyToHighlight = "Escape";
        }

        if (keyToHighlight) {
            const btn = document.querySelector(`button[data-calc-key="${keyToHighlight}"]`);
            if (btn) {
                btn.classList.add("btn-key-pressed");
                setTimeout(() => btn.classList.remove("btn-key-pressed"), 120);
            }
        }
    });
}

function copyCalcResult() {
    if (navigator.clipboard && calcCurrentVal) {
        navigator.clipboard.writeText(calcCurrentVal).then(() => {
            showToast(`Resultado copiado: ${calcCurrentVal}`, "success");
        }).catch(() => {
            showToast("No se pudo copiar el resultado.", "danger");
        });
    }
}

// ====================================================
// CONVERSOR DE DIVISAS EN TIEMPO REAL
// ====================================================

const CURRENCY_CATALOG = {
    EUR: { name: "Euro", flag: "🇪🇺", symbol: "€" },
    USD: { name: "Dólar estadounidense", flag: "🇺🇸", symbol: "$" },
    GBP: { name: "Libra esterlina", flag: "🇬🇧", symbol: "£" },
    JPY: { name: "Yen japonés", flag: "🇯🇵", symbol: "¥" },
    CHF: { name: "Franco suizo", flag: "🇨🇭", symbol: "CHF" },
    CAD: { name: "Dólar canadiense", flag: "🇨🇦", symbol: "CA$" },
    AUD: { name: "Dólar australiano", flag: "🇦🇺", symbol: "AU$" },
    MXN: { name: "Peso mexicano", flag: "🇲🇽", symbol: "MX$" },
    CNY: { name: "Yuan chino", flag: "🇨🇳", symbol: "¥" },
    BRL: { name: "Real brasileño", flag: "🇧🇷", symbol: "R$" },
    INR: { name: "Rupia india", flag: "🇮🇳", symbol: "₹" },
    COP: { name: "Peso colombiano", flag: "🇨🇴", symbol: "COL$" },
    ARS: { name: "Peso argentino", flag: "🇦🇷", symbol: "AR$" },
    CLP: { name: "Peso chileno", flag: "🇨🇱", symbol: "CLP$" },
    SEK: { name: "Corona sueca", flag: "🇸🇪", symbol: "kr" },
    NOK: { name: "Corona noruega", flag: "🇳🇴", symbol: "kr" },
    DKK: { name: "Corona danesa", flag: "🇩🇰", symbol: "kr" },
    PLN: { name: "Zloty polaco", flag: "🇵🇱", symbol: "zł" },
    TRY: { name: "Lira turca", flag: "🇹🇷", symbol: "₺" },
    NZD: { name: "Dólar neozelandés", flag: "🇳🇿", symbol: "NZ$" },
    SGD: { name: "Dólar de Singapur", flag: "🇸🇬", symbol: "S$" },
    HKD: { name: "Dólar de Hong Kong", flag: "🇭🇰", symbol: "HK$" },
    CZK: { name: "Corona checa", flag: "🇨🇿", symbol: "Kč" },
    ILS: { name: "Shekel israelí", flag: "🇮🇱", symbol: "₪" },
    KRW: { name: "Won surcoreano", flag: "🇰🇷", symbol: "₩" },
    ZAR: { name: "Rand sudafricano", flag: "🇿🇦", symbol: "R" },
    AED: { name: "Dírham emiratí", flag: "🇦🇪", symbol: "AED" },
    SAR: { name: "Riyal saudí", flag: "🇸🇦", symbol: "SAR" }
};

// Cotizaciones de respaldo offline (Base EUR)
const DEFAULT_FOREX_RATES = {
    EUR: 1,
    USD: 1.0875,
    GBP: 0.8545,
    JPY: 162.80,
    CHF: 0.9620,
    CAD: 1.4780,
    AUD: 1.6540,
    MXN: 18.4500,
    CNY: 7.8450,
    BRL: 5.9200,
    INR: 90.6500,
    COP: 4320.00,
    ARS: 1045.00,
    CLP: 1015.00,
    SEK: 11.3500,
    NOK: 11.6000,
    DKK: 7.4580,
    PLN: 4.2950,
    TRY: 35.8000,
    NZD: 1.7850,
    SGD: 1.4580,
    HKD: 8.4900,
    CZK: 25.2500,
    ILS: 4.0200,
    KRW: 1485.00,
    ZAR: 19.8500,
    AED: 3.9900,
    SAR: 4.0800
};

let currentForexRates = { ...DEFAULT_FOREX_RATES };
let forexLastUpdatedTime = null;
let lastConvertedResultText = "";

function initCurrencyConverter() {
    populateCurrencySelects();
    
    // Cargar caché local de divisas
    try {
        const cachedRates = localStorage.getItem("mihucha_forex_rates");
        const cachedTime = localStorage.getItem("mihucha_forex_time");
        if (cachedRates) {
            currentForexRates = { ...DEFAULT_FOREX_RATES, ...JSON.parse(cachedRates) };
            if (cachedTime) forexLastUpdatedTime = cachedTime;
        }
    } catch (e) {}

    const amountInput = document.getElementById("currency-amount");
    const fromSelect = document.getElementById("currency-from");
    const toSelect = document.getElementById("currency-to");

    if (amountInput) {
        amountInput.addEventListener("input", calculateCurrencyConversion);
    }
    if (fromSelect) {
        fromSelect.addEventListener("change", calculateCurrencyConversion);
    }
    if (toSelect) {
        toSelect.addEventListener("change", calculateCurrencyConversion);
    }

    calculateCurrencyConversion();
    
    // Cargar cotizaciones frescas en segundo plano
    refreshCurrencyRates(false);
}

function populateCurrencySelects() {
    const fromSelect = document.getElementById("currency-from");
    const toSelect = document.getElementById("currency-to");
    if (!fromSelect || !toSelect) return;

    const optionsHTML = Object.entries(CURRENCY_CATALOG).map(([code, data]) => {
        return `<option value="${code}">${data.flag} ${code} - ${data.name}</option>`;
    }).join("");

    fromSelect.innerHTML = optionsHTML;
    toSelect.innerHTML = optionsHTML;

    fromSelect.value = "EUR";
    toSelect.value = "USD";
}

async function refreshCurrencyRates(isManual = false) {
    const refreshIcon = document.getElementById("svg-refresh-forex");
    if (refreshIcon) refreshIcon.style.animation = "spin 1s linear infinite";

    try {
        const res = await fetch("https://open.er-api.com/v6/latest/EUR");
        if (!res.ok) throw new Error("Error en respuesta API");
        
        const data = await res.json();
        if (data && data.rates) {
            currentForexRates = { ...DEFAULT_FOREX_RATES, ...data.rates };
            forexLastUpdatedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            try {
                localStorage.setItem("mihucha_forex_rates", JSON.stringify(data.rates));
                localStorage.setItem("mihucha_forex_time", forexLastUpdatedTime);
            } catch (e) {}

            if (isManual) showToast("Tipos de cambio actualizados en tiempo real", "success");
        }
    } catch (err) {
        console.warn("Usando tipos de cambio de respaldo / caché:", err);
        if (!forexLastUpdatedTime) {
            forexLastUpdatedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (isManual) showToast("Cotizaciones actualizadas desde caché", "info");
    } finally {
        if (refreshIcon) refreshIcon.style.animation = "";
        calculateCurrencyConversion();
    }
}

function calculateCurrencyConversion() {
    const amountInput = document.getElementById("currency-amount");
    const fromSelect = document.getElementById("currency-from");
    const toSelect = document.getElementById("currency-to");

    if (!amountInput || !fromSelect || !toSelect) return;

    const amount = Math.max(0, parseFloat(amountInput.value) || 0);
    const fromCode = fromSelect.value || "EUR";
    const toCode = toSelect.value || "USD";

    const rateFrom = currentForexRates[fromCode] || 1;
    const rateTo = currentForexRates[toCode] || 1;

    // Convertir a través de EUR base
    const convertedAmount = (amount / rateFrom) * rateTo;
    const unitRateDirect = rateTo / rateFrom;
    const unitRateInverse = rateFrom / rateTo;

    function formatForexVal(val) {
        if (val >= 1000) return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (val >= 1) return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        return val.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    }

    const fromSummaryEl = document.getElementById("currency-from-summary");
    const resultAmountEl = document.getElementById("currency-result-amount");
    const resultCodeEl = document.getElementById("currency-result-code");
    const rateDirectEl = document.getElementById("currency-rate-direct");
    const rateInverseEl = document.getElementById("currency-rate-inverse");
    const updateTimeEl = document.getElementById("currency-update-time");
    const baseTagEl = document.getElementById("multicurrency-base-tag");

    const fromData = CURRENCY_CATALOG[fromCode] || { flag: "", name: fromCode };
    const toData = CURRENCY_CATALOG[toCode] || { flag: "", name: toCode };

    if (fromSummaryEl) {
        fromSummaryEl.textContent = `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${fromCode} (${fromData.name}) =`;
    }

    if (resultAmountEl) {
        resultAmountEl.textContent = formatForexVal(convertedAmount);
    }

    if (resultCodeEl) {
        resultCodeEl.textContent = `${toData.flag} ${toCode}`;
    }

    if (rateDirectEl) {
        rateDirectEl.textContent = `1 ${fromCode} = ${formatForexVal(unitRateDirect)} ${toCode}`;
    }

    if (rateInverseEl) {
        rateInverseEl.textContent = `1 ${toCode} = ${formatForexVal(unitRateInverse)} ${fromCode}`;
    }

    if (updateTimeEl) {
        const timeText = forexLastUpdatedTime || "Hoy en vivo";
        updateTimeEl.innerHTML = `<span class="live-pulse-dot"></span><span>Mercados en vivo • ${timeText}</span>`;
    }

    lastConvertedResultText = `${amount} ${fromCode} = ${formatForexVal(convertedAmount)} ${toCode}`;

    updateForexGauge(fromCode, toCode, unitRateDirect);
    renderMultiCurrencyGrid(amount, fromCode);
}

// Rangos de 52 semanas (1 año) de referencia para pares principales
const FOREX_52W_RANGES = {
    "EUR_USD": { min: 1.0450, max: 1.1200 },
    "USD_EUR": { min: 0.8920, max: 0.9570 },
    "EUR_GBP": { min: 0.8350, max: 0.8750 },
    "GBP_EUR": { min: 1.1420, max: 1.1980 },
    "USD_JPY": { min: 140.20, max: 161.95 },
    "EUR_JPY": { min: 155.00, max: 175.40 },
    "EUR_CHF": { min: 0.9250, max: 0.9950 },
    "CHF_EUR": { min: 1.0050, max: 1.0810 },
    "EUR_MXN": { min: 17.8000, max: 22.1500 },
    "USD_CAD": { min: 1.3400, max: 1.4150 },
    "GBP_USD": { min: 1.2300, max: 1.3400 }
};

function updateForexGauge(fromCode, toCode, unitRate) {
    const titleEl = document.getElementById("forex-range-pair-title");
    const badgeEl = document.getElementById("forex-range-badge");
    const pinEl = document.getElementById("forex-gauge-pin");
    const pinValEl = document.getElementById("forex-gauge-pin-val");
    const minEl = document.getElementById("forex-range-min");
    const maxEl = document.getElementById("forex-range-max");
    const adviceEl = document.getElementById("forex-advice-text");

    if (!titleEl || !badgeEl || !pinEl || !minEl || !maxEl || !adviceEl) return;

    titleEl.textContent = `Rango Anual 52 Semanas (${fromCode} / ${toCode})`;

    const pairKey = `${fromCode}_${toCode}`;
    let minRate, maxRate;

    if (FOREX_52W_RANGES[pairKey]) {
        minRate = FOREX_52W_RANGES[pairKey].min;
        maxRate = FOREX_52W_RANGES[pairKey].max;

        if (unitRate < minRate) minRate = unitRate * 0.985;
        if (unitRate > maxRate) maxRate = unitRate * 1.015;
    } else {
        minRate = unitRate * 0.930;
        maxRate = unitRate * 1.070;
    }

    function formatVal(v) {
        if (v >= 1000) return v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        if (v >= 1) return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        return v.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }

    minEl.textContent = `Mín 52s: ${formatVal(minRate)}`;
    maxEl.textContent = `Máx 52s: ${formatVal(maxRate)}`;
    if (pinValEl) pinValEl.textContent = formatVal(unitRate);

    let percentage = 50;
    if (maxRate > minRate) {
        percentage = ((unitRate - minRate) / (maxRate - minRate)) * 100;
    }
    percentage = Math.min(94, Math.max(6, percentage));
    pinEl.style.left = `${percentage.toFixed(1)}%`;

    if (percentage >= 65) {
        badgeEl.className = "forex-range-status-badge status-high";
        badgeEl.textContent = "Zona Alta / Favorable";
        adviceEl.innerHTML = `El <strong>${fromCode}</strong> cotiza cerca de sus máximos anuales de 52 semanas frente al <strong>${toCode}</strong>. Es un momento estadísticamente <strong>favorable para cambiar ${fromCode} por ${toCode}</strong>.`;
    } else if (percentage <= 35) {
        badgeEl.className = "forex-range-status-badge status-low";
        badgeEl.textContent = "Zona Baja / Desfavorable";
        adviceEl.innerHTML = `El <strong>${fromCode}</strong> se sitúa en la parte baja de su rango anual de 52 semanas frente al <strong>${toCode}</strong>. Si tienes flexibilidad, esperar a un repunte podría ofrecerte mejor cambio.`;
    } else {
        badgeEl.className = "forex-range-status-badge status-balanced";
        badgeEl.textContent = "Rango Medio / Estable";
        adviceEl.innerHTML = `El tipo de cambio entre <strong>${fromCode}</strong> y <strong>${toCode}</strong> cotiza en niveles intermedios y equilibrados de su ciclo anual de 52 semanas.`;
    }
}

function renderMultiCurrencyGrid(amount, fromCode) {
    const gridEl = document.getElementById("multicurrency-grid");
    if (!gridEl) return;

    const topCurrencies = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "MXN", "CNY", "BRL"]
        .filter(c => c !== fromCode);

    const rateFrom = currentForexRates[fromCode] || 1;

    gridEl.innerHTML = topCurrencies.map(code => {
        const data = CURRENCY_CATALOG[code] || { flag: "🌐", name: code };
        const rate = currentForexRates[code] || 1;
        const converted = (amount / rateFrom) * rate;
        const unitRate = rate / rateFrom;

        const formatted = converted.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedUnit = unitRate >= 1 
            ? unitRate.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
            : unitRate.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

        return `
            <div class="multicurrency-item" onclick="setCurrencyPair('${fromCode}', '${code}')" title="Haz clic para seleccionar este par">
                <div class="multicurrency-meta">
                    <span class="multicurrency-flag">${data.flag}</span>
                    <div>
                        <div class="multicurrency-name">${data.name}</div>
                        <div class="multicurrency-code">${code}</div>
                    </div>
                </div>
                <div>
                    <div class="multicurrency-amount">${formatted} ${code}</div>
                    <div class="multicurrency-rate">1 ${fromCode} = ${formattedUnit} ${code}</div>
                </div>
            </div>
        `;
    }).join("");
}

function swapCurrencies() {
    const fromSelect = document.getElementById("currency-from");
    const toSelect = document.getElementById("currency-to");
    if (!fromSelect || !toSelect) return;

    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;

    calculateCurrencyConversion();
}

function setCurrencyAmount(amount) {
    const input = document.getElementById("currency-amount");
    if (input) {
        input.value = amount;
        calculateCurrencyConversion();
    }
}

function setCurrencyPair(from, to) {
    const fromSelect = document.getElementById("currency-from");
    const toSelect = document.getElementById("currency-to");
    if (fromSelect && toSelect) {
        fromSelect.value = from;
        toSelect.value = to;
        calculateCurrencyConversion();
    }
}

function copyCurrencyResult() {
    if (navigator.clipboard && lastConvertedResultText) {
        navigator.clipboard.writeText(lastConvertedResultText).then(() => {
            showToast(`Copiado: ${lastConvertedResultText}`, "success");
        }).catch(() => {
            showToast("No se pudo copiar.", "danger");
        });
    }
}

// ====================================================
// CALCULADORA DE MARGEN DE BENEFICIO Y PRECIO DE VENTA
// ====================================================

let marginCurrentMode = "margin"; // "margin" (sobre venta) o "markup" (sobre coste)
let lastMarginResultText = "";

function initProfitCalculator() {
    const costInput = document.getElementById("margin-cost-input");
    const percentInput = document.getElementById("margin-percent-input");
    const percentSlider = document.getElementById("margin-percent-slider");
    
    const shippingInput = document.getElementById("margin-shipping-input");
    const shippingPctInput = document.getElementById("margin-shipping-percent-input");
    
    const packagingInput = document.getElementById("margin-packaging-input");
    const packagingPctInput = document.getElementById("margin-packaging-percent-input");
    
    const otherCostsInput = document.getElementById("margin-other-costs-input");
    const otherPctInput = document.getElementById("margin-other-percent-input");
    
    const vatSelect = document.getElementById("margin-vat-select");

    const allInputs = [
        costInput, percentInput, 
        shippingInput, shippingPctInput, 
        packagingInput, packagingPctInput, 
        otherCostsInput, otherPctInput
    ];

    allInputs.forEach(inp => {
        if (inp) inp.addEventListener("input", calculateProfitMargin);
    });

    if (percentInput) {
        percentInput.addEventListener("input", () => {
            if (percentSlider) percentSlider.value = percentInput.value;
            calculateProfitMargin();
        });
    }
    if (percentSlider) {
        percentSlider.addEventListener("input", () => {
            if (percentInput) percentInput.value = percentSlider.value;
            calculateProfitMargin();
        });
    }
    if (vatSelect) {
        vatSelect.addEventListener("change", calculateProfitMargin);
    }

    calculateProfitMargin();
}

function setMarginCost(cost) {
    const input = document.getElementById("margin-cost-input");
    if (input) {
        input.value = cost;
        calculateProfitMargin();
    }
}

function setMarginPercent(pct) {
    const input = document.getElementById("margin-percent-input");
    const slider = document.getElementById("margin-percent-slider");
    if (input) input.value = pct;
    if (slider) slider.value = pct;
    calculateProfitMargin();
}

function calculateProfitMargin() {
    const costInput = document.getElementById("margin-cost-input");
    const percentInput = document.getElementById("margin-percent-input");
    
    const shippingInput = document.getElementById("margin-shipping-input");
    const shippingPctInput = document.getElementById("margin-shipping-percent-input");
    
    const packagingInput = document.getElementById("margin-packaging-input");
    const packagingPctInput = document.getElementById("margin-packaging-percent-input");
    
    const otherCostsInput = document.getElementById("margin-other-costs-input");
    const otherPctInput = document.getElementById("margin-other-percent-input");
    
    const vatSelect = document.getElementById("margin-vat-select");

    if (!costInput || !percentInput || !vatSelect) return;

    function fmt(num) {
        return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const baseCost = Math.max(0, parseFloat(costInput.value) || 0);
    const prodPct = Math.max(0, parseFloat(percentInput.value) || 0);
    const gainProduct = baseCost * (prodPct / 100);

    const shippingCost = Math.max(0, parseFloat(shippingInput ? shippingInput.value : 0) || 0);
    const shippingPct = Math.max(0, parseFloat(shippingPctInput ? shippingPctInput.value : 0) || 0);
    const gainShipping = shippingCost * (shippingPct / 100);

    const packagingCost = Math.max(0, parseFloat(packagingInput ? packagingInput.value : 0) || 0);
    const packagingPct = Math.max(0, parseFloat(packagingPctInput ? packagingPctInput.value : 0) || 0);
    const gainPackaging = packagingCost * (packagingPct / 100);

    const otherCost = Math.max(0, parseFloat(otherCostsInput ? otherCostsInput.value : 0) || 0);
    const otherPct = Math.max(0, parseFloat(otherPctInput ? otherPctInput.value : 0) || 0);
    const gainOther = otherCost * (otherPct / 100);

    // Actualizar etiquetas individuales de ganancia en el panel de adyacentes
    const shippingGainLbl = document.getElementById("lbl-gain-shipping");
    const packagingGainLbl = document.getElementById("lbl-gain-packaging");
    const otherGainLbl = document.getElementById("lbl-gain-other");

    if (shippingGainLbl) shippingGainLbl.textContent = `+${fmt(gainShipping)} € ganancia (${shippingPct}%)`;
    if (packagingGainLbl) packagingGainLbl.textContent = `+${fmt(gainPackaging)} € ganancia (${packagingPct}%)`;
    if (otherGainLbl) otherGainLbl.textContent = `+${fmt(gainOther)} € ganancia (${otherPct}%)`;

    const extraCostsTotal = shippingCost + packagingCost + otherCost;
    const totalCost = baseCost + extraCostsTotal;
    const totalProfit = gainProduct + gainShipping + gainPackaging + gainOther;
    const avgMarginPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const basePrice = totalCost + totalProfit;
    const vatRate = parseFloat(vatSelect.value) || 0;
    const vatAmount = basePrice * (vatRate / 100);
    const finalPVP = basePrice + vatAmount;

    // Actualizar elementos visuales
    const totalCostBadge = document.getElementById("margin-total-cost-badge");
    const pvpEl = document.getElementById("margin-pvp-amount");
    const baseSubEl = document.getElementById("margin-base-sub");
    const profitEl = document.getElementById("margin-profit-amount");
    const roiEl = document.getElementById("margin-roi-text");

    const costLbl = document.getElementById("lbl-cost-val");
    const extraLbl = document.getElementById("lbl-extra-val");
    const profitLbl = document.getElementById("lbl-profit-val");
    const vatLbl = document.getElementById("lbl-vat-val");

    const barCost = document.getElementById("bar-margin-cost");
    const barExtra = document.getElementById("bar-margin-extra");
    const barProfit = document.getElementById("bar-margin-profit");
    const barVat = document.getElementById("bar-margin-vat");

    if (totalCostBadge) totalCostBadge.textContent = `Coste Total: ${fmt(totalCost)} €`;
    if (pvpEl) pvpEl.textContent = fmt(finalPVP);
    if (baseSubEl) baseSubEl.textContent = `Base sin IVA: ${fmt(basePrice)} € (Coste: ${fmt(totalCost)} €)`;
    if (profitEl) profitEl.textContent = `+${fmt(totalProfit)} €`;
    if (roiEl) roiEl.textContent = `+${fmt(avgMarginPct)}% rentabilidad global`;

    if (costLbl) costLbl.textContent = `${fmt(baseCost)} €`;
    if (extraLbl) extraLbl.textContent = `${fmt(extraCostsTotal)} €`;
    if (profitLbl) profitLbl.textContent = `${fmt(totalProfit)} €`;
    if (vatLbl) vatLbl.textContent = `${fmt(vatAmount)} €`;

    if (finalPVP > 0) {
        const costPct = (baseCost / finalPVP) * 100;
        const extraPct = (extraCostsTotal / finalPVP) * 100;
        const profitPct = (totalProfit / finalPVP) * 100;
        const vatPct = (vatAmount / finalPVP) * 100;

        if (barCost) barCost.style.width = `${costPct.toFixed(1)}%`;
        if (barExtra) barExtra.style.width = `${extraPct.toFixed(1)}%`;
        if (barProfit) barProfit.style.width = `${profitPct.toFixed(1)}%`;
        if (barVat) barVat.style.width = `${vatPct.toFixed(1)}%`;
    }

    lastMarginResultText = `Coste Total: ${fmt(totalCost)} € | PVP Final: ${fmt(finalPVP)} € | Beneficio Total: +${fmt(totalProfit)} € (Prod: +${fmt(gainProduct)}€, Envío: +${fmt(gainShipping)}€, Pack: +${fmt(gainPackaging)}€, Otros: +${fmt(gainOther)}€)`;

    renderMarginScenarios(baseCost, shippingCost, shippingPct, packagingCost, packagingPct, otherCost, otherPct, vatRate, prodPct);
}

function renderMarginScenarios(baseCost, shippingCost, shippingPct, packagingCost, packagingPct, otherCost, otherPct, vatRate, currentProductPct) {
    const gridEl = document.getElementById("margin-scenarios-grid");
    if (!gridEl) return;

    const samplePercentages = [15, 25, 50, 100, 200, 300, 500, 750, 1000];
    const gainExtras = (shippingCost * (shippingPct / 100)) + (packagingCost * (packagingPct / 100)) + (otherCost * (otherPct / 100));
    const totalCost = baseCost + shippingCost + packagingCost + otherCost;

    gridEl.innerHTML = samplePercentages.map(pct => {
        const gainProd = baseCost * (pct / 100);
        const totalGain = gainProd + gainExtras;
        const base = totalCost + totalGain;
        const pvp = base * (1 + (vatRate / 100));
        const isActive = Math.round(currentProductPct) === pct;

        function fmt(n) { return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

        let multiplierLabel = "";
        if (pct === 100) multiplierLabel = " (x2)";
        else if (pct === 200) multiplierLabel = " (x3)";
        else if (pct === 300) multiplierLabel = " (x4)";
        else if (pct === 500) multiplierLabel = " (x6)";
        else if (pct === 1000) multiplierLabel = " (x11)";

        return `
            <div class="margin-scenario-row ${isActive ? 'active' : ''}" onclick="setMarginPercent(${pct})" title="Seleccionar +${pct}% de beneficio en producto">
                <span class="margin-scenario-pct">+${pct}% Prod.${multiplierLabel}</span>
                <div style="text-align: right;">
                    <span class="margin-scenario-pvp">PVP: ${fmt(pvp)} €</span>
                    <span class="margin-scenario-gain" style="display: block;">(Ganas: +${fmt(totalGain)} €)</span>
                </div>
            </div>
        `;
    }).join("");
}

function copyMarginResult() {
    if (navigator.clipboard && lastMarginResultText) {
        navigator.clipboard.writeText(lastMarginResultText).then(() => {
            showToast(`Copiado: ${lastMarginResultText}`, "success");
        }).catch(() => {
            showToast("No se pudo copiar.", "danger");
        });
    }
}

function openUtilityView(utilityType) {
    const catalogView = document.getElementById("utilities-catalog-view");
    const irpfView = document.getElementById("utility-view-irpf");
    const calcView = document.getElementById("utility-view-calc");
    const currencyView = document.getElementById("utility-view-currency");
    const marginView = document.getElementById("utility-view-margin");
    const finiquitoView = document.getElementById("utility-view-finiquito");

    if (catalogView) catalogView.classList.add("hidden");
    if (irpfView) irpfView.classList.add("hidden");
    if (calcView) calcView.classList.add("hidden");
    if (currencyView) currencyView.classList.add("hidden");
    if (marginView) marginView.classList.add("hidden");
    if (finiquitoView) finiquitoView.classList.add("hidden");

    if (utilityType === "irpf" && irpfView) {
        irpfView.classList.remove("hidden");
        calculateSalaryIRPF();
    } else if (utilityType === "calc" && calcView) {
        calcView.classList.remove("hidden");
        updateCalcDisplay();
        renderCalcHistory();
    } else if (utilityType === "currency" && currencyView) {
        currencyView.classList.remove("hidden");
        calculateCurrencyConversion();
    } else if (utilityType === "margin" && marginView) {
        marginView.classList.remove("hidden");
        calculateProfitMargin();
    } else if (utilityType === "finiquito" && finiquitoView) {
        finiquitoView.classList.remove("hidden");
        initFiniquitoDefaults();
        calculateFiniquito();
    }

    const panel = document.getElementById("panel-utilities");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeUtilityView() {
    const catalogView = document.getElementById("utilities-catalog-view");
    const irpfView = document.getElementById("utility-view-irpf");
    const calcView = document.getElementById("utility-view-calc");
    const currencyView = document.getElementById("utility-view-currency");
    const marginView = document.getElementById("utility-view-margin");
    const finiquitoView = document.getElementById("utility-view-finiquito");

    if (irpfView) irpfView.classList.add("hidden");
    if (calcView) calcView.classList.add("hidden");
    if (currencyView) currencyView.classList.add("hidden");
    if (marginView) marginView.classList.add("hidden");
    if (finiquitoView) finiquitoView.classList.add("hidden");
    if (catalogView) catalogView.classList.remove("hidden");
}


// ====================================================
// CALCULADORA DE FINIQUITO E INDEMNIZACIÓN (ESPAÑA)
// ====================================================
let finiquitoSalaryPeriod = 'monthly'; // 'monthly' | 'annual'


function initFiniquitoCalculator() {
    const salaryInput = document.getElementById("finiquito-salary-input");
    if (!salaryInput) return;
    initFiniquitoDefaults();
    calculateFiniquito();
}

function initFiniquitoDefaults() {
    const startInput = document.getElementById("finiquito-start-date");
    const endInput = document.getElementById("finiquito-end-date");
    
    if (endInput && !endInput.value) {
        const today = new Date();
        endInput.value = today.toISOString().split("T")[0];
    }
    if (startInput && !startInput.value) {
        const today = new Date();
        const threeYearsAgo = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
        startInput.value = threeYearsAgo.toISOString().split("T")[0];
    }
}

function setFiniquitoSalaryPeriod(period) {
    if (finiquitoSalaryPeriod === period) return;
    
    const salaryInput = document.getElementById("finiquito-salary-input");
    const numPagas = parseInt(document.getElementById("finiquito-num-pagas")?.value || "14", 10);
    const btnMonthly = document.getElementById("btn-period-monthly");
    const btnAnnual = document.getElementById("btn-period-annual");
    
    let curVal = parseFloat(salaryInput?.value || "0");
    if (period === "annual" && curVal > 0) {
        salaryInput.value = Math.round(curVal * numPagas);
    } else if (period === "monthly" && curVal > 0) {
        salaryInput.value = Math.round(curVal / numPagas);
    }
    
    finiquitoSalaryPeriod = period;
    if (btnMonthly && btnAnnual) {
        if (period === "monthly") {
            btnMonthly.classList.add("active");
            btnAnnual.classList.remove("active");
        } else {
            btnAnnual.classList.add("active");
            btnMonthly.classList.remove("active");
        }
    }
    
    calculateFiniquito();
}

function setFiniquitoPreset(amount) {
    const salaryInput = document.getElementById("finiquito-salary-input");
    const numPagas = parseInt(document.getElementById("finiquito-num-pagas")?.value || "14", 10);
    if (!salaryInput) return;
    
    if (finiquitoSalaryPeriod === "monthly") {
        salaryInput.value = amount;
    } else {
        salaryInput.value = Math.round(amount * numPagas);
    }
    calculateFiniquito();
}

function computeSeniorityET(dStart, dEnd) {
    if (dEnd < dStart) return { years: 0, months: 0, days: 0, computableMonths: 0, fullMonths: 0 };
    
    // Inclusive: from beginning of dStart to end of dEnd (which is start of dEnd + 1 day)
    const endPlusOne = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate() + 1);
    let cur = new Date(dStart.getTime());
    let fullMonths = 0;
    
    while (true) {
        let next = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
        if (next.getDate() !== cur.getDate()) {
            next = new Date(cur.getFullYear(), cur.getMonth() + 2, 0);
        }
        if (next <= endPlusOne) {
            fullMonths++;
            cur = next;
        } else {
            break;
        }
    }
    
    const diffTime = endPlusOne.getTime() - cur.getTime();
    const remainingDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    // En derecho laboral español, cualquier fracción de mes computa como mes completo
    const computableMonths = remainingDays > 0 ? fullMonths + 1 : fullMonths;
    
    return {
        years: Math.floor(fullMonths / 12),
        months: fullMonths % 12,
        days: remainingDays,
        fullMonths,
        computableMonths
    };
}

function calculateFiniquito() {
    const salaryInput = document.getElementById("finiquito-salary-input");
    const numPagasInput = document.getElementById("finiquito-num-pagas");
    const startInput = document.getElementById("finiquito-start-date");
    const endInput = document.getElementById("finiquito-end-date");
    const dismissalTypeInput = document.getElementById("finiquito-dismissal-type");
    const vacationsInput = document.getElementById("finiquito-vacations-taken");
    const hintElem = document.getElementById("finiquito-type-hint");

    if (!salaryInput || !numPagasInput || !startInput || !endInput || !dismissalTypeInput) return;

    const rawSalary = parseFloat(salaryInput.value) || 0;
    const numPagas = parseInt(numPagasInput.value, 10) || 14;
    const startDateStr = startInput.value;
    const endDateStr = endInput.value;
    const dismissalType = dismissalTypeInput.value;
    const vacationsTaken = parseFloat(vacationsInput?.value || "0") || 0;

    // Actualizar texto explicativo del tipo de despido
    if (hintElem) {
        if (dismissalType === "improcedente") {
            hintElem.textContent = "33 días/año (máx. 24 meses / 720 días). Contempla tramo previo a feb-2012 (45 días/año) si procede.";
        } else if (dismissalType === "objetivo") {
            hintElem.textContent = "20 días de salario por año de servicio (máximo 12 mensualidades / 360 días).";
        } else if (dismissalType === "temporal") {
            hintElem.textContent = "12 días de salario por cada año de servicio cumplido.";
        } else if (dismissalType === "voluntaria") {
            hintElem.textContent = "Baja voluntaria: no genera derecho a indemnización por despido, solo liquidación de finiquito.";
        } else if (dismissalType === "disciplinario") {
            hintElem.textContent = "Despido disciplinario procedente: 0 € de indemnización (solo finiquito de salarios y vacaciones).";
        }
    }

    if (!startDateStr || !endDateStr) return;

    const dStart = new Date(startDateStr + "T00:00:00");
    const dEnd = new Date(endDateStr + "T00:00:00");

    if (dEnd < dStart) {
        // Fechas invertidas
        const payoutEl = document.getElementById("finiquito-total-payout");
        if (payoutEl) payoutEl.textContent = "Fecha inválida";
        return;
    }

    // Salario Bruto Anual & Diario
    let grossAnnual = 0;
    let baseMensual = 0;
    if (finiquitoSalaryPeriod === "monthly") {
        grossAnnual = rawSalary * numPagas;
        baseMensual = rawSalary;
    } else {
        grossAnnual = rawSalary;
        baseMensual = rawSalary / numPagas;
    }
    const dailySalary = grossAnnual / 365;

    // 1. Antigüedad y Días de Indemnización
    const sen = computeSeniorityET(dStart, dEnd);
    let daysIndemnity = 0;
    let indemnityCapReached = false;
    const reformDate = new Date("2012-02-12T00:00:00");

    if (dismissalType === "improcedente") {
        if (dStart < reformDate) {
            const dayBeforeReform = new Date("2012-02-11T00:00:00");
            const sen1 = computeSeniorityET(dStart, dayBeforeReform);
            const daysTramo1 = Math.min(1260, sen1.computableMonths * (45 / 12));
            const sen2 = computeSeniorityET(reformDate, dEnd);
            const daysTramo2 = sen2.computableMonths * (33 / 12);

            if (daysTramo1 >= 720) {
                daysIndemnity = Math.min(1260, daysTramo1);
                indemnityCapReached = daysTramo1 >= 1260;
            } else {
                daysIndemnity = Math.min(720, daysTramo1 + daysTramo2);
                indemnityCapReached = (daysTramo1 + daysTramo2) >= 720;
            }
        } else {
            daysIndemnity = Math.min(720, sen.computableMonths * (33 / 12));
            indemnityCapReached = (sen.computableMonths * (33 / 12)) >= 720;
        }
    } else if (dismissalType === "objetivo") {
        daysIndemnity = Math.min(360, sen.computableMonths * (20 / 12));
        indemnityCapReached = (sen.computableMonths * (20 / 12)) >= 360;
    } else if (dismissalType === "temporal") {
        daysIndemnity = sen.computableMonths * (12 / 12);
    } else {
        daysIndemnity = 0;
    }

    const indemnityAmount = daysIndemnity * dailySalary;

    // 2. Finiquito - Salario días trabajados del mes
    const lastDay = dEnd.getDate();
    const daysInMonth = new Date(dEnd.getFullYear(), dEnd.getMonth() + 1, 0).getDate();
    const monthSalary = (lastDay / daysInMonth) * baseMensual;

    // 3. Finiquito - Pagas extraordinarias
    let extrasPending = 0;
    if (numPagas === 14) {
        const extraVal = grossAnnual / 14;
        if (dEnd.getMonth() < 6) {
            // Semestre 1 (1 ene a 30 jun): Paga de verano
            const startSem = new Date(dEnd.getFullYear(), 0, 1);
            const daysElapsed = Math.round((dEnd.getTime() - startSem.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const daysInSem = dEnd.getFullYear() % 4 === 0 ? 182 : 181;
            extrasPending = (daysElapsed / daysInSem) * extraVal;
        } else {
            // Semestre 2 (1 jul a 31 dic): Paga de navidad (la de verano ya se cobró)
            const startSem = new Date(dEnd.getFullYear(), 6, 1);
            const daysElapsed = Math.round((dEnd.getTime() - startSem.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            extrasPending = (daysElapsed / 184) * extraVal;
        }
    }

    // 4. Finiquito - Vacaciones no disfrutadas
    const startOfYear = new Date(dEnd.getFullYear(), 0, 1);
    const effStart = dStart > startOfYear ? dStart : startOfYear;
    const daysWorkedYear = Math.round((dEnd.getTime() - effStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysInYear = dEnd.getFullYear() % 4 === 0 ? 366 : 365;
    const vacAccrued = (daysWorkedYear / daysInYear) * 30;
    const vacPending = Math.max(0, vacAccrued - vacationsTaken);
    const vacAmount = vacPending * dailySalary;

    // Totales
    const finiquitoTotal = monthSalary + extrasPending + vacAmount;
    const grandTotal = indemnityAmount + finiquitoTotal;

    // Renderizar en DOM
    const totalPayoutEl = document.getElementById("finiquito-total-payout");
    const kpiIndemnityEl = document.getElementById("kpi-finiquito-indemnity");
    const kpiDaysEl = document.getElementById("kpi-finiquito-days-label");
    const kpiHaberesEl = document.getElementById("kpi-finiquito-haberes");
    const kpiHaberesSubEl = document.getElementById("kpi-finiquito-haberes-sub");

    if (totalPayoutEl) totalPayoutEl.textContent = formatCurrency(grandTotal);
    if (kpiIndemnityEl) kpiIndemnityEl.textContent = formatCurrency(indemnityAmount);
    if (kpiDaysEl) {
        kpiDaysEl.textContent = `${daysIndemnity.toFixed(2).replace(".", ",")} días indemnizables${indemnityCapReached ? " (tope alcanzado)" : ""}`;
    }
    if (kpiHaberesEl) kpiHaberesEl.textContent = formatCurrency(finiquitoTotal);

    // Tabla de desglose
    const tblDailySalary = document.getElementById("tbl-finiquito-daily-salary");
    const tblSeniorityMonths = document.getElementById("tbl-finiquito-seniority-months");
    const tblSeniorityDesc = document.getElementById("tbl-finiquito-seniority-desc");
    const tblIndemnityCalc = document.getElementById("tbl-finiquito-indemnity-calc");
    const tblIndemnityAmount = document.getElementById("tbl-finiquito-indemnity-amount");
    const tblMonthDaysDesc = document.getElementById("tbl-finiquito-month-days-desc");
    const tblMonthSalary = document.getElementById("tbl-finiquito-month-salary");
    const tblExtrasDesc = document.getElementById("tbl-finiquito-extras-desc");
    const tblExtrasAmount = document.getElementById("tbl-finiquito-extras-amount");
    const tblVacationsDesc = document.getElementById("tbl-finiquito-vacations-desc");
    const tblVacationsAmount = document.getElementById("tbl-finiquito-vacations-amount");
    const tblGrandTotal = document.getElementById("tbl-finiquito-grand-total");

    if (tblDailySalary) tblDailySalary.textContent = `${formatCurrency(dailySalary)}/día`;
    if (tblSeniorityMonths) tblSeniorityMonths.textContent = `${sen.computableMonths} meses`;
    if (tblSeniorityDesc) {
        const parts = [];
        if (sen.years > 0) parts.push(`${sen.years} ${sen.years === 1 ? "año" : "años"}`);
        if (sen.months > 0) parts.push(`${sen.months} ${sen.months === 1 ? "mes" : "meses"}`);
        if (sen.days > 0) parts.push(`${sen.days} ${sen.days === 1 ? "día" : "días"}`);
        tblSeniorityDesc.textContent = parts.length > 0 ? `(${parts.join(", ")})` : "";
    }
    if (tblIndemnityCalc) {
        tblIndemnityCalc.textContent = `(${daysIndemnity.toFixed(1).replace(".", ",")} días)`;
    }
    if (tblIndemnityAmount) tblIndemnityAmount.textContent = formatCurrency(indemnityAmount);
    if (tblMonthDaysDesc) {
        tblMonthDaysDesc.textContent = `(${lastDay} de ${daysInMonth} días)`;
    }
    if (tblMonthSalary) tblMonthSalary.textContent = formatCurrency(monthSalary);
    if (tblExtrasDesc) {
        tblExtrasDesc.textContent = numPagas === 14 
            ? (dEnd.getMonth() < 6 ? "(Paga Verano en curso)" : "(Paga Navidad en curso)")
            : "(Prorrateadas en nómina mensual)";
    }
    if (tblExtrasAmount) tblExtrasAmount.textContent = formatCurrency(extrasPending);
    if (tblVacationsDesc) {
        tblVacationsDesc.textContent = `(${vacPending.toFixed(1).replace(".", ",")} días pendientes)`;
    }
    if (tblVacationsAmount) tblVacationsAmount.textContent = formatCurrency(vacAmount);
    if (tblGrandTotal) tblGrandTotal.textContent = formatCurrency(grandTotal);

    // Guardar último cálculo para copia
    window._lastFiniquitoCalculation = {
        grossAnnual,
        numPagas,
        dailySalary,
        sen,
        dismissalType,
        daysIndemnity,
        indemnityAmount,
        lastDay,
        daysInMonth,
        monthSalary,
        extrasPending,
        vacPending,
        vacAmount,
        finiquitoTotal,
        grandTotal,
        startDateStr,
        endDateStr
    };
}

function copyFiniquitoSummary() {
    const calc = window._lastFiniquitoCalculation;
    if (!calc) {
        showToast("No hay cálculo disponible para copiar.", "warning");
        return;
    }

    const dismissalNames = {
        improcedente: "Despido Improcedente (33 días/año)",
        objetivo: "Despido Objetivo o ERE (20 días/año)",
        temporal: "Fin de Contrato Temporal (12 días/año)",
        voluntaria: "Baja Voluntaria / Dimisión",
        disciplinario: "Despido Disciplinario Procedente"
    };

    const text = [
        "================================================",
        "INFORME DE FINIQUITO E INDEMNIZACIÓN (ESPAÑA)",
        "Generado con Mi Hucha (mihucha.es)",
        "================================================",
        `• Salario Bruto Anual: ${formatCurrency(calc.grossAnnual)} (${calc.numPagas} pagas)`,
        `• Salario Diario: ${formatCurrency(calc.dailySalary)}/día`,
        `• Periodo Laboral: ${calc.startDateStr} al ${calc.endDateStr}`,
        `• Antigüedad Computable: ${calc.sen.computableMonths} meses (${calc.sen.years}a ${calc.sen.months}m ${calc.sen.days}d)`,
        `• Causa de Extinción: ${dismissalNames[calc.dismissalType] || calc.dismissalType}`,
        "------------------------------------------------",
        "DESGLOSE DE LIQUIDACIÓN:",
        `• Indemnización por Despido: ${formatCurrency(calc.indemnityAmount)} (${calc.daysIndemnity.toFixed(2).replace(".", ",")} días - Exenta de IRPF)`,
        `• Salario del mes (${calc.lastDay}/${calc.daysInMonth} días): ${formatCurrency(calc.monthSalary)}`,
        `• Pagas Extraordinarias pendientes: ${formatCurrency(calc.extrasPending)}`,
        `• Vacaciones no disfrutadas (${calc.vacPending.toFixed(1).replace(".", ",")} días): ${formatCurrency(calc.vacAmount)}`,
        `• Total Finiquito Bruto (Haberes): ${formatCurrency(calc.finiquitoTotal)}`,
        "------------------------------------------------",
        `TOTAL A PERCIBIR: ${formatCurrency(calc.grandTotal)}`,
        "================================================",
        "* Indemnización legal exenta de IRPF conforme al art. 7.e Ley del IRPF (límite 180.000 €).",
        "* Cómputo de fracciones de mes como mes completo conforme al art. 56 Estatuto de los Trabajadores."
    ].join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Informe de finiquito copiado al portapapeles.", "success");
        }).catch(() => {
            showToast("Error al copiar al portapapeles.", "danger");
        });
    } else {
        showToast("Portapapeles no disponible en este navegador.", "warning");
    }
}

// Exponer a window para handlers inline de Utilidades y CRUD
window.openProjectFolder = openProjectFolder;
window.openProjectSandbox = openProjectSandbox;
window.deleteProjectInvestment = deleteProjectInvestment;
window.deleteProjectEarning = deleteProjectEarning;
window.deleteBank = deleteBank;
window.openValuationModal = openValuationModal;
window.openEditModal = openEditModal;
window.deleteFixedExpense = deleteFixedExpense;
window.deleteTransaction = deleteTransaction;
window.switchProfile = switchProfile;
window.deleteProfile = deleteProfile;

window.setSalaryPreset = setSalaryPreset;
window.calculateSalaryIRPF = calculateSalaryIRPF;
window.calcAction = calcAction;
window.calcQuickTax = calcQuickTax;
window.copyCalcResult = copyCalcResult;
window.clearCalcHistory = clearCalcHistory;
window.restoreHistoryResult = restoreHistoryResult;
window.openUtilityView = openUtilityView;
window.closeUtilityView = closeUtilityView;
window.swapCurrencies = swapCurrencies;
window.setCurrencyAmount = setCurrencyAmount;
window.setCurrencyPair = setCurrencyPair;
window.refreshCurrencyRates = refreshCurrencyRates;
window.copyCurrencyResult = copyCurrencyResult;
window.setMarginCost = setMarginCost;
window.setMarginPercent = setMarginPercent;
window.calculateProfitMargin = calculateProfitMargin;
window.copyMarginResult = copyMarginResult;
window.exportBackupFile = exportBackupFile;
window.moveSubprojectOrder = moveSubprojectOrder;
window.moveStandaloneProjectOrder = moveStandaloneProjectOrder;
window.moveFolderOrder = moveFolderOrder;
window.checkBackupReminder = checkBackupReminder;
window.escapeHtml = escapeHtml;




window.calculateFiniquito = calculateFiniquito;
window.setFiniquitoSalaryPeriod = setFiniquitoSalaryPeriod;
window.setFiniquitoPreset = setFiniquitoPreset;
window.copyFiniquitoSummary = copyFiniquitoSummary;
window.initFiniquitoDefaults = initFiniquitoDefaults;