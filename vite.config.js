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
        calculadoraFinanciera: resolve(__dirname, 'calculadora-financiera.html'),
        fondoEmergencia: resolve(__dirname, 'fondo-de-emergencia.html'),
        metodoPeseta: resolve(__dirname, 'el-metodo-peseta-a-peseta.html'),
        trampaInflacion: resolve(__dirname, 'la-trampa-de-la-inflacion-del-estilo-de-vida.html'),
        metodoCincoSobres: resolve(__dirname, 'metodo-5-sobres.html'),
        reglaSetentaydosHoras: resolve(__dirname, 'regla-72-horas.html'),
        sistemaEmbudo: resolve(__dirname, 'sistema-del-embudo.html'),
        avisoLegal: resolve(__dirname, 'aviso-legal.html'),
        politicaCookies: resolve(__dirname, 'politica-cookies.html'),
        politicaPrivacidad: resolve(__dirname, 'politica-privacidad.html')
      }
    }
  }
});
