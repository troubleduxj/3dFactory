import './styles/style.css';
import { start } from './editor';

start().catch(err => {
  console.error(err);
  const tip = document.getElementById('loadTip');
  if (tip) tip.textContent = '启动失败：' + (err instanceof Error ? err.message : String(err));
});
