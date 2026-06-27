// MOTOR DE FINANZAS PERSONAL: FINANZAS FLEX & SANDBOX PROYECTOS
// Desarrollado con lógica robusta de doble entrada, persistencia y reactividad.

// ----------------------------------------------------
// 1. ESTADO DE LA APLICACIÓN (BASE DE DATOS LOCAL)
// ----------------------------------------------------

let state = {
    banks: [],
    fixedExpenses: [],
    transactions: [],
    budgets: {},
    projects: [],
    activityLog: [],
    currentMonth: "", // Formato "YYYY-MM"
    maskMode: false,
    savingGoals: [],
    closedMonths: [],
    plannedIncomes: {} // { "YYYY-MM": { amount, type, description, distributions: [{bankId, value}], mode } }
};

// Variables globales de sesión y seguridad (declaradas al principio para evitar errores de inicialización por TDZ)
let pendingProfileId = null;
let isLocked = false;
let lastActivityTime = Date.now();
let autoLockInterval = null;

// Configuración inicial de datos semilla (Mock Data) para causar impacto visual al cargar por primera vez
const SEED_DATA = {
    banks: [
        { id: "b_1", name: "BBVA (Nómina)", balance: 2450.00, createdAt: "2026-05-01T10:00:00.000Z" },
        { id: "b_2", name: "Revolut (Gastos)", balance: 345.50, createdAt: "2026-05-01T10:00:00.000Z" },
        { id: "b_3", name: "Banco Santander (Ahorros)", balance: 8000.00, createdAt: "2026-05-01T10:00:00.000Z" }
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
function loadProfiles() {
    const storedProfiles = localStorage.getItem("finanzas_profiles");
    const storedCurrentId = localStorage.getItem("finanzas_current_profile_id");
    
    if (storedProfiles) {
        try {
            profilesState.profiles = JSON.parse(storedProfiles);
            profilesState.currentProfileId = storedCurrentId;
        } catch (e) {
            console.error("Error cargando perfiles:", e);
        }
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
        localStorage.setItem("finanzas_profiles", JSON.stringify(profilesState.profiles));
        localStorage.setItem("finanzas_current_profile_id", defaultProfileId);
        
        // Si hay datos legacy, migrarlos al nuevo perfil
        if (legacyData) {
            localStorage.setItem("finanzas_db_" + defaultProfileId, legacyData);
        }
    }
    
    // Garantizar que currentProfileId sea válido
    const activeExists = profilesState.profiles.some(p => p.id === profilesState.currentProfileId);
    if (!activeExists) {
        profilesState.currentProfileId = profilesState.profiles[0].id;
        localStorage.setItem("finanzas_current_profile_id", profilesState.currentProfileId);
    }
}

// Cargar estado de localStorage o sembrar datos si está vacío
function loadState() {
    // Primero nos aseguramos de que los perfiles estén inicializados
    loadProfiles();
    
    const profileKey = "finanzas_db_" + profilesState.currentProfileId;
    const stored = localStorage.getItem(profileKey);
    
    if (stored) {
        try {
            state = JSON.parse(stored);
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
            // Asegurar que exista el mes actual
            if (!state.currentMonth) {
                state.currentMonth = getSystemCurrentMonth();
            }

        } catch (e) {
            console.error("Error leyendo base de datos corrupta del perfil, reseteando...", e);
            state = JSON.parse(JSON.stringify(SEED_DATA));
            saveState();
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
        
        saveState();
    }
}

// Guardar estado y propagar cambios reactivamente
function saveState() {
    if (!profilesState.currentProfileId) return;
    const profileKey = "finanzas_db_" + profilesState.currentProfileId;
    localStorage.setItem(profileKey, JSON.stringify(state));
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
    // Limitar a los últimos 150 registros para evitar sobrecarga de LocalStorage
    if (state.activityLog.length > 150) {
        state.activityLog = state.activityLog.slice(0, 150);
    }
    
    // Guardar directamente en localStorage sin llamar a saveState recursivamente
    if (profilesState.currentProfileId) {
        const profileKey = "finanzas_db_" + profilesState.currentProfileId;
        localStorage.setItem(profileKey, JSON.stringify(state));
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

            tabs.forEach(t => t.classList.remove("active"));
            panels.forEach(p => {
                p.classList.remove("active");
                p.style.display = "none";
            });

            tab.classList.add("active");
            const activePanel = document.getElementById(targetId);
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
                
                subtitleEl.textContent = viewDesc;
            }
            
            // Si volvemos al listado de proyectos, resetear la vista detallada
            if (targetId === "panel-projects") {
                document.getElementById("project-list-view").classList.remove("hidden");
                document.getElementById("project-details-view").classList.add("hidden");
                currentActiveProjectId = null;
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
            else if (hash === "#projects" || hash === "#tab-projects") targetTab = document.getElementById("tab-projects");
            
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

function initBanksManager() {
    const btnShowAdd = document.getElementById("btn-show-add-bank");
    const formAdd = document.getElementById("form-add-bank");
    const btnCancel = document.getElementById("btn-cancel-add-bank");

    btnShowAdd.addEventListener("click", () => {
        formAdd.classList.toggle("hidden");
    });

    btnCancel.addEventListener("click", () => {
        formAdd.classList.add("hidden");
        formAdd.reset();
    });

    formAdd.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("bank-name").value.trim();
        const initialBalance = parseFloat(document.getElementById("bank-initial-balance").value);
        const bankType = document.getElementById("bank-type").value || "normal";

        if (!name || isNaN(initialBalance)) {
            showToast("Por favor complete los campos correctamente.", "danger");
            return;
        }

        const newBank = {
            id: "b_" + Date.now(),
            name: name,
            balance: initialBalance,
            bankType: bankType,
            estimatedValue: bankType === "pension" ? initialBalance : null,
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
        const bankTypeEl = document.getElementById("bank-type");
        if (bankTypeEl) bankTypeEl.value = "normal";
        document.getElementById("pension-hint").classList.add("hidden");
        
        const typeLabel = bankType === "pension" ? "Plan de Pensiones" : "Banco";
        showToast(`${typeLabel} "${name}" creado con éxito.`, "success");
        saveState();
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
        const isPension = bank.bankType === "pension";
        const labelPrefix = isPension ? "Aportado: " : "Saldo: ";
        // 1. Crear el Input en la lista con vista previa de saldo
        const item = document.createElement("div");
        item.className = "funnel-dist-item";
        item.innerHTML = `
            <div class="funnel-bank-label">
                <div class="funnel-bank-name">${bank.name} ${isPension ? '<span style="font-size: 0.7em;">(Pensión)</span>' : ''}</div>
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

        const isPension = bank.bankType === "pension";
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

        if (!name || isNaN(amount) || amount <= 0 || !bankId || isNaN(day) || day < 1 || day > 31) {
            showToast("Complete todos los campos del gasto fijo correctamente.", "danger");
            return;
        }

        const newFE = {
            id: "fe_" + Date.now(),
            name: name,
            amount: amount,
            bankId: bankId,
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

                    // Crear transacción de gasto fijo aplicado
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

            // Guardar directamente en localStorage
            if (profilesState.currentProfileId) {
                const profileKey = "finanzas_db_" + profilesState.currentProfileId;
                localStorage.setItem(profileKey, JSON.stringify(state));
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

function initProjectsSandbox() {
    const btnShowAdd = document.getElementById("btn-show-add-project");
    const formAdd = document.getElementById("form-add-project");
    const btnCancel = document.getElementById("btn-cancel-add-project");
    const btnBack = document.getElementById("btn-back-to-projects");
    const btnDelete = document.getElementById("btn-delete-project");
    const btnEdit = document.getElementById("btn-edit-project");

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

        if (!desc || isNaN(amount) || amount <= 0) return;

        const proj = state.projects.find(p => p.id === currentActiveProjectId);
        if (proj) {
            proj.investments.push({
                id: "inv_" + Date.now(),
                description: desc,
                amount: amount,
                date: getTodayString()
            });
            formInv.reset();
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

        if (!desc || isNaN(amount) || amount <= 0) return;

        const proj = state.projects.find(p => p.id === currentActiveProjectId);
        if (proj) {
            proj.earnings.push({
                id: "ear_" + Date.now(),
                description: desc,
                amount: amount,
                date: getTodayString()
            });
            formEar.reset();
            showToast("Ganancia registrada en el sandbox del proyecto.", "success");
            saveState();
            renderProjectDetailView(currentActiveProjectId);
        }
    });

    btnShowAdd.addEventListener("click", () => {
        formAdd.classList.toggle("hidden");
    });

    btnCancel.addEventListener("click", () => {
        formAdd.classList.add("hidden");
        formAdd.reset();
    });

    btnBack.addEventListener("click", () => {
        document.getElementById("project-list-view").classList.remove("hidden");
        document.getElementById("project-details-view").classList.add("hidden");
        currentActiveProjectId = null;
    });

    btnDelete.addEventListener("click", () => {
        if (!currentActiveProjectId) return;
        const proj = state.projects.find(p => p.id === currentActiveProjectId);
        if (proj) {
            if (confirm(`¿Desea eliminar definitivamente el proyecto "${proj.name}" y todos sus movimientos aislados?`)) {
                state.projects = state.projects.filter(p => p.id !== currentActiveProjectId);
                document.getElementById("project-list-view").classList.remove("hidden");
                document.getElementById("project-details-view").classList.add("hidden");
                currentActiveProjectId = null;
                showToast("Proyecto eliminado.", "danger");
                saveState();
            }
        }
    });

    formAdd.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("project-name").value.trim();
        const desc = document.getElementById("project-description").value.trim();

        if (!name || !desc) {
            showToast("Complete los datos del proyecto.", "danger");
            return;
        }

        const newProj = {
            id: "p_" + Date.now(),
            name: name,
            description: desc,
            createdAt: getTodayString(),
            investments: [],
            earnings: []
        };

        state.projects.push(newProj);
        formAdd.classList.add("hidden");
        formAdd.reset();

        showToast(`Proyecto "${name}" inicializado correctamente en entorno Sandbox.`, "success");
        saveState();
    });
}

function openProjectSandbox(projectId) {
    currentActiveProjectId = projectId;
    document.getElementById("project-list-view").classList.add("hidden");
    document.getElementById("project-details-view").classList.remove("hidden");
    renderProjectDetailView(projectId);
}

function deleteProjectInvestment(projId, invId) {
    const proj = state.projects.find(p => p.id === projId);
    if (!proj) return;

    proj.investments = proj.investments.filter(i => i.id !== invId);
    saveState();
    renderProjectDetailView(projId);
    showToast("Inversión eliminada del Sandbox.", "danger");
}

function deleteProjectEarning(projId, earId) {
    const proj = state.projects.find(p => p.id === projId);
    if (!proj) return;

    proj.earnings = proj.earnings.filter(e => e.id !== earId);
    saveState();
    renderProjectDetailView(projId);
    showToast("Ganancia eliminada del Sandbox.", "danger");
}

// ----------------------------------------------------
// 12. SISTEMA DE RENDERIZACIÓN REACTIVA (DOM UPDATES)
// ----------------------------------------------------

function renderAll() {
    const isDashboard = !!document.getElementById("panel-dashboard");
    if (!isDashboard) return;
    
    // Actualizar el selector de mes global en la cabecera
    const monthDisplay = document.getElementById("current-month-display");
    if (monthDisplay) {
        monthDisplay.textContent = formatMonthString(state.currentMonth);
    }

    // Actualizar visualizaciones por módulo
    renderGlobalStats();
    renderBanksList();
    renderFunnelInputs();
    renderPlannedIncomeBanner();
    renderExpensesDropdowns();
    renderFixedExpensesTable();
    renderTransactionsTable();
    renderBudgetEstimationsForm();
    renderDeviationAnalysisTable();
    renderProjectsList();
    
    // Validar el estado del embudo por si cambiaron los bancos
    validateFunnel();
    
    // Si hay un proyecto en detalle activo, actualizarlo
    if (currentActiveProjectId) {
        renderProjectDetailView(currentActiveProjectId);
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
}

// MÓDULO 1: ESTADÍSTICAS GLOBALES DEL TABLERO
function renderGlobalStats() {
    // 1. Balance total: para planes de pensión usa el valor estimado (con interés)
    let totalBanks = 0;
    state.banks.forEach(b => {
        if (b.bankType === "pension") {
            totalBanks += (b.estimatedValue ?? b.balance);
        } else {
            totalBanks += b.balance;
        }
    });
    document.getElementById("global-total-balance").textContent = formatCurrency(totalBanks);

    // 2. Ingresos del mes en curso
    const monthlyIncomeTx = state.transactions.filter(tx => tx.type === "income" && tx.month === state.currentMonth);
    let totalIncome = 0;
    monthlyIncomeTx.forEach(tx => totalIncome += tx.amount);
    document.getElementById("global-monthly-income").textContent = formatCurrency(totalIncome);
    document.getElementById("global-monthly-income-details").textContent = `Recibidos en ${formatMonthString(state.currentMonth)}`;

    // 3. Gastos del mes en curso
    const monthlyExpenseTx = state.transactions.filter(tx => tx.type === "expense" && tx.month === state.currentMonth);
    let totalExpense = 0;
    monthlyExpenseTx.forEach(tx => totalExpense += tx.amount);
    document.getElementById("global-monthly-expense").textContent = formatCurrency(totalExpense);
    document.getElementById("global-monthly-expense-details").textContent = `Debites de ${formatMonthString(state.currentMonth)}`;

    // 4. Ahorro Neto del mes
    const netSavings = totalIncome - totalExpense;
    const netEl = document.getElementById("global-monthly-net");
    const netCard = netEl.closest(".stat-card");

    netEl.textContent = formatCurrency(netSavings);
    if (netSavings >= 0) {
        netCard.className = "stat-card card-net savings-plus";
    } else {
        netCard.className = "stat-card card-net savings-minus";
    }
}

// MÓDULO 1: RENDER DE LISTA DE BANCOS
function renderBanksList() {
    const container = document.getElementById("banks-list-container");
    container.innerHTML = "";

    if (state.banks.length === 0) {
        container.innerHTML = `<div class="alert-info">No hay bancos creados. Use el botón superior para añadir uno.</div>`;
        return;
    }

    state.banks.forEach(bank => {
        const isPension = bank.bankType === "pension";

        // ── Card especial para Plan de Pensiones ──
        if (isPension) {
            const estimatedValue = bank.estimatedValue ?? bank.balance;
            const gains = estimatedValue - bank.balance;
            const gainsClass = gains >= 0 ? "pension-gains-pos" : "pension-gains-neg";
            const gainsSign = gains >= 0 ? "+" : "";

            const card = document.createElement("div");
            card.className = "bank-item-card bank-pension-card";
            card.innerHTML = `
                <div class="bank-card-info" style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3>${bank.name}</h3>
                        <span class="badge-pension">🏦 Plan de Pensiones</span>
                    </div>
                    <div class="bank-meta">Creado el ${formatDate(bank.createdAt)}</div>
                    <div class="pension-stats">
                        <div class="pension-stat">
                            <span class="pension-stat-label">Total Aportado</span>
                            <span class="pension-stat-value">${formatCurrency(bank.balance)}</span>
                        </div>
                        <div class="pension-stat-divider"></div>
                        <div class="pension-stat">
                            <span class="pension-stat-label">Valor Estimado (con interés)</span>
                            <span class="pension-stat-value" style="color:var(--primary-light);">${formatCurrency(estimatedValue)}</span>
                        </div>
                        <div class="pension-stat-divider"></div>
                        <div class="pension-stat">
                            <span class="pension-stat-label">Rentabilidad</span>
                            <span class="pension-stat-value ${gainsClass}">${gainsSign}${formatCurrency(gains)}</span>
                        </div>
                    </div>
                </div>
                <div class="bank-card-balance-section" style="gap:8px; flex-direction:column; align-items:flex-end;">
                    <button onclick="openEditModal('bank', '${bank.id}')" class="btn-edit-icon" title="Editar Plan de Pensiones">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="deleteBank('${bank.id}')" class="btn-delete-icon" title="Eliminar Plan de Pensiones">
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

        let overdraftHTML = "";
        if (bank.balance < pendingFixedSum) {
            const neededAmount = pendingFixedSum - bank.balance;
            const tooltipText = `Faltan ${formatCurrency(neededAmount)} para cubrir cobros fijos pendientes este mes:&#10;• ` + pendingExpensesNames.join("&#10;• ");
            overdraftHTML = `
                <div class="alert-overdraft" title="${tooltipText}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>Faltan ${formatCurrency(neededAmount)}</span>
                </div>
            `;
        }

        const card = document.createElement("div");
        card.className = "bank-item-card";
        card.innerHTML = `
            <div class="bank-card-info">
                <h3>${bank.name}</h3>
                <div class="bank-meta">Creado el ${formatDate(bank.createdAt)}</div>
                ${overdraftHTML}
            </div>
            <div class="bank-card-balance-section" style="gap: 8px;">
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

// MÓDULO 2: ACTUALIZAR SELECTORES DE BANCOS EN GASTOS
function renderExpensesDropdowns() {
    const fixedSelect = document.getElementById("fixed-bank-id");
    const varSelect = document.getElementById("var-bank-id");
    const adjSelect = document.getElementById("adj-bank-id");

    fixedSelect.innerHTML = "";
    varSelect.innerHTML = "";
    if (adjSelect) adjSelect.innerHTML = "";

    if (state.banks.length === 0) {
        const opt = `<option value="">-- Cree un banco primero --</option>`;
        fixedSelect.innerHTML = opt;
        varSelect.innerHTML = opt;
        if (adjSelect) adjSelect.innerHTML = opt;
        return;
    }

    state.banks.forEach(bank => {
        // Los planes de pensiones no participan en el sistema de gastos
        if (bank.bankType === "pension") return;
        const option = `<option value="${bank.id}">${bank.name} (Saldo: ${formatCurrency(bank.balance)})</option>`;
        fixedSelect.innerHTML += option;
        varSelect.innerHTML += option;
        if (adjSelect) adjSelect.innerHTML += option;
    });
}

// MÓDULO 2: TABLA DE GASTOS FIJOS (MATRIZ)
function renderFixedExpensesTable() {
    const tbody = document.getElementById("tbody-fixed-expenses");
    tbody.innerHTML = "";

    // Actualizar el estado del botón de aplicación global de fijos
    const btnApply = document.getElementById("btn-execute-fixed-expenses");
    const btnText = document.getElementById("btn-execute-fixed-text");
    
    // Contar cuántos faltan por aplicar
    let pendingToApply = 0;

    if (state.fixedExpenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No hay gastos recurrentes definidos en la matriz.</td></tr>`;
        btnApply.className = "btn-action-apply applied";
        btnText.textContent = "Aplicar Gastos Fijos (0 pendientes)";
        btnApply.setAttribute("disabled", "true");
        return;
    }

    const currentMonthNumber = state.currentMonth.split("-")[1]; // "MM"
    const currentM = parseInt(currentMonthNumber);

    // Ordenar automáticamente por día de operación
    const sortedFixedExpenses = [...state.fixedExpenses].sort((a, b) => (a.day || 1) - (b.day || 1));
    sortedFixedExpenses.forEach(fe => {
        const bank = state.banks.find(b => b.id === fe.bankId);
        const bankName = bank ? bank.name : "Desconocido";

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

        // Comprobar si ya se aplicó este mes
        const isAppliedThisMonth = state.transactions.some(tx => 
            tx.type === "expense" &&
            tx.subtype === "Fixed" &&
            tx.description === fe.name &&
            tx.bankId === fe.bankId &&
            tx.month === state.currentMonth
        );

        if (appliesThisMonth && !isAppliedThisMonth) {
            pendingToApply++;
        }

        const monthsNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthsNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        // Formatear descripción del estado
        let statusText = "";
        if (isAppliedThisMonth) {
            statusText = `<span style="color: var(--success-light); font-weight: 500;">✓ Cobrado este mes</span>`;
        } else if (!appliesThisMonth) {
            if (periodicity === "Anual") {
                const mName = monthsNames[refM - 1] || "Otro";
                statusText = `<span style="color: var(--text-secondary); font-size: 0.74rem;">💤 Anual - Cobro en ${mName}</span>`;
            } else if (periodicity === "Trimestral") {
                const month2 = (refM + 3 - 1) % 12 + 1;
                const month3 = (refM + 6 - 1) % 12 + 1;
                const month4 = (refM + 9 - 1) % 12 + 1;
                const mText = [refM, month2, month3, month4].map(m => monthsNamesShort[m - 1]).join(", ");
                statusText = `<span style="color: var(--text-secondary); font-size: 0.74rem;">💤 Trimestral - Meses: ${mText}</span>`;
            } else if (periodicity === "Semestral") {
                const month2 = (refM + 6 - 1) % 12 + 1;
                const mText = [refM, month2].map(m => monthsNamesShort[m - 1]).join(", ");
                statusText = `<span style="color: var(--text-secondary); font-size: 0.74rem;">💤 Semestral - Meses: ${mText}</span>`;
            }
        } else {
            statusText = `<span style="color: var(--warning-light); font-weight: 500;">⚡ Pendiente de cobro</span>`;
        }

        // Formatear periodicidad para mostrar en la columna
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

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <div style="font-weight: 600;">${fe.name}</div>
                <div style="font-size: 0.72rem; margin-top: 2px;">
                    ${statusText}
                </div>
            </td>
            <td>
                <span class="bank-tag" style="background: rgba(0, 229, 255, 0.15); color: var(--primary-light); padding: 4px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 600;">
                    ${bankName}
                </span>
            </td>
            <td style="font-weight: 500; color: var(--text-primary);">Día ${fe.day || 1}</td>
            <td>${periodicityBadge}</td>
            <td class="amount-col" style="font-weight:700; color: var(--danger-light);">${formatCurrency(fe.amount)}</td>
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

    // Configurar estado del botón de aplicación
    if (pendingToApply > 0) {
        btnApply.className = "btn-action-apply";
        btnText.textContent = `Aplicar Gastos Fijos (${pendingToApply} pendientes)`;
        btnApply.removeAttribute("disabled");
    } else {
        btnApply.className = "btn-action-apply applied";
        btnText.textContent = "Gastos Fijos Aplicados ✓";
        btnApply.setAttribute("disabled", "true");
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
            <td style="font-weight: 500;">${tx.description}</td>
            <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${bankName}</td>
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

function renderDeviationAnalysisTable() {
    // Alias de compatibilidad — redirige a la nueva función de gráficas
    renderClosureCharts();
}

// ----------------------------------------------------
// MÓDULO 3: CIERRE DE MES — GRÁFICAS POR BANCO
// ----------------------------------------------------

function renderClosureCharts() {
    const container = document.getElementById("closure-charts-container");
    const noBanks = document.getElementById("closure-no-banks");
    const badge = document.getElementById("closure-month-badge");

    if (badge) badge.textContent = formatMonthString(state.currentMonth);

    if (!container) return;

    if (state.banks.length === 0) {
        container.innerHTML = "";
        if (noBanks) noBanks.classList.remove("hidden");
        return;
    }

    if (noBanks) noBanks.classList.add("hidden");

    // Destruir gráficas anteriores
    Object.values(window._closureCharts).forEach(ch => { try { ch.destroy(); } catch(e){} });
    window._closureCharts = {};

    container.innerHTML = "";

    const [year, month] = state.currentMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthTransactions = state.transactions.filter(tx => tx.month === state.currentMonth);

    // Paleta de colores para el donut (gastos)
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

    state.banks.forEach((bank, bankIndex) => {
        // ── Datos para la gráfica de línea (evolución del saldo) ──

        // Calcular el saldo inicial del banco al inicio del mes
        // El saldo actual ya tiene todos los movimientos aplicados.
        // Reconstruimos el saldo día a día.
        const bankTxs = monthTransactions.filter(tx => tx.bankId === bank.id);

        // Mapa de delta por día (1..daysInMonth)
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

        // También contar ingresos distribuidos a este banco
        monthTransactions.forEach(tx => {
            if (tx.type === "income" && tx.distributions) {
                const dist = tx.distributions.find(d => d.bankId === bank.id);
                if (dist) {
                    const txDay = tx.date ? parseInt(tx.date.split("-")[2]) : null;
                    if (txDay) deltaByDay[txDay] += dist.amount;
                }
            }
        });

        // Calcular saldo inicial (saldo actual menos todos los deltas del mes)
        let totalDeltaMonth = Object.values(deltaByDay).reduce((a, b) => a + b, 0);
        let initialBalance = parseFloat((bank.balance - totalDeltaMonth).toFixed(2));

        // Construir array de saldos día a día
        const balanceLabels = [];
        const balanceData = [];
        let runningBalance = initialBalance;
        const today = new Date();
        const currentDay = (today.getFullYear() === year && today.getMonth() + 1 === month)
            ? today.getDate()
            : daysInMonth;

        for (let d = 1; d <= daysInMonth; d++) {
            runningBalance = parseFloat((runningBalance + deltaByDay[d]).toFixed(2));
            balanceLabels.push(d);
            balanceData.push(d <= currentDay ? runningBalance : null);
        }

        // ── Datos para el donut (gastos por concepto) ──
        const expenseTxs = bankTxs.filter(tx => tx.type === "expense");
        const expenseMap = {};
        expenseTxs.forEach(tx => {
            const key = tx.description || "Sin categoría";
            expenseMap[key] = (expenseMap[key] || 0) + tx.amount;
        });

        // Agrupar categorías pequeñas en "Otros" (si superan 8 categorías)
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
        const totalIncome = (() => {
            let inc = 0;
            // Ingresos directos a este banco (Ej: Ajustes, Extras)
            bankTxs.forEach(tx => {
                if (tx.type === "income") inc += tx.amount;
            });
            // Ingresos distribuidos (Embudos)
            monthTransactions.forEach(tx => {
                if (tx.type === "income" && tx.distributions) {
                    const dist = tx.distributions.find(d => d.bankId === bank.id);
                    if (dist) inc += dist.amount;
                }
            });
            return inc;
        })();
        const netBalance = totalIncome - totalExpenses;
        const netClass = netBalance >= 0 ? "closure-stat-positive" : "closure-stat-negative";
        const netSign = netBalance >= 0 ? "+" : "";

        // ── Generar el HTML de la card ──
        const lineCanvasId = `closure-line-${bank.id}`;
        const donutCanvasId = `closure-donut-${bank.id}`;

        const card = document.createElement("div");
        card.className = "closure-bank-card shadow-glass";
        card.innerHTML = `
            <div class="closure-bank-card-header">
                <div class="closure-bank-title">
                    <div class="closure-bank-icon">${bank.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="closure-bank-name">${bank.name}</div>
                        <div class="closure-bank-month">${formatMonthString(state.currentMonth)}</div>
                    </div>
                </div>
                <div class="closure-bank-stats">
                    <div class="closure-stat">
                        <span class="closure-stat-label">Ingresos</span>
                        <span class="closure-stat-value closure-stat-positive">+${formatCurrency(totalIncome)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Gastos</span>
                        <span class="closure-stat-value closure-stat-negative">-${formatCurrency(totalExpenses)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Neto</span>
                        <span class="closure-stat-value ${netClass}">${netSign}${formatCurrency(netBalance)}</span>
                    </div>
                    <div class="closure-stat">
                        <span class="closure-stat-label">Saldo Actual</span>
                        <span class="closure-stat-value" style="color:var(--text-primary)">${formatCurrency(bank.balance)}</span>
                    </div>
                </div>
            </div>
            <div class="closure-bank-charts">
                <!-- Gráfica de línea: evolución del saldo -->
                <div class="closure-chart-panel">
                    <div class="closure-chart-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        Evolución del Saldo (€)
                    </div>
                    <div class="closure-chart-canvas-wrap">
                        <canvas id="${lineCanvasId}"></canvas>
                    </div>
                </div>
                <!-- Gráfica de donut: en qué se ha gastado -->
                <div class="closure-chart-panel">
                    <div class="closure-chart-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
                        Desglose de Gastos
                    </div>
                    ${donutData.length === 0
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

        // ── Renderizar Chart.js: Línea de saldo ──
        const ctxLine = document.getElementById(lineCanvasId);
        if (ctxLine) {
            const lineCtx = ctxLine.getContext("2d");
            const gradLine = lineCtx.createLinearGradient(0, 0, 0, 220);
            gradLine.addColorStop(0, "rgba(0, 210, 255, 0.30)");
            gradLine.addColorStop(1, "rgba(0, 210, 255, 0.00)");

            window._closureCharts[lineCanvasId] = new Chart(lineCtx, {
                type: "line",
                data: {
                    labels: balanceLabels,
                    datasets: [{
                        label: "Saldo (€)",
                        data: balanceData,
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
                    interaction: {
                        mode: "index",
                        intersect: false
                    },
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
                                label: ctx => ctx.parsed.y !== null ? ` 💰 Saldo: ${formatCurrency(ctx.parsed.y)}` : ""
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: "rgba(255,255,255,0.04)" },
                            ticks: {
                                color: "rgba(148,163,184,0.8)",
                                font: { size: 10 },
                                maxTicksLimit: 10
                            }
                        },
                        y: {
                            grid: { color: "rgba(255,255,255,0.04)" },
                            ticks: {
                                color: "rgba(148,163,184,0.8)",
                                font: { size: 10 },
                                callback: v => formatCurrency(v)
                            }
                        }
                    }
                }
            });
        }

        // ── Renderizar Chart.js: Donut de gastos ──
        if (donutData.length > 0) {
            const ctxDonut = document.getElementById(donutCanvasId);
            if (ctxDonut) {
                window._closureCharts[donutCanvasId] = new Chart(ctxDonut.getContext("2d"), {
                    type: "doughnut",
                    data: {
                        labels: donutLabels,
                        datasets: [{
                            data: donutData,
                            backgroundColor: donutColors,
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
                                        const pct = totalExpenses > 0 ? ((ctx.parsed / totalExpenses) * 100).toFixed(1) : 0;
                                        return ` ${formatCurrency(ctx.parsed)} (${pct}%)`;
                                    }
                                }
                            }
                        }
                    }
                });

                // Leyenda personalizada
                const legendEl = document.getElementById(`closure-legend-${bank.id}`);
                if (legendEl) {
                    legendEl.innerHTML = donutLabels.map((label, i) => {
                        const pct = totalExpenses > 0 ? ((donutData[i] / totalExpenses) * 100).toFixed(1) : 0;
                        return `
                            <div class="closure-legend-item">
                                <span class="closure-legend-dot" style="background:${donutColors[i]};"></span>
                                <span class="closure-legend-label" title="${label}">${label}</span>
                                <span class="closure-legend-amount">${formatCurrency(donutData[i])}</span>
                                <span class="closure-legend-pct">${pct}%</span>
                            </div>
                        `;
                    }).join("");
                }
            }
        }
    });
}


// MÓDULO 4: RENDERIZACIÓN DE PROYECTOS (LISTA GENERAL)
function renderProjectsList() {
    const container = document.getElementById("projects-grid-container");
    container.innerHTML = "";

    if (state.projects.length === 0) {
        container.innerHTML = `<div class="alert-info" style="grid-column: 1 / -1;">No has creado ningún proyecto de simulación aún. Diseña uno con el botón superior.</div>`;
        return;
    }

    state.projects.forEach(proj => {
        // Calcular sumarios
        let totalInvested = 0;
        proj.investments.forEach(i => totalInvested += i.amount);

        let totalEarned = 0;
        proj.earnings.forEach(e => totalEarned += e.amount);

        const netProfit = totalEarned - totalInvested;
        const roi = totalInvested > 0 ? ((netProfit / totalInvested) * 100) : 0;

        let profitClass = "plus";
        if (netProfit < 0) profitClass = "minus";

        let roiClass = "plus";
        if (totalInvested === 0) roiClass = "zero";
        else if (roi < 0) roiClass = "minus";

        const card = document.createElement("div");
        card.className = "project-item-card";
        card.setAttribute("onclick", `openProjectSandbox('${proj.id}')`);
        card.innerHTML = `
            <div class="project-card-header">
                <h3>${proj.name}</h3>
                <p>${proj.description}</p>
            </div>
            <div class="project-card-footer">
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase;">Beneficio Neto</span>
                    <span class="project-badge-profit ${profitClass}">${netProfit >= 0 ? '+' : ''}${formatCurrency(netProfit)}</span>
                </div>
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase; text-align: right;">ROI</span>
                    <span class="project-badge-roi ${roiClass}">${totalInvested === 0 ? 'Sin Inversión' : roi.toFixed(1) + '%'}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
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
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
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
                    // Actualizar valor estimado si es plan de pensiones
                    if (bank.bankType === "pension") {
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
                const newAmount = parseFloat(document.getElementById("edit-fe-amount").value);
                const newDay = parseInt(document.getElementById("edit-fe-day").value);
                const newPeriodicity = document.getElementById("edit-fe-periodicity").value;
                const newChargeMonth = newPeriodicity !== "Mensual" ? document.getElementById("edit-fe-charge-month").value : null;

                if (newName && newBankId && !isNaN(newAmount) && newAmount > 0 && !isNaN(newDay) && newDay >= 1 && newDay <= 31) {
                    fe.name = newName;
                    fe.bankId = newBankId;
                    fe.amount = newAmount;
                    fe.day = newDay;
                    fe.periodicity = newPeriodicity;
                    fe.chargeMonth = newChargeMonth;
                    updatedName = newName;
                    success = true;
                }
            }
        } else if (type === "project") {
            const proj = state.projects.find(p => p.id === id);
            if (proj) {
                const newName = document.getElementById("edit-proj-name").value.trim();
                const newDesc = document.getElementById("edit-proj-desc").value.trim();
                if (newName && newDesc) {
                    proj.name = newName;
                    proj.description = newDesc;
                    updatedName = newName;
                    success = true;
                }
            }
        } else if (type === "projectInvestment") {
            const proj = state.projects.find(p => p.id === extraId);
            if (proj) {
                const inv = proj.investments.find(i => i.id === id);
                if (inv) {
                    const newDesc = document.getElementById("edit-pinv-desc").value.trim();
                    const newAmount = parseFloat(document.getElementById("edit-pinv-amount").value);
                    if (newDesc && !isNaN(newAmount) && newAmount > 0) {
                        inv.description = newDesc;
                        inv.amount = newAmount;
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
                    if (newDesc && !isNaN(newAmount) && newAmount > 0) {
                        ear.description = newDesc;
                        ear.amount = newAmount;
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

function openEditModal(type, id, extraId = null) {
    currentEditingItem = { type, id, extraId };
    const modal = document.getElementById("modal-edit");
    const titleEl = document.getElementById("modal-edit-title");
    const fieldsContainer = document.getElementById("modal-edit-fields");

    fieldsContainer.innerHTML = "";

    if (type === "bank") {
        const bank = state.banks.find(b => b.id === id);
        if (!bank) return;
        const isPension = bank.bankType === "pension";
        titleEl.textContent = isPension ? "Editar Plan de Pensiones" : "Editar Cuenta Bancaria";
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="edit-bank-name">Nombre ${isPension ? "del Plan" : "del Banco"}</label>
                <input type="text" id="edit-bank-name" value="${bank.name}" required>
            </div>
            <div class="form-group">
                <label for="edit-bank-balance">${isPension ? "Total Aportado (€)" : "Saldo Real (€)"}</label>
                <input type="number" id="edit-bank-balance" step="0.01" value="${bank.balance}" required>
            </div>
            ${isPension ? `
            <div class="form-group">
                <label for="edit-bank-estimated">Valor Estimado con Interés (€)</label>
                <input type="number" id="edit-bank-estimated" step="0.01" min="0" value="${bank.estimatedValue ?? bank.balance}">
                <small style="color:var(--text-muted); font-size:0.72rem; margin-top:4px; display:block;">Introduce el valor actual del plan según tu entidad (incluye rentabilidad). No afecta al saldo aportado.</small>
            </div>` : ""}
        `;
    } else if (type === "fixedExpense") {
        const fe = state.fixedExpenses.find(f => f.id === id);
        if (!fe) return;
        titleEl.textContent = "Editar Gasto Fijo Matriz";
        const bankOptions = state.banks.map(b => `<option value="${b.id}" ${b.id === fe.bankId ? 'selected' : ''}>${b.name}</option>`).join('');
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
                <label for="edit-fe-amount">Importe (€)</label>
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
        `;
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
                <label for="edit-pinv-amount">Importe (€)</label>
                <input type="number" id="edit-pinv-amount" step="0.01" min="0.01" value="${inv.amount}" required>
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
                <label for="edit-pear-amount">Importe (€)</label>
                <input type="number" id="edit-pear-amount" step="0.01" min="0.01" value="${ear.amount}" required>
            </div>
        `;
    }

    modal.classList.remove("hidden");
}

// ----------------------------------------------------
// 13C. MÓDULO DE RENDIMIENTO Y GRÁFICOS (ANALÍTICAS BI)
// ----------------------------------------------------
window.myMainEvolutionChart = null;
window.mySecondaryBreakdownChart = null;
let currentPerfSelectedBankId = "all";
window.currentSecondaryChartMode = "expenses"; // "expenses" o "distribution"

function initPerformanceTab() {
    const selector = document.getElementById("perf-bank-selector");
    if (!selector) return;

    selector.addEventListener("change", (e) => {
        currentPerfSelectedBankId = e.target.value;
        renderPerformanceModule();
    });

    // Eventos para el control segmentado de gráficos (Delegación de eventos de alta fiabilidad)
    document.addEventListener("click", (e) => {
        const btnExpenses = e.target.closest("#btn-perf-show-expenses");
        const btnDist = e.target.closest("#btn-perf-show-distribution");

        if (btnExpenses) {
            const bExp = document.getElementById("btn-perf-show-expenses");
            const bDist = document.getElementById("btn-perf-show-distribution");
            if (bExp) bExp.classList.add("active");
            if (bDist) bDist.classList.remove("active");
            window.currentSecondaryChartMode = "expenses";
            renderSecondaryBreakdownChart();
        }

        if (btnDist) {
            const bExp = document.getElementById("btn-perf-show-expenses");
            const bDist = document.getElementById("btn-perf-show-distribution");
            if (bExp) bExp.classList.remove("active");
            if (bDist) bDist.classList.add("active");
            window.currentSecondaryChartMode = "distribution";
            renderSecondaryBreakdownChart();
        }
    });
}

function renderPerformanceSelectorOptions() {
    const selector = document.getElementById("perf-bank-selector");
    if (!selector) return;

    const prevSelected = currentPerfSelectedBankId;
    selector.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Consolidado (Todos los Bancos)";
    selector.appendChild(optAll);

    state.banks.forEach(bank => {
        const opt = document.createElement("option");
        opt.value = bank.id;
        opt.textContent = bank.name;
        selector.appendChild(opt);
    });

    if (prevSelected === "all" || state.banks.some(b => b.id === prevSelected)) {
        selector.value = prevSelected;
        currentPerfSelectedBankId = prevSelected;
    } else {
        selector.value = "all";
        currentPerfSelectedBankId = "all";
    }
}

function getLast6MonthsList(endMonthStr) {
    const list = [endMonthStr];
    let current = endMonthStr;
    for (let i = 0; i < 5; i++) {
        current = getPreviousMonthString(current);
        list.unshift(current);
    }
    return list;
}

function getHistoricalBalancesForBank(bankId, monthsList) {
    const balances = {};
    const bank = state.banks.find(b => b.id === bankId);
    if (!bank) return monthsList.map(() => 0);

    let currentBal = bank.balance;
    balances[monthsList[5]] = currentBal;

    for (let i = 4; i >= 0; i--) {
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
    const monthsList = getLast6MonthsList(state.currentMonth);
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

    // 1. Ahorro Promedio Mensual
    let totalSavingsPeriod = 0;
    monthsList.forEach(m => {
        const txs = state.transactions.filter(tx => tx.month === m);
        let inc = 0;
        let exp = 0;

        txs.forEach(tx => {
            if (tx.type === "income") {
                if (bankId === "all") {
                    inc += tx.amount;
                } else {
                    if (tx.distributions) {
                        const d = tx.distributions.find(dist => dist.bankId === bankId);
                        if (d) inc += d.amount;
                    } else if (tx.bankId === bankId) {
                        inc += tx.amount;
                    }
                }
            } else if (tx.type === "expense") {
                if (bankId === "all" || tx.bankId === bankId) {
                    exp += tx.amount;
                }
            }
        });
        totalSavingsPeriod += (inc - exp);
    });
    const avgSavings = parseFloat((totalSavingsPeriod / monthsList.length).toFixed(2));
    
    const avgSavingsEl = document.getElementById("perf-metric-avg-savings");
    if (avgSavingsEl) {
        avgSavingsEl.textContent = formatCurrency(avgSavings);
        if (avgSavings >= 0) {
            avgSavingsEl.className = "metric-value plus";
        } else {
            avgSavingsEl.className = "metric-value minus";
        }
    }

    // 2. Crecimiento Neto (6 meses)
    const oldestBalance = balancesData[0];
    const latestBalance = balancesData[5];
    const netGrowth = parseFloat((latestBalance - oldestBalance).toFixed(2));
    
    const netGrowthEl = document.getElementById("perf-metric-net-growth");
    if (netGrowthEl) {
        netGrowthEl.textContent = (netGrowth >= 0 ? '+' : '') + formatCurrency(netGrowth);
        if (netGrowth >= 0) {
            netGrowthEl.className = "metric-value plus";
        } else {
            netGrowthEl.className = "metric-value minus";
        }
    }

    // 3. Ratio Gasto / Ingreso
    const currentMonthTxs = state.transactions.filter(tx => tx.month === state.currentMonth);
    let currentIncomes = 0;
    let currentExpenses = 0;

    currentMonthTxs.forEach(tx => {
        if (tx.type === "income") {
            if (bankId === "all") {
                currentIncomes += tx.amount;
            } else {
                if (tx.distributions) {
                    const d = tx.distributions.find(dist => dist.bankId === bankId);
                    if (d) currentIncomes += d.amount;
                } else if (tx.bankId === bankId) {
                    currentIncomes += tx.amount;
                }
            }
        } else if (tx.type === "expense") {
            if (bankId === "all" || tx.bankId === bankId) {
                currentExpenses += tx.amount;
            }
        }
    });

    const expenseRatioEl = document.getElementById("perf-metric-expense-ratio");
    if (expenseRatioEl) {
        if (currentIncomes > 0) {
            const ratio = ((currentExpenses / currentIncomes) * 100).toFixed(1);
            expenseRatioEl.textContent = ratio + "%";
            if (ratio < 40) {
                expenseRatioEl.className = "metric-value plus";
            } else if (ratio < 70) {
                expenseRatioEl.className = "metric-value";
            } else {
                expenseRatioEl.className = "metric-value minus";
            }
        } else {
            expenseRatioEl.textContent = currentExpenses > 0 ? "100.0%" : "0.0%";
            expenseRatioEl.className = "metric-value";
        }
    }

    // 4. Tasa de Ahorro Neto
    let savingsRate = 0;
    if (currentIncomes > 0) {
        savingsRate = parseFloat((((currentIncomes - currentExpenses) / currentIncomes) * 100).toFixed(1));
    } else {
        savingsRate = currentExpenses > 0 ? -100 : 0;
    }

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

    // 5. Previsión a 90 días (basado en balance actual + 3 * avgSavings)
    const forecastBalance = parseFloat((latestBalance + (avgSavings * 3)).toFixed(2));
    const forecastEl = document.getElementById("perf-metric-forecast");
    if (forecastEl) {
        forecastEl.textContent = formatCurrency(forecastBalance);
        if (forecastBalance >= latestBalance) {
            forecastEl.className = "metric-value plus";
        } else {
            forecastEl.className = "metric-value minus";
        }
    }

    // 6. Asistente Financiero Inteligente (Insights)
    renderFinancialInsights(avgSavings, netGrowth, currentExpenses / (currentIncomes || 1), savingsRate, currentIncomes, currentExpenses, latestBalance);

    // ----------------------------------------------------
    // GRÁFICO 1: EVOLUCIÓN MENSUAL (LÍNEA GRADIENTE)
    // ----------------------------------------------------
    const mainChartTitleEl = document.getElementById("perf-chart-title");
    if (mainChartTitleEl) {
        mainChartTitleEl.textContent = `Histórico de Saldos: ${selectedBankName}`;
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
                    tension: 0.4,
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
                    legend: {
                        display: false
                    },
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
                                return 'Saldo: ' + formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            font: { family: 'Inter', size: 11 }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
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

    // ----------------------------------------------------
    // GRÁFICO 2: DESGLOSE COMPLETO (DONA CON DOS MODOS)
    // ----------------------------------------------------
    renderSecondaryBreakdownChart();
}

function renderSecondaryBreakdownChart() {
    const bankId = currentPerfSelectedBankId;
    const canvasSec = document.getElementById('chart-secondary-breakdown');
    if (!canvasSec) return;

    const ctxSec = canvasSec.getContext('2d');

    if (window.mySecondaryBreakdownChart) {
        window.mySecondaryBreakdownChart.destroy();
    }

    const breakdownTitleEl = document.getElementById("perf-breakdown-title");

    if (window.currentSecondaryChartMode === "expenses") {
        if (breakdownTitleEl) {
            breakdownTitleEl.textContent = `Gastos por Concepto (${formatMonthString(state.currentMonth)})`;
        }

        const monthlyExpenses = state.transactions.filter(tx => 
            tx.month === state.currentMonth && 
            tx.type === "expense" && 
            (bankId === "all" || tx.bankId === bankId)
        );

        const expenseGroups = {};
        monthlyExpenses.forEach(tx => {
            const desc = tx.description || "Otros Gastos";
            expenseGroups[desc] = (expenseGroups[desc] || 0) + tx.amount;
        });

        const sortedExpenses = Object.entries(expenseGroups).sort((a, b) => b[1] - a[1]);

        const breakdownLabels = [];
        const breakdownValues = [];
        let otherSum = 0;

        sortedExpenses.forEach(([desc, val], idx) => {
            if (idx < 5) {
                breakdownLabels.push(desc);
                breakdownValues.push(parseFloat(val.toFixed(2)));
            } else {
                otherSum += val;
            }
        });

        if (otherSum > 0) {
            breakdownLabels.push("Otros Conceptos");
            breakdownValues.push(parseFloat(otherSum.toFixed(2)));
        }

        if (breakdownValues.length === 0) {
            window.mySecondaryBreakdownChart = new Chart(ctxSec, {
                type: 'doughnut',
                data: {
                    labels: ["Sin Gastos Registrados"],
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
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.4)',
                                font: { family: 'Inter', size: 11 }
                            }
                        },
                        tooltip: {
                            enabled: false
                        }
                    }
                }
            });
        } else {
            window.mySecondaryBreakdownChart = new Chart(ctxSec, {
                type: 'doughnut',
                data: {
                    labels: breakdownLabels,
                    datasets: [{
                        data: breakdownValues,
                        backgroundColor: [
                            '#00d2ff', // Sky Blue / Celeste
                            '#ff7300', // Orange
                            '#ffea00', // Yellow
                            '#0055ff', // Blue
                            '#ffaa33', // Golden Orange
                            '#00a2ff', // Mid Blue
                            '#ffd700'  // Gold
                        ],
                        borderWidth: 1,
                        borderColor: 'rgba(15, 23, 42, 0.6)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                font: { family: 'Inter', size: 11 }
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
                                    const pct = ((context.parsed / total) * 100).toFixed(1);
                                    return ` ${context.label}: ${formatCurrency(context.parsed)} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } else {
        // MODO "DISTRIBUTION": Mostrar reparto de saldos en bancos
        if (breakdownTitleEl) {
            breakdownTitleEl.textContent = `Distribución de Saldos por Banco`;
        }

        const activeBanks = state.banks.filter(b => {
            const val = b.bankType === "pension" ? (b.estimatedValue ?? b.balance) : b.balance;
            return val > 0;
        });
        const labels = activeBanks.map(b => b.name);
        const values = activeBanks.map(b => b.bankType === "pension" ? (b.estimatedValue ?? b.balance) : b.balance);

        if (values.length === 0) {
            window.mySecondaryBreakdownChart = new Chart(ctxSec, {
                type: 'doughnut',
                data: {
                    labels: ["Sin Saldo Disponible"],
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
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.4)',
                                font: { family: 'Inter', size: 11 }
                            }
                        },
                        tooltip: {
                            enabled: false
                        }
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
                            '#00d2ff', // Sky Blue / Celeste
                            '#ff7300', // Orange
                            '#ffea00', // Yellow
                            '#0055ff', // Blue
                            '#ffaa33', // Golden Orange
                            '#00a2ff', // Mid Blue
                            '#ffd700'  // Gold
                        ],
                        borderWidth: 1,
                        borderColor: 'rgba(15, 23, 42, 0.6)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                font: { family: 'Inter', size: 11 }
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
                                    const pct = ((context.parsed / total) * 100).toFixed(1);
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

function renderFinancialInsights(avgSavings, netGrowth, expenseRatio, savingsRate, incomes, expenses, latestBalance) {
    const container = document.getElementById("perf-insights-container");
    if (!container) return;

    container.innerHTML = "";

    // 1. Tasa de Ahorro Insight
    const cardSavings = document.createElement("div");
    if (savingsRate >= 30) {
        cardSavings.className = "insight-card success";
        cardSavings.innerHTML = `
            <div class="insight-icon success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div class="insight-content">
                <h4>¡Tasa de Ahorro Excelente! (${savingsRate}%)</h4>
                <p>Estás logrando ahorrar un gran porcentaje de tus ingresos este mes. Tienes una salud financiera de alto nivel, ideal para expandir tu Sandbox de proyectos o acelerar tus inversiones.</p>
            </div>
        `;
    } else if (savingsRate >= 10) {
        cardSavings.className = "insight-card info";
        cardSavings.innerHTML = `
            <div class="insight-icon info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            <div class="insight-content">
                <h4>Buen ritmo de Ahorro (${savingsRate}%)</h4>
                <p>Tu ahorro se encuentra en un rango saludable. Si deseas potenciarlo, intenta recortar un 5% en tus suscripciones o salidas del mes para alcanzar la regla de oro del 50/30/20.</p>
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
                <p>Estás muy cerca del punto de equilibrio. Revisa las compras variables recientes y haz un filtro de gastos no esenciales para proteger tu fondo de emergencia.</p>
            </div>
        `;
    } else {
        cardSavings.className = "insight-card warning";
        cardSavings.innerHTML = `
            <div class="insight-icon warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div class="insight-content">
                <h4>⚠️ Déficit Detectado este Mes (${savingsRate}%)</h4>
                <p>Tus gastos superan a tus ingresos este mes por un margen de ${formatCurrency(Math.abs(incomes - expenses))}. Es prioritario recortar compras no esenciales de inmediato para frenar la pérdida de capital.</p>
            </div>
        `;
    }
    container.appendChild(cardSavings);

    // 2. Previsión a 90 días Insight
    const cardForecast = document.createElement("div");
    if (avgSavings > 0) {
        cardForecast.className = "insight-card success";
        cardForecast.innerHTML = `
            <div class="insight-icon success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            </div>
            <div class="insight-content">
                <h4>Proyección Capital Favorable</h4>
                <p>Si mantienes tu ritmo de ahorro promedio mensual (+${formatCurrency(avgSavings)}), tu capital consolidado proyecta crecer a ${formatCurrency(latestBalance + (avgSavings * 3))} en los próximos 90 días. ¡Un crecimiento muy sólido!</p>
            </div>
        `;
    } else if (avgSavings < 0) {
        cardForecast.className = "insight-card warning";
        cardForecast.innerHTML = `
            <div class="insight-icon warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
            </div>
            <div class="insight-content">
                <h4>Proyección Capital de Alerta</h4>
                <p>Debido a tu saldo medio de ahorro negativo (${formatCurrency(avgSavings)}/mes), tu capital consolidado podría disminuir a ${formatCurrency(latestBalance + (avgSavings * 3))} en 90 días si no se ajustan los hábitos de gasto.</p>
            </div>
        `;
    } else {
        cardForecast.className = "insight-card info";
        cardForecast.innerHTML = `
            <div class="insight-icon info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            <div class="insight-content">
                <h4>Trayectoria Neutral de Fondos</h4>
                <p>Tu ahorro medio histórico está en el punto de equilibrio. Para consolidar un crecimiento del saldo a 90 días, es aconsejable buscar fuentes adicionales de ingresos o recortar suscripciones fijas.</p>
            </div>
        `;
    }
    container.appendChild(cardForecast);

    // 3. Mayor Gasto por Concepto
    const monthlyExpenses = state.transactions.filter(tx => 
        tx.month === state.currentMonth && 
        tx.type === "expense" && 
        (currentPerfSelectedBankId === "all" || tx.bankId === currentPerfSelectedBankId)
    );
    const expenseGroups = {};
    monthlyExpenses.forEach(tx => {
        const desc = tx.description || "Otros Gastos";
        expenseGroups[desc] = (expenseGroups[desc] || 0) + tx.amount;
    });
    const sortedExpenses = Object.entries(expenseGroups).sort((a, b) => b[1] - a[1]);

    const cardExpenses = document.createElement("div");
    if (sortedExpenses.length > 0) {
        const [topDesc, topVal] = sortedExpenses[0];
        const pctOfTotal = ((topVal / expenses) * 100).toFixed(0);
        
        cardExpenses.className = "insight-card tip";
        cardExpenses.innerHTML = `
            <div class="insight-icon tip">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div class="insight-content">
                <h4>Mayor Categoría: "${topDesc}"</h4>
                <p>El mayor gasto de este mes es en "${topDesc}" con un total de ${formatCurrency(topVal)}, representando el ${pctOfTotal}% de tus gastos totales. Si buscas recortar costes, optimizar este punto tendrá el mayor impacto inmediato.</p>
            </div>
        `;
    } else {
        cardExpenses.className = "insight-card success";
        cardExpenses.innerHTML = `
            <div class="insight-icon success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div class="insight-content">
                <h4>Cuentas del Mes Impecables</h4>
                <p>No has registrado ningún gasto variable este mes para esta cuenta de análisis. ¡Excelente autodisciplina! Tu capital permanece 100% intacto frente a gastos superfluos.</p>
            </div>
        `;
    }
    container.appendChild(cardExpenses);
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
        localStorage.setItem("finanzas_onboarding_shown", "true");
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
    const onboardingShown = localStorage.getItem("finanzas_onboarding_shown");
    if (!onboardingShown) {
        setTimeout(openOnboarding, 800);
    }
}

// ----------------------------------------------------
// 14. INICIO DE LA APLICACIÓN AL CARGAR EL DOM
// ----------------------------------------------------

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
                    <form id="contact-modal-form" action="https://formsubmit.co/expondudas@yahoo.com" method="POST" target="_blank" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <!-- Configuración adicional de FormSubmit -->
                        <input type="hidden" name="_subject" value="📬 Nuevo mensaje de Soporte - Mi Hucha">
                        <input type="hidden" name="_honey" style="display:none">
                        <input type="hidden" name="_template" value="table">
                        
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
                            ¡Gracias! Se está abriendo tu cliente de correo para enviar el mensaje a <strong>expondudas@yahoo.com</strong>.
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
            successDiv.innerHTML = '<strong>¡Procesando envío!</strong> Se ha abierto una nueva pestaña. Confirma que no eres un robot en ella y revisa tu correo <strong>expondudas@yahoo.com</strong> para activar el servicio de FormSubmit (solo la primera vez).';
            
            // Limpiar y cerrar el modal tras unos segundos
            setTimeout(() => {
                form.reset();
                closeModal();
            }, 8000);
        });
    }
}

function startApp() {
    try {
        loadState();
        initContactModal();
        
        // Check if we are on the main dashboard page
        const isDashboard = !!document.getElementById("panel-dashboard");
        
        if (isDashboard) {
            initNavigation();
            initMonthSelector();
            initBanksManager();
            initIncomeFunnel();
            initFixedExpenses();
            initVariableExpenses();
            initBudgetClosure();
            initProjectsSandbox();
            initEditModal();
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
        }

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
    if (!stored) return { totalBalance: 0, bankCount: 0 };
    try {
        const parsedState = JSON.parse(stored);
        if (parsedState && Array.isArray(parsedState.banks)) {
            const totalBalance = parsedState.banks.reduce((sum, b) => sum + (b.balance || 0), 0);
            const bankCount = parsedState.banks.length;
            return { totalBalance, bankCount };
        }
    } catch (e) {
        console.error("Error al leer estadísticas rápidas del perfil " + profileId, e);
    }
    return { totalBalance: 0, bankCount: 0 };
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
            const emptyDb = {
                banks: [],
                fixedExpenses: [],
                transactions: [],
                budgets: {},
                projects: [],
                activityLog: [],
                currentMonth: getSystemCurrentMonth()
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
        const balanceFormatted = stats.totalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
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
        const balanceFormatted = stats.totalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        
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
function switchProfile(profileId) {
    const prof = profilesState.profiles.find(p => p.id === profileId);
    if (!prof) return;
    
    profilesState.currentProfileId = profileId;
    localStorage.setItem("finanzas_current_profile_id", profileId);
    
    loadState();
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
    }).then(confirmed => {
        if (confirmed) {
            localStorage.removeItem("finanzas_db_" + profileId);
            
            profilesState.profiles = profilesState.profiles.filter(p => p.id !== profileId);
            localStorage.setItem("finanzas_profiles", JSON.stringify(profilesState.profiles));
            
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
                <div class="activity-log-desc">${act.description}</div>
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
        // ESC Key: Cerrar cualquier modal abierto (excepto pantalla de bloqueo)
        if (e.key === "Escape") {
            const modals = ["modal-edit", "modal-profiles", "modal-pin", "modal-custom-dialog", "modal-activity-log", "modal-shortcuts", "modal-contact"];
            modals.forEach(id => {
                const modalEl = document.getElementById(id);
                if (modalEl && !modalEl.classList.contains("hidden")) {
                    modalEl.classList.add("hidden");
                    logActivity(`Modal ${id} cerrado mediante atajo de teclado.`);
                }
            });
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
                    <h3>${goal.name}</h3>
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
                    <span>Cuenta: ${bank ? bank.name : 'Desconocida'}</span>
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

