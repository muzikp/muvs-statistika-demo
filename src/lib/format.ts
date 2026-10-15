export const number = (value: number, digits = 0) => value.toLocaleString('cs-CZ', { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const percent = (value: number, digits = 1) => `${number(value * 100, digits)} %`;
export const palette = ['#397ec1', '#c34e4e', '#6b86b5', '#6b86b5', '#607f91', '#477fa8', '#6b86b5', '#607f91', '#397ec1', '#c34e4e', '#626b72', '#6b86b5'];
