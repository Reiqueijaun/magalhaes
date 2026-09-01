export const formatCurrency = (value) => {
  if (!value) return '';
  let v = value.toString().replace(/\D/g, '');
  if (v === '') return '';
  const num = parseInt(v, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const parseCurrency = (formattedValue) => {
  if (!formattedValue) return 0;
  // Ex: 1.500,00 -> 1500.00
  return parseFloat(formattedValue.replace(/\./g, '').replace(',', '.'));
};

// Data de hoje no formato 'yyyy-mm-dd' respeitando o fuso local.
// (new Date().toISOString() usa UTC e, a noite no Brasil, ja aponta para o dia seguinte.)
export const todayInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

// Formata uma data vinda da API (ISO) como dd/mm/aaaa sem deslocar o dia por causa do fuso.
export const formatDateBR = (value) => {
  if (!value) return '—';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

// Diferenca em dias de calendario entre hoje e a data informada (positivo = futuro).
// Usa apenas ano/mes/dia, ignorando horario e fuso, para nao errar por algumas horas.
export const daysUntil = (value) => {
  if (!value) return 0;
  const s = String(value);
  let y, mo, d;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
  else {
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return 0;
    y = dt.getFullYear(); mo = dt.getMonth(); d = dt.getDate();
  }
  const target = new Date(y, mo, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
};

export const formatDoc = (value) => {
  if (!value) return '';
  let v = value.replace(/\D/g, '');
  if (v.length <= 11) {
    // CPF
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
  }
  return v.substring(0, 18);
};
