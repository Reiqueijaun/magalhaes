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
