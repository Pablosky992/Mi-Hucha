import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        articulos: resolve(__dirname, 'articulos.html'),
        utilidades: resolve(__dirname, 'utilidades.html'),
        calculadoraIrpf: resolve(__dirname, 'calculadora-irpf.html'),
        conversorDivisas: resolve(__dirname, 'conversor-divisas.html'),
        calculadoraMargen: resolve(__dirname, 'calculadora-margen-beneficio.html'),
        calculadoraFiniquito: resolve(__dirname, 'calculadora-finiquito.html'),
        calculadoraFinanciera: resolve(__dirname, 'calculadora-financiera.html'),
        calculadoraDepositos: resolve(__dirname, 'calculadora-depositos.html'),
        calculadoraHipoteca: resolve(__dirname, 'calculadora-hipoteca.html'),
        calculadoraRentabilidadInmobiliaria: resolve(__dirname, 'calculadora-rentabilidad-inmobiliaria.html'),
        fondoEmergencia: resolve(__dirname, 'fondo-de-emergencia.html'),
        metodoPeseta: resolve(__dirname, 'el-metodo-peseta-a-peseta.html'),
        trampaInflacion: resolve(__dirname, 'la-trampa-de-la-inflacion-del-estilo-de-vida.html'),
        metodoCincoSobres: resolve(__dirname, 'metodo-5-sobres.html'),
        reglaSetentaydosHoras: resolve(__dirname, 'regla-72-horas.html'),
        sistemaEmbudo: resolve(__dirname, 'sistema-del-embudo.html'),
        avisoLegal: resolve(__dirname, 'aviso-legal.html'),
        guiaNominaIrpf: resolve(__dirname, 'de-salario-bruto-a-neto-guia-nomina-irpf.html'),
        guiaCashback: resolve(__dirname, 'guia-cashback-ganar-dinero-compras-beruby.html'),
        cuentasRemuneradas: resolve(__dirname, 'cuentas-remuneradas-depositos-rentabilidad-ahorro.html'),
        amortizarHipoteca: resolve(__dirname, 'amortizar-hipoteca-o-invertir-guia-completa.html'),
        salirDeudas: resolve(__dirname, 'como-salir-de-deudas-metodo-bola-de-nieve-avalancha.html'),
        fondosIndexados: resolve(__dirname, 'fondos-indexados-guia-invertir-largo-plazo.html'),
        politicaCookies: resolve(__dirname, 'politica-cookies.html'),
        politicaPrivacidad: resolve(__dirname, 'politica-privacidad.html')
      }
    }
  }
});
