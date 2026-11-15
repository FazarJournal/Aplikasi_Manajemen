import { App } from './app/shell.js';

const app = new App();
app.boot().catch((error) => {
  console.error('[Bootstrap] Aplikasi gagal dimulai.', error);
});
